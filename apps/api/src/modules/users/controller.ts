import type { Request, Response } from 'express'
import { asyncHandler } from '../../utils/asyncHandler'
import { sendPaginated, sendSuccess } from '../../utils/response'
import { unauthorized } from '../../utils/errors'
import { usersService } from './service'
import type {
  EducationInput,
  ExperienceInput,
  FeaturedInput,
  PaginationQuery,
  ReorderFeaturedInput,
  UpdatePreferencesInput,
  UpdateProfileInput,
  UserListQuery,
} from './schema'

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

export const updateMyPreferences = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(
    res,
    await usersService.updatePreferences(
      context.userId,
      context.universityId,
      req.body as UpdatePreferencesInput,
    ),
  )
})

export const deactivateMe = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await usersService.deactivateAccount(context.userId, context.universityId))
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

export const getSuggestions = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await usersService.getSuggestions(context.userId, context.universityId))
})

export const getProgress = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await usersService.getProgress(context.userId, context.universityId))
})

// ─── Experience ─────────────────────────────────────────────────────────────

export const getUserExperience = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await usersService.getUserExperience(context.userId, getUserIdParam(req), context.universityId))
})

export const createExperience = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await usersService.createExperience(context.userId, context.universityId, req.body as ExperienceInput), 201)
})

export const updateExperience = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(
    res,
    await usersService.updateExperience(
      context.userId,
      getEntryIdParam(req),
      context.universityId,
      req.body as Partial<ExperienceInput>,
    ),
  )
})

export const deleteExperience = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await usersService.deleteExperience(context.userId, getEntryIdParam(req)))
})

// ─── Education ──────────────────────────────────────────────────────────────

export const getUserEducation = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await usersService.getUserEducation(context.userId, getUserIdParam(req), context.universityId))
})

export const createEducation = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await usersService.createEducation(context.userId, context.universityId, req.body as EducationInput), 201)
})

export const updateEducation = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(
    res,
    await usersService.updateEducation(
      context.userId,
      getEntryIdParam(req),
      context.universityId,
      req.body as Partial<EducationInput>,
    ),
  )
})

export const deleteEducation = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await usersService.deleteEducation(context.userId, getEntryIdParam(req)))
})

// ─── Featured ───────────────────────────────────────────────────────────────

export const getUserFeatured = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await usersService.getUserFeatured(context.userId, getUserIdParam(req), context.universityId))
})

export const createFeatured = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await usersService.createFeatured(context.userId, context.universityId, req.body as FeaturedInput), 201)
})

export const deleteFeatured = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await usersService.deleteFeatured(context.userId, getEntryIdParam(req)))
})

export const reorderFeatured = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await usersService.reorderFeatured(context.userId, req.body as ReorderFeaturedInput))
})

// ─── Analytics + Viewers ────────────────────────────────────────────────────

export const getMyAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await usersService.getMyAnalytics(context.userId, context.universityId))
})

export const getMyViewers = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const result = await usersService.getMyViewers(
    context.userId,
    context.universityId,
    req.query as unknown as PaginationQuery,
  )
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

export const getUserConnections = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const result = await usersService.getUserConnections(
    context.userId,
    getUserIdParam(req),
    context.universityId,
    req.query as unknown as PaginationQuery,
  )
  if (result.listHidden) {
    sendSuccess(res, { total: result.total, listHidden: true })
  } else {
    sendPaginated(res, result.items, result.total, result.page, result.limit)
  }
})

function getAuthContext(req: Request) {
  if (!req.user) throw unauthorized()
  return req.user
}

function getUserIdParam(req: Request) {
  const value = req.params.userId
  return Array.isArray(value) ? value[0] : value
}

function getEntryIdParam(req: Request) {
  const value = req.params.entryId
  return Array.isArray(value) ? value[0] : value
}
