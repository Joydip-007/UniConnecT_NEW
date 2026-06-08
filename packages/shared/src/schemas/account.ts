import { z } from 'zod'

export const accountDeletionStatusSchema = z.enum(['pending', 'approved', 'declined', 'cancelled'])
export type AccountDeletionStatus = z.infer<typeof accountDeletionStatusSchema>

/** User submits a deletion request with a reason; admins review it. */
export const createAccountDeletionRequestSchema = z.object({
  reason: z.string().trim().min(10, 'Please tell us a little more (at least 10 characters)').max(1000),
})
export type CreateAccountDeletionRequestInput = z.infer<typeof createAccountDeletionRequestSchema>

/** Admin resolves a request (approve = greenlight deletion, decline = keep account). */
export const resolveAccountDeletionRequestSchema = z.object({
  status: z.enum(['approved', 'declined']),
  adminNote: z.string().trim().max(1000).optional(),
})
export type ResolveAccountDeletionRequestInput = z.infer<typeof resolveAccountDeletionRequestSchema>

/** A deletion request as returned to the requester and the admin queue. */
export const accountDeletionRequestSchema = z.object({
  id: z.string().uuid(),
  reason: z.string(),
  status: accountDeletionStatusSchema,
  adminNote: z.string().nullable(),
  reviewedAt: z.union([z.string(), z.date()]).nullable(),
  createdAt: z.union([z.string(), z.date()]),
  // Present only in the admin queue listing.
  requesterId: z.string().uuid().optional(),
  requesterName: z.string().nullable().optional(),
  requesterEmail: z.string().nullable().optional(),
})
export type AccountDeletionRequest = z.infer<typeof accountDeletionRequestSchema>
