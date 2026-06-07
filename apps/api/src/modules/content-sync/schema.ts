import { z } from 'zod'

export { contentSyncConfigSchema } from '@uniconnect/shared'
export type { ContentSyncConfigInput } from '@uniconnect/shared'

export const RunsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

/** Body for POST /run. `backfill` widens the per-source fetch window for this run only,
 *  so historical attachment-bearing items (beyond the normal window) get imported. */
export const RunContentSyncSchema = z.object({
  backfill: z.boolean().default(false),
})

export type RunsQuery = z.infer<typeof RunsQuerySchema>
export type RunContentSyncInput = z.infer<typeof RunContentSyncSchema>
