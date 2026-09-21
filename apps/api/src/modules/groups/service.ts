import type { Knex } from 'knex'
import type { UserRole } from '@uniconnect/shared'
import { db } from '../../config/db'
import { getIo } from '../../socket'
import { feedService } from '../feed/service'
import { eventsService } from '../events/service'
import { notificationsService } from '../notifications/service'
import { badgeQueue } from '../../queues/badge.queue'
import { notificationQueue } from '../../queues/notification.queue'
import { badRequest, conflict, forbidden, notFound } from '../../utils/errors'
import { gradebookService } from '../academic/gradebook.service'
import { contentSyncService } from '../content-sync/service'
import { messagesService } from '../messages/service'
import { logger } from '../../utils/logger'
import {
  assertAllowedUploadType,
  assertAttachmentUrlsAreOwnUploads,
  getPresignedUploadUrl,
  sanitizeFileName,
} from '../../services/upload.service'
import type {
  AllowedRole,
  Attachment,
  CreateFlashcardDeckInput,
  CreateFlashcardInput,
  CreateGroupInput,
  CreateResourceInput,
  CreateSharedNoteInput,
  CreateStudySessionInput,
  FlashcardReviewInput,
  GroupListQuery,
  JoinRequestsQuery,
  MembersQuery,
  ModLogQuery,
  PaginationQuery,
  PutSessionCreatorNotesInput,
  PutSessionPrivateNotesInput,
  ResourceListQuery,
  RsvpStudySessionInput,
  SuggestionsQuery,
  UpdateFlashcardDeckInput,
  UpdateFlashcardInput,
  UpdateGroupInput,
  UpdateGroupSettingsInput,
  UpdateSharedNoteInput,
} from './schema'
import { AISettingsSchema } from './schema'
import { scheduleFlashcardReview } from './spacedRepetition'
import { canModerate, type GroupRole } from './permissions'

export interface ModLogWrite {
  universityId: string
  groupId: string
  actorId: string | null
  kind: 'post' | 'member' | 'settings'
  action: string
  target: string
  targetUserId?: string | null
}

export async function logModeration(trx: Knex | Knex.Transaction, entry: ModLogWrite) {
  await trx('group_moderation_log').insert({
    university_id: entry.universityId,
    group_id: entry.groupId,
    actor_id: entry.actorId,
    kind: entry.kind,
    action: entry.action,
    target: entry.target,
    target_user_id: entry.targetUserId ?? null,
  })
}

/**
 * `UpdateGroupAISettingsSchema` is built from a default-free shape, so a PATCH persists only the
 * keys the client sent and groups created before AI settings shipped have none of them. Apply the
 * defaults at serialization so the client always receives a complete object.
 *
 * Defaults must stay on this read path only. Putting them on the write schema makes every partial
 * PATCH write the full default set, which silently resets the fields the client did not touch.
 *
 * Spread order matters: `ai_settings` also holds runtime-only keys (`last_ai_post_date`,
 * `pending_deck_id`, `pending_quiz_id`) that are NOT in `AISettingsSchema`, so a bare
 * `AISettingsSchema.parse(row.ai_settings)` would strip them and break pending approvals.
 */
function withAiSettingsDefaults(raw: unknown): Record<string, unknown> {
  return { ...AISettingsSchema.parse({}), ...((raw as Record<string, unknown> | null) ?? {}) }
}

type GroupType = 'department' | 'club' | 'batch' | 'research' | 'interest' | 'other' | 'academic'

interface AuthContext {
  userId: string
  universityId: string
  role: UserRole
}

interface CountRow {
  count: string | number
}

/** Faces rendered in the group-card avatar stack. Kept small — the card has room for three. */
const GROUP_PREVIEW_MEMBER_COUNT = 3

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
  is_muted: boolean | null
  pinned_text: string | null
  pinned_at: Date | null
  pinned_by: string | null
  rules_md: string | null
  ai_settings: Record<string, unknown> | null
  require_post_approval: boolean
  require_event_approval: boolean
}

/** A handful of members rendered as an avatar stack on the group card. */
interface GroupPreviewMemberRow {
  group_id: string
  user_id: string
  full_name: string
  avatar_url: string | null
}

interface GroupKnownCountRow {
  group_id: string
  known_count: string | number
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

interface FlashcardDeckRow {
  id: string
  group_id: string
  university_id: string
  created_by: string | null
  title: string
  description: string | null
  is_archived: boolean
  card_count: number
  created_at: Date
  updated_at: Date
  creator_full_name: string | null
  creator_avatar_url: string | null
  due_count: string | number
}

interface FlashcardRow {
  id: string
  deck_id: string
  group_id: string
  university_id: string
  created_by: string | null
  front: string
  back: string
  hint: string | null
  created_at: Date
  updated_at: Date
  creator_full_name: string | null
  creator_avatar_url: string | null
  review_user_id: string | null
  ease_factor: string | number | null
  interval_days: number | null
  repetition_count: number | null
  due_at: Date | null
  last_reviewed_at: Date | null
  last_rating: 'again' | 'hard' | 'good' | 'easy' | null
}

interface FlashcardOwnerRow {
  id: string
  deck_id: string
  created_by: string | null
  deck_created_by: string | null
}

interface FlashcardReviewRow {
  card_id: string
  user_id: string
  group_id: string
  university_id: string
  ease_factor: string | number
  interval_days: number
  repetition_count: number
  due_at: Date
  last_reviewed_at: Date | null
  last_rating: 'again' | 'hard' | 'good' | 'easy' | null
  created_at: Date
  updated_at: Date
}

interface SharedNoteRow {
  id: string
  group_id: string
  university_id: string
  created_by: string | null
  title: string
  body: string
  created_at: Date
  updated_at: Date
  attachments: Attachment[] | null
  creator_full_name: string | null
  creator_avatar_url: string | null
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

    const { previewByGroup, knownByGroup } = await loadGroupSocialProof(
      rows.map((row) => row.id),
      context.userId,
    )

    const items = rows.map((row) => ({
      ...toGroup(row),
      previewMembers: previewByGroup.get(row.id) ?? [],
      knownMemberCount: knownByGroup.get(row.id) ?? 0,
    }))

    return { items, total, page: query.page, limit: query.limit }
  }

  /**
   * Mute or unmute a group's notifications for the current user. Membership carries the
   * preference, so someone who is not a member has nothing to mute.
   */
  async setMyMute(context: AuthContext, groupId: string, muted: boolean) {
    await assertGroupAccess(context, groupId)

    const updated = await db('group_members')
      .where({ group_id: groupId, user_id: context.userId })
      .update({ is_muted: muted })

    if (updated === 0) throw notFound('You are not a member of this group', 'GROUP_MEMBERSHIP_NOT_FOUND')

    return { isMuted: muted }
  }

