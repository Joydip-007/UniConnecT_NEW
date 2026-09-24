import { db } from '../../config/db'
import { getIo } from '../../socket'
import { emailQueue } from '../../queues/email.queue'
import { notificationQueue } from '../../queues/notification.queue'
import { mentorshipQueue } from '../../queues/mentorship.queue'
import { badRequest, conflict, forbidden, notFound } from '../../utils/errors'
import type { UserRole } from '@uniconnect/shared'
import type {
  AlumniListQuery,
  CreateRequestInput,
  CreateSessionInput,
  IncomingRequestsQuery,
  PaginationQuery,
  RedeemGiftCardInput,
  SubmitFeedbackInput,
  UpdateRequestInput,
  UpdateSessionInput,
} from './schema'

export const POINTS_PER_SESSION = 10
export const POINTS_PER_USD = 100

type RequestStatus = 'pending' | 'accepted' | 'declined' | 'completed' | 'expired'

interface GiftCardRow {
  id: string
  vendor: string
  title: string
  description: string | null
  image_url: string | null
  value_usd_cents: number
  threshold_points: number
}

interface RedemptionHistoryRow {
  id: string
  points_spent: number
  status: 'pending' | 'fulfilled' | 'rejected'
  code_text: string | null
  admin_note: string | null
  requested_at: Date
  fulfilled_at: Date | null
  gift_card_id: string | null
  vendor: string | null
  title: string | null
  value_usd_cents: number | null
  image_url: string | null
}

interface AuthContext {
  userId: string
  universityId: string
  role: UserRole
}

interface CountRow {
  count: string | number
}

interface AlumniRow {
  id: string
  university_id: string
  full_name: string
  headline: string | null
  department: string | null
  batch_year: string | null
  skills: string[] | null
  avatar_url: string | null
  max_mentees: number
  current_mentees: string | number
}

interface RequestRow {
  id: string
  university_id: string
  student_id: string
  alumni_id: string
  message: string
  status: RequestStatus
  session_notes: string | null
  conversation_id: string | null
  created_at: Date
  updated_at: Date
  // alumni fields (for my-requests)
  alumni_full_name?: string
  alumni_avatar_url?: string | null
  alumni_headline?: string | null
  alumni_department?: string | null
  alumni_batch_year?: string | null
  alumni_role?: UserRole
  // student fields (for incoming)
  student_full_name?: string
  student_avatar_url?: string | null
  student_headline?: string | null
  student_department?: string | null
  student_batch_year?: string | null
  student_role?: UserRole
}

interface RequestDetailRow extends RequestRow {
  alumni_full_name: string
  alumni_avatar_url: string | null
  alumni_headline: string | null
  student_full_name: string
  student_avatar_url: string | null
  student_department: string | null
  student_batch_year: string | null
}

interface SessionRow {
  id: string
  university_id: string
  request_id: string
  created_by: string
  session_date: string
  duration_minutes: number
  topic: string
  notes: string | null
  created_at: Date
  updated_at: Date
}

