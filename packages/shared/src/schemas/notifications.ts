import { z } from 'zod'
import type { NotificationPreferences } from '../constants/notifications'

const categoryPreferenceSchema = z
  .object({
    in_app: z.boolean(),
    push: z.boolean(),
  })
  .partial()

/** Partial update — any subset of categories/channels may be sent; the server merges over current prefs. */
export const notificationPreferencesSchema = z.object({
  connections: categoryPreferenceSchema.optional(),
  feed: categoryPreferenceSchema.optional(),
  groups: categoryPreferenceSchema.optional(),
  mentorship: categoryPreferenceSchema.optional(),
  messages: categoryPreferenceSchema.optional(),
})

export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>

/** Effective prefs returned by the API (always the full, merged matrix). */
export type NotificationPreferencesResponse = NotificationPreferences
