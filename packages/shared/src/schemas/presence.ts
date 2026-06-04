import { z } from 'zod'

/** Batch presence lookup query: `?userIds=a,b,c` (comma-separated). */
export const presenceLookupSchema = z.object({
  userIds: z
    .string()
    .transform((s) => s.split(',').map((id) => id.trim()).filter(Boolean))
    .pipe(z.array(z.string().uuid()).max(200)),
})

export type PresenceLookupInput = z.infer<typeof presenceLookupSchema>

export interface PresenceEntry {
  userId: string
  status: 'online' | 'offline'
  lastSeenAt: string | null
}
