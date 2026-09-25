import type { ProblemReport, ProblemReportListQuery, ResolveProblemReportInput } from '@uniconnect/shared'
import { db } from '../../config/db'
import { notFound } from '../../utils/errors'
import {
  PROBLEM_REPORT_COLUMNS,
  toProblemReport,
  type ProblemReportRow,
} from '../users/problem-reports.service'

type AdminRow = ProblemReportRow & {
  user_id: string
  reporter_name: string | null
  reporter_email: string | null
}

export const adminProblemReportsService = {
  async list(universityId: string, query: ProblemReportListQuery) {
    const base = db('problem_reports as pr')
      .join('users as u', 'u.id', 'pr.user_id')
      .leftJoin('profiles as p', 'p.user_id', 'pr.user_id')
      .where('pr.university_id', universityId)
    if (query.status) base.where('pr.status', query.status)

    const [{ count }] = await base.clone().count<{ count: string }[]>('pr.id as count')

    const rows = await base
      .clone()
      .select(
        ...PROBLEM_REPORT_COLUMNS.map((c) => `pr.${c}`),
        'pr.user_id',
        'p.full_name as reporter_name',
        'u.email as reporter_email',
      )
      // Open first, then most recent.
      .orderByRaw("CASE WHEN pr.status = 'open' THEN 0 ELSE 1 END")
      .orderBy('pr.created_at', 'desc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)

    const items: ProblemReport[] = (rows as AdminRow[]).map((r) => ({
      ...toProblemReport(r),
      reporterId: r.user_id,
      reporterName: r.reporter_name,
      reporterEmail: r.reporter_email,
    }))

    return { items, total: Number(count), page: query.page, limit: query.limit }
  },

  /** Resolve, or reopen a report resolved by mistake. Both are audited. */
  async setStatus(universityId: string, actorId: string, reportId: string, input: ResolveProblemReportInput) {
    const report = await db('problem_reports')
      .where({ id: reportId, university_id: universityId })
      .first<{ id: string; status: string }>()
    if (!report) throw notFound('Problem report not found')

    const resolved = input.status === 'resolved'
    await db.transaction(async (trx) => {
      await trx('problem_reports')
        .where({ id: reportId })
        .update({
          status: input.status,
          resolved_by: resolved ? actorId : null,
          resolved_at: resolved ? trx.fn.now() : null,
          updated_at: trx.fn.now(),
        })
      await trx('university_audit_logs').insert({
        university_id: universityId,
        actor_id: actorId,
        action: resolved ? 'problem_report.resolved' : 'problem_report.reopened',
        payload: JSON.stringify({ reportId }),
      })
    })

    return { reportId, status: input.status }
  },
}
