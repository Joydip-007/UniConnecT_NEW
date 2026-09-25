import type { Knex } from 'knex'
import type { UserRole } from '@uniconnect/shared'
import { db } from '../../config/db'
import { env } from '../../config/env'
import { getIo } from '../../socket'
import { notificationQueue } from '../../queues/notification.queue'
import { badRequest, conflict, forbidden, notFound } from '../../utils/errors'
import { addUserAttachments, getAttachmentsFor, removeAttachments } from '../content-sync/attachments'
import { notifyGroupReviewers } from '../groups/review-notify'
import { canModerate, loadGroupApprovalContext } from '../groups/permissions'
import { logger } from '../../utils/logger'
import type {
  AttendeesQuery,
  CreateEventInput,
  EventDatesQuery,
  EventListQuery,
  MyEventsQuery,
  UpdateEventInput,
} from './schema'

type EventType = 'general' | 'career_fair' | 'seminar' | 'alumni_meetup' | 'workshop' | 'club'
type RsvpStatus = 'going' | 'maybe' | 'not_going' | 'waitlisted'

/**
 * When an event ends. One without `ends_at` is treated as an hour long, so the
 * upcoming / ongoing / past split, the conflict check and the card's "Ended" state all
 * agree on a single definition (the web mirrors it in `eventEndsAt`).
 */
const EVENT_END_SQL = "COALESCE(events.ends_at, events.starts_at + interval '1 hour')"
const TOP_ORGANISERS_LIMIT = 5
const EVENT_DATES_LIMIT = 500

interface AuthContext {
  userId: string
  universityId: string
  role: UserRole
}

interface CountRow {
  count: string | number
}

interface EventRow {
  id: string
  university_id: string
  organizer_id: string
  group_id: string | null
  title: string
  description: string
  location: string
  is_online: boolean
  online_link: string | null
  cover_url: string | null
  starts_at: Date
  ends_at: Date | null
  capacity: number | null
  type: EventType
  is_published: boolean
  is_imported: boolean
  group_review_status: 'pending' | 'approved' | 'declined' | null
  created_at: Date
  organizer_full_name: string
  organizer_avatar_url: string | null
  organizer_headline: string | null
  organizer_role: UserRole
  going_count: string | number
  maybe_count: string | number
  not_going_count: string | number
  own_rsvp: RsvpStatus | null
  waitlist_count: string | number
  own_waitlist_position: string | number
  preview_attendees: { id: string; fullName: string; avatarUrl: string | null }[] | null
  conflict: { id: string; title: string; startsAt: string } | null
}

interface EventAccessRow {
  id: string
  university_id: string
  organizer_id: string
  is_published: boolean
  capacity: number | null
}

interface AttendeeRow {
  user_id: string
  status: RsvpStatus
  created_at: Date
  email: string
  role: UserRole
  full_name: string
  avatar_url: string | null
  headline: string | null
  department: string | null
  batch_year: string | null
}

