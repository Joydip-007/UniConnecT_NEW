import { z } from 'zod'

export const MentorshipStatusSchema = z.enum(['pending', 'accepted', 'declined', 'completed'])

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export const AlumniListQuerySchema = PaginationQuerySchema

export const IncomingRequestsQuerySchema = PaginationQuerySchema.extend({
  status: MentorshipStatusSchema.optional(),
})

export const CreateRequestSchema = z.object({
  alumniId: z.string().uuid(),
  message: z.string().trim().min(1).max(500),
})

export const UpdateRequestSchema = z
  .object({
    status: MentorshipStatusSchema.optional(),
    session_notes: z.string().trim().max(2000).nullable().optional(),
    sessionNotes: z.string().trim().max(2000).nullable().optional(),
  })
  .refine(
    (v) => v.status !== undefined || v.session_notes !== undefined || v.sessionNotes !== undefined,
    { message: 'At least one field is required' },
  )
  .transform((v) => ({
    status: v.status,
    session_notes: v.session_notes ?? v.sessionNotes,
  }))

export const RedeemGiftCardSchema = z.object({
  giftCardId: z.string().uuid(),
})

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>
export type AlumniListQuery = z.infer<typeof AlumniListQuerySchema>
export type IncomingRequestsQuery = z.infer<typeof IncomingRequestsQuerySchema>
export type CreateRequestInput = z.infer<typeof CreateRequestSchema>
export type UpdateRequestInput = z.infer<typeof UpdateRequestSchema>
export type RedeemGiftCardInput = z.infer<typeof RedeemGiftCardSchema>
