import type { Knex } from 'knex'
import type { UserRole } from '@uniconnect/shared'
import { db } from '../../config/db'
import { env } from '../../config/env'
import { getIo } from '../../socket'
import { badRequest, conflict, forbidden, notFound } from '../../utils/errors'
import type { AttendeesQuery, CreateEventInput, EventListQuery, PaginationQuery, UpdateEventInput } from './schema'

type EventType = 'general' | 'career_fair' | 'seminar' | 'alumni_meetup' | 'workshop' | 'club'
type RsvpStatus = 'going' | 'maybe' | 'not_going'

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
  created_at: Date
  organizer_full_name: string
  organizer_avatar_url: string | null
  organizer_headline: string | null
  organizer_role: UserRole
  going_count: string | number
  maybe_count: string | number
  not_going_count: string | number
  own_rsvp: RsvpStatus | null
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
      .modify((builder) => {
        if (context.role !== 'admin') builder.andWhere('events.is_published', true)
        applyEventFilters(builder, query)
      })
      .orderBy('events.starts_at', 'asc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)) as EventRow[]

    return { items: rows.map(toEvent), total, page: query.page, limit: query.limit }
  }

  async createEvent(context: AuthContext, input: CreateEventInput) {
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
          is_published: input.is_published ?? false,
        })
        .returning<{ id: string }[]>('id')

      if (!event) throw badRequest('Event could not be created', 'EVENT_CREATE_FAILED')
      return event.id
    })

    return this.getEvent(context, eventId)
  }

  async getEvent(context: AuthContext, eventId: string) {
    const row = await eventSelectQuery(db, context.userId)
      .where({ 'events.id': eventId, 'events.university_id': context.universityId })
      .first<EventRow>()

    if (!row) throw notFound('Event not found', 'EVENT_NOT_FOUND')
    assertCanViewEvent(context, row)
    return toEvent(row)
  }

  async updateEvent(context: AuthContext, eventId: string, input: UpdateEventInput) {
    const event = await assertEventInUniversity(eventId, context.universityId)
    assertCanMutateEvent(context, event.organizer_id)

    await db('events')
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

  async rsvpEvent(context: AuthContext, eventId: string, status: RsvpStatus) {
    await db.transaction(async (trx) => {
      const event = await trx('events')
        .select<EventAccessRow[]>('id', 'university_id', 'organizer_id', 'is_published', 'capacity')
        .where({ id: eventId, university_id: context.universityId })
        .first()
        .forUpdate()

      if (!event) throw notFound('Event not found', 'EVENT_NOT_FOUND')
      assertCanViewEvent(context, event)

      if (status === 'going' && event.capacity !== null) {
        const [{ count }] = await trx('event_rsvps')
          .where({ event_id: eventId, status: 'going' })
          .whereNot('user_id', context.userId)
          .count<CountRow[]>({ count: '*' })

        if (Number(count) >= event.capacity) {
          throw conflict('Event is at capacity', 'EVENT_AT_CAPACITY')
        }
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
    })

    const payload = { eventId, userId: context.userId, status }
    getIo().to(`uni:${context.universityId}`).emit('event:rsvp', payload)
    return payload
  }

  async deleteRsvp(context: AuthContext, eventId: string) {
    await assertVisibleEvent(context, eventId)
    await db('event_rsvps').where({ event_id: eventId, user_id: context.userId }).delete()
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

  async listMyEvents(context: AuthContext, query: PaginationQuery) {
    const [{ count }] = await db('event_rsvps')
      .join('events', 'events.id', 'event_rsvps.event_id')
      .where({
        'event_rsvps.user_id': context.userId,
        'event_rsvps.status': 'going',
        'events.university_id': context.universityId,
      })
      .count<CountRow[]>({ count: '*' })
    const total = Number(count)

    const rows = (await eventSelectQuery(db, context.userId)
      .join('event_rsvps as my_rsvp_filter', 'my_rsvp_filter.event_id', 'events.id')
      .where({
        'my_rsvp_filter.user_id': context.userId,
        'my_rsvp_filter.status': 'going',
        'events.university_id': context.universityId,
      })
      .modify((builder) => {
        if (context.role !== 'admin') builder.andWhere('events.is_published', true)
      })
      .orderBy('events.starts_at', 'asc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)) as EventRow[]

    return { items: rows.map(toEvent), total, page: query.page, limit: query.limit }
  }
}

export const eventsService = new EventsService()

function eventBaseQuery(knex: Knex, context: AuthContext) {
  const query = knex('events').where('events.university_id', context.universityId)
  if (context.role !== 'admin') query.andWhere('events.is_published', true)
  return query
}

function applyEventFilters(query: Knex.QueryBuilder, filters: Partial<EventListQuery>) {
  if (filters.type) query.andWhere('events.type', filters.type)
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
    )
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

function assertCanViewEvent(context: AuthContext, event: { organizer_id: string; is_published: boolean }) {
  if (event.is_published || context.role === 'admin' || context.userId === event.organizer_id) return
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
    previewAttendees: [],
    totalAttendees: goingCount,
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
