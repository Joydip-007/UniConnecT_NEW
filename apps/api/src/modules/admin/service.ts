import crypto from 'node:crypto'
import type { UserRole } from '@uniconnect/shared'
import { db } from '../../config/db'
import { notFound } from '../../utils/errors'
import type {
  CreateInvitationInput,
  PaginationQuery,
  ResolveReportInput,
  UpdateUserRoleInput,
  UpdateUserStatusInput,
} from './schema'

interface CountRow {
  count: string | number
}

interface AdminUserRow {
  id: string
  university_id: string
  email: string
  role: UserRole
  is_verified: boolean
  is_active: boolean
  last_active_at: Date | null
  created_at: Date
  full_name: string
  avatar_url: string | null
  department: string | null
  batch_year: string | null
}

interface ReportRow {
  id: string
  reporter_id: string
  target_id: string
  target_type: string
  reason: string
  description: string | null
  status: string
  resolved_by: string | null
  created_at: Date
  resolved_at: Date | null
  reporter_full_name: string | null
}

interface InvitationRow {
  id: string
  university_id: string
  invited_by: string | null
  email: string
  role: string
  token: string
  is_used: boolean
  expires_at: Date
  created_at: Date
}

export class AdminService {
  async getStats(universityId: string) {
    const [users, posts, jobs, events, groups, news, reports] = await Promise.all([
      countWhere('users', { university_id: universityId }),
      countWhere('posts', { university_id: universityId, is_deleted: false }),
      countWhere('jobs', { university_id: universityId }),
      countWhere('events', { university_id: universityId }),
      countWhere('groups', { university_id: universityId }),
      countWhere('news', { university_id: universityId }),
      countWhere('reports', {}),
    ])

    const activeUsers = await countActive(universityId)

    return { users, posts, jobs, events, groups, news, reports, activeUsers }
  }

