import type { Request, Response } from 'express'
import { asyncHandler } from '../../utils/asyncHandler'
import { sendPaginated, sendSuccess } from '../../utils/response'
import { unauthorized } from '../../utils/errors'
import { newsService } from './service'
import type { CreateNewsInput, NewsListQuery, UpdateNewsInput } from './schema'

export const listNews = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const result = await newsService.listNews(context, req.query as unknown as NewsListQuery)
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

export const createNews = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await newsService.createNews(context, req.body as CreateNewsInput), 201)
})

export const getNews = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await newsService.getNews(context, getNewsIdParam(req)))
})

export const updateNews = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await newsService.updateNews(context, getNewsIdParam(req), req.body as UpdateNewsInput))
})

export const deleteNews = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await newsService.deleteNews(context, getNewsIdParam(req)))
})

function getAuthContext(req: Request) {
  if (!req.user) throw unauthorized()

  return {
    userId: req.user.userId,
    universityId: req.university?.id ?? req.user.universityId,
    role: req.user.role,
  }
}

function getNewsIdParam(req: Request) {
  const value = req.params.newsId
  return Array.isArray(value) ? value[0] : value
}
