import type { Request, Response } from 'express'
import { asyncHandler } from '../../utils/asyncHandler'
import { sendSuccess } from '../../utils/response'
import { getTrending, search, getCategories, recordShare } from './service'
import {
  klipyParamsSchema,
  klipyListQuerySchema,
  klipySearchQuerySchema,
  klipyShareParamsSchema,
} from './schema'
import { badRequest } from '../../utils/errors'

export const trending = asyncHandler(async (req: Request, res: Response) => {
  const { media } = klipyParamsSchema.parse(req.params)
  const { page, per_page } = klipyListQuerySchema.parse(req.query)
  const result = await getTrending(media, page, per_page, req.user!.userId)
  sendSuccess(res, result)
})

export const searchItems = asyncHandler(async (req: Request, res: Response) => {
  const { media } = klipyParamsSchema.parse(req.params)
  const parsed = klipySearchQuerySchema.safeParse(req.query)
  if (!parsed.success) throw badRequest('q is required')
  const { q, page, per_page } = parsed.data
  const result = await search(media, q, page, per_page, req.user!.userId)
  sendSuccess(res, result)
})

export const categories = asyncHandler(async (req: Request, res: Response) => {
  const { media } = klipyParamsSchema.parse(req.params)
  const result = await getCategories(media, req.user!.userId)
  sendSuccess(res, result)
})

export const share = asyncHandler(async (req: Request, res: Response) => {
  const { media, slug } = klipyShareParamsSchema.parse(req.params)
  await recordShare(media, slug, req.user!.userId)
  sendSuccess(res, { ok: true })
})
