import { z } from 'zod'

export const klipyMediaSchema = z.enum(['stickers', 'gifs'])

export const klipyListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(50).default(24),
})

export const klipySearchQuerySchema = klipyListQuerySchema.extend({
  q: z.string().trim().min(1),
})

export const klipyParamsSchema = z.object({
  media: klipyMediaSchema,
})

export const klipyShareParamsSchema = z.object({
  media: klipyMediaSchema,
  slug: z.string().trim().min(1),
})

export type KlipyListQuery = z.infer<typeof klipyListQuerySchema>
export type KlipySearchQuery = z.infer<typeof klipySearchQuerySchema>
