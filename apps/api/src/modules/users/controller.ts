import type { Request, Response } from 'express'
import { asyncHandler } from '../../utils/asyncHandler'
import { sendPaginated, sendSuccess } from '../../utils/response'
import { unauthorized } from '../../utils/errors'
import type { CreateAccountDeletionRequestInput, CreateProblemReportInput, PrivacyPreferencesInput } from '@uniconnect/shared'
import { RESERVED_USERNAMES, normalizeUsername, usernameSchema } from '@uniconnect/shared'
import { usersService } from './service'
import * as accountService from './account.service'
import { createProblemReport as fileProblemReport } from './problem-reports.service'
import { loadPrivacy, updatePrivacy } from './privacy.service'
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

export const requestAccountDeletion = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const { reason } = req.body as CreateAccountDeletionRequestInput
  sendSuccess(res, await accountService.requestAccountDeletion(context.userId, context.universityId, reason), 201)
})

export const createProblemReport = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(
    res,
    await fileProblemReport(context.userId, context.universityId, req.body as CreateProblemReportInput),
    201,
  )
})

export const getMyDeletionRequest = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await accountService.getMyDeletionRequest(context.userId))
})

export const cancelMyDeletionRequest = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await accountService.cancelDeletionRequest(context.userId))
})

export const exportMyData = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await accountService.exportUserData(context.userId, context.universityId))
})

export const getMyPrivacy = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await loadPrivacy(context.userId))
})

export const updateMyPrivacy = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(
    res,
    await updatePrivacy(context.userId, context.universityId, req.body as PrivacyPreferencesInput),
  )
})

export const getUserByUsername = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(
    res,
    await usersService.getPublicProfileByUsername(context.userId, getUsernameParam(req), context.universityId),
  )
})

export const checkUsernameAvailable = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const raw = String((req.query as { username?: unknown }).username ?? '')
  const parsed = usernameSchema.safeParse(raw)
  if (!parsed.success) {
    const reserved = RESERVED_USERNAMES.includes(
      normalizeUsername(raw) as (typeof RESERVED_USERNAMES)[number],
    )
    sendSuccess(res, { available: false, reason: reserved ? 'reserved' : 'invalid' })
    return
  }
  const available = await usersService.isUsernameAvailable(context.userId, context.universityId, parsed.data)
  sendSuccess(res, { available, reason: available ? undefined : 'taken' })
})

export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await usersService.getPublicProfile(context.userId, getUserIdParam(req), context.universityId))
})

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const result = await usersService.listUsers(
    context.userId,
    context.universityId,
    req.query as unknown as UserListQuery,
  )
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

function getUsernameParam(req: Request) {
  const value = req.params.username
  return Array.isArray(value) ? value[0] : value
}

function getEntryIdParam(req: Request) {
  const value = req.params.entryId
  return Array.isArray(value) ? value[0] : value
}
