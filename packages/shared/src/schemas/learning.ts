import { z } from 'zod'

export const pathIdParamsSchema = z.object({ pathId: z.string().uuid() })
export const unitIdParamsSchema = z.object({ unitId: z.string().uuid() })
export const userIdParamsSchema = z.object({ userId: z.string().uuid() })

/** Body for POST /learning/units/:unitId/complete — score only required by quiz units. */
export const completeUnitSchema = z.object({
  score: z.number().int().min(0).max(100).optional(),
})
export type CompleteUnitInput = z.infer<typeof completeUnitSchema>

/** Body for PUT /learning/me/badges/showcase — null clears the showcase. */
export const showcaseBadgeSchema = z.object({
  badgeId: z.string().uuid().nullable(),
})
export type ShowcaseBadgeInput = z.infer<typeof showcaseBadgeSchema>

export type BadgeRarity = 'common' | 'rare' | 'epic'

export const badgeIdParamsSchema = z.object({ badgeId: z.string().uuid() })

/** Body for POST /learning/units/:unitId/attempts — one picked option index per question. */
export const submitUnitQuizAttemptSchema = z.object({
  answers: z.array(z.number().int().min(0).max(20)).min(1).max(50),
})
export type SubmitUnitQuizAttemptInput = z.infer<typeof submitUnitQuizAttemptSchema>

/** Body for PUT /learning/me/badges/:badgeId/pin. */
export const pinBadgeSchema = z.object({ pinned: z.boolean() })
export type PinBadgeInput = z.infer<typeof pinBadgeSchema>
