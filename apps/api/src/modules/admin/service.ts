import crypto from 'node:crypto'
import type { UserRole } from '@uniconnect/shared'
import { db } from '../../config/db'
import { badRequest, notFound } from '../../utils/errors'
import { emailQueue } from '../../queues/email.queue'
import { env } from '../../config/env'
import { getIo } from '../../socket'
import { systemGroupsService } from '../groups/system-groups.service'
import type {
  AdminFulfillRedemptionInput,
  AdminRedemptionListQuery,
  CreateBulkInvitationsInput,
  CreateInvitationInput,
  PaginationQuery,
  ResolveReportInput,
  UpdateUserRoleInput,
  UpdateUserStatusInput,
} from './schema'

interface RedemptionListRow {
  id: string
  status: 'pending' | 'fulfilled' | 'rejected'
  points_spent: number
  code_text: string | null
  admin_note: string | null
  requested_at: Date
  fulfilled_at: Date | null
  user_id: string
  user_full_name: string
  user_avatar_url: string | null
  user_email: string
  gift_card_id: string
  gift_card_vendor: string
  gift_card_title: string
  gift_card_value_usd_cents: number
}

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
      countWhere('posts', { university_id: universityId }),
      countWhere('jobs', { university_id: universityId }),
      countWhere('events', { university_id: universityId }),
      countWhere('groups', { university_id: universityId }),
      countWhere('news', { university_id: universityId }),
      db('reports')
        .whereIn('reporter_id', db('users').where('university_id', universityId).select('id'))
        .where('status', 'pending')
        .count<CountRow[]>({ count: '*' })
        .first()
        .then((r) => Number(r?.count ?? 0)),
    ])

    const activeUsers = await countActive(universityId)

    return { users, posts, jobs, events, groups, news, reports, activeUsers }
  }

  async listUsers(universityId: string, query: PaginationQuery) {
    const baseQuery = db('users')
      .join('profiles', 'profiles.user_id', 'users.id')
      .where('users.university_id', universityId)
      .where('users.is_deleted', false)
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
      .where({ university_id: universityId, is_deleted: false })
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
    const previous = await db('users')
      .join('profiles', 'profiles.user_id', 'users.id')
      .where({ 'users.id': userId, 'users.university_id': universityId })
      .select<{ role: import('@uniconnect/shared').UserRole; department: string | null }[]>(
        'users.role',
        'profiles.department',
      )
      .first()

    if (!previous) throw notFound('User not found')

    const updated = await db('users')
      .where({ id: userId, university_id: universityId })
      .update({ role: input.role })

    if (updated === 0) throw notFound('User not found')

    await systemGroupsService.syncUserMembership(
      userId,
      universityId,
      { role: previous.role, department: previous.department },
      { role: input.role, department: previous.department },
    )

    return { userId, role: input.role }
  }

  async deleteUser(universityId: string, adminUserId: string, userId: string) {
    if (userId === adminUserId) throw badRequest('You cannot delete your own account', 'SELF_ACTION')

    const user = await db('users')
      .join('profiles', 'profiles.user_id', 'users.id')
      .where({ 'users.id': userId, 'users.university_id': universityId, 'users.is_deleted': false })
      .select<{ role: import('@uniconnect/shared').UserRole; department: string | null }[]>(
        'users.role',
        'profiles.department',
      )
      .first()

    if (!user) throw notFound('User not found')

    await db('users')
      .where({ id: userId, university_id: universityId })
      .update({ is_deleted: true, is_active: false })

    await db('user_sessions').where({ user_id: userId }).delete()

    await systemGroupsService.removeUserFromSystemGroups(userId, universityId, user.role, user.department)

    return { userId, deleted: true }
  }

  async updateUserStatus(universityId: string, userId: string, input: UpdateUserStatusInput) {
    const previous = await db('users')
      .join('profiles', 'profiles.user_id', 'users.id')
      .where({ 'users.id': userId, 'users.university_id': universityId })
      .select<{ role: import('@uniconnect/shared').UserRole; department: string | null }[]>(
        'users.role',
        'profiles.department',
      )
      .first()

    if (!previous) throw notFound('User not found')

    const updated = await db('users')
      .where({ id: userId, university_id: universityId })
      .update({ is_active: input.is_active })

    if (updated === 0) throw notFound('User not found')

    if (!input.is_active) {
      await systemGroupsService.removeUserFromSystemGroups(
        userId,
        universityId,
        previous.role,
        previous.department,
      )
    } else {
      await systemGroupsService.addUserToSystemGroups(
        userId,
        universityId,
        previous.role,
        previous.department,
      )
    }

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

  async resolveReport(universityId: string, resolvedById: string, reportId: string, input: ResolveReportInput) {
    const universityUserIds = db('users').where('university_id', universityId).select('id')
    const updated = await db('reports')
      .where({ id: reportId })
      .whereIn('reporter_id', universityUserIds)
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
    universityName: string,
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

    const registerUrl = `${env.WEB_URL}/register/${token}`
    void emailQueue.add({
      to: input.email,
      subject: "You're invited to join UniConnecT",
      text: JSON.stringify({
        template: 'invitation',
        userName: '',
        registerUrl,
        role: input.role,
        universityName,
        token,
      }),
    })

    return toInvitation(row)
  }

  async createBulkInvitations(
    universityId: string,
    invitedById: string,
    input: CreateBulkInvitationsInput,
    universityName: string,
  ) {
    const unique = [...new Set(input.emails.map((e) => e.toLowerCase().trim()))]
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + input.expires_in_days)

    const rows = unique.map((email) => ({
      university_id: universityId,
      invited_by: invitedById,
      email,
      role: input.role,
      token: crypto.randomBytes(32).toString('hex'),
      expires_at: expiresAt,
    }))

    await db.transaction(async (trx) => {
      await db('invitations').insert(rows).transacting(trx)
    })

    for (const row of rows) {
      const registerUrl = `${env.WEB_URL}/register/${row.token}`
      void emailQueue.add({
        to: row.email,
        subject: "You're invited to join UniConnecT",
        text: JSON.stringify({
          template: 'invitation',
          userName: '',
          registerUrl,
          role: input.role,
          universityName,
          token: row.token,
        }),
      })
    }

    return { created: rows.length, emails: rows.map((r) => r.email) }
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

  async listRedemptions(universityId: string, query: AdminRedemptionListQuery) {
    const base = db('mentor_redemptions')
      .where('mentor_redemptions.university_id', universityId)
      .modify((builder) => {
        if (query.status) builder.where('mentor_redemptions.status', query.status)
      })

    const [{ count }] = await base.clone().count<CountRow[]>({ count: '*' })
    const total = Number(count)

    const rows = await base
      .clone()
      .join('users', 'users.id', 'mentor_redemptions.user_id')
      .join('profiles', 'profiles.user_id', 'users.id')
      .join('gift_cards', 'gift_cards.id', 'mentor_redemptions.gift_card_id')
      .select<RedemptionListRow[]>(
        'mentor_redemptions.id',
        'mentor_redemptions.status',
        'mentor_redemptions.points_spent',
        'mentor_redemptions.code_text',
        'mentor_redemptions.admin_note',
        'mentor_redemptions.requested_at',
        'mentor_redemptions.fulfilled_at',
        'users.id as user_id',
        'users.email as user_email',
        'profiles.full_name as user_full_name',
        'profiles.avatar_url as user_avatar_url',
        'gift_cards.id as gift_card_id',
        'gift_cards.vendor as gift_card_vendor',
        'gift_cards.title as gift_card_title',
        'gift_cards.value_usd_cents as gift_card_value_usd_cents',
      )
      .orderBy('mentor_redemptions.requested_at', 'desc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)

    return {
      items: rows.map(toAdminRedemption),
      total,
      page: query.page,
      limit: query.limit,
    }
  }

  async updateRedemption(
    universityId: string,
    adminUserId: string,
    redemptionId: string,
    input: AdminFulfillRedemptionInput,
  ) {
    return db.transaction(async (trx) => {
      const row = await trx('mentor_redemptions')
        .where({ id: redemptionId, university_id: universityId })
        .forUpdate()
        .select<{
          id: string
          user_id: string
          points_spent: number
          status: 'pending' | 'fulfilled' | 'rejected'
        }[]>('id', 'user_id', 'points_spent', 'status')
        .first()

      if (!row) throw notFound('Redemption not found', 'REDEMPTION_NOT_FOUND')
      if (row.status !== 'pending') {
        throw badRequest('Redemption has already been processed', 'REDEMPTION_ALREADY_PROCESSED')
      }

      if (input.status === 'rejected') {
        await trx('profiles')
          .where({ user_id: row.user_id })
          .increment('mentorship_points', row.points_spent)
      }

      await trx('mentor_redemptions')
        .where({ id: redemptionId })
        .update({
          status: input.status,
          code_text: input.codeText ?? null,
          admin_note: input.adminNote ?? null,
          fulfilled_at: trx.fn.now(),
          fulfilled_by: adminUserId,
        })

      getIo()
        .to(`user:${row.user_id}`)
        .emit('mentorship:redemption:updated', {
          redemptionId,
          status: input.status,
        })

      return { id: redemptionId, status: input.status }
    })
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

function toAdminRedemption(row: RedemptionListRow) {
  return {
    id: row.id,
    status: row.status,
    pointsSpent: row.points_spent,
    codeText: row.code_text,
    adminNote: row.admin_note,
    requestedAt: row.requested_at,
    fulfilledAt: row.fulfilled_at,
    user: {
      id: row.user_id,
      email: row.user_email,
      fullName: row.user_full_name,
      avatarUrl: row.user_avatar_url,
    },
    giftCard: {
      id: row.gift_card_id,
      vendor: row.gift_card_vendor,
      title: row.gift_card_title,
      valueUsdCents: row.gift_card_value_usd_cents,
    },
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
