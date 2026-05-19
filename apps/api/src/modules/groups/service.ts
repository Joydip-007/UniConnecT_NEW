import type { Knex } from 'knex'
import type { UserRole } from '@uniconnect/shared'
import { db } from '../../config/db'
import { feedService } from '../feed/service'
import { notificationsService } from '../notifications/service'
import { badRequest, conflict, forbidden, notFound } from '../../utils/errors'
import type {
  AllowedRole,
  CreateGroupInput,
  GroupListQuery,
  MembersQuery,
  PaginationQuery,
  UpdateGroupInput,
} from './schema'

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
  allowed_role: AllowedRole | null
  is_system: boolean
  department: string | null
  user_role: GroupRole | null
}

interface GroupAccessRow {
  id: string
  university_id: string
  created_by: string
  is_private: boolean
  is_system: boolean
  allowed_role: AllowedRole | null
  department: string | null
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
    const allowedRole = resolveAllowedRoleOnCreate(context.role, input.allowed_role)

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
          allowed_role: allowedRole,
          is_system: false,
          department: null,
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

    if (group.is_system) {
      const restricted = ['name', 'type', 'allowed_role'] as const
      for (const key of restricted) {
        if (input[key] !== undefined) {
          throw forbidden(
            'System groups cannot rename or change their type or role restriction',
            'GROUP_SYSTEM_EDIT_FORBIDDEN',
          )
        }
      }
      if (context.role !== 'admin') {
        throw forbidden('Only platform admins can edit system groups', 'GROUP_SYSTEM_EDIT_FORBIDDEN')
      }
    }

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
          allowed_role: input.allowed_role,
        }),
      })

    return this.getGroup(context, groupId)
  }

  async deleteGroup(context: AuthContext, groupId: string) {
    const group = await assertGroupAccess(context, groupId)
    if (group.is_system) {
      throw forbidden('System groups cannot be deleted', 'GROUP_SYSTEM_DELETE_FORBIDDEN')
    }
    if (group.user_role !== 'owner') {
      throw forbidden('Only the group owner can delete this group', 'GROUP_OWNER_REQUIRED')
    }

    await db('groups').where({ id: groupId, university_id: context.universityId }).delete()
    return { deleted: true }
  }

  async joinGroup(context: AuthContext, groupId: string) {
    const access = await assertGroupAccess(context, groupId)
    assertCanJoinGroup(access, context.role)

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

  async joinGroupViaInvite(context: AuthContext, groupId: string) {
    const access = await assertGroupAccess(context, groupId)
    if (access.is_system) {
      throw forbidden('System groups cannot be joined via invite', 'GROUP_SYSTEM_JOIN_FORBIDDEN')
    }
    if (access.allowed_role && context.role !== access.allowed_role) {
      throw badRequest(
        `This group only allows ${access.allowed_role}s`,
        'GROUP_ROLE_NOT_ALLOWED',
      )
    }
    if (access.user_role) {
      return this.getGroup(context, groupId)
    }

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
        // Race; treat as already joined.
        return this.getGroup(context, groupId)
      }
      throw error
    }

    return this.getGroup(context, groupId)
  }

  async leaveGroup(context: AuthContext, groupId: string) {
    const group = await assertGroupAccess(context, groupId)
    if (group.is_system) {
      throw forbidden(
        'You cannot leave an auto-managed group; this membership is controlled by your role',
        'GROUP_SYSTEM_LEAVE_FORBIDDEN',
      )
    }
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

  async listMembers(context: AuthContext, groupId: string, query: MembersQuery) {
    await assertMemberAccess(context, groupId)

    const countQuery = db('group_members')
      .join('users', 'users.id', 'group_members.user_id')
      .join('profiles', 'profiles.user_id', 'users.id')
      .where({ 'group_members.group_id': groupId })
    if (query.search) {
      countQuery.andWhereILike('profiles.full_name', `%${query.search}%`)
    }
    const [{ count }] = await countQuery.count<CountRow[]>({ count: '*' })
    const total = Number(count)

    const rows = (await memberSelectQuery(db)
      .where('group_members.group_id', groupId)
      .modify((builder) => {
        if (query.search) builder.andWhereILike('profiles.full_name', `%${query.search}%`)
      })
      .orderByRaw("CASE group_members.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'moderator' THEN 3 ELSE 4 END")
      .orderBy('profiles.full_name', 'asc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)) as MemberRow[]

    return { items: rows.map(toMember), total, page: query.page, limit: query.limit }
  }

  async updateMember(context: AuthContext, groupId: string, targetUserId: string, role: GroupRole) {
    const group = await assertGroupAccess(context, groupId)
    if (group.is_system) {
      throw forbidden('System group membership cannot be modified', 'GROUP_SYSTEM_EDIT_FORBIDDEN')
    }
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
    if (group.is_system) {
      throw forbidden('System group membership cannot be modified', 'GROUP_SYSTEM_EDIT_FORBIDDEN')
    }
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

  async listGroupEvents(context: AuthContext, groupId: string, query: PaginationQuery) {
    const group = await assertGroupAccess(context, groupId)
    if (group.is_private && !group.user_role) {
      throw notFound('Group not found', 'GROUP_NOT_FOUND')
    }

    const events = (await db('events')
      .join('users', 'users.id', 'events.organizer_id')
      .join('profiles', 'profiles.user_id', 'users.id')
      .select(
        'events.id',
        'events.title',
        'events.description',
        'events.location',
        'events.is_online',
        'events.online_link',
        'events.cover_url',
        'events.starts_at',
        'events.ends_at',
        'events.capacity',
        'events.type',
        'events.is_published',
        'events.organizer_id',
        'events.created_at',
        'profiles.full_name as organizer_full_name',
        'profiles.avatar_url as organizer_avatar_url',
        db.raw(
          "(SELECT COUNT(*)::int FROM event_rsvps WHERE event_rsvps.event_id = events.id AND status = 'going') AS going_count",
        ),
        db.raw('(SELECT status FROM event_rsvps WHERE event_id = events.id AND user_id = ? LIMIT 1) AS own_rsvp', [
          context.userId,
        ]),
      )
      .where({ 'events.group_id': groupId, 'events.university_id': context.universityId })
      .andWhere((builder) => {
        builder.where('events.is_published', true).orWhere('events.organizer_id', context.userId)
      })) as EventListRow[]

    const posts = (await db('posts')
      .join('users', 'users.id', 'posts.author_id')
      .join('profiles', 'profiles.user_id', 'users.id')
      .select(
        'posts.id',
        'posts.content',
        'posts.media_urls',
        'posts.created_at',
        'posts.author_id',
        'profiles.full_name as author_full_name',
        'profiles.avatar_url as author_avatar_url',
      )
      .where({
        'posts.group_id': groupId,
        'posts.university_id': context.universityId,
        'posts.type': 'event_promo',
      })) as EventPromoPostRow[]

    const items = [
      ...events.map((row) => ({
        kind: 'event' as const,
        createdAt: row.created_at,
        startsAt: row.starts_at,
        data: toMiniEvent(row),
      })),
      ...posts.map((row) => ({
        kind: 'post' as const,
        createdAt: row.created_at,
        startsAt: null,
        data: toMiniPost(row),
      })),
    ]

    items.sort((a, b) => sortEventsDesc(a, b))

    const offset = (query.page - 1) * query.limit
    const paged = items.slice(offset, offset + query.limit)
    return {
      items: paged.map((entry) => ({ kind: entry.kind, ...entry.data })),
      total: items.length,
      page: query.page,
      limit: query.limit,
    }
  }

  async listGroupCollaborations(context: AuthContext, groupId: string, query: PaginationQuery) {
    const group = await assertGroupAccess(context, groupId)
    if (group.is_private && !group.user_role) {
      throw notFound('Group not found', 'GROUP_NOT_FOUND')
    }

    const memberIds = (await db('group_members')
      .where({ group_id: groupId })
      .pluck<string[]>('user_id'))

    const baseQuery = db('jobs')
      .join('users', 'users.id', 'jobs.posted_by')
      .join('profiles', 'profiles.user_id', 'users.id')
      .select(
        'jobs.id',
        'jobs.title',
        'jobs.company',
        'jobs.location',
        'jobs.type',
        'jobs.description',
        'jobs.deadline',
        'jobs.application_url',
        'jobs.created_at',
        'jobs.posted_by',
        'profiles.full_name as poster_full_name',
        'profiles.avatar_url as poster_avatar_url',
        'profiles.department as poster_department',
      )
      .where({ 'jobs.university_id': context.universityId, 'jobs.is_active': true })
      .andWhere('jobs.deadline', '>=', db.fn.now())

    if (group.allowed_role === 'faculty' && group.department) {
      baseQuery.andWhere('profiles.department', group.department)
    } else if (memberIds.length > 0) {
      baseQuery.whereIn('jobs.posted_by', memberIds)
    } else {
      baseQuery.whereRaw('1 = 0')
    }

    const total = (await baseQuery
      .clone()
      .clearSelect()
      .clearOrder()
      .count<CountRow[]>({ count: 'jobs.id' })).reduce((sum, row) => sum + Number(row.count), 0)

    const rows = (await baseQuery
      .orderBy('jobs.deadline', 'asc')
      .orderBy('jobs.created_at', 'desc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)) as CollabJobRow[]

    return {
      items: rows.map((row) => ({ kind: 'job' as const, ...toMiniJob(row) })),
      total,
      page: query.page,
      limit: query.limit,
    }
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

  async inviteToGroup(context: AuthContext, groupId: string, targetUserId: string) {
    const group = await assertGroupAccess(context, groupId)
    assertCanAdminGroup(group.user_role)
    if (group.is_system) {
      throw forbidden('System groups cannot be invited to', 'GROUP_SYSTEM_INVITE_FORBIDDEN')
    }
    if (targetUserId === context.userId) {
      throw badRequest('You cannot invite yourself', 'GROUP_INVITE_SELF_FORBIDDEN')
    }

    const target = await db('users')
      .where({ id: targetUserId, university_id: context.universityId })
      .select<{ id: string; role: UserRole }[]>('id', 'role')
      .first()

    if (!target) throw notFound('User not found', 'USER_NOT_FOUND')
    if (group.allowed_role && target.role !== group.allowed_role) {
      throw badRequest(
        `This group only allows ${group.allowed_role}s`,
        'GROUP_ROLE_NOT_ALLOWED',
      )
    }

    const existingMembership = await db('group_members')
      .where({ group_id: groupId, user_id: targetUserId })
      .first()
    if (existingMembership) {
      throw conflict('User is already a group member', 'ALREADY_GROUP_MEMBER')
    }

    const pendingInvite = await db('notifications')
      .where({
        user_id: targetUserId,
        type: 'group_invite',
        reference_id: groupId,
        reference_type: 'group',
        is_read: false,
      })
      .first()
    if (pendingInvite) {
      throw conflict('A pending invite already exists', 'GROUP_INVITE_DUPLICATE')
    }

    const inviterName = await notificationsService.getActorName(context.userId)
    const groupRow = await db('groups')
      .where({ id: groupId })
      .select<{ name: string }[]>('name')
      .first()
    const groupName = groupRow?.name ?? 'a group'

    const notification = await notificationsService.createNotification({
      userId: targetUserId,
      type: 'group_invite',
      actorId: context.userId,
      referenceId: groupId,
      referenceType: 'group',
      content: `${inviterName} invited you to join "${groupName}"`,
    })

    return { invited: true, notificationId: notification.id }
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

// ── Helper types for events/jobs sub-queries ─────────────────────────────────

interface EventListRow {
  id: string
  title: string
  description: string
  location: string
  is_online: boolean
  online_link: string | null
  cover_url: string | null
  starts_at: Date
  ends_at: Date | null
  capacity: number | null
  type: string
  is_published: boolean
  organizer_id: string
  created_at: Date
  organizer_full_name: string
  organizer_avatar_url: string | null
  going_count: string | number
  own_rsvp: 'going' | 'maybe' | 'not_going' | null
}

interface EventPromoPostRow {
  id: string
  content: string
  media_urls: string[] | null
  created_at: Date
  author_id: string
  author_full_name: string
  author_avatar_url: string | null
}

interface CollabJobRow {
  id: string
  title: string
  company: string
  location: string
  type: 'full_time' | 'part_time' | 'internship' | 'remote' | 'contract'
  description: string
  deadline: Date
  application_url: string | null
  created_at: Date
  posted_by: string
  poster_full_name: string
  poster_avatar_url: string | null
  poster_department: string | null
}

// ── Query builders ───────────────────────────────────────────────────────────

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
      'groups.allowed_role',
      'groups.is_system',
      'groups.department',
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
      'groups.is_system',
      'groups.allowed_role',
      'groups.department',
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

function assertCanJoinGroup(group: GroupAccessRow, userRole: UserRole) {
  if (group.is_system) {
    throw forbidden(
      'You cannot join an auto-managed group; membership is controlled by your role',
      'GROUP_SYSTEM_JOIN_FORBIDDEN',
    )
  }
  if (group.is_private && !group.user_role) {
    // Stay consistent with previous behaviour: private groups are joinable only via invite.
    throw notFound('Group not found', 'GROUP_NOT_FOUND')
  }
  if (group.allowed_role && userRole !== group.allowed_role) {
    throw badRequest(
      `This group only allows ${group.allowed_role}s`,
      'GROUP_ROLE_NOT_ALLOWED',
    )
  }
}

function resolveAllowedRoleOnCreate(creatorRole: UserRole, requested: AllowedRole | null | undefined): AllowedRole | null {
  if (creatorRole === 'student') return 'student'
  return requested ?? null
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
    allowedRole: row.allowed_role,
    isSystem: row.is_system,
    department: row.department,
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

function toMiniEvent(row: EventListRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    location: row.location,
    isOnline: row.is_online,
    onlineLink: row.online_link,
    coverUrl: row.cover_url,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    startDate: row.starts_at,
    endDate: row.ends_at,
    capacity: row.capacity,
    type: row.type,
    organizer: {
      id: row.organizer_id,
      fullName: row.organizer_full_name,
      avatarUrl: row.organizer_avatar_url,
    },
    rsvpCounts: { going: Number(row.going_count), maybe: 0 },
    myRsvp: row.own_rsvp,
    previewAttendees: [],
    totalAttendees: Number(row.going_count),
    createdAt: row.created_at,
  }
}

function toMiniPost(row: EventPromoPostRow) {
  return {
    id: row.id,
    content: row.content,
    mediaUrls: row.media_urls ?? [],
    createdAt: row.created_at,
    author: {
      id: row.author_id,
      fullName: row.author_full_name,
      avatarUrl: row.author_avatar_url,
    },
  }
}

function toMiniJob(row: CollabJobRow) {
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    location: row.location,
    type: row.type,
    description: row.description,
    deadline: row.deadline,
    applicationUrl: row.application_url,
    createdAt: row.created_at,
    postedBy: {
      id: row.posted_by,
      fullName: row.poster_full_name,
      avatarUrl: row.poster_avatar_url,
      department: row.poster_department,
    },
  }
}

function sortEventsDesc(
  a: { kind: 'event' | 'post'; startsAt: Date | null; createdAt: Date },
  b: { kind: 'event' | 'post'; startsAt: Date | null; createdAt: Date },
): number {
  const aTime = a.kind === 'event' && a.startsAt ? a.startsAt.getTime() : a.createdAt.getTime()
  const bTime = b.kind === 'event' && b.startsAt ? b.startsAt.getTime() : b.createdAt.getTime()
  return bTime - aTime
}

function pickDefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined))
}

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}
