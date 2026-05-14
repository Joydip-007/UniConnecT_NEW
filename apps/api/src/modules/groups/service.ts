import type { Knex } from 'knex'
import type { UserRole } from '@uniconnect/shared'
import { db } from '../../config/db'
import { feedService } from '../feed/service'
import { badRequest, conflict, forbidden, notFound } from '../../utils/errors'
import type { CreateGroupInput, GroupListQuery, PaginationQuery, UpdateGroupInput } from './schema'

type GroupType = 'department' | 'club' | 'batch' | 'research' | 'interest' | 'other'
type GroupRole = 'owner' | 'admin' | 'moderator' | 'member'

interface AuthContext {
  userId: string
  universityId: string
  role: UserRole
}

interface CountRow {
  count: string | number
}

interface GroupRow {
  id: string
  university_id: string
  created_by: string
  name: string
  description: string
  type: GroupType
  avatar_url: string | null
  cover_url: string | null
  is_private: boolean
  member_count: number
  created_at: Date
  user_role: GroupRole | null
}

interface GroupAccessRow {
  id: string
  university_id: string
  created_by: string
  is_private: boolean
  user_role: GroupRole | null
}

interface MemberRow {
  user_id: string
  role: GroupRole
  joined_at: Date
  email: string
  user_role: UserRole
  full_name: string
  avatar_url: string | null
  headline: string | null
  department: string | null
  batch_year: string | null
}

