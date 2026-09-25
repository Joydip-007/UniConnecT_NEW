import { z } from 'zod'
import { userRoleSchema } from './users'

/**
 * Targets a user can report. Mirrors `reports.target_type` on the API. `user`
 * is the new addition that powers "report this person"; the rest report content.
 */
export const reportTargetTypeSchema = z.enum(['user', 'post', 'comment', 'job', 'event', 'group', 'message', 'lost_found'])
export type ReportTargetType = z.infer<typeof reportTargetTypeSchema>

export const reportReasonSchema = z.enum([
  'spam',
  'harassment',
  'hate_speech',
  'violence',
  'nudity',
  'misinformation',
  'impersonation',
  'self_harm',
  'other',
])
export type ReportReason = z.infer<typeof reportReasonSchema>

export const createReportSchema = z.object({
  targetType: reportTargetTypeSchema,
  targetId: z.string().uuid(),
  reason: reportReasonSchema,
  description: z.string().trim().max(1000).optional(),
})
export type CreateReportInput = z.infer<typeof createReportSchema>

/** A blocked or muted account, as returned in the management lists. */
export const moderatedUserSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string(),
  role: userRoleSchema,
  username: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  headline: z.string().nullable(),
  createdAt: z.union([z.string(), z.date()]),
})
export type ModeratedUser = z.infer<typeof moderatedUserSchema>
