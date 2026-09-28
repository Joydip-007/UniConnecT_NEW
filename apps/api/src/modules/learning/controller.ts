import type { Request, Response } from 'express'
import { asyncHandler } from '../../utils/asyncHandler'
import { sendSuccess } from '../../utils/response'
import { unauthorized } from '../../utils/errors'
import * as service from './service'

function getAuthContext(req: Request) {
  if (!req.user) throw unauthorized()
  return req.user
}

export const listPaths = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await service.listPaths(context.universityId, context.userId))
})

export const getPath = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const { pathId } = req.params as { pathId: string }
  sendSuccess(res, await service.getPath(pathId, context.userId, context.universityId))
})

export const enroll = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const { pathId } = req.params as { pathId: string }
  sendSuccess(res, await service.enroll(pathId, context.userId, context.universityId))
})

export const abandon = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const { pathId } = req.params as { pathId: string }
  sendSuccess(res, await service.abandon(pathId, context.userId))
})

export const completeUnit = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const { unitId } = req.params as { unitId: string }
  sendSuccess(res, await service.completeUnit(unitId, context.userId, context.universityId, req.body))
})

export const getToday = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await service.getToday(context.userId, context.universityId))
})

export const getStats = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await service.getStats(context.userId, context.universityId))
})

export const listMyBadges = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await service.listUserBadges(context.userId))
})

export const setShowcase = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const { badgeId } = req.body as { badgeId: string | null }
  await service.setShowcase(context.userId, badgeId)
  sendSuccess(res, { success: true })
})

export const listBadgesForUser = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const { userId } = req.params as { userId: string }
  sendSuccess(res, await service.listUserBadgesForOther(userId, context.universityId))
})

export const submitUnitQuizAttempt = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const { unitId } = req.params as { unitId: string }
  sendSuccess(res, await service.submitUnitQuizAttempt(unitId, context.userId, context.universityId, req.body), 201)
})

export const listUnitQuizAttempts = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const { unitId } = req.params as { unitId: string }
  sendSuccess(res, await service.listUnitQuizAttempts(unitId, context.userId, context.universityId))
})

export const listMyQuizzes = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await service.listMyQuizzes(context.userId, context.universityId))
})

export const getBadgeProgress = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await service.getBadgeProgress(context.userId, context.universityId))
})

export const setBadgePin = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const { badgeId } = req.params as { badgeId: string }
  const { pinned } = req.body as { pinned: boolean }
  await service.setBadgePin(context.userId, badgeId, pinned)
  sendSuccess(res, { success: true })
})
