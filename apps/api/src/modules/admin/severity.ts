/**
 * Report severity is derived, not stored — `reports.reason` mirrors the fixed
 * enum in packages/shared/src/schemas/moderation.ts (reportReasonSchema). This
 * mapping must stay exhaustive against that enum: spam, harassment,
 * hate_speech, violence, nudity, misinformation, impersonation, self_harm, other.
 */
const HIGH_REASONS = ['harassment', 'hate_speech', 'violence', 'nudity', 'self_harm'] as const
const MEDIUM_REASONS = ['misinformation', 'impersonation'] as const
// spam, other -> low (the SQL/JS default branch)

export type ReportSeverity = 'high' | 'medium' | 'low'

export function severityForReason(reason: string): ReportSeverity {
  if ((HIGH_REASONS as readonly string[]).includes(reason)) return 'high'
  if ((MEDIUM_REASONS as readonly string[]).includes(reason)) return 'medium'
  return 'low'
}

/** SQL CASE expression over a fixed, code-defined reason list — safe to inline, no user input reaches this string. */
export function severityCaseSql(column: string): string {
  const high = HIGH_REASONS.map((r) => `'${r}'`).join(', ')
  const medium = MEDIUM_REASONS.map((r) => `'${r}'`).join(', ')
  return `CASE WHEN ${column} IN (${high}) THEN 3 WHEN ${column} IN (${medium}) THEN 2 ELSE 1 END`
}

export function severityFromRank(rank: number): ReportSeverity {
  if (rank >= 3) return 'high'
  if (rank === 2) return 'medium'
  return 'low'
}