export class MentorshipService {
  async listAlumni(universityId: string, query: AlumniListQuery) {
    const base = db('users')
      .join('profiles', 'profiles.user_id', 'users.id')
      .where({
        'users.university_id': universityId,
        'users.role': 'alumni',
        'profiles.is_open_to_mentorship': true,
      })

    const [{ count }] = await base.clone().count<CountRow[]>({ count: '*' })
    const total = Number(count)

    const rows = await base
      .clone()
      .select<AlumniRow[]>(
        'users.id',
        'users.university_id',
        'profiles.full_name',
        'profiles.headline',
        'profiles.department',
        'profiles.batch_year',
        'profiles.skills',
        'profiles.avatar_url',
        'profiles.max_mentees',
        db.raw(
          `(SELECT COUNT(*) FROM mentorship_requests mr
             WHERE mr.alumni_id = users.id
               AND mr.status = 'accepted'
               AND mr.is_deleted = false) AS current_mentees`,
        ),
      )
      .orderBy('profiles.full_name', 'asc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)

    return {
      items: rows.map(toAlumni),
      total,
      page: query.page,
      hasMore: query.page * query.limit < total,
    }
  }

  async createRequest(context: AuthContext, input: CreateRequestInput) {
    if (context.role !== 'student') {
      throw forbidden('Only students can send mentorship requests', 'MENTORSHIP_STUDENT_ONLY')
    }

    // Verify alumni exists, belongs to same university, and is open to mentorship
    const alumni = await db('users')
      .join('profiles', 'profiles.user_id', 'users.id')
      .where({
        'users.id': input.alumniId,
        'users.university_id': context.universityId,
        'users.role': 'alumni',
        'profiles.is_open_to_mentorship': true,
      })
      .select<{ id: string; full_name: string }[]>('users.id', 'profiles.full_name')
      .first()

    if (!alumni) throw notFound('Alumni not found or not open to mentorship', 'ALUMNI_NOT_FOUND')

    let requestId: string
    try {
      const [row] = await db('mentorship_requests')
        .insert({
          university_id: context.universityId,
          student_id: context.userId,
          alumni_id: input.alumniId,
          message: input.message,
        })
        .returning<{ id: string }[]>('id')

      if (!row) throw badRequest('Request could not be created', 'REQUEST_CREATE_FAILED')
      requestId = row.id
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw conflict('A mentorship request already exists for this alumni', 'REQUEST_ALREADY_EXISTS')
      }
      throw error
    }

    // Enqueue delayed lifecycle jobs
    const [reminderJob, expireJob] = await Promise.all([
      mentorshipQueue.add(
        {
          type: 'request_reminder',
          requestId,
          universityId: context.universityId,
          alumniId: input.alumniId,
          studentId: context.userId,
        },
        { delay: 48 * 60 * 60 * 1000 },
      ),
      mentorshipQueue.add(
        {
          type: 'request_expire',
          requestId,
          universityId: context.universityId,
          alumniId: input.alumniId,
          studentId: context.userId,
        },
        { delay: 7 * 24 * 60 * 60 * 1000 },
      ),
    ])

    await db('mentorship_requests')
      .where({ id: requestId })
      .update({
        reminder_job_id: String(reminderJob.id),
        expire_job_id: String(expireJob.id),
      })

    const request = await this.getRequestById(requestId)
    if (!request) throw notFound('Request not found', 'REQUEST_NOT_FOUND')

    // Notify the alumni
    const studentProfile = await db('profiles')
      .where({ user_id: context.userId })
      .select<{ full_name: string }[]>('full_name')
      .first()

    getIo()
      .to(`user:${input.alumniId}`)
      .emit('mentorship:request:new', {
        request,
        studentName: studentProfile?.full_name ?? 'A student',
      })

    return request
  }

