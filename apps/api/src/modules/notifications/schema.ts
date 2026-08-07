import { z } from 'zod'

export const NotificationListQuerySchema = z.object({
  // Query params arrive as strings; z.coerce.boolean() would turn "false" into true.
  isRead: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export type NotificationListQuery = z.infer<typeof NotificationListQuerySchema>
