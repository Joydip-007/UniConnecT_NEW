import { db } from '../../config/db'
import { getIo } from '../../socket'
import { badRequest, conflict, forbidden, notFound } from '../../utils/errors'
import type { UserRole } from '@uniconnect/shared'
import type {
  AlumniListQuery,
  CreateRequestInput,
  IncomingRequestsQuery,
  PaginationQuery,
  UpdateRequestInput,
} from './schema'

type RequestStatus = 'pending' | 'accepted' | 'declined' | 'completed'

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
        'profiles.is_open_to_work': true,
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
        'profiles.is_open_to_work': true,
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

    return this.getRequestById(requestId)
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