  async getMyRequests(universityId: string, studentId: string, query: PaginationQuery) {
    const base = db('mentorship_requests')
      .where({
        'mentorship_requests.university_id': universityId,
        'mentorship_requests.student_id': studentId,
        'mentorship_requests.is_deleted': false,
      })

    const [{ count }] = await base.clone().count<CountRow[]>({ count: '*' })
    const total = Number(count)

    const rows = await base
      .clone()
      .join('users as alumni_user', 'alumni_user.id', 'mentorship_requests.alumni_id')
      .join('profiles as alumni_profile', 'alumni_profile.user_id', 'alumni_user.id')
      .select<RequestRow[]>(
        'mentorship_requests.id',
        'mentorship_requests.university_id',
        'mentorship_requests.student_id',
        'mentorship_requests.alumni_id',
        'mentorship_requests.message',
        'mentorship_requests.status',
        'mentorship_requests.session_notes',
        'mentorship_requests.conversation_id',
        'mentorship_requests.created_at',
        'mentorship_requests.updated_at',
        'alumni_profile.full_name as alumni_full_name',
        'alumni_profile.avatar_url as alumni_avatar_url',
        'alumni_profile.headline as alumni_headline',
        'alumni_profile.department as alumni_department',
        'alumni_profile.batch_year as alumni_batch_year',
        'alumni_user.role as alumni_role',
      )
      .orderBy('mentorship_requests.created_at', 'desc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)

    return {
      items: rows.map(toMyRequest),
      total,
      page: query.page,
      hasMore: query.page * query.limit < total,
    }
  }

  async getIncomingRequests(universityId: string, alumniId: string, query: IncomingRequestsQuery) {
    const base = db('mentorship_requests')
      .where({
        'mentorship_requests.university_id': universityId,
        'mentorship_requests.alumni_id': alumniId,
        'mentorship_requests.is_deleted': false,
      })
      .modify((builder) => {
        if (query.status) builder.andWhere('mentorship_requests.status', query.status)
      })

    const [{ count }] = await base.clone().count<CountRow[]>({ count: '*' })
    const total = Number(count)

    const rows = await base
      .clone()
      .join('users as student_user', 'student_user.id', 'mentorship_requests.student_id')
      .join('profiles as student_profile', 'student_profile.user_id', 'student_user.id')
      .select<RequestRow[]>(
        'mentorship_requests.id',
        'mentorship_requests.university_id',
        'mentorship_requests.student_id',
        'mentorship_requests.alumni_id',
        'mentorship_requests.message',
        'mentorship_requests.status',
        'mentorship_requests.session_notes',
        'mentorship_requests.conversation_id',
        'mentorship_requests.created_at',
        'mentorship_requests.updated_at',
        'student_profile.full_name as student_full_name',
        'student_profile.avatar_url as student_avatar_url',
        'student_profile.headline as student_headline',
        'student_profile.department as student_department',
        'student_profile.batch_year as student_batch_year',
        'student_user.role as student_role',
      )
      .orderBy('mentorship_requests.created_at', 'desc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)

    return {
      items: rows.map(toIncomingRequest),
      total,
      page: query.page,
      hasMore: query.page * query.limit < total,
    }
  }

  async updateRequest(context: AuthContext, requestId: string, input: UpdateRequestInput) {
    const request = await db('mentorship_requests')
      .where({ id: requestId, university_id: context.universityId, is_deleted: false })
      .select<
        {
          id: string
          alumni_id: string
          student_id: string
          status: RequestStatus
          reminder_job_id: string | null
          expire_job_id: string | null
        }[]
      >('id', 'alumni_id', 'student_id', 'status', 'reminder_job_id', 'expire_job_id')
      .first()

    if (!request) throw notFound('Mentorship request not found', 'REQUEST_NOT_FOUND')

    // Only the alumni on the request (or admin) can update
    if (context.userId !== request.alumni_id && context.role !== 'admin') {
      throw forbidden('You do not have permission to update this request', 'REQUEST_FORBIDDEN')
    }

    // ── ACCEPT PATH ─────────────────────────────────────────────────────────
    if (input.status === 'accepted') {
      // Check capacity: count currently accepted relationships for this alumni
      const [{ count: activeCount }] = await db('mentorship_requests')
        .where({ alumni_id: request.alumni_id, status: 'accepted', is_deleted: false })
        .count<CountRow[]>({ count: '*' })

      const maxMenteesRow = await db('profiles')
        .where({ user_id: request.alumni_id })
        .select<{ max_mentees: number }[]>('max_mentees')
        .first()

      const maxMentees = maxMenteesRow?.max_mentees ?? 3

      if (Number(activeCount) >= maxMentees) {
        throw badRequest('This mentor is currently full', 'MENTOR_AT_CAPACITY')
      }

      // Get full names for the conversation title
      const fullRequest = await this.getRequestById(requestId)
      if (!fullRequest) throw notFound('Request not found', 'REQUEST_NOT_FOUND')

      const studentFirstName = (fullRequest.student_full_name as string | undefined)?.split(' ')[0] ?? 'Student'
      const alumniFirstName = (fullRequest.alumni_full_name as string | undefined)?.split(' ')[0] ?? 'Mentor'

      // Run accept in a transaction: create conversation + update request
      const conversationId = await db.transaction(async (trx) => {
        const [conv] = await trx('conversations')
          .insert({
            university_id: context.universityId,
            type: 'mentorship',
            name: `${studentFirstName} ↔ ${alumniFirstName} — Mentorship`,
            is_group: false,
            created_by: request.alumni_id,
          })
          .returning<{ id: string }[]>('id')

        if (!conv) throw badRequest('Could not create conversation', 'CONV_CREATE_FAILED')

        await trx('conversation_participants').insert([
          { conversation_id: conv.id, user_id: request.student_id },
          { conversation_id: conv.id, user_id: request.alumni_id },
        ])

        await trx('messages').insert({
          conversation_id: conv.id,
          sender_id: request.alumni_id,
          type: 'system',
          content:
            'Mentorship connection started. You can now propose sessions, share resources, and chat here.',
        })

        await trx('mentorship_requests')
          .where({ id: requestId, university_id: context.universityId })
          .update({
            status: 'accepted',
            conversation_id: conv.id,
            updated_at: trx.fn.now(),
          })

        return conv.id
      })

      // Cancel lifecycle jobs now that request is resolved
      await this.cancelMentorshipJobs(request.reminder_job_id, request.expire_job_id)

      // Emit to both users
      getIo()
        .to(`user:${request.student_id}`)
        .emit('mentorship:request:accepted', { requestId, conversationId })

      getIo()
        .to(`user:${request.student_id}`)
        .to(`user:${request.alumni_id}`)
        .emit('conversation:new', { conversationId })

      return this.getRequestById(requestId)
    }

    // ── DECLINE PATH ────────────────────────────────────────────────────────
    if (input.status === 'declined') {
      await db('mentorship_requests')
        .where({ id: requestId, university_id: context.universityId })
        .update({ status: 'declined', updated_at: db.fn.now() })

      await this.cancelMentorshipJobs(request.reminder_job_id, request.expire_job_id)

      await notificationQueue.add({
        universityId: context.universityId,
        userId: request.student_id,
        type: 'mentorship_request_declined',
        actorId: request.alumni_id,
        referenceId: requestId,
        referenceType: 'mentorship_request',
        content: 'Your mentorship request was declined.',
        payload: { requestId },
      })

      return this.getRequestById(requestId)
    }

    // ── GENERAL UPDATE PATH (notes, completed) ──────────────────────────────
    const updates: Record<string, unknown> = { updated_at: db.fn.now() }
    if (input.status !== undefined) updates.status = input.status
    if (input.session_notes !== undefined) updates.session_notes = input.session_notes

    await db('mentorship_requests')
      .where({ id: requestId, university_id: context.universityId })
      .update(updates)

    // Award points when transitioning into 'completed'
    if (input.status === 'completed' && request.status !== 'completed') {
      await db('profiles')
        .where({ user_id: request.alumni_id })
        .increment('mentorship_points', POINTS_PER_SESSION)

      // Cancel expire job just in case it's still live
      await this.cancelMentorshipJobs(null, request.expire_job_id)
    }

    return this.getRequestById(requestId)
  }

  async withdrawRequest(context: AuthContext, requestId: string) {
    const request = await db('mentorship_requests')
      .where({ id: requestId, university_id: context.universityId, is_deleted: false })
      .select<{ student_id: string; status: RequestStatus; reminder_job_id: string | null; expire_job_id: string | null }[]>(
        'student_id', 'status', 'reminder_job_id', 'expire_job_id',
      )
      .first()

    if (!request) throw notFound('Mentorship request not found', 'REQUEST_NOT_FOUND')

    if (context.userId !== request.student_id) {
      throw forbidden('You do not have permission to withdraw this request', 'REQUEST_FORBIDDEN')
    }

    if (request.status !== 'pending') {
      throw badRequest('Only pending requests can be withdrawn', 'REQUEST_NOT_PENDING')
    }

    await db('mentorship_requests')
      .where({ id: requestId, university_id: context.universityId })
      .update({ is_deleted: true, updated_at: db.fn.now() })

    await this.cancelMentorshipJobs(request.reminder_job_id, request.expire_job_id)
  }

  // ── SESSION CRUD ──────────────────────────────────────────────────────────

  async listSessions(context: AuthContext, requestId: string) {
    await this.assertRequestParticipant(context, requestId)

    return db('mentorship_sessions')
      .where({ request_id: requestId })
      .orderBy('session_date', 'desc')
      .select<SessionRow[]>(
        'id',
        'university_id',
        'request_id',
        'created_by',
        'session_date',
        'duration_minutes',
        'topic',
        'notes',
        'created_at',
        'updated_at',
      )
      .then((rows) => rows.map(toSession))
  }

  async createSession(context: AuthContext, requestId: string, input: CreateSessionInput) {
    await this.assertRequestParticipant(context, requestId)

    const [row] = await db('mentorship_sessions')
      .insert({
        university_id: context.universityId,
        request_id: requestId,
        created_by: context.userId,
        session_date: input.sessionDate,
        duration_minutes: input.durationMinutes,
        topic: input.topic,
        notes: input.notes ?? null,
      })
      .returning<SessionRow[]>('*')

    if (!row) throw badRequest('Session could not be created', 'SESSION_CREATE_FAILED')
    return toSession(row)
  }

  async updateSession(
    context: AuthContext,
    requestId: string,
    sessionId: string,
    input: UpdateSessionInput,
  ) {
    await this.assertRequestParticipant(context, requestId)

    const session = await db('mentorship_sessions')
      .where({ id: sessionId, request_id: requestId })
      .select<{ id: string; created_by: string }[]>('id', 'created_by')
      .first()

    if (!session) throw notFound('Session not found', 'SESSION_NOT_FOUND')
    if (session.created_by !== context.userId) {
      throw forbidden('You can only edit sessions you created', 'SESSION_FORBIDDEN')
    }

    const updates: Record<string, unknown> = { updated_at: db.fn.now() }
    if (input.sessionDate !== undefined) updates.session_date = input.sessionDate
    if (input.durationMinutes !== undefined) updates.duration_minutes = input.durationMinutes
    if (input.topic !== undefined) updates.topic = input.topic
    if (input.notes !== undefined) updates.notes = input.notes

    await db('mentorship_sessions').where({ id: sessionId }).update(updates)

    const updated = await db('mentorship_sessions')
      .where({ id: sessionId })
      .select<SessionRow[]>('*')
      .first()

    if (!updated) throw notFound('Session not found after update', 'SESSION_NOT_FOUND')
    return toSession(updated)
  }

  async deleteSession(context: AuthContext, requestId: string, sessionId: string) {
    await this.assertRequestParticipant(context, requestId)

    const session = await db('mentorship_sessions')
      .where({ id: sessionId, request_id: requestId })
      .select<{ id: string; created_by: string }[]>('id', 'created_by')
      .first()

    if (!session) throw notFound('Session not found', 'SESSION_NOT_FOUND')
    if (session.created_by !== context.userId) {
      throw forbidden('You can only delete sessions you created', 'SESSION_FORBIDDEN')
    }

    await db('mentorship_sessions').where({ id: sessionId }).delete()
  }

  // ── FEEDBACK ─────────────────────────────────────────────────────────────────

  async submitFeedback(context: AuthContext, requestId: string, input: SubmitFeedbackInput) {
    const request = await db('mentorship_requests')
      .where({ id: requestId, university_id: context.universityId, is_deleted: false })
      .select<{ student_id: string; alumni_id: string; status: RequestStatus }[]>(
        'student_id', 'alumni_id', 'status',
      )
      .first()

    if (!request) throw notFound('Mentorship request not found', 'REQUEST_NOT_FOUND')

    if (request.status !== 'completed') {
      throw badRequest('Feedback can only be submitted for completed requests', 'FEEDBACK_REQUEST_NOT_COMPLETED')
    }

    const isStudent = context.userId === request.student_id
    const isAlumni = context.userId === request.alumni_id
    if (!isStudent && !isAlumni) throw forbidden()

    const authorRole = isStudent ? 'student' : 'alumni'

    try {
      const [row] = await db('mentorship_feedback')
        .insert({
          university_id: context.universityId,
          request_id: requestId,
          author_id: context.userId,
          author_role: authorRole,
          rating: input.rating,
          comment: input.comment ?? null,
        })
        .returning<{ id: string; author_role: string; rating: number; comment: string | null; created_at: Date }[]>(
          ['id', 'author_role', 'rating', 'comment', 'created_at'],
        )

      if (!row) throw badRequest('Feedback could not be saved', 'FEEDBACK_CREATE_FAILED')

      return {
        id: row.id,
        authorId: context.userId,
        authorRole: row.author_role,
        rating: row.rating,
        comment: row.comment,
        createdAt: row.created_at,
      }
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw conflict('Feedback already submitted', 'FEEDBACK_ALREADY_SUBMITTED')
      }
      throw error
    }
  }

  async getRequestFeedback(context: AuthContext, requestId: string) {
    const request = await db('mentorship_requests')
      .where({ id: requestId, university_id: context.universityId, is_deleted: false })
      .select<{ student_id: string; alumni_id: string }[]>('student_id', 'alumni_id')
      .first()

    if (!request) throw notFound('Mentorship request not found', 'REQUEST_NOT_FOUND')

    const isParticipant = context.userId === request.student_id || context.userId === request.alumni_id
    if (!isParticipant && context.role !== 'admin') throw forbidden()

    const rows = await db('mentorship_feedback')
      .where({ request_id: requestId })
      .select<{ id: string; author_id: string; author_role: string; rating: number; comment: string | null; created_at: Date }[]>(
        'id', 'author_id', 'author_role', 'rating', 'comment', 'created_at',
      )

    const studentRow = rows.find((r) => r.author_role === 'student')
    const alumniRow = rows.find((r) => r.author_role === 'alumni')

    const toEntry = (r: typeof rows[number] | undefined) =>
      r ? { id: r.id, authorId: r.author_id, authorRole: r.author_role, rating: r.rating, comment: r.comment, createdAt: r.created_at } : null

    return { student: toEntry(studentRow), alumni: toEntry(alumniRow) }
  }

  // ── REWARDS ───────────────────────────────────────────────────────────────

  async getMyRewards(universityId: string, userId: string) {
    const profile = await db('profiles')
      .where({ user_id: userId })
      .select<{ mentorship_points: number }[]>('mentorship_points')
      .first()
    const points = profile?.mentorship_points ?? 0

    const history = await db('mentor_redemptions')
      .leftJoin('gift_cards', 'gift_cards.id', 'mentor_redemptions.gift_card_id')
      .where({
        'mentor_redemptions.university_id': universityId,
        'mentor_redemptions.user_id': userId,
      })
      .orderBy('mentor_redemptions.requested_at', 'desc')
      .select<RedemptionHistoryRow[]>(
        'mentor_redemptions.id',
        'mentor_redemptions.points_spent',
        'mentor_redemptions.status',
        'mentor_redemptions.code_text',
        'mentor_redemptions.admin_note',
        'mentor_redemptions.requested_at',
        'mentor_redemptions.fulfilled_at',
        'gift_cards.id as gift_card_id',
        'gift_cards.vendor',
        'gift_cards.title',
        'gift_cards.value_usd_cents',
        'gift_cards.image_url',
      )

    return {
      points,
      pointsPerSession: POINTS_PER_SESSION,
      pointsPerUsd: POINTS_PER_USD,
      history: history.map(toRedemption),
    }
  }

  async listGiftCards() {
    const rows = await db('gift_cards')
      .where({ is_active: true })
      .orderBy('threshold_points', 'asc')
      .select<GiftCardRow[]>(
        'id',
        'vendor',
        'title',
        'description',
        'image_url',
        'value_usd_cents',
        'threshold_points',
      )
    return rows.map(toGiftCard)
  }

  async redeem(context: AuthContext, input: RedeemGiftCardInput) {
    if (context.role !== 'alumni') {
      throw forbidden('Only alumni can redeem mentorship rewards', 'REDEEM_ALUMNI_ONLY')
    }

    return db.transaction(async (trx) => {
      const card = await trx('gift_cards')
        .where({ id: input.giftCardId, is_active: true })
        .select<{ id: string; threshold_points: number; title: string }[]>(
          'id',
          'threshold_points',
          'title',
        )
        .first()
      if (!card) throw notFound('Gift card not available', 'GIFT_CARD_NOT_FOUND')

      const profile = await trx('profiles')
        .where({ user_id: context.userId })
        .forUpdate()
        .select<{ mentorship_points: number; is_open_to_mentorship: boolean }[]>(
          'mentorship_points',
          'is_open_to_mentorship',
        )
        .first()

      if (!profile) throw notFound('Profile not found', 'PROFILE_NOT_FOUND')
      if (!profile.is_open_to_mentorship) {
        throw badRequest('Enable mentorship to redeem rewards', 'MENTORSHIP_NOT_ENABLED')
      }
      const balance = profile.mentorship_points
      if (balance < card.threshold_points) {
        throw badRequest('Not enough points to redeem this card', 'INSUFFICIENT_POINTS')
      }

      await trx('profiles')
        .where({ user_id: context.userId })
        .decrement('mentorship_points', card.threshold_points)

      const [row] = await trx('mentor_redemptions')
        .insert({
          university_id: context.universityId,
          user_id: context.userId,
          gift_card_id: card.id,
          points_spent: card.threshold_points,
          status: 'pending',
        })
        .returning<{ id: string }[]>('id')

      if (!row) throw badRequest('Redemption could not be created', 'REDEMPTION_CREATE_FAILED')

      return {
        redemptionId: row.id,
        remainingPoints: balance - card.threshold_points,
      }
    })
  }

  // ── PRIVATE HELPERS ───────────────────────────────────────────────────────

  private async getRequestById(requestId: string) {
    return db('mentorship_requests')
      .where('mentorship_requests.id', requestId)
      .join('users as alumni_user', 'alumni_user.id', 'mentorship_requests.alumni_id')
      .join('profiles as alumni_profile', 'alumni_profile.user_id', 'alumni_user.id')
      .join('users as student_user', 'student_user.id', 'mentorship_requests.student_id')
      .join('profiles as student_profile', 'student_profile.user_id', 'student_user.id')
      .select(
        'mentorship_requests.id',
        'mentorship_requests.university_id',
        'mentorship_requests.student_id',
        'mentorship_requests.alumni_id',
        'mentorship_requests.message',
        'mentorship_requests.status',
        'mentorship_requests.session_notes',
        'mentorship_requests.conversation_id',
        'mentorship_requests.created_at',
        'mentorship_requests.updated_at',
        'alumni_profile.full_name as alumni_full_name',
        'alumni_profile.avatar_url as alumni_avatar_url',
        'alumni_profile.headline as alumni_headline',
        'student_profile.full_name as student_full_name',
        'student_profile.avatar_url as student_avatar_url',
        'student_profile.department as student_department',
        'student_profile.batch_year as student_batch_year',
      )
      .first<RequestDetailRow>()
  }

  private async assertRequestParticipant(context: AuthContext, requestId: string) {
    const request = await db('mentorship_requests')
      .where({ id: requestId, university_id: context.universityId, is_deleted: false })
      .select<{ student_id: string; alumni_id: string }[]>('student_id', 'alumni_id')
      .first()

    if (!request) throw notFound('Mentorship request not found', 'REQUEST_NOT_FOUND')

    if (context.userId !== request.student_id && context.userId !== request.alumni_id) {
      throw forbidden('You are not a participant in this mentorship', 'REQUEST_NOT_PARTICIPANT')
    }
  }

  private async cancelMentorshipJobs(
    reminderId: string | null,
    expireId: string | null,
  ): Promise<void> {
    if (reminderId) {
      const job = await mentorshipQueue.getJob(reminderId)
      await job?.remove()
    }
    if (expireId) {
      const job = await mentorshipQueue.getJob(expireId)
      await job?.remove()
    }
  }
}

export const mentorshipService = new MentorshipService()

// ── MAPPERS ───────────────────────────────────────────────────────────────────

function toAlumni(row: AlumniRow) {
  return {
    id: row.id,
    universityId: row.university_id,
    fullName: row.full_name,
    // Mentor listings only ever select `users.role = 'alumni'`.
    role: 'alumni' as const,
    headline: row.headline,
    department: row.department,
    batchYear: row.batch_year,
    skills: row.skills ?? [],
    avatarUrl: row.avatar_url,
    maxMentees: row.max_mentees,
    currentMentees: Number(row.current_mentees),
  }
}

function toMyRequest(row: RequestRow) {
  return {
    id: row.id,
    message: row.message,
    status: row.status,
    sessionNotes: row.session_notes,
    conversationId: row.conversation_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    alumni: {
      id: row.alumni_id,
      fullName: row.alumni_full_name ?? '',
      avatarUrl: row.alumni_avatar_url ?? null,
      headline: row.alumni_headline ?? null,
      department: row.alumni_department ?? null,
      batchYear: row.alumni_batch_year ?? null,
      role: row.alumni_role ?? null,
    },
  }
}

function toIncomingRequest(row: RequestRow) {
  return {
    id: row.id,
    message: row.message,
    status: row.status,
    sessionNotes: row.session_notes,
    conversationId: row.conversation_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    student: {
      id: row.student_id,
      fullName: row.student_full_name ?? '',
      avatarUrl: row.student_avatar_url ?? null,
      headline: row.student_headline ?? null,
      department: row.student_department ?? null,
      batchYear: row.student_batch_year ?? null,
      role: row.student_role ?? null,
    },
  }
}

function toSession(row: SessionRow) {
  return {
    id: row.id,
    requestId: row.request_id,
    createdBy: row.created_by,
    sessionDate: typeof row.session_date === 'string'
      ? row.session_date
      : new Date(row.session_date).toISOString().slice(0, 10),
    durationMinutes: row.duration_minutes,
    topic: row.topic,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}

function toGiftCard(row: GiftCardRow) {
  return {
    id: row.id,
    vendor: row.vendor,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url,
    valueUsdCents: row.value_usd_cents,
    thresholdPoints: row.threshold_points,
  }
}

function toRedemption(row: RedemptionHistoryRow) {
  return {
    id: row.id,
    pointsSpent: row.points_spent,
    status: row.status,
    codeText: row.code_text,
    adminNote: row.admin_note,
    requestedAt: row.requested_at,
    fulfilledAt: row.fulfilled_at,
    giftCard: row.gift_card_id
      ? {
          id: row.gift_card_id,
          vendor: row.vendor ?? '',
          title: row.title ?? '',
          valueUsdCents: row.value_usd_cents ?? 0,
          imageUrl: row.image_url,
        }
      : null,
  }
}
