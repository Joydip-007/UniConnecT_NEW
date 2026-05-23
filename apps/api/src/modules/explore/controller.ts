import type { Request, Response } from 'express'
import { asyncHandler } from '../../utils/asyncHandler'
import { sendSuccess } from '../../utils/response'
import { unauthorized } from '../../utils/errors'
import { AppError } from '../../utils/errors'
import { getDiscovery, getTagPosts } from './service'
import type { TagPostsQuery } from './schema'

function getAuthContext(req: Request) {
  if (!req.user) throw unauthorized()
  if (!req.university) throw new AppError('University not resolved', 500, 'UNIVERSITY_NOT_RESOLVED')
  return { userId: req.user.userId, universityId: req.university.id }
}

export const discoveryController = asyncHandler(async (req: Request, res: Response) => {
  const { userId, universityId } = getAuthContext(req)
  const result = await getDiscovery(universityId, userId)
  sendSuccess(res, result)
})

export const tagPostsController = asyncHandler(async (req: Request, res: Response) => {
  const { userId, universityId } = getAuthContext(req)
  const tag = req.params.tag as string
  const { page, limit } = req.query as unknown as TagPostsQuery
  const result = await getTagPosts(universityId, userId, tag, page, limit)
  sendSuccess(res, result)
})
