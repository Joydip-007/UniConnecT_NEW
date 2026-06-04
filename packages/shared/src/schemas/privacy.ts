import { z } from 'zod'
import {
  AUDIENCE_TIERS,
  CONNECTION_REQUEST_TIERS,
  MESSAGE_TIERS,
  ONLINE_VISIBILITY_TIERS,
  PRIVACY_SECTIONS,
  type PrivacyPreferences,
} from '../constants/privacy'

const audienceTier = z.enum(AUDIENCE_TIERS)

const sectionsSchema = z
  .object(
    PRIVACY_SECTIONS.reduce(
      (acc, section) => {
        acc[section] = audienceTier.optional()
        return acc
      },
      {} as Record<(typeof PRIVACY_SECTIONS)[number], z.ZodOptional<typeof audienceTier>>,
    ),
  )
  .partial()

/** Partial update — any subset may be sent; the server merges over current prefs. */
export const privacyPreferencesSchema = z.object({
  sections: sectionsSchema.optional(),
  connection_requests: z.enum(CONNECTION_REQUEST_TIERS).optional(),
  messages: z.enum(MESSAGE_TIERS).optional(),
  discoverable: z.boolean().optional(),
  online_visibility: z.enum(ONLINE_VISIBILITY_TIERS).optional(),
})

export type PrivacyPreferencesInput = z.infer<typeof privacyPreferencesSchema>

/** Effective prefs returned by the API (always the full, merged object). */
export type PrivacyPreferencesResponse = PrivacyPreferences
