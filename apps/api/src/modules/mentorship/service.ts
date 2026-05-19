import { db } from '../../config/db'
import { getIo } from '../../socket'
import { badRequest, conflict, forbidden, notFound } from '../../utils/errors'
import type { UserRole } from '@uniconnect/shared'
import type {
  AlumniListQuery,
  CreateRequestInput,
  IncomingRequestsQuery,
  PaginationQuery,
  RedeemGiftCardInput,
  UpdateRequestInput,
} from './schema'

export const POINTS_PER_SESSION = 10
export const POINTS_PER_USD = 100

type RequestStatus = 'pending' | 'accepted' | 'declined' | 'completed'

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
}

interface RequestRow {
  id: string
  university_id: string
  student_id: string
  alumni_id: string
  message: string
  status: RequestStatus
  session_notes: string | null
  created_at: Date
  updated_at: Date
  // alumni fields (for my-requests)
  alumni_full_name?: string
  alumni_avatar_url?: string | null
  alumni_headline?: string | null
  alumni_department?: string | null
  alumni_batch_year?: string | null
  // student fields (for incoming)
  student_full_name?: string
  student_avatar_url?: string | null
  student_headline?: string | null
  student_department?: string | null
  student_batch_year?: string | null
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
        'mentorship_requests.created_at',
        'mentorship_requests.updated_at',
        'alumni_profile.full_name as alumni_full_name',
        'alumni_profile.avatar_url as alumni_avatar_url',
        'alumni_profile.headline as alumni_headline',
        'alumni_profile.department as alumni_department',
        'alumni_profile.batch_year as alumni_batch_year',
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
        'mentorship_requests.created_at',
        'mentorship_requests.updated_at',
        'student_profile.full_name as student_full_name',
        'student_profile.avatar_url as student_avatar_url',
        'student_profile.headline as student_headline',
        'student_profile.department as student_department',
        'student_profile.batch_year as student_batch_year',
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
      .select<{ id: string; alumni_id: string; student_id: string; status: RequestStatus }[]>(
        'id',
        'alumni_id',
        'student_id',
        'status',
      )
      .first()

    if (!request) throw notFound('Mentorship request not found', 'REQUEST_NOT_FOUND')

    // Only the alumni on the request (or admin) can update
    if (context.userId !== request.alumni_id && context.role !== 'admin') {
      throw forbidden('You do not have permission to update this request', 'REQUEST_FORBIDDEN')
    }

    const updates: Record<string, unknown> = { updated_at: db.fn.now() }
    if (input.status !== undefined) updates.status = input.status
    if (input.session_notes !== undefined) updates.session_notes = input.session_notes

    await db('mentorship_requests')
      .where({ id: requestId, university_id: context.universityId })
      .update(updates)

    // Award points when transitioning into 'completed' (forward-only; no retroactive backfill)
    if (
      input.status === 'completed' &&
      request.status !== 'completed'
    ) {
      await db('profiles')
        .where({ user_id: request.alumni_id })
        .increment('mentorship_points', POINTS_PER_SESSION)
    }

    return this.getRequestById(requestId)
  }

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
      .first()
  }
}

export const mentorshipService = new MentorshipService()

function toAlumni(row: AlumniRow) {
  return {
    id: row.id,
    universityId: row.university_id,
    fullName: row.full_name,
    headline: row.headline,
    department: row.department,
    batchYear: row.batch_year,
    skills: row.skills ?? [],
    avatarUrl: row.avatar_url,
  }
}

function toMyRequest(row: RequestRow) {
  return {
    id: row.id,
    message: row.message,
    status: row.status,
    sessionNotes: row.session_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    alumni: {
      id: row.alumni_id,
      fullName: row.alumni_full_name ?? '',
      avatarUrl: row.alumni_avatar_url ?? null,
      headline: row.alumni_headline ?? null,
      department: row.alumni_department ?? null,
      batchYear: row.alumni_batch_year ?? null,
    },
  }
}

function toIncomingRequest(row: RequestRow) {
  return {
    id: row.id,
    message: row.message,
    status: row.status,
    sessionNotes: row.session_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    student: {
      id: row.student_id,
      fullName: row.student_full_name ?? '',
      avatarUrl: row.student_avatar_url ?? null,
      headline: row.student_headline ?? null,
      department: row.student_department ?? null,
      batchYear: row.student_batch_year ?? null,
    },
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