  async createGroup(context: AuthContext, input: CreateGroupInput) {
    if (input.type === 'academic' && context.role !== 'faculty') {
      throw forbidden('Only faculty members can create academic groups', 'ACADEMIC_GROUP_FACULTY_ONLY')
    }

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

  async updateSettings(context: AuthContext, groupId: string, input: UpdateGroupSettingsInput) {
    const access = await assertGroupAdminAccess(context, groupId)
    if (access.is_system) throw forbidden('System groups have no settings', 'GROUP_SYSTEM')
    const before = await db('groups')
      .select<{ is_private: boolean; require_post_approval: boolean; require_event_approval: boolean }[]>(
        'is_private',
        'require_post_approval',
        'require_event_approval',
      )
      .where({ id: groupId })
      .first()
    if (!before) throw notFound('Group not found', 'GROUP_NOT_FOUND')

    await db.transaction(async (trx) => {
      await trx('groups').where({ id: groupId }).update({ ...input })
      const labels: [keyof UpdateGroupSettingsInput, string][] = [
        ['is_private', 'Private group'],
        ['require_post_approval', 'Post approval'],
        ['require_event_approval', 'Event approval'],
      ]
      for (const [key, label] of labels) {
        if (input[key] !== undefined && input[key] !== before[key]) {
          await logModeration(trx, {
            universityId: context.universityId,
            groupId,
            actorId: context.userId,
            kind: 'settings',
            action: `${label} turned ${input[key] ? 'on' : 'off'}`,
            target: 'Group settings',
          })
        }
      }
    })
    return this.getGroup(context, groupId)
  }

  async listModerationLog(context: AuthContext, groupId: string, query: ModLogQuery) {
    await assertGroupAdminAccess(context, groupId)
    const q = db('group_moderation_log as l')
      .leftJoin('profiles as p', 'p.user_id', 'l.actor_id')
      .where('l.group_id', groupId)
      .modify((qb) => {
        if (query.kind !== 'all') qb.where('l.kind', query.kind)
      })
    const [{ count }] = await q.clone().count<{ count: string }[]>({ count: '*' })
    interface ModLogRow {
      id: string
      kind: 'post' | 'member' | 'settings'
      action: string
      target: string
      actor_id: string | null
      created_at: Date
      actor_name: string | null
    }
    const rows = await q
      .select<ModLogRow[]>(
        'l.id',
        'l.kind',
        'l.action',
        'l.target',
        'l.actor_id',
        'l.created_at',
        'p.full_name as actor_name',
      )
      .orderBy('l.created_at', 'desc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)
    return {
      items: rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        action: r.action,
        target: r.target,
        createdAt: r.created_at,
        actor: r.actor_id ? { id: r.actor_id, fullName: r.actor_name ?? null } : null,
      })),
      total: Number(count),
      page: query.page,
      limit: query.limit,
    }
  }

  // ── Post/event review queue ────────────────────────────────

  async listPendingPosts(context: AuthContext, groupId: string) {
    const access = await assertGroupAccess(context, groupId)
    if (!canModerate(access.user_role)) throw forbidden('Moderator required', 'GROUP_MOD_REQUIRED')
    const ids = await db('posts')
      .where({ group_id: groupId, group_review_status: 'pending' })
      .orderBy('created_at')
      .pluck('id')
    return feedService.listPostsByIds(context.universityId, context.userId, ids)
  }

  async reviewPost(context: AuthContext, groupId: string, postId: string, action: 'approve' | 'decline') {
    const access = await assertGroupAccess(context, groupId)
    if (!canModerate(access.user_role)) throw forbidden('Moderator required', 'GROUP_MOD_REQUIRED')
    const post = await db('posts')
      .leftJoin('profiles as p', 'p.user_id', 'posts.author_id')
      .select<{ id: string; author_id: string; content: string; full_name: string | null }[]>(
        'posts.id',
        'posts.author_id',
        'posts.content',
        'p.full_name',
      )
      .where({ 'posts.id': postId, 'posts.group_id': groupId, 'posts.group_review_status': 'pending' })
      .first()
    if (!post) throw notFound('Post not found', 'POST_NOT_FOUND')

    await db.transaction(async (trx) => {
      await trx('posts')
        .where({ id: postId })
        .update(
          action === 'approve'
            ? { is_published: true, group_review_status: 'approved' }
            : { group_review_status: 'declined', archived_at: trx.fn.now() },
        )
      await logModeration(trx, {
        universityId: context.universityId,
        groupId,
        actorId: context.userId,
        kind: 'post',
        action: action === 'approve' ? 'Queued post approved' : 'Queued post declined',
        target: `${post.full_name ?? 'Member'} · ${post.content.slice(0, 60)}`,
        targetUserId: post.author_id,
      })
    })

    if (action === 'approve') {
      const publishedPost = await feedService.getPost(context.universityId, context.userId, postId, { incrementView: false })
      getIo().to(`uni:${context.universityId}`).emit('post:created', publishedPost)
      getIo().to(`uni:${context.universityId}`).emit('feed:post:new', { post: publishedPost })
    }
    return { id: postId, groupReviewStatus: action === 'approve' ? 'approved' : 'declined' }
  }

  async listPendingEvents(context: AuthContext, groupId: string) {
    const access = await assertGroupAccess(context, groupId)
    if (!canModerate(access.user_role)) throw forbidden('Moderator required', 'GROUP_MOD_REQUIRED')
    const ids = await db('events')
      .where({ group_id: groupId, group_review_status: 'pending' })
      .orderBy('created_at')
      .pluck('id')
    return eventsService.listEventsByIds(context.userId, ids)
  }

  async reviewEvent(context: AuthContext, groupId: string, eventId: string, action: 'approve' | 'decline') {
    const access = await assertGroupAccess(context, groupId)
    if (!canModerate(access.user_role)) throw forbidden('Moderator required', 'GROUP_MOD_REQUIRED')
    const event = await db('events')
      .leftJoin('profiles as p', 'p.user_id', 'events.organizer_id')
      .select<{ id: string; organizer_id: string; title: string; full_name: string | null }[]>(
        'events.id',
        'events.organizer_id',
        'events.title',
        'p.full_name',
      )
      .where({ 'events.id': eventId, 'events.group_id': groupId, 'events.group_review_status': 'pending' })
      .first()
    if (!event) throw notFound('Event not found', 'EVENT_NOT_FOUND')

    await db.transaction(async (trx) => {
      await trx('events')
        .where({ id: eventId })
        .update(
          action === 'approve'
            ? { is_published: true, group_review_status: 'approved' }
            : { group_review_status: 'declined' },
        )
      await logModeration(trx, {
        universityId: context.universityId,
        groupId,
        actorId: context.userId,
        kind: 'post',
        action: action === 'approve' ? 'Queued event approved' : 'Queued event declined',
        target: `${event.full_name ?? 'Member'} · ${event.title.slice(0, 60)}`,
        targetUserId: event.organizer_id,
      })
    })

    return { id: eventId, groupReviewStatus: action === 'approve' ? 'approved' : 'declined' }
  }

  async reviewSummary(context: AuthContext, groupId: string) {
    const access = await assertGroupAccess(context, groupId)
    if (!canModerate(access.user_role)) throw forbidden('Moderator required', 'GROUP_MOD_REQUIRED')
    const [posts, events, joins, reports] = await Promise.all([
      db('posts').where({ group_id: groupId, group_review_status: 'pending' }).count<CountRow[]>({ count: '*' }).first(),
      db('events').where({ group_id: groupId, group_review_status: 'pending' }).count<CountRow[]>({ count: '*' }).first(),
      db('group_join_requests').where({ group_id: groupId, status: 'pending' }).count<CountRow[]>({ count: '*' }).first(),
      db('reports')
        .where({ target_type: 'post', status: 'pending' })
        .whereIn('target_id', db('posts').select('id').where({ group_id: groupId }))
        .count<CountRow[]>({ count: '*' })
        .first(),
    ])
    const n = (row: CountRow | undefined) => Number(row?.count ?? 0)
    return {
      pendingPosts: n(posts),
      pendingEvents: n(events),
      pendingJoinRequests: n(joins),
      reportsOpen: n(reports),
    }
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

    await syncGroupChatParticipant(groupId, context.userId, 'add')

    const group = await this.getGroup(context, groupId)
    if (group.type === 'academic') {
      await gradebookService.autoPopulateGradebook(groupId, context.universityId, context.userId)
    }
    return { kind: 'joined' as const, group }
  }

  async joinGroup(context: AuthContext, groupId: string) {
    const result = await this.joinOrRequest(context, groupId, null)
    return result
  }

  async listJoinRequests(context: AuthContext, groupId: string, query: JoinRequestsQuery) {
    await assertGroupAdminAccess(context, groupId)

    const baseQuery = db('group_join_requests').where({ group_id: groupId, status: query.status })
    if (query.status !== 'pending') {
      baseQuery.where('group_join_requests.reviewed_at', '>=', db.raw("now() - interval '30 days'"))
    }

    const [{ count }] = await baseQuery.clone().count<{ count: string }[]>({ count: '*' })

    const rows = await baseQuery
      .clone()
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
      .orderBy('group_join_requests.created_at', query.status === 'pending' ? 'asc' : 'desc')
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
    action: 'approve' | 'decline' | 'undo',
  ) {
    await assertGroupAdminAccess(context, groupId)

    const request = await db('group_join_requests')
      .where({ id: requestId, group_id: groupId })
      .first<
        | {
            id: string
            user_id: string
            university_id: string
            status: 'pending' | 'approved' | 'declined'
            message: string | null
          }
        | undefined
      >()

    if (!request) throw notFound('Join request not found', 'JOIN_REQUEST_NOT_FOUND')

    const requester = await db('profiles')
      .select<{ full_name: string | null }[]>('full_name')
      .where({ user_id: request.user_id })
      .first()
    const requesterName = requester?.full_name ?? 'A member'
    const modLogTarget = `${requesterName}${request.message ? ' · ' + request.message : ''}`

    if (action === 'approve') {
      if (request.status !== 'pending') throw badRequest('Join request already reviewed', 'JOIN_REQUEST_ALREADY_REVIEWED')

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
        await logModeration(trx, {
          universityId: context.universityId,
          groupId,
          actorId: context.userId,
          kind: 'member',
          action: 'Join request approved',
          target: modLogTarget,
          targetUserId: request.user_id,
        })
      })

      const group = await db('groups').where({ id: groupId }).first<{ type: string } | undefined>('type')
      if (group?.type === 'academic') {
        await gradebookService.autoPopulateGradebook(groupId, context.universityId, request.user_id)
      }

      await syncGroupChatParticipant(groupId, request.user_id, 'add')

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

      return { action: 'approved' as const, ...(await this.getJoinRequest(groupId, requestId)) }
    }

    if (action === 'decline') {
      if (request.status !== 'pending') throw badRequest('Join request already reviewed', 'JOIN_REQUEST_ALREADY_REVIEWED')

      await db.transaction(async (trx) => {
        await trx('group_join_requests').where({ id: requestId }).update({
          status: 'declined',
          reviewed_by: context.userId,
          reviewed_at: new Date(),
          updated_at: new Date(),
        })
        await logModeration(trx, {
          universityId: context.universityId,
          groupId,
          actorId: context.userId,
          kind: 'member',
          action: 'Join request declined',
          target: modLogTarget,
          targetUserId: request.user_id,
        })
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

      return { action: 'declined' as const, ...(await this.getJoinRequest(groupId, requestId)) }
    }

    // undo
    if (request.status === 'pending') throw badRequest('Join request is already pending', 'JOIN_REQUEST_NOT_REVIEWED')

    await db.transaction(async (trx) => {
      if (request.status === 'approved') {
        const deleted = await trx('group_members').where({ group_id: groupId, user_id: request.user_id }).delete()
        if (deleted > 0) {
          await trx('groups')
            .where({ id: groupId, university_id: context.universityId })
            .where('member_count', '>', 0)
            .decrement('member_count', 1)
        }
      }
      await trx('group_join_requests').where({ id: requestId }).update({
        status: 'pending',
        reviewed_by: null,
        reviewed_at: null,
        updated_at: new Date(),
      })
    })

    if (request.status === 'approved') {
      await syncGroupChatParticipant(groupId, request.user_id, 'remove')
    }

    return { action: 'undo' as const, ...(await this.getJoinRequest(groupId, requestId)) }
  }

  private async getJoinRequest(groupId: string, requestId: string) {
    const row = await db('group_join_requests')
      .where({ 'group_join_requests.id': requestId, 'group_join_requests.group_id': groupId })
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
      .first<JoinRequestRow>()

    if (!row) throw notFound('Join request not found', 'JOIN_REQUEST_NOT_FOUND')
    return toJoinRequest(row)
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

    await syncGroupChatParticipant(groupId, context.userId, 'add')

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

    await syncGroupChatParticipant(groupId, context.userId, 'remove')

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
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const [
      [newMembersRow],
      [postsRow],
      [activeContributorsRow],
      [pendingRow],
      [upcomingRow],
      [memberCountRow],
      [active30dRow],
      [resourcesRow],
      [upcomingEventsRow],
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

      // Design keys below — kept alongside the original set above since the contextual
      // rail widget still reads the original keys.
      db('group_members').where({ group_id: groupId }).count<{ count: string }[]>({ count: '*' }),

      db('posts')
        .where({ group_id: groupId })
        .andWhere('created_at', '>=', thirtyDaysAgo)
        .countDistinct<{ count: string }[]>({ count: 'author_id' }),

      db('group_resources').where({ group_id: groupId }).count<{ count: string }[]>({ count: '*' }),

      db('events')
        .where({ group_id: groupId })
        .andWhere('starts_at', '>=', new Date())
        .count<{ count: string }[]>({ count: '*' }),
    ])

    return {
      newMembersThisWeek: Number(newMembersRow.count),
      postsThisWeek: Number(postsRow.count),
      activeContributors: Number(activeContributorsRow.count),
      pendingJoinRequests: Number(pendingRow.count),
      upcomingStudySessions: Number(upcomingRow.count),
      // Design's five keys
      members: Number(memberCountRow.count),
      active30d: Number(active30dRow.count),
      resources: Number(resourcesRow.count),
      upcomingEvents: Number(upcomingEventsRow.count),
    }
  }

  async getAnalytics(context: AuthContext, groupId: string) {
    const access = await assertGroupAccess(context, groupId)
    if (!canModerate(access.user_role)) throw forbidden('Moderator required', 'GROUP_MOD_REQUIRED')

    const base = db('posts').where({ group_id: groupId, is_published: true }).whereNull('archived_at')

    const [members, newMembers, posts30, postsPrev30, active, reports, weeks, top] = await Promise.all([
      db('group_members').where({ group_id: groupId }).count<{ c: string }[]>({ c: '*' }).then((rows) => rows[0]),
      db('group_members')
        .where({ group_id: groupId })
        .where('joined_at', '>=', db.raw("now() - interval '7 days'"))
        .count<{ c: string }[]>({ c: '*' })
        .then((rows) => rows[0]),
      base
        .clone()
        .where('created_at', '>=', db.raw("now() - interval '30 days'"))
        .count<{ c: string }[]>({ c: '*' })
        .then((rows) => rows[0]),
      base
        .clone()
        .whereBetween('created_at', [db.raw("now() - interval '60 days'"), db.raw("now() - interval '30 days'")])
        .count<{ c: string }[]>({ c: '*' })
        .then((rows) => rows[0]),
      base
        .clone()
        .where('created_at', '>=', db.raw("now() - interval '30 days'"))
        .countDistinct<{ c: string }[]>({ c: 'author_id' })
        .then((rows) => rows[0]),
      db('reports')
        .where({ target_type: 'post', status: 'pending' })
        .whereIn('target_id', db('posts').select('id').where({ group_id: groupId }))
        .count<{ c: string }[]>({ c: '*' })
        .then((rows) => rows[0]),
      db.raw<{ rows: { week_start: Date; count: number }[] }>(
        `SELECT g.week_start, COUNT(p.id)::int AS count
           FROM generate_series(date_trunc('week', now()) - interval '4 weeks', date_trunc('week', now()), interval '1 week') AS g(week_start)
           LEFT JOIN posts p ON p.group_id = ? AND p.is_published AND p.archived_at IS NULL
             AND p.created_at >= g.week_start AND p.created_at < g.week_start + interval '1 week'
          GROUP BY g.week_start ORDER BY g.week_start`,
        [groupId],
      ),
      db.raw<{
        rows: { id: string; full_name: string | null; avatar_url: string | null; posts: number; replies: number }[]
      }>(
        `SELECT u.id, pr.full_name, pr.avatar_url,
                COUNT(DISTINCT p.id)::int AS posts, COUNT(DISTINCT c.id)::int AS replies
           FROM users u JOIN profiles pr ON pr.user_id = u.id
           LEFT JOIN posts p ON p.author_id = u.id AND p.group_id = ? AND p.created_at >= now() - interval '30 days'
           LEFT JOIN comments c ON c.author_id = u.id AND c.post_id IN (SELECT id FROM posts WHERE group_id = ?)
             AND c.created_at >= now() - interval '30 days'
          WHERE u.id IN (SELECT user_id FROM group_members WHERE group_id = ?)
          GROUP BY u.id, pr.full_name, pr.avatar_url
          HAVING COUNT(DISTINCT p.id) + COUNT(DISTINCT c.id) > 0
          ORDER BY posts DESC, replies DESC LIMIT 3`,
        [groupId, groupId, groupId],
      ),
    ])

    const memberCount = Number(members?.c ?? 0)
    const p30 = Number(posts30?.c ?? 0)
    const pPrev = Number(postsPrev30?.c ?? 0)
    const labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'This week']

    return {
      members: memberCount,
      membersDelta7d: Number(newMembers?.c ?? 0),
      posts30d: p30,
      postsDeltaPct: pPrev === 0 ? null : Math.round(((p30 - pPrev) / pPrev) * 100),
      activePct: memberCount === 0 ? 0 : Math.round((Number(active?.c ?? 0) / memberCount) * 100),
      reportsOpen: Number(reports?.c ?? 0),
      postsPerWeek: weeks.rows.map((r, i) => ({ label: labels[i] ?? `Week ${i + 1}`, count: r.count })),
      topMembers: top.rows.map((r) => ({
        id: r.id,
        fullName: r.full_name,
        avatarUrl: r.avatar_url,
        posts: r.posts,
        replies: r.replies,
      })),
    }
  }

  async listSuggestions(context: AuthContext, limit: number) {
    // Non-member groups only, public or private — unlike `listGroups`, a private group
    // the caller hasn't joined is still a valid suggestion (surfaced by known-member
    // count), so there is no `is_private` filter here. System groups are excluded —
    // `assertCanJoinGroup` rejects joining one outright, so they are never a valid
    // suggestion.
    //
    // The known-member count that ranking depends on is computed as a correlated
    // subquery and ordered/limited in the database — computing it in JS only after an
    // arbitrary "top 50 by member_count" pre-cut would silently drop a group with many
    // known connections but a small `member_count` once more than 50 groups are
    // eligible, breaking the "knownMemberCount desc, member_count desc" contract.
    const memberGroupIds = db('group_members').select('group_id').where({ user_id: context.userId })

    const rows = (await groupSelectQuery(db, context.userId)
      .where('groups.university_id', context.universityId)
      .whereNotIn('groups.id', memberGroupIds)
      .whereNot('groups.is_system', true)
      .select(
        db.raw(
          `(
            select count(*)::int
              from group_members gm
              join connections conn
                on conn.status = 'accepted'
               and (
                 (conn.requester_id = ? and conn.addressee_id = gm.user_id)
                 or (conn.addressee_id = ? and conn.requester_id = gm.user_id)
               )
             where gm.group_id = groups.id
          ) as known_member_count`,
          [context.userId, context.userId],
        ),
      )
      .orderByRaw('known_member_count desc, groups.member_count desc')
      .limit(limit)) as (GroupRow & { known_member_count: number | string })[]

    const { previewByGroup } = await loadGroupSocialProof(
      rows.map((row) => row.id),
      context.userId,
    )

    const items = rows.map((row) => ({
      ...toGroup(row),
      previewMembers: previewByGroup.get(row.id) ?? [],
      knownMemberCount: Number(row.known_member_count ?? 0),
    }))

    return { items }
  }

  /**
   * Lazily creates and returns the group's class-chat conversation id. Concurrent
   * first calls (e.g. two members opening the chat tab at once) race on the
   * check-then-create — a plain SELECT-then-UPDATE would let both requests see
   * `chat_conversation_id: null` and each create its own conversation. Guarded here
   * with `SELECT … FOR UPDATE` inside a transaction: the second transaction blocks on
   * the row lock until the first commits, then re-reads the now-populated
   * `chat_conversation_id` and returns it instead of creating a duplicate.
   */
  async openGroupChat(context: AuthContext, groupId: string) {
    await assertMemberAccess(context, groupId)

    // Cheap pre-check outside the transaction — the common case (chat already
    // exists) never needs to take the row lock at all.
    const precheck = await db('groups')
      .select<{ type: GroupType; chat_conversation_id: string | null }[]>('type', 'chat_conversation_id')
      .where({ id: groupId })
      .first()

    if (!precheck) throw notFound('Group not found', 'GROUP_NOT_FOUND')
    if (precheck.type !== 'academic') {
      throw badRequest('Only class groups have a group chat', 'GROUP_NOT_ACADEMIC')
    }
    if (precheck.chat_conversation_id) return { conversationId: precheck.chat_conversation_id }

    const conversationId = await db.transaction(async (trx) => {
      const locked = await trx('groups')
        .select<{ name: string; chat_conversation_id: string | null }[]>('name', 'chat_conversation_id')
        .where({ id: groupId })
        .forUpdate()
        .first()

      if (!locked) throw notFound('Group not found', 'GROUP_NOT_FOUND')
      // Re-check after acquiring the lock — another transaction may have created and
      // committed the chat while this one was waiting on the lock.
      if (locked.chat_conversation_id) return locked.chat_conversation_id

      const memberIds = await trx('group_members').where({ group_id: groupId }).pluck<string[]>('user_id')
      const newConversationId = await messagesService.createGroupConversationForGroup(
        context,
        { name: locked.name, participantIds: memberIds },
        trx,
      )
      await trx('groups').where({ id: groupId }).update({ chat_conversation_id: newConversationId })

      return newConversationId
    })

    return { conversationId }
  }

  async askTeacher(context: AuthContext, groupId: string) {
    await assertMemberAccess(context, groupId)

    const group = await db('groups')
      .select<{ type: GroupType; created_by: string }[]>('type', 'created_by')
      .where({ id: groupId })
      .first()
    if (!group) throw notFound('Group not found', 'GROUP_NOT_FOUND')
    if (group.type !== 'academic') {
      throw badRequest('Only class groups can message their teacher', 'GROUP_NOT_ACADEMIC')
    }

    const teacherId = await resolveGroupTeacherId(groupId, group.created_by)
    const conversationId = await messagesService.getOrCreateDirect(context, teacherId)

    const teacherProfile = await db('profiles')
      .select<{ full_name: string | null; avatar_url: string | null; department: string | null }[]>(
        'full_name',
        'avatar_url',
        'department',
      )
      .where('user_id', teacherId)
      .first()

    return {
      conversationId,
      teacher: {
        id: teacherId,
        fullName: teacherProfile?.full_name ?? null,
        avatarUrl: teacherProfile?.avatar_url ?? null,
        department: teacherProfile?.department ?? null,
      },
    }
  }

  async askTeacherQueue(context: AuthContext, groupId: string) {
    await assertGroupAdminAccess(context, groupId)

    const row = await db('groups')
      .select<{ type: GroupType; created_by: string }[]>('type', 'created_by')
      .where({ id: groupId })
      .first()
    if (!row) throw notFound('Group not found', 'GROUP_NOT_FOUND')
    if (row.type !== 'academic') {
      throw badRequest('Only class groups have an ask-teacher queue', 'GROUP_NOT_ACADEMIC')
    }

    const teacherId = await resolveGroupTeacherId(groupId, row.created_by)

    const memberIds = await db('group_members').where({ group_id: groupId }).pluck<string[]>('user_id')
    const studentIds = memberIds.filter((id) => id !== teacherId)
    if (studentIds.length === 0) return { items: [] }

    // Direct conversations the teacher is in, restricted to the other participant
    // being one of this group's members — this is what makes it "the ask-teacher
    // queue for this class" rather than every DM the teacher has.
    const conversationRows = (await db('conversation_participants as owner_p')
      .join('conversations as c', 'c.id', 'owner_p.conversation_id')
      .join('conversation_participants as student_p', function joinStudent() {
        this.on('student_p.conversation_id', '=', 'c.id').andOn('student_p.user_id', '!=', 'owner_p.user_id')
      })
      .join('profiles as sp', 'sp.user_id', 'student_p.user_id')
      .where('owner_p.user_id', teacherId)
      .andWhere('c.university_id', context.universityId)
      .andWhere('c.is_group', false)
      .whereIn('student_p.user_id', studentIds)
      .select<
        {
          conversation_id: string
          student_id: string
          full_name: string | null
          avatar_url: string | null
          owner_last_read_at: Date | null
        }[]
      >(
        'c.id as conversation_id',
        'student_p.user_id as student_id',
        'sp.full_name',
        'sp.avatar_url',
        'owner_p.last_read_at as owner_last_read_at',
      )) as {
      conversation_id: string
      student_id: string
      full_name: string | null
      avatar_url: string | null
      owner_last_read_at: Date | null
    }[]

    if (conversationRows.length === 0) return { items: [] }

    const conversationIds = conversationRows.map((row) => row.conversation_id)

    const lastMessages = await db('messages')
      .whereIn('conversation_id', conversationIds)
      .andWhere('is_deleted', false)
      .orderBy('created_at', 'desc')
      .select<{ conversation_id: string; content: string | null; created_at: Date; sender_id: string }[]>(
        'conversation_id',
        'content',
        'created_at',
        'sender_id',
      )

    const lastByConversation = new Map<string, { content: string | null; created_at: Date }>()
    for (const message of lastMessages) {
      if (!lastByConversation.has(message.conversation_id)) {
        lastByConversation.set(message.conversation_id, { content: message.content, created_at: message.created_at })
      }
    }

    const unreadMessages = await db('messages')
      .whereIn('conversation_id', conversationIds)
      .andWhere('sender_id', '!=', teacherId)
      .select<{ conversation_id: string; created_at: Date }[]>('conversation_id', 'created_at')

    const unreadByConversation = new Map<string, number>()
    for (const row of conversationRows) {
      const threshold = row.owner_last_read_at
      const count = unreadMessages.filter(
        (m) => m.conversation_id === row.conversation_id && (!threshold || m.created_at > threshold),
      ).length
      unreadByConversation.set(row.conversation_id, count)
    }

    const items = conversationRows
      .map((row) => ({
        conversationId: row.conversation_id,
        student: { id: row.student_id, fullName: row.full_name, avatarUrl: row.avatar_url },
        lastMessage: lastByConversation.get(row.conversation_id)?.content ?? '',
        lastAt: lastByConversation.get(row.conversation_id)?.created_at ?? null,
        unread: unreadByConversation.get(row.conversation_id) ?? 0,
      }))
      .sort((a, b) => {
        const aTime = a.lastAt ? new Date(a.lastAt).getTime() : 0
        const bTime = b.lastAt ? new Date(b.lastAt).getTime() : 0
        return bTime - aTime
      })

    return { items }
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

    const targetName = await getMemberFullName(targetUserId)
    await db.transaction(async (trx) => {
      await trx('group_members').where({ group_id: groupId, user_id: targetUserId }).update({ role })
      const action = role === 'moderator' ? 'Moderator added' : role === 'admin' ? 'Admin added' : 'Role removed'
      await logModeration(trx, {
        universityId: context.universityId,
        groupId,
        actorId: context.userId,
        kind: 'member',
        action,
        target: targetName,
        targetUserId,
      })
    })
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

    const targetName = await getMemberFullName(targetUserId)
    await db.transaction(async (trx) => {
      const deleted = await trx('group_members').where({ group_id: groupId, user_id: targetUserId }).delete()
      if (deleted > 0) {
        await trx('groups')
          .where({ id: groupId, university_id: context.universityId })
          .where('member_count', '>', 0)
          .decrement('member_count', 1)
        await logModeration(trx, {
          universityId: context.universityId,
          groupId,
          actorId: context.userId,
          kind: 'member',
          action: 'Member removed',
          target: targetName,
          targetUserId,
        })
      }
    })

    await syncGroupChatParticipant(groupId, targetUserId, 'remove')

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
    const access = await assertMemberAccess(context, groupId)

    const resource = await db('group_resources')
      .where({ id: resourceId, group_id: groupId })
      .select<{ id: string; uploaded_by: string | null }>('id', 'uploaded_by')
      .first()

    if (!resource) throw notFound('Resource not found', 'RESOURCE_NOT_FOUND')

    // Permission: uploader OR owner/admin/moderator
    if (resource.uploaded_by !== context.userId && !canModerate(access.user_role)) {
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

  async listPendingInvites(context: AuthContext, groupId: string, query: PaginationQuery) {
    await assertGroupAdminAccess(context, groupId)

    const baseWhere = {
      type: 'group_invite',
      reference_id: groupId,
      reference_type: 'group',
      is_read: false,
    }

    const [{ count }] = await db('notifications').where(baseWhere).count<{ count: string }[]>({ count: '*' })

    const rows = await db('notifications')
      .where(baseWhere)
      .leftJoin('profiles as ip', 'ip.user_id', 'notifications.user_id')
      .leftJoin('profiles as ap', 'ap.user_id', 'notifications.actor_id')
      .select<
        {
          id: string
          user_id: string
          actor_id: string | null
          created_at: Date
          invitee_full_name: string | null
          invitee_avatar_url: string | null
          inviter_full_name: string | null
        }[]
      >(
        'notifications.id',
        'notifications.user_id',
        'notifications.actor_id',
        'notifications.created_at',
        'ip.full_name as invitee_full_name',
        'ip.avatar_url as invitee_avatar_url',
        'ap.full_name as inviter_full_name',
      )
      .orderBy('notifications.created_at', 'desc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)

    return {
      items: rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        fullName: r.invitee_full_name ?? 'Unknown user',
        avatarUrl: r.invitee_avatar_url,
        invitedBy: r.inviter_full_name ?? 'Someone',
        createdAt: r.created_at,
      })),
      total: Number(count),
      page: query.page,
      limit: query.limit,
    }
  }

  async cancelInvite(context: AuthContext, groupId: string, notificationId: string) {
    await assertGroupAdminAccess(context, groupId)

    const deleted = await db('notifications')
      .where({
        id: notificationId,
        type: 'group_invite',
        reference_id: groupId,
        reference_type: 'group',
        is_read: false,
      })
      .delete()

    if (deleted === 0) throw notFound('Pending invite not found', 'GROUP_INVITE_NOT_FOUND')
    return { cancelled: true }
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
      .where({ 'group_study_sessions.id': sessionId! })
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
    const access = await assertMemberAccess(context, groupId)

    const session = await db('group_study_sessions')
      .where({ id: sessionId, group_id: groupId })
      .select<{ id: string; created_by: string | null }>('id', 'created_by')
      .first()

    if (!session) throw notFound('Study session not found', 'STUDY_SESSION_NOT_FOUND')

    if (session.created_by !== context.userId && !canModerate(access.user_role)) {
      throw forbidden(
        'Only the creator or group moderators can delete a study session',
        'SESSION_DELETE_FORBIDDEN',
      )
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

  async getSessionCreatorNotes(context: AuthContext, groupId: string, sessionId: string) {
    await assertMemberAccess(context, groupId)
    const row = await db('group_session_creator_notes').where({ session_id: sessionId, group_id: groupId }).first()
    return row
      ? { id: row.id, title: row.title, body: row.body, attachments: row.attachments, createdBy: row.created_by, updatedAt: row.updated_at }
      : null
  }

  async putSessionCreatorNotes(context: AuthContext, groupId: string, sessionId: string, input: PutSessionCreatorNotesInput) {
    await assertMemberAccess(context, groupId)
    const session = await db('group_study_sessions').where({ id: sessionId, group_id: groupId }).first()
    if (!session) throw notFound('Study session not found', 'STUDY_SESSION_NOT_FOUND')
    if (session.created_by !== context.userId) {
      throw forbidden('Only the session creator can edit these notes', 'SESSION_NOTES_CREATOR_ONLY')
    }
    assertAttachmentsAreOwnUploads(input.attachments)

    const existing = await db('group_session_creator_notes').where({ session_id: sessionId }).first()
    if (existing) {
      const [row] = await db('group_session_creator_notes')
        .where({ id: existing.id })
        .update({
          ...pickDefined({
            title: input.title,
            body: input.body,
            attachments: input.attachments !== undefined ? JSON.stringify(input.attachments) : undefined,
          }),
          updated_at: new Date(),
        })
        .returning('*')
      return { id: row.id, title: row.title, body: row.body, attachments: row.attachments, createdBy: row.created_by, updatedAt: row.updated_at }
    }

    const [row] = await db('group_session_creator_notes')
      .insert({
        session_id: sessionId,
        group_id: groupId,
        university_id: context.universityId,
        created_by: context.userId,
        title: input.title ?? null,
        body: input.body ?? null,
        attachments: JSON.stringify(input.attachments ?? []),
      })
      .returning('*')
    return { id: row.id, title: row.title, body: row.body, attachments: row.attachments, createdBy: row.created_by, updatedAt: row.updated_at }
  }

  async getSessionCreatorNotesUploadUrl(context: AuthContext, groupId: string, sessionId: string, fileName: string, contentType: string) {
    await assertMemberAccess(context, groupId)
    const session = await db('group_study_sessions').where({ id: sessionId, group_id: groupId }).first()
    if (!session) throw notFound('Study session not found', 'STUDY_SESSION_NOT_FOUND')
    if (session.created_by !== context.userId) {
      throw forbidden('Only the session creator can upload here', 'SESSION_NOTES_CREATOR_ONLY')
    }
    assertAllowedUploadType(contentType)
    const key = `session-notes/creator/${context.universityId}/${sessionId}/${Date.now()}-${sanitizeFileName(fileName)}`
    const presigned = await getPresignedUploadUrl(key, contentType)
    return { ...presigned, maxSizeBytes: 26214400 }
  }

  async getMySessionPrivateNotes(context: AuthContext, groupId: string, sessionId: string) {
    await assertMemberAccess(context, groupId)
    const row = await db('group_session_member_notes')
      .where({ session_id: sessionId, group_id: groupId, user_id: context.userId })
      .first()
    return row ? { id: row.id, body: row.body, attachments: row.attachments, updatedAt: row.updated_at } : null
  }

  async putMySessionPrivateNotes(context: AuthContext, groupId: string, sessionId: string, input: PutSessionPrivateNotesInput) {
    await assertMemberAccess(context, groupId)
    assertAttachmentsAreOwnUploads(input.attachments)
    const existing = await db('group_session_member_notes')
      .where({ session_id: sessionId, group_id: groupId, user_id: context.userId })
      .first()
    if (existing) {
      const [row] = await db('group_session_member_notes')
        .where({ id: existing.id })
        .update({
          ...pickDefined({
            body: input.body,
            attachments: input.attachments !== undefined ? JSON.stringify(input.attachments) : undefined,
          }),
          updated_at: new Date(),
        })
        .returning('*')
      return { id: row.id, body: row.body, attachments: row.attachments, updatedAt: row.updated_at }
    }

    const [row] = await db('group_session_member_notes')
      .insert({
        session_id: sessionId,
        group_id: groupId,
        university_id: context.universityId,
        user_id: context.userId,
        body: input.body ?? null,
        attachments: JSON.stringify(input.attachments ?? []),
      })
      .returning('*')
    return { id: row.id, body: row.body, attachments: row.attachments, updatedAt: row.updated_at }
  }

  async getSessionPrivateNotesUploadUrl(context: AuthContext, groupId: string, sessionId: string, fileName: string, contentType: string) {
    await assertMemberAccess(context, groupId)
    assertAllowedUploadType(contentType)
    const key = `session-notes/private/${context.universityId}/${sessionId}/${context.userId}/${Date.now()}-${sanitizeFileName(fileName)}`
    const presigned = await getPresignedUploadUrl(key, contentType)
    return { ...presigned, maxSizeBytes: 26214400 }
  }

  async listFlashcardDecks(context: AuthContext, groupId: string) {
    await assertMemberAccess(context, groupId)

    const rows = await flashcardDeckSelectQuery(context.userId)
      .where({
        'group_flashcard_decks.group_id': groupId,
        'group_flashcard_decks.university_id': context.universityId,
        'group_flashcard_decks.is_archived': false,
      })
      .orderBy('group_flashcard_decks.updated_at', 'desc')

    return rows.map(toFlashcardDeck)
  }

  async createFlashcardDeck(context: AuthContext, groupId: string, input: CreateFlashcardDeckInput) {
    await assertMemberAccess(context, groupId)

    const [deck] = await db('group_flashcard_decks')
      .insert({
        group_id: groupId,
        university_id: context.universityId,
        created_by: context.userId,
        title: input.title,
        description: input.description ?? null,
      })
      .returning<{ id: string }[]>('id')

    if (!deck) throw badRequest('Flashcard deck could not be created', 'FLASHCARD_DECK_CREATE_FAILED')

    await badgeQueue.add({
      userId: context.userId,
      universityId: context.universityId,
      action: 'deck_contributed',
      payload: { deckId: deck.id },
    })

    return getFlashcardDeck(context, groupId, deck.id)
  }

  async updateFlashcardDeck(
    context: AuthContext,
    groupId: string,
    deckId: string,
    input: UpdateFlashcardDeckInput,
  ) {
    const access = await assertMemberAccess(context, groupId)
    const deck = await getFlashcardDeckOwner(context, groupId, deckId)
    assertCanEditOwnedResource(access, deck.created_by, context.userId)

    await db('group_flashcard_decks')
      .where({ id: deckId, group_id: groupId, university_id: context.universityId })
      .update({
        ...pickDefined({
          title: input.title,
          description: input.description,
          is_archived: input.is_archived,
        }),
        updated_at: new Date(),
      })

    return getFlashcardDeck(context, groupId, deckId)
  }

  async deleteFlashcardDeck(context: AuthContext, groupId: string, deckId: string) {
    const access = await assertMemberAccess(context, groupId)
    const deck = await getFlashcardDeckOwner(context, groupId, deckId)
    assertCanEditOwnedResource(access, deck.created_by, context.userId)

    await db('group_flashcard_decks')
      .where({ id: deckId, group_id: groupId, university_id: context.universityId })
      .delete()

    return { deleted: true }
  }

  async listFlashcards(context: AuthContext, groupId: string, deckId: string) {
    await assertMemberAccess(context, groupId)
    await getFlashcardDeckOwner(context, groupId, deckId)

    const rows = await flashcardSelectQuery(context.userId)
      .where({
        'group_flashcards.group_id': groupId,
        'group_flashcards.deck_id': deckId,
        'group_flashcards.university_id': context.universityId,
      })
      .orderBy('group_flashcards.created_at', 'asc')

    return rows.map(toFlashcard)
  }

  async createFlashcard(context: AuthContext, groupId: string, deckId: string, input: CreateFlashcardInput) {
    await assertMemberAccess(context, groupId)
    await getFlashcardDeckOwner(context, groupId, deckId)

    let cardId: string
    let firstCardInDeckForUser = false

    await db.transaction(async (trx) => {
      const existingContribution = await trx('group_flashcards')
        .where({
          deck_id: deckId,
          group_id: groupId,
          university_id: context.universityId,
          created_by: context.userId,
        })
        .first<{ id: string }>('id')

      const [card] = await trx('group_flashcards')
        .insert({
          deck_id: deckId,
          group_id: groupId,
          university_id: context.universityId,
          created_by: context.userId,
          front: input.front,
          back: input.back,
          hint: input.hint ?? null,
        })
        .returning<{ id: string }[]>('id')

      if (!card) throw badRequest('Flashcard could not be created', 'FLASHCARD_CREATE_FAILED')
      cardId = card.id
      firstCardInDeckForUser = !existingContribution

      await trx('group_flashcard_decks')
        .where({ id: deckId, group_id: groupId, university_id: context.universityId })
        .increment('card_count', 1)
        .update({ updated_at: new Date() })
    })

    if (firstCardInDeckForUser) {
      await badgeQueue.add({
        userId: context.userId,
        universityId: context.universityId,
        action: 'deck_contributed',
        payload: { deckId },
      })
    }

    return getFlashcard(context, groupId, cardId!)
  }

  async updateFlashcard(context: AuthContext, groupId: string, cardId: string, input: UpdateFlashcardInput) {
    const access = await assertMemberAccess(context, groupId)
    const card = await getFlashcardOwner(context, groupId, cardId)
    assertCanEditCard(access, card, context.userId)

    await db('group_flashcards')
      .where({ id: cardId, group_id: groupId, university_id: context.universityId })
      .update({
        ...pickDefined({
          front: input.front,
          back: input.back,
          hint: input.hint,
        }),
        updated_at: new Date(),
      })

    await db('group_flashcard_decks').where({ id: card.deck_id }).update({ updated_at: new Date() })

    return getFlashcard(context, groupId, cardId)
  }

  async deleteFlashcard(context: AuthContext, groupId: string, cardId: string) {
    const access = await assertMemberAccess(context, groupId)
    const card = await getFlashcardOwner(context, groupId, cardId)
    assertCanEditCard(access, card, context.userId)

    await db.transaction(async (trx) => {
      const deleted = await trx('group_flashcards')
        .where({ id: cardId, group_id: groupId, university_id: context.universityId })
        .delete()

      if (deleted > 0) {
        await trx('group_flashcard_decks')
          .where({ id: card.deck_id, group_id: groupId, university_id: context.universityId })
          .where('card_count', '>', 0)
          .decrement('card_count', 1)
          .update({ updated_at: new Date() })
      }
    })

    return { deleted: true }
  }

  async getFlashcardReviewQueue(context: AuthContext, groupId: string, deckId: string, query: PaginationQuery) {
    await assertMemberAccess(context, groupId)
    await getFlashcardDeckOwner(context, groupId, deckId)

    const dueFilter = (builder: Knex.QueryBuilder) => {
      builder.whereNull('my_review.card_id').orWhere('my_review.due_at', '<=', db.fn.now())
    }

    const [{ count }] = await db('group_flashcards')
      .leftJoin('group_flashcard_reviews as my_review', function joinCurrentReview(this: Knex.JoinClause) {
        this.on('my_review.card_id', '=', 'group_flashcards.id').andOn(
          'my_review.user_id',
          '=',
          db.raw('?', [context.userId]),
        )
      })
      .where({
        'group_flashcards.group_id': groupId,
        'group_flashcards.deck_id': deckId,
        'group_flashcards.university_id': context.universityId,
      })
      .andWhere(dueFilter)
      .count<CountRow[]>({ count: '*' })

    const rows = await flashcardSelectQuery(context.userId)
      .where({
        'group_flashcards.group_id': groupId,
        'group_flashcards.deck_id': deckId,
        'group_flashcards.university_id': context.universityId,
      })
      .andWhere(dueFilter)
      .orderByRaw('CASE WHEN my_review.card_id IS NULL THEN 1 ELSE 0 END ASC')
      .orderBy('my_review.due_at', 'asc')
      .orderBy('group_flashcards.created_at', 'asc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)

    return {
      items: rows.map(toFlashcard),
      total: Number(count),
      page: query.page,
      limit: query.limit,
    }
  }

  async reviewFlashcard(context: AuthContext, groupId: string, cardId: string, input: FlashcardReviewInput) {
    await assertMemberAccess(context, groupId)
    const card = await getFlashcardOwner(context, groupId, cardId)

    const existing = await db('group_flashcard_reviews')
      .where({ card_id: cardId, user_id: context.userId })
      .first<FlashcardReviewRow>()

    const reviewedAt = new Date()
    const schedule = scheduleFlashcardReview(
      existing
        ? {
            easeFactor: Number(existing.ease_factor),
            intervalDays: existing.interval_days,
            repetitionCount: existing.repetition_count,
          }
        : null,
      input.rating,
      reviewedAt,
    )

    await db('group_flashcard_reviews')
      .insert({
        card_id: cardId,
        user_id: context.userId,
        group_id: groupId,
        university_id: context.universityId,
        ease_factor: schedule.easeFactor,
        interval_days: schedule.intervalDays,
        repetition_count: schedule.repetitionCount,
        due_at: schedule.dueAt,
        last_rating: input.rating,
        last_reviewed_at: reviewedAt,
        updated_at: reviewedAt,
      })
      .onConflict(['card_id', 'user_id'])
      .merge({
        group_id: groupId,
        university_id: context.universityId,
        ease_factor: schedule.easeFactor,
        interval_days: schedule.intervalDays,
        repetition_count: schedule.repetitionCount,
        due_at: schedule.dueAt,
        last_rating: input.rating,
        last_reviewed_at: reviewedAt,
        updated_at: reviewedAt,
      })

    await badgeQueue.add({
      userId: context.userId,
      universityId: context.universityId,
      action: 'flashcard_review_completed',
      payload: { cardId, groupId },
    })

    const row = await db('group_flashcard_reviews')
      .where({ card_id: card.id, user_id: context.userId })
      .first<FlashcardReviewRow>()

    return toFlashcardReview(row!)
  }

  async listSharedNotes(context: AuthContext, groupId: string, query: PaginationQuery) {
    await assertMemberAccess(context, groupId)

    const [{ count }] = await db('group_shared_notes')
      .where({ group_id: groupId, university_id: context.universityId })
      .count<CountRow[]>({ count: '*' })

    const rows = await sharedNoteSelectQuery()
      .where({ 'group_shared_notes.group_id': groupId, 'group_shared_notes.university_id': context.universityId })
      .orderBy('group_shared_notes.updated_at', 'desc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)

    return {
      items: rows.map(toSharedNote),
      total: Number(count),
      page: query.page,
      limit: query.limit,
    }
  }

  async createSharedNote(context: AuthContext, groupId: string, input: CreateSharedNoteInput) {
    await assertMemberAccess(context, groupId)
    assertAttachmentsAreOwnUploads(input.attachments)

    const [note] = await db('group_shared_notes')
      .insert({
        group_id: groupId,
        university_id: context.universityId,
        created_by: context.userId,
        title: input.title,
        body: input.body,
        attachments: JSON.stringify(input.attachments ?? []),
      })
      .returning<{ id: string }[]>('id')

    if (!note) throw badRequest('Shared note could not be created', 'SHARED_NOTE_CREATE_FAILED')

    return getSharedNote(context, groupId, note.id)
  }

  async updateSharedNote(context: AuthContext, groupId: string, noteId: string, input: UpdateSharedNoteInput) {
    const access = await assertMemberAccess(context, groupId)
    const note = await getSharedNoteOwner(context, groupId, noteId)
    assertCanEditOwnedResource(access, note.created_by, context.userId)
    assertAttachmentsAreOwnUploads(input.attachments)

    await db('group_shared_notes')
      .where({ id: noteId, group_id: groupId, university_id: context.universityId })
      .update({
        ...pickDefined({
          title: input.title,
          body: input.body,
          attachments: input.attachments !== undefined ? JSON.stringify(input.attachments) : undefined,
        }),
        updated_at: new Date(),
      })

    return getSharedNote(context, groupId, noteId)
  }

  async getSharedNoteUploadUrl(context: AuthContext, groupId: string, fileName: string, contentType: string) {
    await assertMemberAccess(context, groupId)
    assertAllowedUploadType(contentType)

    const key = `group-notes/${context.universityId}/${groupId}/${Date.now()}-${sanitizeFileName(fileName)}`
    const presigned = await getPresignedUploadUrl(key, contentType)

    return { ...presigned, maxSizeBytes: 26214400 }
  }

  async deleteSharedNote(context: AuthContext, groupId: string, noteId: string) {
    const access = await assertMemberAccess(context, groupId)
    const note = await getSharedNoteOwner(context, groupId, noteId)
    assertCanEditOwnedResource(access, note.created_by, context.userId)

    await db('group_shared_notes')
      .where({ id: noteId, group_id: groupId, university_id: context.universityId })
      .delete()

    return { deleted: true }
  }

  async setRules(context: AuthContext, groupId: string, content: string) {
    const access = await assertGroupAccess(context, groupId)
    assertCanAdminGroup(access.user_role)

    await db('groups')
      .where({ id: groupId, university_id: context.universityId })
      .update({ rules_md: content })

    return { rulesMd: content }
  }

  async getAiSettings(context: AuthContext, groupId: string) {
    const group = await this.getGroup(context, groupId)
    return { aiSettings: withAiSettingsDefaults(group.aiSettings) }
  }

  async updateAiSettings(context: AuthContext, groupId: string, patch: Record<string, unknown>) {
    const row = await db('groups').where({ id: groupId, university_id: context.universityId }).first()
    if (!row) throw notFound('Group not found')
    if (row.type !== 'academic') {
      throw forbidden('AI settings are only available on academic groups', 'ACADEMIC_GROUP_REQUIRED')
    }
    await assertGroupAdminAccess(context, groupId)

    await mergeAiSettings(groupId, patch)
    return this.getGroup(context, groupId)
  }

  async listPendingAiContent(context: AuthContext, groupId: string) {
    await assertGroupAdminAccess(context, groupId)
    const group = await db('groups').where({ id: groupId, university_id: context.universityId }).first()
    if (!group) throw notFound('Group not found')
    const settings: Record<string, unknown> = group.ai_settings ?? {}

    const items: Array<{ id: string; type: 'flashcard_deck' | 'quiz'; title?: string; content?: unknown; createdAt?: Date }> = []
    if (settings.pending_deck_id) {
      const deck = await db('group_flashcard_decks')
        .where({ id: settings.pending_deck_id as string, group_id: groupId, university_id: context.universityId })
        .first()
      if (deck) items.push({ id: deck.id, type: 'flashcard_deck', title: deck.title, createdAt: deck.created_at })
    }
    if (typeof settings.pending_quiz_id === 'string') {
      const quiz = await db('group_quizzes')
        .where({ id: settings.pending_quiz_id, group_id: groupId, university_id: context.universityId })
        .first()
      if (quiz) items.push({ id: quiz.id, type: 'quiz', title: quiz.title })
    }
    return items
  }

  async approvePendingAiContent(context: AuthContext, groupId: string, contentId: string) {
    await assertGroupAdminAccess(context, groupId)
    const group = await db('groups').where({ id: groupId, university_id: context.universityId }).first()
    if (!group) throw notFound('Group not found')
    const settings: Record<string, unknown> = group.ai_settings ?? {}

    if (settings.pending_deck_id === contentId) {
      await db('group_flashcard_decks')
        .where({ id: contentId, group_id: groupId, university_id: context.universityId })
        .update({ is_archived: false })
      await mergeAiSettings(groupId, { pending_deck_id: null })

      // Announce the newly-approved deck to the group feed as the campus bot, best-effort.
      const deck = await db('group_flashcard_decks').where({ id: contentId }).first()
      try {
        const botUserId = await contentSyncService.ensureCampusBotUser(context.universityId)
        await feedService.createPost(
          { userId: botUserId, universityId: context.universityId, role: 'faculty' },
          {
            type: 'post',
            content: `New AI flashcard deck ready: ${deck?.title ?? 'Untitled deck'}`,
            group_id: groupId,
            media_urls: [],
            is_published: true,
          },
        )
      } catch (err) {
        // Non-fatal: approval already succeeded. Announcement failures (e.g. bot user
        // provisioning issues) should not roll back or fail the approval itself.
        logger.warn('Failed to post AI content approval announcement', { groupId, contentId, error: err })
      }
      return { approved: true }
    }

    if (settings.pending_quiz_id === contentId) {
      await db('group_quizzes')
        .where({ id: contentId, group_id: groupId, university_id: context.universityId })
        .update({ is_archived: false })
      await mergeAiSettings(groupId, { pending_quiz_id: null })
      return { approved: true }
    }

    throw notFound('Pending content not found')
  }

  async discardPendingAiContent(context: AuthContext, groupId: string, contentId: string) {
    await assertGroupAdminAccess(context, groupId)
    const group = await db('groups').where({ id: groupId, university_id: context.universityId }).first()
    if (!group) throw notFound('Group not found')
    const settings: Record<string, unknown> = group.ai_settings ?? {}

    if (settings.pending_deck_id === contentId) {
      await db('group_flashcard_decks')
        .where({ id: contentId, group_id: groupId, university_id: context.universityId })
        .delete()
      await mergeAiSettings(groupId, { pending_deck_id: null })
      return { discarded: true }
    }

    if (settings.pending_quiz_id === contentId) {
      await db('group_quizzes')
        .where({ id: contentId, group_id: groupId, university_id: context.universityId })
        .del()
      await mergeAiSettings(groupId, { pending_quiz_id: null })
      return { discarded: true }
    }

    throw notFound('Pending content not found')
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
      'current_member.is_muted',
      'groups.pinned_text',
      'groups.pinned_at',
      'groups.pinned_by',
      'groups.ai_settings',
      'groups.require_post_approval',
      'groups.require_event_approval',
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

function flashcardDeckSelectQuery(userId: string) {
  return db('group_flashcard_decks')
    .leftJoin('profiles as cp', 'cp.user_id', 'group_flashcard_decks.created_by')
    .select<FlashcardDeckRow[]>(
      'group_flashcard_decks.id',
      'group_flashcard_decks.group_id',
      'group_flashcard_decks.university_id',
      'group_flashcard_decks.created_by',
      'group_flashcard_decks.title',
      'group_flashcard_decks.description',
      'group_flashcard_decks.is_archived',
      'group_flashcard_decks.card_count',
      'group_flashcard_decks.created_at',
      'group_flashcard_decks.updated_at',
      'cp.full_name as creator_full_name',
      'cp.avatar_url as creator_avatar_url',
      db.raw(
        `(
          SELECT COUNT(*)::int
          FROM group_flashcards due_cards
          LEFT JOIN group_flashcard_reviews due_reviews
            ON due_reviews.card_id = due_cards.id
           AND due_reviews.user_id = ?
          WHERE due_cards.deck_id = group_flashcard_decks.id
            AND (due_reviews.card_id IS NULL OR due_reviews.due_at <= now())
        ) AS due_count`,
        [userId],
      ),
    )
}

function flashcardSelectQuery(userId: string) {
  return db('group_flashcards')
    .leftJoin('profiles as cp', 'cp.user_id', 'group_flashcards.created_by')
    .leftJoin('group_flashcard_reviews as my_review', function joinCurrentReview(this: Knex.JoinClause) {
      this.on('my_review.card_id', '=', 'group_flashcards.id').andOn(
        'my_review.user_id',
        '=',
        db.raw('?', [userId]),
      )
    })
    .select<FlashcardRow[]>(
      'group_flashcards.id',
      'group_flashcards.deck_id',
      'group_flashcards.group_id',
      'group_flashcards.university_id',
      'group_flashcards.created_by',
      'group_flashcards.front',
      'group_flashcards.back',
      'group_flashcards.hint',
      'group_flashcards.created_at',
      'group_flashcards.updated_at',
      'cp.full_name as creator_full_name',
      'cp.avatar_url as creator_avatar_url',
      'my_review.user_id as review_user_id',
      'my_review.ease_factor',
      'my_review.interval_days',
      'my_review.repetition_count',
      'my_review.due_at',
      'my_review.last_reviewed_at',
      'my_review.last_rating',
    )
}

function sharedNoteSelectQuery() {
  return db('group_shared_notes')
    .leftJoin('profiles as cp', 'cp.user_id', 'group_shared_notes.created_by')
    .select<SharedNoteRow[]>(
      'group_shared_notes.id',
      'group_shared_notes.group_id',
      'group_shared_notes.university_id',
      'group_shared_notes.created_by',
      'group_shared_notes.title',
      'group_shared_notes.body',
      'group_shared_notes.created_at',
      'group_shared_notes.updated_at',
      'group_shared_notes.attachments',
      'cp.full_name as creator_full_name',
      'cp.avatar_url as creator_avatar_url',
    )
}

async function getFlashcardDeck(context: AuthContext, groupId: string, deckId: string) {
  const row = await flashcardDeckSelectQuery(context.userId)
    .where({
      'group_flashcard_decks.id': deckId,
      'group_flashcard_decks.group_id': groupId,
      'group_flashcard_decks.university_id': context.universityId,
    })
    .first<FlashcardDeckRow>()

  if (!row) throw notFound('Flashcard deck not found', 'FLASHCARD_DECK_NOT_FOUND')
  return toFlashcardDeck(row)
}

async function getFlashcardDeckOwner(context: AuthContext, groupId: string, deckId: string) {
  const row = await db('group_flashcard_decks')
    .where({ id: deckId, group_id: groupId, university_id: context.universityId })
    .select<{ id: string; created_by: string | null }[]>('id', 'created_by')
    .first()

  if (!row) throw notFound('Flashcard deck not found', 'FLASHCARD_DECK_NOT_FOUND')
  return row
}

async function getFlashcard(context: AuthContext, groupId: string, cardId: string) {
  const row = await flashcardSelectQuery(context.userId)
    .where({
      'group_flashcards.id': cardId,
      'group_flashcards.group_id': groupId,
      'group_flashcards.university_id': context.universityId,
    })
    .first<FlashcardRow>()

  if (!row) throw notFound('Flashcard not found', 'FLASHCARD_NOT_FOUND')
  return toFlashcard(row)
}

async function getFlashcardOwner(context: AuthContext, groupId: string, cardId: string) {
  const row = await db('group_flashcards')
    .join('group_flashcard_decks', 'group_flashcard_decks.id', 'group_flashcards.deck_id')
    .where({
      'group_flashcards.id': cardId,
      'group_flashcards.group_id': groupId,
      'group_flashcards.university_id': context.universityId,
    })
    .select<FlashcardOwnerRow[]>(
      'group_flashcards.id',
      'group_flashcards.deck_id',
      'group_flashcards.created_by',
      'group_flashcard_decks.created_by as deck_created_by',
    )
    .first()

  if (!row) throw notFound('Flashcard not found', 'FLASHCARD_NOT_FOUND')
  return row
}

async function getSharedNote(context: AuthContext, groupId: string, noteId: string) {
  const row = await sharedNoteSelectQuery()
    .where({
      'group_shared_notes.id': noteId,
      'group_shared_notes.group_id': groupId,
      'group_shared_notes.university_id': context.universityId,
    })
    .first<SharedNoteRow>()

  if (!row) throw notFound('Shared note not found', 'SHARED_NOTE_NOT_FOUND')
  return toSharedNote(row)
}

async function getSharedNoteOwner(context: AuthContext, groupId: string, noteId: string) {
  const row = await db('group_shared_notes')
    .where({ id: noteId, group_id: groupId, university_id: context.universityId })
    .select<{ id: string; created_by: string | null }[]>('id', 'created_by')
    .first()

  if (!row) throw notFound('Shared note not found', 'SHARED_NOTE_NOT_FOUND')
  return row
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

export async function assertMemberAccess(context: AuthContext, groupId: string) {
  const group = await assertGroupAccess(context, groupId)
  if (!group.user_role) throw forbidden('You must be a group member', 'GROUP_MEMBER_REQUIRED')
  return group
}

export async function assertGroupAdminAccess(context: AuthContext, groupId: string) {
  const group = await assertGroupAccess(context, groupId)
  assertCanAdminGroup(group.user_role)
  return group
}

async function getMembership(groupId: string, userId: string) {
  return db('group_members').select<{ role: GroupRole }[]>('role').where({ group_id: groupId, user_id: userId }).first()
}

/** The academic group's teacher — the member with `role: 'owner'`, falling back to
 * `groups.created_by` for the rare case where ownership was never seeded as a
 * membership row. */
async function resolveGroupTeacherId(groupId: string, createdBy: string): Promise<string> {
  const owner = await db('group_members')
    .select<{ user_id: string }[]>('user_id')
    .where({ group_id: groupId, role: 'owner' })
    .orderBy('joined_at', 'asc')
    .first()
  return owner?.user_id ?? createdBy
}

/**
 * Keeps a group's class-chat conversation's participant list in sync with membership.
 * A no-op when the group has no chat conversation yet — the chat is created lazily on
 * first `POST /:groupId/chat`, so most groups never pay this query.
 */
async function syncGroupChatParticipant(groupId: string, userId: string, action: 'add' | 'remove') {
  const group = await db('groups')
    .select<{ chat_conversation_id: string | null }[]>('chat_conversation_id')
    .where({ id: groupId })
    .first()
  if (!group?.chat_conversation_id) return

  if (action === 'add') {
    await db('conversation_participants')
      .insert({ conversation_id: group.chat_conversation_id, user_id: userId })
      .onConflict(['conversation_id', 'user_id'])
      .ignore()
  } else {
    await db('conversation_participants')
      .where({ conversation_id: group.chat_conversation_id, user_id: userId })
      .delete()
  }
}

async function getMemberFullName(userId: string): Promise<string> {
  const row = await db('profiles').select<{ full_name: string | null }[]>('full_name').where({ user_id: userId }).first()
  return row?.full_name ?? 'A member'
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

function assertCanEditOwnedResource(access: GroupAccessRow, ownerId: string | null, userId: string) {
  if (ownerId === userId || canModerate(access.user_role)) return
  throw forbidden('Only the creator or group moderators can edit this item', 'GROUP_ROLE_FORBIDDEN')
}

function assertCanEditCard(access: GroupAccessRow, card: FlashcardOwnerRow, userId: string) {
  if (card.created_by === userId || card.deck_created_by === userId || canModerate(access.user_role)) return
  throw forbidden('Only the card creator, deck creator, or group moderators can edit this card', 'GROUP_ROLE_FORBIDDEN')
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

function toFlashcardDeck(row: FlashcardDeckRow) {
  return {
    id: row.id,
    groupId: row.group_id,
    createdBy: row.created_by,
    title: row.title,
    description: row.description,
    isArchived: row.is_archived,
    cardCount: Number(row.card_count),
    dueCount: Number(row.due_count ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    creator: row.created_by
      ? { id: row.created_by, fullName: row.creator_full_name, avatarUrl: row.creator_avatar_url }
      : null,
  }
}

function toFlashcard(row: FlashcardRow) {
  return {
    id: row.id,
    deckId: row.deck_id,
    groupId: row.group_id,
    createdBy: row.created_by,
    front: row.front,
    back: row.back,
    hint: row.hint,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    creator: row.created_by
      ? { id: row.created_by, fullName: row.creator_full_name, avatarUrl: row.creator_avatar_url }
      : null,
    review: row.review_user_id
      ? {
          userId: row.review_user_id,
          easeFactor: Number(row.ease_factor),
          intervalDays: Number(row.interval_days),
          repetitionCount: Number(row.repetition_count),
          dueAt: row.due_at,
          lastReviewedAt: row.last_reviewed_at,
          lastRating: row.last_rating,
        }
      : null,
  }
}

function toFlashcardReview(row: FlashcardReviewRow) {
  return {
    cardId: row.card_id,
    userId: row.user_id,
    groupId: row.group_id,
    easeFactor: Number(row.ease_factor),
    intervalDays: Number(row.interval_days),
    repetitionCount: Number(row.repetition_count),
    dueAt: row.due_at,
    lastReviewedAt: row.last_reviewed_at,
    lastRating: row.last_rating,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toSharedNote(row: SharedNoteRow) {
  return {
    id: row.id,
    groupId: row.group_id,
    createdBy: row.created_by,
    title: row.title,
    body: row.body,
    attachments: row.attachments ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
    // `is_muted` comes from the left-joined membership row, so it is null for non-members.
    // Collapse that to `false` — "not muted" is the honest answer for someone who is not in.
    isMuted: Boolean(row.is_muted),
    aiSettings: withAiSettingsDefaults(row.ai_settings),
    requirePostApproval: row.require_post_approval,
    requireEventApproval: row.require_event_approval,
  }
}

/**
 * Avatar-stack members and the "n people you know" count for a page of groups.
 *
 * Both are per-group aggregates over `group_members`, so they are fetched once for the
 * whole page rather than as correlated subqueries on the list query — the list is already
 * paginated, so the id set is bounded by `limit`.
 */
async function loadGroupSocialProof(groupIds: string[], currentUserId: string) {
  const previewByGroup = new Map<string, { id: string; fullName: string; avatarUrl: string | null }[]>()
  const knownByGroup = new Map<string, number>()

  if (groupIds.length === 0) return { previewByGroup, knownByGroup }

  const previewRows = (await db
    .select<GroupPreviewMemberRow[]>('group_id', 'user_id', 'full_name', 'avatar_url')
    .from(
      db('group_members')
        .join('profiles', 'profiles.user_id', 'group_members.user_id')
        .whereIn('group_members.group_id', groupIds)
        .select(
          'group_members.group_id',
          'group_members.user_id',
          'profiles.full_name',
          'profiles.avatar_url',
          db.raw(
            `row_number() over (
               partition by group_members.group_id
               order by case group_members.role
                 when 'owner' then 0 when 'admin' then 1 when 'moderator' then 2 else 3 end,
                 group_members.joined_at asc
             ) as rn`,
          ),
        )
        .as('ranked'),
    )
    .where('rn', '<=', GROUP_PREVIEW_MEMBER_COUNT)) as GroupPreviewMemberRow[]

  for (const row of previewRows) {
    const list = previewByGroup.get(row.group_id) ?? []
    list.push({ id: row.user_id, fullName: row.full_name, avatarUrl: row.avatar_url })
    previewByGroup.set(row.group_id, list)
  }

  const knownRows = (await db('group_members')
    .join('connections', function joinAcceptedConnections() {
      this.on('connections.status', '=', db.raw('?', ['accepted'])).andOn(function matchEitherSide() {
        this.on(function requesterSide() {
          this.on('connections.requester_id', '=', db.raw('?', [currentUserId])).andOn(
            'connections.addressee_id',
            '=',
            'group_members.user_id',
          )
        }).orOn(function addresseeSide() {
          this.on('connections.addressee_id', '=', db.raw('?', [currentUserId])).andOn(
            'connections.requester_id',
            '=',
            'group_members.user_id',
          )
        })
      })
    })
    .whereIn('group_members.group_id', groupIds)
    .groupBy('group_members.group_id')
    .select<GroupKnownCountRow[]>('group_members.group_id')
    .count({ known_count: '*' })) as GroupKnownCountRow[]

  for (const row of knownRows) knownByGroup.set(row.group_id, Number(row.known_count))

  return { previewByGroup, knownByGroup }
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

function assertAttachmentsAreOwnUploads(attachments: Attachment[] | undefined) {
  assertAttachmentUrlsAreOwnUploads(attachments)
}

function pickDefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined))
}

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}

/**
 * Merges a patch into groups.ai_settings inside the database rather than reading the
 * blob, spreading it in JS, and writing it back. The read-modify-write version lost
 * whichever concurrent write finished first — most often the creator's save being
 * overwritten by the background worker's stale snapshot.
 */
export async function mergeAiSettings(groupId: string, patch: Record<string, unknown>): Promise<void> {
  await db('groups')
    .where({ id: groupId })
    .update({ ai_settings: db.raw(`coalesce(ai_settings, '{}'::jsonb) || ?::jsonb`, [JSON.stringify(patch)]) })
}
