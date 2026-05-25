import { z } from 'zod'

export const SendConnectionRequestSchema = z.object({
  note: z.string().trim().max(300).optional(),
})
export type SendConnectionRequestInput = z.infer<typeof SendConnectionRequestSchema>

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
})
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>
