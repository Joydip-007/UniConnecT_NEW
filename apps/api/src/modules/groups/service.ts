import type { Knex } from 'knex'
import type { UserRole } from '@uniconnect/shared'
import { db } from '../../config/db'
import { feedService } from '../feed/service'
import { notificationsService } from '../notifications/service'
import { notificationQueue } from '../../queues/notification.queue'
import { badRequest, conflict, forbidden, notFound } from '../../utils/errors'
import type {
  AllowedRole,
  CreateGroupInput,
  CreateResourceInput,
  CreateStudySessionInput,
  GroupListQuery,
  MembersQuery,
  PaginationQuery,
  ResourceListQuery,
  RsvpStudySessionInput,
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
  pinned_text: string | null
  pinned_at: Date | null
  pinned_by: string | null
  rules_md: string | null
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

interface JoinRequestRow {
  id: string
  group_id: string
  user_id: string
  university_id: string
  message: string | null
  status: 'pending' | 'approved' | 'declined'
  reviewed_by: string | null
  reviewed_at: Date | null
  created_at: Date
  requester_full_name: string | null
  requester_avatar_url: string | null
  requester_department: string | null
  requester_user_role: string | null
}

interface ResourceRow {
  id: string
  group_id: string
  university_id: string
  uploaded_by: string | null
  title: string
  url: string
  category: string
  description: string | null
  click_count: number
  created_at: Date
  uploader_full_name: string | null
  uploader_avatar_url: string | null
}

interface StudySessionRow {
  id: string
  group_id: string
  university_id: string
  created_by: string | null
  title: string
  description: string | null
  location: string | null
  is_online: boolean
  online_link: string | null
  starts_at: Date
  ends_at: Date | null
  capacity: number | null
  rsvp_count: number
  created_at: Date
  creator_full_name: string | null
  creator_avatar_url: string | null
  own_rsvp: 'going' | 'not_going' | null
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
      .select('groups.rules_md')
      .where({ 'groups.id': groupId, 'groups.university_id': context.universityId })
      .first<GroupRow>()

    if (!row) throw notFound('Group not found', 'GROUP_NOT_FOUND')
    assertCanViewGroup(row)
    return { ...toGroup(row), rulesMd: row.rules_md }
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

  async joinOrRequest(context: AuthContext, groupId: string, message?: string | null) {
    const access = await assertGroupAccess(context, groupId)

    // System groups: forbidden
    if (access.is_system) {
      throw forbidden('You cannot join a system group', 'GROUP_SYSTEM_JOIN_FORBIDDEN')
    }

    // Role restriction check
    if (access.allowed_role && context.role !== access.allowed_role) {
      throw badRequest(`This group only allows ${access.allowed_role}s`, 'GROUP_ROLE_NOT_ALLOWED')
    }

    // Already a member
    if (access.user_role) {
      throw conflict('Already a group member', 'ALREADY_GROUP_MEMBER')
    }

    // Private group → create join request
    if (access.is_private) {
      try {
        const [request] = await db('group_join_requests')
          .insert({
            group_id: groupId,
            user_id: context.userId,
            university_id: context.universityId,
            message: message ?? null,
            status: 'pending',
          })
          .returning<{ id: string }[]>('id')

        // Notify all owners + admins
        const admins = await db('group_members')
          .where({ group_id: groupId })
          .whereIn('role', ['owner', 'admin'])
          .select<{ user_id: string }[]>('user_id')

        for (const admin of admins) {
          await notificationQueue.add({
            universityId: context.universityId,
            userId: admin.user_id,
            type: 'group_join_request',
            actorId: context.userId,
            referenceId: groupId,
            referenceType: 'group',
            content: 'Someone requested to join your group',
            payload: {},
          })
        }

        return { kind: 'requested' as const, requestId: request.id }
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw conflict('Join request already pending', 'JOIN_REQUEST_ALREADY_PENDING')
        }
        throw error
      }
    }

    // Public group → direct join
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

    const group = await this.getGroup(context, groupId)
    return { kind: 'joined' as const, group }
  }

  async joinGroup(context: AuthContext, groupId: string) {
    const result = await this.joinOrRequest(context, groupId, null)
    return result
  }

  async listJoinRequests(context: AuthContext, groupId: string, query: PaginationQuery) {
    await assertGroupAdminAccess(context, groupId)

    const [{ count }] = await db('group_join_requests')
      .where({ group_id: groupId, status: 'pending' })
      .count<{ count: string }[]>({ count: '*' })

    const rows = await db('group_join_requests')
      .where({ group_id: groupId, status: 'pending' })
      .leftJoin('profiles as rp', 'rp.user_id', 'group_join_requests.user_id')
      .leftJoin('users as ru', 'ru.id', 'group_join_requests.user_id')
      .select<JoinRequestRow[]>(
        'group_join_requests.id',
        'group_join_requests.group_id',
        'group_join_requests.user_id',
        'group_join_requests.university_id',
        'group_join_requests.message',
        'group_join_requests.status',
        'group_join_requests.reviewed_by',
        'group_join_requests.reviewed_at',
        'group_join_requests.created_at',
        'rp.full_name as requester_full_name',
        'rp.avatar_url as requester_avatar_url',
        'rp.department as requester_department',
        'ru.role as requester_user_role',
      )
      .orderBy('group_join_requests.created_at', 'asc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)

    return {
      items: rows.map(toJoinRequest),
      total: Number(count),
      page: query.page,
      limit: query.limit,
    }
  }

  async reviewJoinRequest(
    context: AuthContext,
    groupId: string,
    requestId: string,
    action: 'approve' | 'decline',
  ) {
    await assertGroupAdminAccess(context, groupId)

    const request = await db('group_join_requests')
      .where({ id: requestId, group_id: groupId, status: 'pending' })
      .first<{ id: string; user_id: string; university_id: string } | undefined>()

    if (!request) throw notFound('Join request not found', 'JOIN_REQUEST_NOT_FOUND')

    if (action === 'approve') {
      await db.transaction(async (trx) => {
        await trx('group_members').insert({
          group_id: groupId,
          user_id: request.user_id,
          role: 'member',
        })
        await trx('groups').where({ id: groupId }).increment('member_count', 1)
        await trx('group_join_requests').where({ id: requestId }).update({
          status: 'approved',
          reviewed_by: context.userId,
          reviewed_at: new Date(),
          updated_at: new Date(),
        })
      })

      await notificationQueue.add({
        universityId: context.universityId,
        userId: request.user_id,
        type: 'group_join_approved',
        actorId: context.userId,
        referenceId: groupId,
        referenceType: 'group',
        content: 'Your request to join the group was approved',
        payload: {},
      })

      return { action: 'approved' }
    }

    // decline
    await db('group_join_requests').where({ id: requestId }).update({
      status: 'declined',
      reviewed_by: context.userId,
      reviewed_at: new Date(),
      updated_at: new Date(),
    })

    await notificationQueue.add({
      universityId: context.universityId,
      userId: request.user_id,
      type: 'group_join_declined',
      actorId: context.userId,
      referenceId: groupId,
      referenceType: 'group',
      content: 'Your request to join the group was declined',
      payload: {},
    })

    return { action: 'declined' }
  }

  async cancelJoinRequest(context: AuthContext, groupId: string) {
    const deleted = await db('group_join_requests')
      .where({ group_id: groupId, user_id: context.userId, status: 'pending' })
      .delete()

    if (deleted === 0) throw notFound('No pending request found', 'JOIN_REQUEST_NOT_FOUND')

    return { cancelled: true }
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
      countQuery.where((builder) => {
        builder
          .whereILike('profiles.full_name', `%${query.search}%`)
          .orWhereILike('profiles.department', `%${query.search}%`)
      })
    }
    if (query.role) {
      countQuery.andWhere('group_members.role', query.role)
    }
    const [{ count }] = await countQuery.count<CountRow[]>({ count: '*' })
    const total = Number(count)

    const rows = (await memberSelectQuery(db)
      .where('group_members.group_id', groupId)
      .modify((builder) => {
        if (query.search) {
          builder.where((q) => {
            q.whereILike('profiles.full_name', `%${query.search}%`)
             .orWhereILike('profiles.department', `%${query.search}%`)
          })
        }
        if (query.role) {
          builder.andWhere('group_members.role', query.role)
        }
      })
      .orderByRaw("CASE group_members.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'moderator' THEN 3 ELSE 4 END")
      .orderBy('profiles.full_name', 'asc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)) as MemberRow[]

    return { items: rows.map(toMember), total, page: query.page, limit: query.limit }
  }

  async getGroupStats(context: AuthContext, groupId: string) {
    const access = await assertGroupAccess(context, groupId)
    if (!access.user_role || !['owner', 'admin', 'moderator'].includes(access.user_role)) {
      throw forbidden('Only group admin or moderator can view stats', 'GROUP_ROLE_FORBIDDEN')
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const [
      [newMembersRow],
      [postsRow],
      [activeContributorsRow],
      [pendingRow],
      [upcomingRow],
    ] = await Promise.all([
      db('group_members')
        .where({ group_id: groupId })
        .andWhere('joined_at', '>=', sevenDaysAgo)
        .count<{ count: string }[]>({ count: '*' }),

      db('posts')
        .where({ group_id: groupId })
        .andWhere('created_at', '>=', sevenDaysAgo)
        .count<{ count: string }[]>({ count: '*' }),

      db('posts')
        .where({ group_id: groupId })
        .andWhere('created_at', '>=', sevenDaysAgo)
        .countDistinct<{ count: string }[]>({ count: 'author_id' }),

      db('group_join_requests')
        .where({ group_id: groupId, status: 'pending' })
        .count<{ count: string }[]>({ count: '*' }),

      db('group_study_sessions')
        .where({ group_id: groupId })
        .andWhere('starts_at', '>', new Date())
        .count<{ count: string }[]>({ count: '*' }),
    ])

    return {
      newMembersThisWeek: Number(newMembersRow.count),
      postsThisWeek: Number(postsRow.count),
      activeContributors: Number(activeContributorsRow.count),
      pendingJoinRequests: Number(pendingRow.count),
      upcomingStudySessions: Number(upcomingRow.count),
    }
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

  async listResources(context: AuthContext, groupId: string, query: ResourceListQuery) {
    await assertMemberAccess(context, groupId)

    const base = db('group_resources')
      .where({ 'group_resources.group_id': groupId, 'group_resources.university_id': context.universityId })
      .leftJoin('profiles as up', 'up.user_id', 'group_resources.uploaded_by')
      .modify((b) => {
        if (query.category) b.andWhere('group_resources.category', query.category)
      })

    const [{ count }] = await db('group_resources')
      .where({ group_id: groupId, university_id: context.universityId })
      .modify((b) => { if (query.category) b.andWhere('category', query.category) })
      .count<{ count: string }[]>({ count: '*' })

    const rows = await base
      .select<ResourceRow[]>(
        'group_resources.id',
        'group_resources.group_id',
        'group_resources.university_id',
        'group_resources.uploaded_by',
        'group_resources.title',
        'group_resources.url',
        'group_resources.category',
        'group_resources.description',
        'group_resources.click_count',
        'group_resources.created_at',
        'up.full_name as uploader_full_name',
        'up.avatar_url as uploader_avatar_url',
      )
      .orderBy('group_resources.created_at', 'desc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)

    return {
      items: rows.map(toResource),
      total: Number(count),
      page: query.page,
      limit: query.limit,
    }
  }

  async createResource(context: AuthContext, groupId: string, input: CreateResourceInput) {
    await assertMemberAccess(context, groupId)

    const [row] = await db('group_resources')
      .insert({
        group_id: groupId,
        university_id: context.universityId,
        uploaded_by: context.userId,
        title: input.title,
        url: input.url,
        category: input.category,
        description: input.description ?? null,
      })
      .returning('*')

    return toResource({
      ...row,
      uploader_full_name: null,
      uploader_avatar_url: null,
    } as ResourceRow)
  }

  async deleteResource(context: AuthContext, groupId: string, resourceId: string) {
    await assertMemberAccess(context, groupId)

    const resource = await db('group_resources')
      .where({ id: resourceId, group_id: groupId })
      .select<{ id: string; uploaded_by: string | null }>('id', 'uploaded_by')
      .first()

    if (!resource) throw notFound('Resource not found', 'RESOURCE_NOT_FOUND')

    // Check permission: uploader OR owner/admin/moderator
    const membership = await db('group_members')
      .where({ group_id: groupId, user_id: context.userId })
      .select<{ role: string }>('role')
      .first()

    const isPrivileged = membership && ['owner', 'admin', 'moderator'].includes(membership.role)
    const isUploader = resource.uploaded_by === context.userId

    if (!isUploader && !isPrivileged) {
      throw forbidden('You can only delete your own resources', 'RESOURCE_DELETE_FORBIDDEN')
    }

    await db('group_resources').where({ id: resourceId }).delete()
    return { deleted: true }
  }

  async trackResource(context: AuthContext, groupId: string, resourceId: string) {
    await assertMemberAccess(context, groupId)

    const updated = await db('group_resources')
      .where({ id: resourceId, group_id: groupId })
      .increment('click_count', 1)

    if (updated === 0) throw notFound('Resource not found', 'RESOURCE_NOT_FOUND')

    const row = await db('group_resources')
      .where({ id: resourceId })
      .select<{ click_count: number }>('click_count')
      .first()

    return { clickCount: row?.click_count ?? 0 }
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

  async setPinned(context: AuthContext, groupId: string, text: string | null) {
    const access = await assertGroupAccess(context, groupId)
    if (!access.user_role || !['owner', 'admin', 'moderator'].includes(access.user_role)) {
      throw forbidden('Only owner, admin, or moderator can set pinned text', 'GROUP_ROLE_FORBIDDEN')
    }

    if (text === null) {
      await db('groups')
        .where({ id: groupId, university_id: context.universityId })
        .update({ pinned_text: null, pinned_at: null, pinned_by: null })
      return { pinnedText: null }
    }

    await db('groups')
      .where({ id: groupId, university_id: context.universityId })
      .update({ pinned_text: text, pinned_at: new Date(), pinned_by: context.userId })

    const members = await db('group_members')
      .where({ group_id: groupId })
      .whereNot({ user_id: context.userId })
      .select<{ user_id: string }[]>('user_id')

    for (const member of members) {
      await notificationQueue.add({
        universityId: context.universityId,
        userId: member.user_id,
        type: 'group_pinned_update',
        actorId: context.userId,
        referenceId: groupId,
        referenceType: 'group',
        content: 'A new announcement was pinned in your group',
        payload: {},
      })
    }

    return { pinnedText: text }
  }

  async listStudySessions(context: AuthContext, groupId: string, query: PaginationQuery) {
    await assertMemberAccess(context, groupId)

    const [{ count }] = await db('group_study_sessions')
      .where({ group_id: groupId, university_id: context.universityId })
      .count<{ count: string }[]>({ count: '*' })

    const rows = await db('group_study_sessions')
      .where({ 'group_study_sessions.group_id': groupId, 'group_study_sessions.university_id': context.universityId })
      .leftJoin('profiles as cp', 'cp.user_id', 'group_study_sessions.created_by')
      .leftJoin('group_study_session_rsvps as my_rsvp', function (this: Knex.JoinClause) {
        this.on('my_rsvp.session_id', '=', 'group_study_sessions.id')
            .andOn('my_rsvp.user_id', '=', db.raw('?', [context.userId]))
      })
      .select<StudySessionRow[]>(
        'group_study_sessions.id',
        'group_study_sessions.group_id',
        'group_study_sessions.university_id',
        'group_study_sessions.created_by',
        'group_study_sessions.title',
        'group_study_sessions.description',
        'group_study_sessions.location',
        'group_study_sessions.is_online',
        'group_study_sessions.online_link',
        'group_study_sessions.starts_at',
        'group_study_sessions.ends_at',
        'group_study_sessions.capacity',
        'group_study_sessions.rsvp_count',
        'group_study_sessions.created_at',
        'cp.full_name as creator_full_name',
        'cp.avatar_url as creator_avatar_url',
        'my_rsvp.status as own_rsvp',
      )
      .orderBy('group_study_sessions.starts_at', 'desc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)

    return {
      items: rows.map(toStudySession),
      total: Number(count),
      page: query.page,
      limit: query.limit,
    }
  }

  async createStudySession(context: AuthContext, groupId: string, input: CreateStudySessionInput) {
    await assertMemberAccess(context, groupId)

    let sessionId: string

    await db.transaction(async (trx) => {
      const [session] = await trx('group_study_sessions')
        .insert({
          group_id: groupId,
          university_id: context.universityId,
          created_by: context.userId,
          title: input.title,
          description: input.description ?? null,
          location: input.location ?? null,
          is_online: input.is_online,
          online_link: input.online_link ?? null,
          starts_at: input.starts_at,
          ends_at: input.ends_at ?? null,
          capacity: input.capacity ?? null,
          rsvp_count: 1, // creator auto-RSVPs
        })
        .returning<{ id: string }[]>('id')

      sessionId = session.id

      // Creator auto-RSVPs as going
      await trx('group_study_session_rsvps').insert({
        session_id: session.id,
        user_id: context.userId,
        university_id: context.universityId,
        status: 'going',
      })
    })

    // Notify all group members except creator
    const members = await db('group_members')
      .where({ group_id: groupId })
      .whereNot({ user_id: context.userId })
      .select<{ user_id: string }[]>('user_id')

    for (const member of members) {
      await notificationQueue.add({
        universityId: context.universityId,
        userId: member.user_id,
        type: 'group_study_session_created',
        actorId: context.userId,
        referenceId: groupId,
        referenceType: 'group',
        content: 'A new study session was created in your group',
        payload: { sessionId: sessionId! },
      })
    }

    const session = await db('group_study_sessions')
      .where({ id: sessionId! })
      .leftJoin('profiles as cp', 'cp.user_id', 'group_study_sessions.created_by')
      .leftJoin('group_study_session_rsvps as my_rsvp', function (this: Knex.JoinClause) {
        this.on('my_rsvp.session_id', '=', 'group_study_sessions.id')
            .andOn('my_rsvp.user_id', '=', db.raw('?', [context.userId]))
      })
      .select<StudySessionRow>(
        'group_study_sessions.*',
        'cp.full_name as creator_full_name',
        'cp.avatar_url as creator_avatar_url',
        'my_rsvp.status as own_rsvp',
      )
      .first<StudySessionRow>()

    return toStudySession(session!)
  }

  async deleteStudySession(context: AuthContext, groupId: string, sessionId: string) {
    await assertMemberAccess(context, groupId)

    const session = await db('group_study_sessions')
      .where({ id: sessionId, group_id: groupId })
      .select<{ id: string; created_by: string | null }>('id', 'created_by')
      .first()

    if (!session) throw notFound('Study session not found', 'STUDY_SESSION_NOT_FOUND')

    const membership = await db('group_members')
      .where({ group_id: groupId, user_id: context.userId })
      .select<{ role: string }>('role')
      .first()

    const isCreator = session.created_by === context.userId
    const isPrivileged = membership && ['owner', 'admin'].includes(membership.role)

    if (!isCreator && !isPrivileged) {
      throw forbidden('Only the creator or group owner/admin can delete a study session', 'SESSION_DELETE_FORBIDDEN')
    }

    await db('group_study_sessions').where({ id: sessionId }).delete()
    return { deleted: true }
  }

  async rsvpStudySession(context: AuthContext, groupId: string, sessionId: string, status: 'going' | 'not_going') {
    await assertMemberAccess(context, groupId)

    // Fetch session with a row lock
    const session = await db('group_study_sessions')
      .where({ id: sessionId, group_id: groupId })
      .select<{ id: string; capacity: number | null; rsvp_count: number }>('id', 'capacity', 'rsvp_count')
      .first()

    if (!session) throw notFound('Study session not found', 'STUDY_SESSION_NOT_FOUND')

    // Get previous RSVP status
    const existing = await db('group_study_session_rsvps')
      .where({ session_id: sessionId, user_id: context.userId })
      .select<{ status: string }>('status')
      .first()

    // Capacity check (only when going and was not already going)
    if (status === 'going' && existing?.status !== 'going') {
      if (session.capacity !== null && session.rsvp_count >= session.capacity) {
        throw conflict('Session is at capacity', 'SESSION_AT_CAPACITY')
      }
    }

    await db.transaction(async (trx) => {
      // Upsert RSVP
      await trx('group_study_session_rsvps')
        .insert({
          session_id: sessionId,
          user_id: context.userId,
          university_id: context.universityId,
          status,
          updated_at: new Date(),
        })
        .onConflict(['session_id', 'user_id'])
        .merge(['status', 'updated_at'])

      // Update rsvp_count
      if (status === 'going' && (!existing || existing.status === 'not_going')) {
        await trx('group_study_sessions').where({ id: sessionId }).increment('rsvp_count', 1)
      } else if (status === 'not_going' && existing?.status === 'going') {
        await trx('group_study_sessions').where({ id: sessionId }).decrement('rsvp_count', 1)
      }
    })

    const updated = await db('group_study_sessions')
      .where({ id: sessionId })
      .select<{ rsvp_count: number }>('rsvp_count')
      .first()

    return { status, rsvpCount: updated?.rsvp_count ?? 0 }
  }

  async setRules(context: AuthContext, groupId: string, content: string) {
    const access = await assertGroupAccess(context, groupId)
    assertCanAdminGroup(access.user_role)

    await db('groups')
      .where({ id: groupId, university_id: context.universityId })
      .update({ rules_md: content })

    return { rulesMd: content }
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
      'groups.pinned_text',
      'groups.pinned_at',
      'groups.pinned_by',
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

async function assertGroupAdminAccess(context: AuthContext, groupId: string) {
  const group = await assertGroupAccess(context, groupId)
  assertCanAdminGroup(group.user_role)
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

function toStudySession(row: StudySessionRow) {
  return {
    id: row.id,
    groupId: row.group_id,
    createdBy: row.created_by,
    title: row.title,
    description: row.description,
    location: row.location,
    isOnline: row.is_online,
    onlineLink: row.online_link,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    capacity: row.capacity,
    rsvpCount: row.rsvp_count,
    createdAt: row.created_at,
    ownRsvp: row.own_rsvp,
    creator: row.created_by
      ? { id: row.created_by, fullName: row.creator_full_name, avatarUrl: row.creator_avatar_url }
      : null,
  }
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
    pinnedText: row.pinned_text,
    pinnedAt: row.pinned_at,
    pinnedBy: row.pinned_by,
  }
}

function toResource(row: ResourceRow) {
  return {
    id: row.id,
    groupId: row.group_id,
    uploadedBy: row.uploaded_by,
    title: row.title,
    url: row.url,
    category: row.category,
    description: row.description,
    clickCount: row.click_count,
    createdAt: row.created_at,
    uploader: row.uploaded_by
      ? { id: row.uploaded_by, fullName: row.uploader_full_name, avatarUrl: row.uploader_avatar_url }
      : null,
  }
}

function toJoinRequest(row: JoinRequestRow) {
  return {
    id: row.id,
    groupId: row.group_id,
    userId: row.user_id,
    message: row.message,
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    requester: {
      id: row.user_id,
      fullName: row.requester_full_name,
      avatarUrl: row.requester_avatar_url,
      department: row.requester_department,
      role: row.requester_user_role,
    },
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
