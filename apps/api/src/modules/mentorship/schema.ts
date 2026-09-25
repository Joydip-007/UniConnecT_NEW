import { z } from 'zod'

export const MentorshipStatusSchema = z.enum(['pending', 'accepted', 'declined', 'completed', 'expired'])

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
    // Shown to the student on a decline. Absent on a decline at capacity → filled in.
    declineReason: z.string().trim().min(1).max(300).optional(),
  })
  .refine(
    (v) => v.status !== undefined || v.session_notes !== undefined || v.sessionNotes !== undefined,
    { message: 'At least one field is required' },
  )
  .transform((v) => ({
    status: v.status,
    session_notes: v.session_notes ?? v.sessionNotes,
    declineReason: v.declineReason,
  }))

export const EndMentorshipSchema = z.object({
  reason: z.string().trim().min(1).max(100),
  note: z.string().trim().max(1000).optional(),
})

export const CreateSessionRequestSchema = z.object({
  // A mentor availability label, or null for "no specific time".
  slotLabel: z.string().trim().min(1).max(100).nullable().optional(),
  topic: z.string().trim().max(255).optional(),
})

// No `.default()` here: this validates a partial write (see CLAUDE.md).
export const UpdateMentorSettingsSchema = z
  .object({
    isOpenToMentorship: z.boolean().optional(),
    maxMentees: z.number().int().min(1).max(20).optional(),
    topics: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
    availability: z.array(z.string().trim().min(1).max(100)).max(14).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'At least one field is required',
  })

export const RedeemGiftCardSchema = z.object({
  giftCardId: z.string().uuid(),
})

export const CreateSessionSchema = z.object({
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
  durationMinutes: z.number().int().min(1).max(480),
  topic: z.string().trim().min(1).max(255),
  notes: z.string().trim().max(5000).nullable().optional(),
})

export const UpdateSessionSchema = CreateSessionSchema.partial().refine(
  (v) =>
    v.sessionDate !== undefined ||
    v.durationMinutes !== undefined ||
    v.topic !== undefined ||
    v.notes !== undefined,
  { message: 'At least one field is required' },
)

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>
export type AlumniListQuery = z.infer<typeof AlumniListQuerySchema>
export type IncomingRequestsQuery = z.infer<typeof IncomingRequestsQuerySchema>
export type CreateRequestInput = z.infer<typeof CreateRequestSchema>
export type UpdateRequestInput = z.infer<typeof UpdateRequestSchema>
export type RedeemGiftCardInput = z.infer<typeof RedeemGiftCardSchema>
export type CreateSessionInput = z.infer<typeof CreateSessionSchema>
export type UpdateSessionInput = z.infer<typeof UpdateSessionSchema>

export const SubmitFeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
})

export type EndMentorshipInput = z.infer<typeof EndMentorshipSchema>
export type CreateSessionRequestInput = z.infer<typeof CreateSessionRequestSchema>
export type UpdateMentorSettingsInput = z.infer<typeof UpdateMentorSettingsSchema>
export type SubmitFeedbackInput = z.infer<typeof SubmitFeedbackSchema>
