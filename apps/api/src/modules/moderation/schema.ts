import { z } from 'zod'
import { createReportSchema } from '@uniconnect/shared'

// Re-exported so the router/controller can validate against the shared contract.
export const CreateReportSchema = createReportSchema
export type CreateReportInput = z.infer<typeof CreateReportSchema>

export const ModerationListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
})
export type ModerationListQuery = z.infer<typeof ModerationListQuerySchema>
