import type { Request, Response } from 'express'
import { asyncHandler } from '../../utils/asyncHandler'
import { sendSuccess } from '../../utils/response'
import { AppError } from '../../utils/errors'
import { unauthorized } from '../../utils/errors'
import { searchAll, searchPeople, searchPosts, searchJobs, searchEvents, searchGroups } from './service'
import type { SearchAllQuery, SearchPagedQuery, SearchPeopleQuery, SearchPostsQuery } from './schema'

function getAuthContext(req: Request) {
  if (!req.user) throw unauthorized()
  if (!req.university) throw new AppError('University not resolved', 500, 'UNIVERSITY_NOT_RESOLVED')
  return { userId: req.user.userId, universityId: req.university.id }
}

export const searchAllController = asyncHandler(async (req: Request, res: Response) => {
  const { userId, universityId } = getAuthContext(req)
  const { q, limit } = req.query as unknown as SearchAllQuery
  const result = await searchAll(universityId, q, limit, userId)
  sendSuccess(res, result)
})

export const searchPeopleController = asyncHandler(async (req: Request, res: Response) => {
  const { userId, universityId } = getAuthContext(req)
  const { q, role, department, batch, page, limit } = req.query as unknown as SearchPeopleQuery
  const result = await searchPeople(universityId, { q, role, department, batch }, page, limit, userId)
  sendSuccess(res, result)
})

export const searchPostsController = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getAuthContext(req)
  const { q, tag, page, limit } = req.query as unknown as SearchPostsQuery
  const result = await searchPosts(universityId, { q, tag }, page, limit)
  sendSuccess(res, result)
})

export const searchJobsController = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getAuthContext(req)
  const { q, page, limit } = req.query as unknown as SearchPagedQuery
  const result = await searchJobs(universityId, q, page, limit)
  sendSuccess(res, result)
})

export const searchEventsController = asyncHandler(async (req: Request, res: Response) => {
  const { userId, universityId } = getAuthContext(req)
  const { q, page, limit } = req.query as unknown as SearchPagedQuery
  const result = await searchEvents(universityId, q, page, limit, userId)
  sendSuccess(res, result)
})

export const searchGroupsController = asyncHandler(async (req: Request, res: Response) => {
  const { userId, universityId } = getAuthContext(req)
  const { q, page, limit } = req.query as unknown as SearchPagedQuery
  const result = await searchGroups(universityId, q, page, limit, userId)
  sendSuccess(res, result)
})
