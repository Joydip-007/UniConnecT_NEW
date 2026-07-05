import { asyncHandler } from '../../utils/asyncHandler'
import { sendSuccess, sendPaginated } from '../../utils/response'
import { unauthorized } from '../../utils/errors'
import * as service from './service'
import type { SubmitAnswersInput, QuizHistoryQuery } from './schema'
import type { Request, Response } from 'express'

function getAuthContext(req: Request) {
  if (!req.user) throw unauthorized()
  return { userId: req.user.userId, universityId: req.university!.id }
}

function getSlotIdParam(req: Request) {
  const value = req.params.slotId
  return Array.isArray(value) ? value[0] : value
}

export const getTodaySlot = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.getTodaySlot(getAuthContext(req)))
})

export const submitAttempt = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await service.submitAttempt(context, getSlotIdParam(req), req.body as SubmitAnswersInput), 201)
})

export const getTodayLeaderboard = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.getTodayLeaderboard(getAuthContext(req)))
})

export const getMyHistory = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const result = await service.getMyHistory(context, req.query as unknown as QuizHistoryQuery)
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})