export class GroupsService {
  async listGroups(context: AuthContext, query: GroupListQuery) {
    const countQuery = visibleGroupsBaseQuery(db, context)
    applyGroupFilters(countQuery, query)

    const [{ count }] = await countQuery.count<CountRow[]>({ count: '*' })
    const total = Number(count)

    const rows = (await groupSelectQuery(db, context.userId)
      .where('groups.university_id', context.universityId)
      .andWhere((builder) => {
        builder.where('groups.is_private', false).orWhereNotNull('current_member.user_id')
      })
      .modify((builder) => applyGroupFilters(builder, query))
      .orderBy('groups.created_at', 'desc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)) as GroupRow[]

    return { items: rows.map(toGroup), total, page: query.page, limit: query.limit }
  }

  async createGroup(context: AuthContext, input: CreateGroupInput) {
    const groupId = await db.transaction(async (trx) => {
      const [group] = await trx('groups')
        .insert({
          university_id: context.universityId,
          created_by: context.userId,
          name: input.name,
          description: input.description,
          type: input.type,
          avatar_url: input.avatar_url ?? null,
          cover_url: input.cover_url ?? null,
          is_private: input.is_private,
          member_count: 1,
        })
        .returning<{ id: string }[]>('id')

      if (!group) throw badRequest('Group could not be created', 'GROUP_CREATE_FAILED')

      await trx('group_members').insert({
        group_id: group.id,
        user_id: context.userId,
        role: 'owner',
      })

      return group.id
    })

    return this.getGroup(context, groupId)
  }

  async getGroup(context: AuthContext, groupId: string) {
    const row = await groupSelectQuery(db, context.userId)
      .where({ 'groups.id': groupId, 'groups.university_id': context.universityId })
      .first<GroupRow>()

    if (!row) throw notFound('Group not found', 'GROUP_NOT_FOUND')
    assertCanViewGroup(row)
    return toGroup(row)
  }

  async updateGroup(context: AuthContext, groupId: string, input: UpdateGroupInput) {
    const group = await assertGroupAccess(context, groupId)
    assertCanAdminGroup(group.user_role)

    await db('groups')
      .where({ id: groupId, university_id: context.universityId })
      .update({
        ...pickDefined({
          name: input.name,
          description: input.description,
          type: input.type,
          avatar_url: input.avatar_url,
          cover_url: input.cover_url,
          is_private: input.is_private,
        }),
      })

    return this.getGroup(context, groupId)
  }

  async deleteGroup(context: AuthContext, groupId: string) {
    const group = await assertGroupAccess(context, groupId)
    if (group.user_role !== 'owner') {
      throw forbidden('Only the group owner can delete this group', 'GROUP_OWNER_REQUIRED')
    }

    await db('groups').where({ id: groupId, university_id: context.universityId }).delete()
    return { deleted: true }
  }

  async joinGroup(context: AuthContext, groupId: string) {
    await assertGroupExists(groupId, context.universityId)

    try {
      await db.transaction(async (trx) => {
        await trx('group_members').insert({
          group_id: groupId,
          user_id: context.userId,
          role: 'member',
        })
        await trx('groups').where({ id: groupId, university_id: context.universityId }).increment('member_count', 1)
      })
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw conflict('Already a group member', 'ALREADY_GROUP_MEMBER')
      }
      throw error
    }

    return this.getGroup(context, groupId)
  }

  async leaveGroup(context: AuthContext, groupId: string) {
    const group = await assertGroupAccess(context, groupId)
    if (!group.user_role) throw notFound('Group membership not found', 'GROUP_MEMBERSHIP_NOT_FOUND')

    if (group.user_role === 'owner') {
      const ownerCount = await countOwners(groupId)
      if (ownerCount <= 1) {
        throw badRequest('You must transfer ownership before leaving this group', 'GROUP_TRANSFER_OWNER_REQUIRED')
      }
    }

    await db.transaction(async (trx) => {
      const deleted = await trx('group_members').where({ group_id: groupId, user_id: context.userId }).delete()
      if (deleted > 0) {
        await trx('groups')
          .where({ id: groupId, university_id: context.universityId })
          .where('member_count', '>', 0)
          .decrement('member_count', 1)
      }
    })

    return { left: true }
  }

  async listMembers(context: AuthContext, groupId: string, query: PaginationQuery) {
    await assertMemberAccess(context, groupId)

    const [{ count }] = await db('group_members').where({ group_id: groupId }).count<CountRow[]>({ count: '*' })
    const total = Number(count)

    const rows = (await memberSelectQuery(db)
      .where('group_members.group_id', groupId)
      .orderByRaw("CASE group_members.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'moderator' THEN 3 ELSE 4 END")
      .orderBy('profiles.full_name', 'asc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)) as MemberRow[]

    return { items: rows.map(toMember), total, page: query.page, limit: query.limit }
  }

  async updateMember(context: AuthContext, groupId: string, targetUserId: string, role: GroupRole) {
    const group = await assertGroupAccess(context, groupId)
    assertCanAdminGroup(group.user_role)

    const target = await getMembership(groupId, targetUserId)
    if (!target) throw notFound('Group member not found', 'GROUP_MEMBER_NOT_FOUND')

    if (role === 'owner') {
      await this.transferOwnership(context, groupId, targetUserId, group.user_role, target.role)
      return this.getMember(groupId, targetUserId)
    }

    if (target.role === 'owner') {
      throw badRequest('Use ownership transfer before changing the owner role', 'GROUP_OWNER_TRANSFER_REQUIRED')
    }

    assertCanAssignRole(group.user_role, target.role, role)

    await db('group_members').where({ group_id: groupId, user_id: targetUserId }).update({ role })
    return this.getMember(groupId, targetUserId)
  }

  async removeMember(context: AuthContext, groupId: string, targetUserId: string) {
    const group = await assertGroupAccess(context, groupId)
    assertCanAdminGroup(group.user_role)

    const target = await getMembership(groupId, targetUserId)
    if (!target) throw notFound('Group member not found', 'GROUP_MEMBER_NOT_FOUND')
    if (target.role === 'owner') throw badRequest('Cannot remove the group owner', 'GROUP_OWNER_REMOVE_FORBIDDEN')
    assertCanRemoveRole(group.user_role, target.role)

    await db.transaction(async (trx) => {
      const deleted = await trx('group_members').where({ group_id: groupId, user_id: targetUserId }).delete()
      if (deleted > 0) {
        await trx('groups')
          .where({ id: groupId, university_id: context.universityId })
          .where('member_count', '>', 0)
          .decrement('member_count', 1)
      }
    })

    return { removed: true }
  }

  async listGroupPosts(context: AuthContext, groupId: string, query: PaginationQuery) {
    const group = await assertGroupAccess(context, groupId)
    if (group.is_private && !group.user_role) {
      throw notFound('Group not found', 'GROUP_NOT_FOUND')
    }

    return feedService.listGroupPosts(context.universityId, context.userId, groupId, query)
  }

  async listMyGroups(context: AuthContext, query: PaginationQuery) {
    const [{ count }] = await db('group_members')
      .join('groups', 'groups.id', 'group_members.group_id')
      .where({ 'group_members.user_id': context.userId, 'groups.university_id': context.universityId })
      .count<CountRow[]>({ count: '*' })
    const total = Number(count)

    const rows = (await groupSelectQuery(db, context.userId)
      .join('group_members as my_groups_filter', 'my_groups_filter.group_id', 'groups.id')
      .where({
        'my_groups_filter.user_id': context.userId,
        'groups.university_id': context.universityId,
      })
      .orderBy('my_groups_filter.joined_at', 'desc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)) as GroupRow[]

    return { items: rows.map(toGroup), total, page: query.page, limit: query.limit }
  }

  private async transferOwnership(
    context: AuthContext,
    groupId: string,
    targetUserId: string,
    actorRole: GroupRole | null,
    targetRole: GroupRole,
  ) {
    if (actorRole !== 'owner') {
      throw forbidden('Only the group owner can transfer ownership', 'GROUP_OWNER_REQUIRED')
    }
    if (targetUserId === context.userId) {
      throw badRequest('You are already the group owner', 'GROUP_OWNER_ALREADY_ASSIGNED')
    }
    if (targetRole === 'owner') {
      throw badRequest('User is already the group owner', 'GROUP_OWNER_ALREADY_ASSIGNED')
    }

    await db.transaction(async (trx) => {
      await trx('group_members').where({ group_id: groupId, user_id: context.userId }).update({ role: 'admin' })
      await trx('group_members').where({ group_id: groupId, user_id: targetUserId }).update({ role: 'owner' })
    })
  }

  private async getMember(groupId: string, userId: string) {
    const row = await memberSelectQuery(db)
      .where({ 'group_members.group_id': groupId, 'group_members.user_id': userId })
      .first<MemberRow>()

    if (!row) throw notFound('Group member not found', 'GROUP_MEMBER_NOT_FOUND')
    return toMember(row)
  }
}

export const groupsService = new GroupsService()

function visibleGroupsBaseQuery(knex: Knex, context: AuthContext) {
  return knex('groups')
    .leftJoin('group_members as current_member', function joinCurrentMember() {
      this.on('current_member.group_id', '=', 'groups.id').andOn(
        'current_member.user_id',
        '=',
        knex.raw('?', [context.userId]),
      )
    })
    .where('groups.university_id', context.universityId)
    .andWhere((builder) => {
      builder.where('groups.is_private', false).orWhereNotNull('current_member.user_id')
    })
}

function applyGroupFilters(query: Knex.QueryBuilder, filters: Partial<GroupListQuery>) {
  if (filters.type) query.andWhere('groups.type', filters.type)
  if (filters.search) {
    query.andWhere((builder) => {
      builder.whereILike('groups.name', `%${filters.search}%`).orWhereILike('groups.description', `%${filters.search}%`)
    })
  }
}

function groupSelectQuery(knex: Knex, userId: string) {
  return knex('groups')
    .leftJoin('group_members as current_member', function joinCurrentMember() {
      this.on('current_member.group_id', '=', 'groups.id').andOn(
        'current_member.user_id',
        '=',
        knex.raw('?', [userId]),
      )
    })
    .select<GroupRow[]>(
      'groups.id',
      'groups.university_id',
      'groups.created_by',
      'groups.name',
      'groups.description',
      'groups.type',
      'groups.avatar_url',
      'groups.cover_url',
      'groups.is_private',
      'groups.member_count',
      'groups.created_at',
      'current_member.role as user_role',
    )
}

function memberSelectQuery(knex: Knex) {
  return knex('group_members')
    .join('users', 'users.id', 'group_members.user_id')
    .join('profiles', 'profiles.user_id', 'users.id')
    .select<MemberRow[]>(
      'group_members.user_id',
      'group_members.role',
      'group_members.joined_at',
      'users.email',
      'users.role as user_role',
      'profiles.full_name',
      'profiles.avatar_url',
      'profiles.headline',
      'profiles.department',
      'profiles.batch_year',
    )
}

async function assertGroupExists(groupId: string, universityId: string) {
  const group = await db('groups').where({ id: groupId, university_id: universityId }).first()
  if (!group) throw notFound('Group not found', 'GROUP_NOT_FOUND')
}

async function assertGroupAccess(context: AuthContext, groupId: string) {
  const group = await db('groups')
    .leftJoin('group_members as current_member', function joinCurrentMember() {
      this.on('current_member.group_id', '=', 'groups.id').andOn(
        'current_member.user_id',
        '=',
        db.raw('?', [context.userId]),
      )
    })
    .select<GroupAccessRow[]>(
      'groups.id',
      'groups.university_id',
      'groups.created_by',
      'groups.is_private',
      'current_member.role as user_role',
    )
    .where({ 'groups.id': groupId, 'groups.university_id': context.universityId })
    .first()

  if (!group) throw notFound('Group not found', 'GROUP_NOT_FOUND')
  return group
}

async function assertMemberAccess(context: AuthContext, groupId: string) {
  const group = await assertGroupAccess(context, groupId)
  if (!group.user_role) throw forbidden('You must be a group member', 'GROUP_MEMBER_REQUIRED')
  return group
}

async function getMembership(groupId: string, userId: string) {
  return db('group_members').select<{ role: GroupRole }[]>('role').where({ group_id: groupId, user_id: userId }).first()
}

async function countOwners(groupId: string) {
  const [{ count }] = await db('group_members')
    .where({ group_id: groupId, role: 'owner' })
    .count<CountRow[]>({ count: '*' })
  return Number(count)
}

function assertCanViewGroup(group: Pick<GroupRow, 'is_private' | 'user_role'>) {
  if (!group.is_private || group.user_role) return
  throw notFound('Group not found', 'GROUP_NOT_FOUND')
}

function assertCanAdminGroup(role: GroupRole | null) {
  if (role === 'owner' || role === 'admin') return
  throw forbidden('You do not have permission to manage this group', 'GROUP_ADMIN_REQUIRED')
}

function assertCanAssignRole(actorRole: GroupRole | null, targetRole: GroupRole, nextRole: GroupRole) {
  if (actorRole === 'owner') return
  if (actorRole === 'admin' && isBelowAdmin(targetRole) && isBelowAdmin(nextRole)) return
  throw forbidden('You do not have permission to assign this role', 'GROUP_ROLE_FORBIDDEN')
}

function assertCanRemoveRole(actorRole: GroupRole | null, targetRole: GroupRole) {
  if (actorRole === 'owner') return
  if (actorRole === 'admin' && isBelowAdmin(targetRole)) return
  throw forbidden('You do not have permission to remove this member', 'GROUP_ROLE_FORBIDDEN')
}

function isBelowAdmin(role: GroupRole) {
  return role === 'moderator' || role === 'member'
}

function toGroup(row: GroupRow) {
  return {
    id: row.id,
    universityId: row.university_id,
    createdBy: row.created_by,
    name: row.name,
    description: row.description,
    type: row.type,
    avatarUrl: row.avatar_url,
    coverUrl: row.cover_url,
    isPrivate: row.is_private,
    memberCount: row.member_count,
    createdAt: row.created_at,
    userRole: row.user_role,
    isMember: Boolean(row.user_role),
  }
}

function toMember(row: MemberRow) {
  return {
    id: row.user_id,
    userId: row.user_id,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    headline: row.headline,
    department: row.department,
    batchYear: row.batch_year,
    role: row.role,
    joinedAt: row.joined_at,
    user: {
      id: row.user_id,
      email: row.email,
      role: row.user_role,
      fullName: row.full_name,
      avatarUrl: row.avatar_url,
      headline: row.headline,
      department: row.department,
      batchYear: row.batch_year,
    },
  }
}

function pickDefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined))
}

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}
