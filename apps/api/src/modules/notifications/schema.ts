import { z } from 'zod'

export const NotificationListQuerySchema = z.object({
  isRead: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export type NotificationListQuery = z.infer<typeof NotificationListQuerySchema>
