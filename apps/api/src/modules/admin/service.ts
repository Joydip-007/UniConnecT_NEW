import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import type { AccountDeletionRequest, ResolveAccountDeletionRequestInput, UserRole } from '@uniconnect/shared'
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
  CreateDriverInput,
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

interface FeedbackEntry {
  id: string
  authorId: string
  authorRole: 'student' | 'alumni'
  rating: number
  comment: string | null
  createdAt: Date
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
      .select<{ role: import('@uniconnect/shared').UserRole; department: string | null; batch_year: string | null }[]>(
        'users.role',
        'profiles.department',
        'profiles.batch_year',
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
      { role: previous.role, department: previous.department, batchYear: previous.batch_year },
      { role: input.role, department: previous.department, batchYear: previous.batch_year },
    )

    return { userId, role: input.role }
  }

  async deleteUser(universityId: string, adminUserId: string, userId: string) {
    if (userId === adminUserId) throw badRequest('You cannot delete your own account', 'SELF_ACTION')

    const user = await db('users')
      .join('profiles', 'profiles.user_id', 'users.id')
      .where({ 'users.id': userId, 'users.university_id': universityId, 'users.is_deleted': false })
      .select<{ role: import('@uniconnect/shared').UserRole; department: string | null; batch_year: string | null }[]>(
        'users.role',
        'profiles.department',
        'profiles.batch_year',
      )
      .first()

    if (!user) throw notFound('User not found')

    await db('users')
      .where({ id: userId, university_id: universityId })
      .update({ is_deleted: true, is_active: false })

    await db('user_sessions').where({ user_id: userId }).delete()

    await systemGroupsService.removeUserFromSystemGroups(userId, universityId, user.role, user.department, user.batch_year)

    return { userId, deleted: true }
  }

  // Drivers are transport staff who broadcast GPS. Admin creates them directly
  // (no invitation, no OTP, no allowed-domain check) as a least-privilege
  // `driver` account. The account is pre-verified so they can log in immediately.
  async createDriver(universityId: string, actorId: string, input: CreateDriverInput) {
    const email = input.email.trim().toLowerCase()

    const existing = await db('users')
      .where({ email, university_id: universityId, is_deleted: false })
      .first<{ id: string }>('id')
    if (existing) throw badRequest('An account already exists for this email', 'CONFLICT')

    const passwordHash = await bcrypt.hash(input.password, 12)

    const created = await db.transaction(async (trx) => {
      const [user] = await trx('users')
        .insert({
          university_id: universityId,
          email,
          password_hash: passwordHash,
          role: 'driver',
          is_verified: true,
          is_active: true,
        })
        .returning<{ id: string; email: string; role: UserRole }[]>(['id', 'email', 'role'])

      await trx('profiles').insert({ user_id: user.id, full_name: input.full_name })

      return user
    })

    await db('university_audit_logs').insert({
      university_id: universityId,
      actor_id: actorId,
      action: 'driver.created',
      payload: JSON.stringify({ driverId: created.id, email }),
    })

    return { id: created.id, email: created.email, role: created.role, fullName: input.full_name }
  }

  async updateUserStatus(universityId: string, userId: string, input: UpdateUserStatusInput) {
    const previous = await db('users')
      .join('profiles', 'profiles.user_id', 'users.id')
      .where({ 'users.id': userId, 'users.university_id': universityId })
      .select<{ role: import('@uniconnect/shared').UserRole; department: string | null; batch_year: string | null }[]>(
        'users.role',
        'profiles.department',
        'profiles.batch_year',
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
        previous.batch_year,
      )
    } else {
      await systemGroupsService.addUserToSystemGroups(
        userId,
        universityId,
        previous.role,
        previous.department,
        previous.batch_year,
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

  async listDeletionRequests(universityId: string, query: PaginationQuery) {
    const base = db('account_deletion_requests as adr')
      .join('users as u', 'u.id', 'adr.user_id')
      .leftJoin('profiles as p', 'p.user_id', 'adr.user_id')
      .where('adr.university_id', universityId)

    const [{ count }] = await base.clone().count<{ count: string }[]>('adr.id as count')

    const rows = await base
      .clone()
      .select(
        'adr.id',
        'adr.user_id',
        'adr.reason',
        'adr.status',
        'adr.admin_note',
        'adr.reviewed_at',
        'adr.created_at',
        'p.full_name as requester_name',
        'u.email as requester_email',
      )
      // Pending first, then most recent.
      .orderByRaw("CASE WHEN adr.status = 'pending' THEN 0 ELSE 1 END")
      .orderBy('adr.created_at', 'desc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)

    const items: AccountDeletionRequest[] = (
      rows as {
        id: string
        user_id: string
        reason: string
        status: AccountDeletionRequest['status']
        admin_note: string | null
        reviewed_at: Date | null
        created_at: Date
        requester_name: string | null
        requester_email: string | null
      }[]
    ).map((r) => ({
      id: r.id,
      reason: r.reason,
      status: r.status,
      adminNote: r.admin_note,
      reviewedAt: r.reviewed_at,
      createdAt: r.created_at,
      requesterId: r.user_id,
      requesterName: r.requester_name,
      requesterEmail: r.requester_email,
    }))

    return { items, total: Number(count), page: query.page, limit: query.limit }
  }

  async resolveDeletionRequest(
    universityId: string,
    actorId: string,
    requestId: string,
    input: ResolveAccountDeletionRequestInput,
  ) {
    const request = await db('account_deletion_requests')
      .where({ id: requestId, university_id: universityId })
      .first<{ id: string; user_id: string; status: string }>()
    if (!request) throw notFound('Deletion request not found')
    if (request.status !== 'pending') {
      throw badRequest('This request has already been resolved', 'DELETION_REQUEST_ALREADY_RESOLVED')
    }

    await db.transaction(async (trx) => {
      await trx('account_deletion_requests').where({ id: requestId }).update({
        status: input.status,
        admin_note: input.adminNote ?? null,
        reviewed_by: actorId,
        reviewed_at: trx.fn.now(),
      })

      // Approving a deletion deactivates the account and ends every session;
      // actual data erasure stays a deliberate, separate admin/ops step.
      if (input.status === 'approved') {
        await trx('users')
          .where({ id: request.user_id })
          .update({ is_active: false, deactivated_at: trx.fn.now() })
        await trx('user_sessions').where({ user_id: request.user_id }).delete()
      }

      await trx('university_audit_logs').insert({
        university_id: universityId,
        actor_id: actorId,
        action: `account_deletion.${input.status}`,
        payload: JSON.stringify({ requestId, targetUserId: request.user_id }),
      })
    })

    return { requestId, status: input.status }
  }

  async createInvitation(
    universityId: string,
    invitedById: string,
    input: CreateInvitationInput,
    universityName: string,
  ) {
    const { allowedEmailDomains } = await this.getAllowedEmailDomains(universityId)
    if (allowedEmailDomains.length > 0) {
      const domain = input.email.split('@')[1]?.toLowerCase() ?? ''
      if (!allowedEmailDomains.includes(domain)) {
        throw badRequest(
          `Invitations are only allowed for: ${allowedEmailDomains.join(', ')}`,
          'EMAIL_DOMAIN_NOT_ALLOWED',
        )
      }
    }

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

    const { allowedEmailDomains } = await this.getAllowedEmailDomains(universityId)
    if (allowedEmailDomains.length > 0) {
      const blocked = unique.filter((e) => {
        const d = e.split('@')[1]?.toLowerCase() ?? ''
        return !allowedEmailDomains.includes(d)
      })
      if (blocked.length > 0) {
        throw badRequest(
          `These emails have disallowed domains: ${blocked.join(', ')}. Allowed: ${allowedEmailDomains.join(', ')}`,
          'EMAIL_DOMAIN_NOT_ALLOWED',
        )
      }
    }

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

  async updateAllowedEmailDomains(universityId: string, actorId: string, domains: string[]) {
    const unique = [...new Set(domains.map((d) => d.trim().toLowerCase()).filter(Boolean))]

    const { allowedEmailDomains: before } = await this.getAllowedEmailDomains(universityId)

    await db('universities')
      .where({ id: universityId })
      .update({ allowed_email_domains: unique })

    await db('university_audit_logs').insert({
      university_id: universityId,
      actor_id: actorId,
      action: 'domains.updated',
      payload: JSON.stringify({ before, after: unique }),
    })

    getIo().to(`uni:${universityId}`).emit('university:domains_updated', { allowedEmailDomains: unique })

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

  // ── MENTORSHIP DASHBOARD ──────────────────────────────────────────────────────

  async listMentors(universityId: string, query: { page: number; limit: number }) {
    const countResult = await db.raw<{ rows: { count: string }[] }>(
      `SELECT COUNT(DISTINCT alumni_id) as count
       FROM mentorship_requests
       WHERE university_id = ? AND is_deleted = false`,
      [universityId],
    )
    const total = Number(countResult.rows[0]?.count ?? 0)

    interface MentorRow {
      id: string
      full_name: string
      avatar_url: string | null
      department: string | null
      batch_year: string | null
      mentorship_points: number
      max_mentees: number
      current_mentees: string | number
      completed_count: string | number
      total_sessions: string | number
    }

    const rows = await db('mentorship_requests')
      .where({ 'mentorship_requests.university_id': universityId, 'mentorship_requests.is_deleted': false })
      .join('users as u', 'u.id', 'mentorship_requests.alumni_id')
      .join('profiles as p', 'p.user_id', 'u.id')
      .groupBy('u.id', 'p.user_id', 'p.full_name', 'p.avatar_url', 'p.department', 'p.batch_year', 'p.mentorship_points', 'p.max_mentees')
      .select<MentorRow[]>(
        'u.id',
        'p.full_name',
        'p.avatar_url',
        'p.department',
        'p.batch_year',
        'p.mentorship_points',
        'p.max_mentees',
        db.raw(`COUNT(CASE WHEN mentorship_requests.status = 'accepted' THEN 1 END)::int AS current_mentees`),
        db.raw(`COUNT(CASE WHEN mentorship_requests.status = 'completed' THEN 1 END)::int AS completed_count`),
        db.raw(`COALESCE((
          SELECT COUNT(*)::int
          FROM mentorship_sessions ms
          JOIN mentorship_requests mr2 ON ms.request_id = mr2.id
          WHERE mr2.alumni_id = u.id
            AND mr2.university_id = ?
            AND mr2.is_deleted = false
        ), 0) AS total_sessions`, [universityId]),
      )
      .orderBy('p.full_name', 'asc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)

    return {
      items: rows.map((r) => ({
        id: r.id,
        fullName: r.full_name,
        avatarUrl: r.avatar_url,
        department: r.department,
        batchYear: r.batch_year,
        mentorshipPoints: r.mentorship_points,
        maxMentees: r.max_mentees,
        currentMentees: Number(r.current_mentees),
        completedCount: Number(r.completed_count),
        totalSessions: Number(r.total_sessions),
      })),
      total,
      page: query.page,
      hasMore: query.page * query.limit < total,
    }
  }

  async getMentorRequests(universityId: string, alumniId: string) {
    interface MentorRequestRow {
      id: string
      status: string
      message: string
      created_at: Date
      updated_at: Date
      student_id: string
      student_full_name: string
      student_avatar_url: string | null
      student_department: string | null
      student_batch_year: string | null
      session_count: string | number
    }

    const rows = await db('mentorship_requests')
      .where({
        'mentorship_requests.university_id': universityId,
        'mentorship_requests.alumni_id': alumniId,
        'mentorship_requests.is_deleted': false,
      })
      .join('users as su', 'su.id', 'mentorship_requests.student_id')
      .join('profiles as sp', 'sp.user_id', 'su.id')
      .select<MentorRequestRow[]>(
        'mentorship_requests.id',
        'mentorship_requests.status',
        'mentorship_requests.message',
        'mentorship_requests.created_at',
        'mentorship_requests.updated_at',
        'su.id as student_id',
        'sp.full_name as student_full_name',
        'sp.avatar_url as student_avatar_url',
        'sp.department as student_department',
        'sp.batch_year as student_batch_year',
        db.raw(
          `(SELECT COUNT(*)::int FROM mentorship_sessions ms WHERE ms.request_id = mentorship_requests.id) AS session_count`,
        ),
      )
      .orderBy('mentorship_requests.created_at', 'desc')

    if (rows.length === 0) return []

    const requestIds = rows.map((r) => r.id)

    interface FeedbackRow {
      request_id: string
      id: string
      author_id: string
      author_role: string
      rating: number
      comment: string | null
      created_at: Date
    }

    const feedbackRows = await db('mentorship_feedback')
      .whereIn('request_id', requestIds)
      .select<FeedbackRow[]>('request_id', 'id', 'author_id', 'author_role', 'rating', 'comment', 'created_at')

    const feedbackMap = new Map<string, { student: FeedbackEntry | null; alumni: FeedbackEntry | null }>()
    for (const fb of feedbackRows) {
      if (!feedbackMap.has(fb.request_id)) {
        feedbackMap.set(fb.request_id, { student: null, alumni: null })
      }
      const slot = feedbackMap.get(fb.request_id)!
      const entry: FeedbackEntry = {
        id: fb.id,
        authorId: fb.author_id,
        authorRole: fb.author_role as 'student' | 'alumni',
        rating: fb.rating,
        comment: fb.comment,
        createdAt: fb.created_at,
      }
      if (fb.author_role === 'student') slot.student = entry
      else slot.alumni = entry
    }

    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      message: r.message,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      sessionCount: Number(r.session_count),
      student: {
        id: r.student_id,
        fullName: r.student_full_name,
        avatarUrl: r.student_avatar_url,
        department: r.student_department,
        batchYear: r.student_batch_year,
      },
      feedback: feedbackMap.get(r.id) ?? { student: null, alumni: null },
    }))
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