  async listUsers(universityId: string, query: PaginationQuery) {
    const baseQuery = db('users')
      .join('profiles', 'profiles.user_id', 'users.id')
      .where('users.university_id', universityId)
      .select<AdminUserRow[]>(
        'users.id',
        'users.university_id',
        'users.email',
        'users.role',
        'users.is_verified',
        'users.is_active',
        'users.last_active_at',
        'users.created_at',
        'profiles.full_name',
        'profiles.avatar_url',
        'profiles.department',
        'profiles.batch_year',
      )

    const [{ count }] = await db('users')
      .where({ university_id: universityId })
      .count<CountRow[]>({ count: '*' })

    const rows = await baseQuery
      .orderBy('users.created_at', 'desc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)

    return {
      items: rows.map(toAdminUser),
      total: Number(count),
      page: query.page,
      limit: query.limit,
    }
  }

  async updateUserRole(universityId: string, userId: string, input: UpdateUserRoleInput) {
    const updated = await db('users')
      .where({ id: userId, university_id: universityId })
      .update({ role: input.role })

    if (updated === 0) throw notFound('User not found')
    return { userId, role: input.role }
  }

  async updateUserStatus(universityId: string, userId: string, input: UpdateUserStatusInput) {
    const updated = await db('users')
      .where({ id: userId, university_id: universityId })
      .update({ is_active: input.is_active })

    if (updated === 0) throw notFound('User not found')
    return { userId, isActive: input.is_active }
  }

  async listReports(universityId: string, query: PaginationQuery) {
    const subQuery = db('users')
      .where('university_id', universityId)
      .select('id')

    const baseQuery = db('reports')
      .join('profiles as reporter_profile', 'reporter_profile.user_id', 'reports.reporter_id')
      .whereIn('reports.reporter_id', subQuery)
      .select<ReportRow[]>(
        'reports.id',
        'reports.reporter_id',
        'reports.target_id',
        'reports.target_type',
        'reports.reason',
        'reports.description',
        'reports.status',
        'reports.resolved_by',
        'reports.created_at',
        'reports.resolved_at',
        'reporter_profile.full_name as reporter_full_name',
      )

    const [{ count }] = await db('reports')
      .whereIn('reporter_id', subQuery)
      .count<CountRow[]>({ count: '*' })

    const rows = await baseQuery
      .orderBy('reports.created_at', 'desc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)

    return {
      items: rows.map(toReport),
      total: Number(count),
      page: query.page,
      limit: query.limit,
    }
  }

  async resolveReport(resolvedById: string, reportId: string, input: ResolveReportInput) {
    const updated = await db('reports')
      .where({ id: reportId })
      .update({
        status: input.status,
        resolved_by: resolvedById,
        resolved_at: db.fn.now(),
      })

    if (updated === 0) throw notFound('Report not found')
    return { reportId, status: input.status }
  }

  async createInvitation(
    universityId: string,
    invitedById: string,
    input: CreateInvitationInput,
  ) {
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + input.expires_in_days)

    const [row] = await db('invitations')
      .insert({
        university_id: universityId,
        invited_by: invitedById,
        email: input.email,
        role: input.role,
        token,
        expires_at: expiresAt,
      })
      .returning<InvitationRow[]>('*')

    return toInvitation(row)
  }

  async listInvitations(universityId: string, query: PaginationQuery) {
    const [{ count }] = await db('invitations')
      .where({ university_id: universityId })
      .count<CountRow[]>({ count: '*' })

    const rows = await db('invitations')
      .where({ university_id: universityId })
      .select<InvitationRow[]>('*')
      .orderBy('created_at', 'desc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)

    return {
      items: rows.map(toInvitation),
      total: Number(count),
      page: query.page,
      limit: query.limit,
    }
  }

  async deleteInvitation(universityId: string, invitationId: string) {
    const deleted = await db('invitations')
      .where({ id: invitationId, university_id: universityId })
      .delete()

    if (deleted === 0) throw notFound('Invitation not found')
    return { deleted: true }
  }

  async getAllowedEmailDomains(universityId: string) {
    const row = await db<{ allowed_email_domains: string[] | null }>('universities')
      .select('allowed_email_domains')
      .where({ id: universityId })
      .first()

    return { allowedEmailDomains: row?.allowed_email_domains ?? [] }
  }

  async updateAllowedEmailDomains(universityId: string, domains: string[]) {
    const unique = [...new Set(domains.map((d) => d.trim().toLowerCase()).filter(Boolean))]
    await db('universities')
      .where({ id: universityId })
      .update({ allowed_email_domains: db.raw('?::text[]', [unique.length ? `{${unique.join(',')}}` : '{}']) })

    return { allowedEmailDomains: unique }
  }
}

export const adminService = new AdminService()

async function countWhere(table: string, where: Record<string, unknown>): Promise<number> {
  const [{ count }] = await db(table).where(where).count<CountRow[]>({ count: '*' })
  return Number(count)
}

async function countActive(universityId: string): Promise<number> {
  const since = new Date()
  since.setDate(since.getDate() - 30)

  const [{ count }] = await db('users')
    .where('university_id', universityId)
    .andWhere('last_active_at', '>=', since)
    .count<CountRow[]>({ count: '*' })
  return Number(count)
}

function toAdminUser(row: AdminUserRow) {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    isVerified: row.is_verified,
    isActive: row.is_active,
    lastActiveAt: row.last_active_at,
    createdAt: row.created_at,
    profile: {
      fullName: row.full_name,
      avatarUrl: row.avatar_url,
      department: row.department,
      batchYear: row.batch_year,
    },
  }
}

function toReport(row: ReportRow) {
  return {
    id: row.id,
    reporterId: row.reporter_id,
    reporterName: row.reporter_full_name,
    targetId: row.target_id,
    targetType: row.target_type,
    reason: row.reason,
    description: row.description,
    status: row.status,
    resolvedBy: row.resolved_by,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  }
}

function toInvitation(row: InvitationRow) {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    token: row.token,
    isUsed: row.is_used,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }
}
