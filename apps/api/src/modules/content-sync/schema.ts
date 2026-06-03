import { z } from 'zod'

export { contentSyncConfigSchema } from '@uniconnect/shared'
export type { ContentSyncConfigInput } from '@uniconnect/shared'

export const RunsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export type RunsQuery = z.infer<typeof RunsQuerySchema>