export class EventsService {
  async listEvents(context: AuthContext, query: EventListQuery) {
    const countQuery = eventBaseQuery(db, context)
    applyEventFilters(countQuery, query)

    const [{ count }] = await countQuery.count<CountRow[]>({ count: '*' })
    const total = Number(count)

    const rows = (await eventSelectQuery(db, context.userId)
      .where('events.university_id', context.universityId)
      .andWhere('events.is_published', true)
      .modify((builder) => {
        applyEventFilters(builder, query)
      })
      // Past reads newest-first — the event that just finished is the one you're after.
      .orderBy('events.starts_at', query.when === 'past' ? 'desc' : 'asc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)) as EventRow[]

    return { items: rows.map(toEvent), total, page: query.page, limit: query.limit }
  }

  /** Start instants (and types) of published events in a window — the date picker's dots. */
  async listEventDates(context: AuthContext, query: EventDatesQuery) {
    const rows = await eventBaseQuery(db, context)
      .modify((builder) => applyEventFilters(builder, { type: query.type, from: query.from, to: query.to }))
      .select<{ starts_at: Date; type: EventType }[]>('events.starts_at', 'events.type')
      .orderBy('events.starts_at', 'asc')
      .limit(EVENT_DATES_LIMIT)
    return rows.map((row) => ({ startsAt: row.starts_at, type: row.type }))
  }

  /**
   * Who is putting on the most upcoming events: a group when the event belongs to one,
   * otherwise the person who organised it.
   */
  async listTopOrganisers(context: AuthContext) {
    const rows = (await eventBaseQuery(db, context)
      .leftJoin('groups', 'groups.id', 'events.group_id')
      .join('profiles', 'profiles.user_id', 'events.organizer_id')
      .where('events.starts_at', '>', db.fn.now())
      .select(
        db.raw("CASE WHEN events.group_id IS NULL THEN 'user' ELSE 'group' END AS kind"),
        db.raw('COALESCE(events.group_id, events.organizer_id) AS id'),
        db.raw('COALESCE(groups.name, profiles.full_name) AS name'),
        db.raw('COALESCE(groups.avatar_url, profiles.avatar_url) AS avatar_url'),
        db.raw('COUNT(*)::int AS upcoming_count'),
      )
      .groupByRaw('1, 2, 3, 4')
      .orderBy([
        { column: 'upcoming_count', order: 'desc' },
        { column: 'name', order: 'asc' },
      ])
      .limit(TOP_ORGANISERS_LIMIT)) as {
      kind: 'group' | 'user'
      id: string
      name: string
      avatar_url: string | null
      upcoming_count: number
    }[]

    return rows.map((row) => ({
      kind: row.kind,
      id: row.id,
      name: row.name,
      avatarUrl: row.avatar_url,
      upcomingCount: Number(row.upcoming_count),
    }))
  }

  async createEvent(context: AuthContext, input: CreateEventInput) {
    // A group with `require_event_approval` on holds a non-moderator member's event for
    // review, same rule as posts — but only when the organizer actually asked to
    // publish it now. A draft event (is_published: false) has nothing to hold.
    const willPublish = input.is_published ?? false
    let reviewPending = false
    if (input.group_id && willPublish) {
      const g = await loadGroupApprovalContext(input.group_id, context.userId)
      reviewPending = !!g?.require_event_approval && !canModerate(g?.role)
    }

    const eventId = await db.transaction(async (trx) => {
      const [event] = await trx('events')
        .insert({
          university_id: context.universityId,
          organizer_id: context.userId,
          group_id: input.group_id ?? null,
          title: input.title,
          description: input.description,
          location: input.location,
          is_online: input.is_online,
          online_link: input.online_link ?? null,
          cover_url: input.cover_url ?? null,
          starts_at: new Date(input.starts_at ?? ''),
          ends_at: input.ends_at ? new Date(input.ends_at) : null,
          capacity: input.capacity ?? null,
          type: input.type,
          is_published: reviewPending ? false : willPublish,
          group_review_status: reviewPending ? 'pending' : null,
        })
        .returning<{ id: string }[]>('id')

      if (!event) throw badRequest('Event could not be created', 'EVENT_CREATE_FAILED')

      await addUserAttachments(trx, {
        universityId: context.universityId,
        entityType: 'event',
        entityId: event.id,
        uploadedBy: context.userId,
        attachments: input.attachments ?? [],
      })
      return event.id
    })

    if (reviewPending && input.group_id) {
      notifyGroupReviewers(input.group_id).catch((err: unknown) =>
        logger.warn('Failed to notify group reviewers of a pending event', { err, groupId: input.group_id }),
      )
    }

    return this.getEvent(context, eventId)
  }

  async getEvent(context: AuthContext, eventId: string) {
    const row = await eventSelectQuery(db, context.userId)
      .where({ 'events.id': eventId, 'events.university_id': context.universityId })
      .first<EventRow>()

    if (!row) throw notFound('Event not found', 'EVENT_NOT_FOUND')
    assertCanViewEvent(context, row)
    const attachments = await getAttachmentsFor('event', eventId)
    return { ...toEvent(row), attachments }
  }

  /**
   * Hydrates an arbitrary set of event ids into `Event` shapes, preserving order and
   * bypassing the normal publish/organizer visibility gate — the caller (the groups
   * review queue) has already authorized itself as a group moderator.
   */
  async listEventsByIds(userId: string, ids: string[]) {
    if (ids.length === 0) return []
    const rows = (await eventSelectQuery(db, userId).whereIn('events.id', ids)) as EventRow[]
    const byId = new Map(rows.map((row) => [row.id, row]))
    return ids.map((id) => byId.get(id)).filter((row): row is EventRow => row !== undefined).map(toEvent)
  }

  async updateEvent(context: AuthContext, eventId: string, input: UpdateEventInput) {
    const event = await assertEventInUniversity(eventId, context.universityId)
    assertCanMutateEvent(context, event.organizer_id)

    const promoted = await db.transaction(async (trx) => {
      await trx('events')
        .where({ id: eventId, university_id: context.universityId })
        .update({
          ...pickDefined({
            group_id: input.group_id,
            title: input.title,
            description: input.description,
            location: input.location,
            is_online: input.is_online,
            online_link: input.online_link,
            cover_url: input.cover_url,
            starts_at: input.starts_at ? new Date(input.starts_at) : undefined,
            ends_at: input.ends_at ? new Date(input.ends_at) : input.ends_at,
            capacity: input.capacity,
            type: input.type,
          }),
        })

      await removeAttachments(trx, {
        universityId: context.universityId,
        entityType: 'event',
        entityId: eventId,
        ids: input.removedAttachmentIds ?? [],
      })
      await addUserAttachments(trx, {
        universityId: context.universityId,
        entityType: 'event',
        entityId: eventId,
        uploadedBy: context.userId,
        attachments: input.attachments ?? [],
      })

      // Raising (or removing) the cap opens seats the waitlist is owed.
      return input.capacity !== undefined ? promoteFromWaitlist(trx, eventId) : []
    })

    await announcePromotions(context.universityId, eventId, promoted)
    return this.getEvent(context, eventId)
  }

  async deleteEvent(context: AuthContext, eventId: string) {
    const event = await assertEventInUniversity(eventId, context.universityId)
    assertCanMutateEvent(context, event.organizer_id)

    await db('events').where({ id: eventId, university_id: context.universityId }).delete()
    return { deleted: true }
  }

  async publishEvent(context: AuthContext, eventId: string) {
    const event = await assertEventInUniversity(eventId, context.universityId)
    assertCanMutateEvent(context, event.organizer_id)

    await db('events').where({ id: eventId, university_id: context.universityId }).update({ is_published: true })
    return this.getEvent(context, eventId)
  }

  async rsvpEvent(context: AuthContext, eventId: string, requested: RsvpStatus) {
    let status = requested
    const promoted = await db.transaction(async (trx) => {
      const event = await trx('events')
        .select<EventAccessRow[]>('id', 'university_id', 'organizer_id', 'is_published', 'capacity')
        .where({ id: eventId, university_id: context.universityId })
        .first()
        .forUpdate()

      if (!event) throw notFound('Event not found', 'EVENT_NOT_FOUND')
      assertCanViewEvent(context, event)

      const previous = await trx('event_rsvps')
        .where({ event_id: eventId, user_id: context.userId })
        .first<{ status: RsvpStatus } | undefined>('status')

      if (status === 'going' || status === 'waitlisted') {
        const [{ count }] = await trx('event_rsvps')
          .where({ event_id: eventId, status: 'going' })
          .whereNot('user_id', context.userId)
          .count<CountRow[]>({ count: '*' })
        const full = event.capacity !== null && Number(count) >= event.capacity

        if (status === 'going' && full) {
          throw conflict('Event is at capacity', 'EVENT_AT_CAPACITY')
        }
        // Asking to queue for a seat that is free just takes the seat.
        if (status === 'waitlisted' && !full) status = 'going'
        // Re-joining the queue you're already in must not cost you your place.
        if (status === 'waitlisted' && previous?.status === 'waitlisted') return []
      }

      await trx('event_rsvps')
        .insert({
          event_id: eventId,
          user_id: context.userId,
          status,
        })
        .onConflict(['event_id', 'user_id'])
        .merge({
          status,
          created_at: trx.fn.now(),
        })

      return previous?.status === 'going' && status !== 'going' ? promoteFromWaitlist(trx, eventId) : []
    })

    const payload = { eventId, userId: context.userId, status }
    getIo().to(`uni:${context.universityId}`).emit('event:rsvp', payload)
    await announcePromotions(context.universityId, eventId, promoted)
    return payload
  }

  async deleteRsvp(context: AuthContext, eventId: string) {
    await assertVisibleEvent(context, eventId)
    const promoted = await db.transaction(async (trx) => {
      const [removed] = await trx('event_rsvps')
        .where({ event_id: eventId, user_id: context.userId })
        .delete()
        .returning<{ status: RsvpStatus }[]>('status')
      return removed?.status === 'going' ? promoteFromWaitlist(trx, eventId) : []
    })
    await announcePromotions(context.universityId, eventId, promoted)
    return { rsvp: null }
  }

  async listAttendees(context: AuthContext, eventId: string, query: AttendeesQuery) {
    await assertVisibleEvent(context, eventId)

    const countQuery = db('event_rsvps').where('event_id', eventId)
    if (query.status) countQuery.andWhere('status', query.status)

    const [{ count }] = await countQuery.count<CountRow[]>({ count: '*' })
    const total = Number(count)

    const rows = (await db('event_rsvps')
      .join('users', 'users.id', 'event_rsvps.user_id')
      .join('profiles', 'profiles.user_id', 'users.id')
      .select(
        'event_rsvps.user_id',
        'event_rsvps.status',
        'event_rsvps.created_at',
        'users.email',
        'users.role',
        'profiles.full_name',
        'profiles.avatar_url',
        'profiles.headline',
        'profiles.department',
        'profiles.batch_year',
      )
      .where('event_rsvps.event_id', eventId)
      .modify((builder) => {
        if (query.status) builder.andWhere('event_rsvps.status', query.status)
      })
      .orderBy('event_rsvps.created_at', 'desc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)) as AttendeeRow[]

    return { items: rows.map(toAttendee), total, page: query.page, limit: query.limit }
  }

  async getEventIcal(context: AuthContext, eventId: string) {
    const event = await this.getEvent(context, eventId)
    return buildIcal(event)
  }

  async listMyEvents(context: AuthContext, query: MyEventsQuery) {
    const [{ count }] = await db('event_rsvps')
      .join('events', 'events.id', 'event_rsvps.event_id')
      .where({
        'event_rsvps.user_id': context.userId,
        'event_rsvps.status': 'going',
        'events.university_id': context.universityId,
        'events.is_published': true,
      })
      .modify((builder) => applyEventFilters(builder, { from: query.from }))
      .count<CountRow[]>({ count: '*' })
    const total = Number(count)

    const rows = (await eventSelectQuery(db, context.userId)
      .join('event_rsvps as my_rsvp_filter', 'my_rsvp_filter.event_id', 'events.id')
      .where({
        'my_rsvp_filter.user_id': context.userId,
        'my_rsvp_filter.status': 'going',
        'events.university_id': context.universityId,
      })
      .andWhere('events.is_published', true)
      .modify((builder) => applyEventFilters(builder, { from: query.from }))
      .orderBy('events.starts_at', 'asc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)) as EventRow[]

    return { items: rows.map(toEvent), total, page: query.page, limit: query.limit }
  }
}

export const eventsService = new EventsService()

function eventBaseQuery(knex: Knex, context: AuthContext) {
  // Drafts never appear in public listings — author-only, surfaced in the "Drafts" view.
  return knex('events').where('events.university_id', context.universityId).andWhere('events.is_published', true)
}

function applyEventFilters(query: Knex.QueryBuilder, filters: Partial<EventListQuery>) {
  if (filters.type) query.andWhere('events.type', filters.type)
  if (filters.when === 'upcoming') query.andWhere('events.starts_at', '>', db.fn.now())
  if (filters.when === 'ongoing') query.andWhereRaw(`events.starts_at <= now() AND ${EVENT_END_SQL} >= now()`)
  if (filters.when === 'past') query.andWhereRaw(`${EVENT_END_SQL} < now()`)
  if (filters.from) query.andWhere('events.starts_at', '>=', new Date(filters.from))
  if (filters.to) query.andWhere('events.starts_at', '<=', new Date(filters.to))
}

function eventSelectQuery(knex: Knex, userId: string) {
  return knex('events')
    .join('users', 'users.id', 'events.organizer_id')
    .join('profiles', 'profiles.user_id', 'users.id')
    .select<EventRow[]>(
      'events.id',
      'events.university_id',
      'events.organizer_id',
      'events.group_id',
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
      'events.is_imported',
      'events.group_review_status',
      'events.created_at',
      'profiles.full_name as organizer_full_name',
      'profiles.avatar_url as organizer_avatar_url',
      'profiles.headline as organizer_headline',
      'users.role as organizer_role',
      knex.raw(
        "(SELECT COUNT(*)::int FROM event_rsvps WHERE event_rsvps.event_id = events.id AND status = 'going') AS going_count",
      ),
      knex.raw(
        "(SELECT COUNT(*)::int FROM event_rsvps WHERE event_rsvps.event_id = events.id AND status = 'maybe') AS maybe_count",
      ),
      knex.raw(
        "(SELECT COUNT(*)::int FROM event_rsvps WHERE event_rsvps.event_id = events.id AND status = 'not_going') AS not_going_count",
      ),
      knex.raw('(SELECT status FROM event_rsvps WHERE event_id = events.id AND user_id = ? LIMIT 1) AS own_rsvp', [
        userId,
      ]),
      knex.raw(
        "(SELECT COUNT(*)::int FROM event_rsvps WHERE event_rsvps.event_id = events.id AND status = 'waitlisted') AS waitlist_count",
      ),
      // 1-based place in the queue; 0 when the viewer isn't on it.
      knex.raw(
        `(SELECT COUNT(*)::int FROM event_rsvps w
            WHERE w.event_id = events.id AND w.status = 'waitlisted'
              AND w.created_at <= (SELECT m.created_at FROM event_rsvps m
                                    WHERE m.event_id = events.id AND m.user_id = ? AND m.status = 'waitlisted')
          ) AS own_waitlist_position`,
        [userId],
      ),
      // The card's face stack: the first three people to say they're going.
      knex.raw(
        `(SELECT json_agg(json_build_object('id', a.user_id, 'fullName', a.full_name, 'avatarUrl', a.avatar_url))
            FROM (SELECT r.user_id, p.full_name, p.avatar_url FROM event_rsvps r
                    JOIN profiles p ON p.user_id = r.user_id
                   WHERE r.event_id = events.id AND r.status = 'going'
                   ORDER BY r.created_at ASC LIMIT 3) a
          ) AS preview_attendees`,
      ),
      // The earliest other event the viewer is going to whose time overlaps this one.
      knex.raw(
        `(SELECT json_build_object('id', o.id, 'title', o.title, 'startsAt', o.starts_at)
            FROM events o
            JOIN event_rsvps orr ON orr.event_id = o.id AND orr.user_id = ? AND orr.status = 'going'
           WHERE o.id <> events.id AND o.is_published = true
             AND o.starts_at < ${EVENT_END_SQL}
             AND ${EVENT_END_SQL.replace(/events\./g, 'o.')} > events.starts_at
           ORDER BY o.starts_at ASC LIMIT 1
          ) AS conflict`,
        [userId],
      ),
    )
}

/**
 * Hands every free seat to the waitlist, oldest first. Runs inside the caller's
 * transaction after the change that freed the seat, and returns who got one.
 */
async function promoteFromWaitlist(trx: Knex.Transaction, eventId: string): Promise<string[]> {
  const event = await trx('events').where({ id: eventId }).first<{ capacity: number | null } | undefined>('capacity').forUpdate()
  if (!event) return []

  let limit: number | undefined
  if (event.capacity !== null) {
    const [{ count }] = await trx('event_rsvps').where({ event_id: eventId, status: 'going' }).count<CountRow[]>({ count: '*' })
    limit = Math.max(0, event.capacity - Number(count))
    if (limit === 0) return []
  }

  const next = await trx('event_rsvps')
    .where({ event_id: eventId, status: 'waitlisted' })
    .orderBy('created_at', 'asc')
    .modify((builder) => {
      if (limit !== undefined) builder.limit(limit)
    })
    .forUpdate()
    .pluck<string[]>('user_id')
  if (next.length === 0) return []

  await trx('event_rsvps')
    .where({ event_id: eventId, status: 'waitlisted' })
    .whereIn('user_id', next)
    .update({ status: 'going', created_at: trx.fn.now() })
  return next
}

/** Tells each promoted person they're in — after commit, so a rollback never notifies. */
async function announcePromotions(universityId: string, eventId: string, userIds: string[]) {
  if (userIds.length === 0) return
  const event = await db('events').where({ id: eventId }).first<{ title: string } | undefined>('title')
  for (const userId of userIds) {
    getIo().to(`uni:${universityId}`).emit('event:rsvp', { eventId, userId, status: 'going' })
    await notificationQueue
      .add({
        universityId,
        userId,
        type: 'event_waitlist_promoted',
        referenceId: eventId,
        referenceType: 'event',
        content: `A seat opened up: you're going to ${event?.title ?? 'an event'}`,
        payload: { eventId },
      })
      .catch((err: unknown) => logger.warn('Failed to enqueue waitlist promotion notice', { err, eventId, userId }))
  }
}

async function assertEventInUniversity(eventId: string, universityId: string) {
  const event = await db('events')
    .select<EventAccessRow[]>('id', 'university_id', 'organizer_id', 'is_published', 'capacity')
    .where({ id: eventId, university_id: universityId })
    .first()

  if (!event) throw notFound('Event not found', 'EVENT_NOT_FOUND')
  return event
}

async function assertVisibleEvent(context: AuthContext, eventId: string) {
  const event = await assertEventInUniversity(eventId, context.universityId)
  assertCanViewEvent(context, event)
  return event
}

function assertCanViewEvent(
  context: AuthContext,
  event: { organizer_id: string; is_published: boolean; is_imported?: boolean },
) {
  // Published → anyone. Draft → only the organizer, or an admin reviewing an imported item.
  if (event.is_published) return
  if (context.userId === event.organizer_id) return
  if (context.role === 'admin' && event.is_imported) return
  throw notFound('Event not found', 'EVENT_NOT_FOUND')
}

function assertCanMutateEvent(context: AuthContext, organizerId: string) {
  if (context.userId === organizerId || context.role === 'admin') return
  throw forbidden('You do not have permission to modify this event', 'EVENT_FORBIDDEN')
}

function toEvent(row: EventRow) {
  const goingCount = Number(row.going_count)
  return {
    id: row.id,
    universityId: row.university_id,
    organizerId: row.organizer_id,
    groupId: row.group_id,
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
    isPublished: row.is_published,
    groupReviewStatus: row.group_review_status ?? null,
    createdAt: row.created_at,
    organizer: {
      id: row.organizer_id,
      fullName: row.organizer_full_name,
      avatarUrl: row.organizer_avatar_url,
      headline: row.organizer_headline,
      role: row.organizer_role,
    },
    rsvpCounts: {
      going: goingCount,
      maybe: Number(row.maybe_count),
      not_going: Number(row.not_going_count),
    },
    ownRsvp: row.own_rsvp,
    myRsvp: row.own_rsvp,
    previewAttendees: row.preview_attendees ?? [],
    totalAttendees: goingCount,
    waitlistCount: Number(row.waitlist_count),
    waitlistPosition: Number(row.own_waitlist_position) || null,
    conflict: row.conflict,
  }
}

function toAttendee(row: AttendeeRow) {
  return {
    id: row.user_id,
    userId: row.user_id,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    profile: {
      headline: row.headline,
      department: row.department,
    },
    status: row.status,
    createdAt: row.created_at,
    user: {
      id: row.user_id,
      email: row.email,
      role: row.role,
      fullName: row.full_name,
      avatarUrl: row.avatar_url,
      headline: row.headline,
      department: row.department,
      batchYear: row.batch_year,
    },
  }
}

function buildIcal(event: ReturnType<typeof toEvent>) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    `UID:${event.id}@uniconnect`,
    `SUMMARY:${escapeIcalText(event.title)}`,
    `DTSTART:${formatIcalDate(event.startsAt)}`,
    event.endsAt ? `DTEND:${formatIcalDate(event.endsAt)}` : null,
    `LOCATION:${escapeIcalText(event.location)}`,
    `DESCRIPTION:${escapeIcalText(event.description)}`,
    `URL:${env.CLIENT_URL}/events/${event.id}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter((line): line is string => line !== null)

  return `${lines.join('\r\n')}\r\n`
}

function formatIcalDate(value: Date) {
  return value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function escapeIcalText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

function pickDefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined))
}
