import { z } from 'zod'

/** First-run / profile-completion signals returned by GET /users/me/progress. */
export const profileProgressSchema = z.object({
  /** 0–100 weighted completion of the profile fields. */
  profileScore: z.number().int().min(0).max(100),
  hasMadePost: z.boolean(),
  connectionCount: z.number().int().nonnegative(),
  isVerified: z.boolean(),
  hasAddedExperience: z.boolean(),
  hasAddedEducation: z.boolean(),
  // Granular flags so the onboarding checklist can deep-link to the exact gap.
  hasAvatar: z.boolean(),
  hasBio: z.boolean(),
  hasHeadline: z.boolean(),
})
export type ProfileProgress = z.infer<typeof profileProgressSchema>
