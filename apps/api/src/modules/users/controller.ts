import type { Request, Response } from 'express'
import { asyncHandler } from '../../utils/asyncHandler'
import { sendPaginated, sendSuccess } from '../../utils/response'
import { unauthorized } from '../../utils/errors'
import { usersService } from './service'
import type { PaginationQuery, UpdateProfileInput, UserListQuery } from './schema'

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await usersService.getCurrentUser(context.userId, context.universityId))
})

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(
    res,
    await usersService.updateCurrentUser(context.userId, context.universityId, req.body as UpdateProfileInput),
  )
})

export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await usersService.getPublicProfile(context.userId, getUserIdParam(req), context.universityId))
})

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const result = await usersService.listUsers(context.universityId, req.query as unknown as UserListQuery)
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

export const followUser = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await usersService.followUser(context.userId, getUserIdParam(req), context.universityId))
})

export const unfollowUser = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await usersService.unfollowUser(context.userId, getUserIdParam(req), context.universityId))
})

export const listFollowers = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const result = await usersService.listFollowers(
    getUserIdParam(req),
    context.universityId,
    req.query as unknown as PaginationQuery,
  )
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

export const listFollowing = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const result = await usersService.listFollowing(
    getUserIdParam(req),
    context.universityId,
    req.query as unknown as PaginationQuery,
  )
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

export const getSuggestions = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await usersService.getSuggestions(context.userId, context.universityId))
})

function getAuthContext(req: Request) {
  if (!req.user) throw unauthorized()
  return req.user
}

function getUserIdParam(req: Request) {
  const value = req.params.userId
  return Array.isArray(value) ? value[0] : value
}
