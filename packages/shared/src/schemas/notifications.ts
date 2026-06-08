import { z } from 'zod'
import type { NotificationPreferences } from '../constants/notifications'

const categoryPreferenceSchema = z
  .object({
    in_app: z.boolean(),
    push: z.boolean(),
  })
  .partial()

const timeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be in HH:MM 24-hour format')

const quietHoursInputSchema = z
  .object({
    enabled: z.boolean(),
    start: timeOfDay,
    end: timeOfDay,
    timezone: z.string().min(1),
  })
  .partial()

/** Partial update — any subset of categories/channels may be sent; the server merges over current prefs. */
export const notificationPreferencesSchema = z.object({
  connections: categoryPreferenceSchema.optional(),
  feed: categoryPreferenceSchema.optional(),
  groups: categoryPreferenceSchema.optional(),
  mentorship: categoryPreferenceSchema.optional(),
  messages: categoryPreferenceSchema.optional(),
  quietHours: quietHoursInputSchema.optional(),
  emailDigest: z.enum(['off', 'daily']).optional(),
})

export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>

/** Effective prefs returned by the API (always the full, merged matrix). */
export type NotificationPreferencesResponse = NotificationPreferences
