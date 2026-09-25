import { z } from 'zod'

export const problemReportStatusSchema = z.enum(['open', 'resolved'])
export type ProblemReportStatus = z.infer<typeof problemReportStatusSchema>

/** Filed from the "This page didn't load" card when a page crashes inside the shell. */
export const createProblemReportSchema = z.object({
  /** Client-generated id shown to the user (`uc-7f3a91`), so support and logs line up. */
  errorId: z.string().trim().regex(/^uc-[0-9a-f]{6}$/, 'Invalid error id'),
  errorMessage: z.string().trim().min(1).max(2000),
  /** What the user was doing. Optional: the crash details alone are still worth sending. */
  description: z.string().trim().max(1000).optional(),
  pageUrl: z.string().trim().max(2000),
  userAgent: z.string().trim().max(500).optional(),
})
export type CreateProblemReportInput = z.infer<typeof createProblemReportSchema>

export const resolveProblemReportSchema = z.object({
  status: problemReportStatusSchema,
})
export type ResolveProblemReportInput = z.infer<typeof resolveProblemReportSchema>

export const problemReportListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: problemReportStatusSchema.optional(),
})
export type ProblemReportListQuery = z.infer<typeof problemReportListQuerySchema>

export const problemReportSchema = z.object({
  id: z.string().uuid(),
  errorId: z.string(),
  errorMessage: z.string(),
  description: z.string().nullable(),
  pageUrl: z.string(),
  userAgent: z.string().nullable(),
  status: problemReportStatusSchema,
  createdAt: z.union([z.string(), z.date()]),
  resolvedAt: z.union([z.string(), z.date()]).nullable(),
  // Present only in the admin queue listing.
  reporterId: z.string().uuid().optional(),
  reporterName: z.string().nullable().optional(),
  reporterEmail: z.string().nullable().optional(),
})
export type ProblemReport = z.infer<typeof problemReportSchema>
