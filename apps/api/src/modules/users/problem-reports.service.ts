import type { CreateProblemReportInput, ProblemReport } from '@uniconnect/shared'
import { db } from '../../config/db'
import { tooManyRequests } from '../../utils/errors'
import { logger } from '../../utils/logger'

/** A crash loop can fire the card repeatedly; this caps what one user can file per hour. */
export const PROBLEM_REPORTS_PER_HOUR = 10

export interface ProblemReportRow {
  id: string
  error_id: string
  error_message: string
  description: string | null
  page_url: string
  user_agent: string | null
  status: ProblemReport['status']
  created_at: Date
  resolved_at: Date | null
}

export const PROBLEM_REPORT_COLUMNS = [
  'id',
  'error_id',
  'error_message',
  'description',
  'page_url',
  'user_agent',
  'status',
  'created_at',
  'resolved_at',
] as const

export function toProblemReport(row: ProblemReportRow): ProblemReport {
  return {
    id: row.id,
    errorId: row.error_id,
    errorMessage: row.error_message,
    description: row.description,
    pageUrl: row.page_url,
    userAgent: row.user_agent,
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  }
}

/**
 * File a problem report for the admins. Re-sending the same error id updates the
 * existing report (a retry after a flaky send, or a description added second time
 * round) instead of queueing a duplicate.
 */
export async function createProblemReport(
  userId: string,
  universityId: string,
  input: CreateProblemReportInput,
): Promise<ProblemReport> {
  const [{ count }] = await db('problem_reports')
    .where({ user_id: userId })
    .where('created_at', '>', db.raw("now() - interval '1 hour'"))
    .count<{ count: string }[]>('id as count')
  if (Number(count) >= PROBLEM_REPORTS_PER_HOUR) {
    throw tooManyRequests('You have sent a lot of reports recently. Try again later.', 'PROBLEM_REPORT_RATE_LIMITED')
  }

  const [row] = await db('problem_reports')
    .insert({
      university_id: universityId,
      user_id: userId,
      error_id: input.errorId,
      error_message: input.errorMessage,
      description: input.description || null,
      page_url: input.pageUrl,
      user_agent: input.userAgent ?? null,
    })
    .onConflict(['user_id', 'error_id'])
    .merge({
      description: db.raw('COALESCE(EXCLUDED.description, problem_reports.description)'),
      updated_at: db.fn.now(),
    })
    .returning<ProblemReportRow[]>([...PROBLEM_REPORT_COLUMNS])

  logger.info('Problem report filed', { userId, universityId, reportId: row.id, errorId: input.errorId })
  return toProblemReport(row)
}
