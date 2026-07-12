import type { Request, Response } from 'express'
import { asyncHandler } from '../../utils/asyncHandler'
import { unauthorized } from '../../utils/errors'
import { sendSuccess } from '../../utils/response'
import { learningAdminService } from './service'
import type { LearningAdminConfigInput } from './schema'

export const getConfig = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getContext(req)
  sendSuccess(res, await learningAdminService.getConfig(universityId))
})

export const updateConfig = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getContext(req)
  const config = await learningAdminService.updateConfig(universityId, req.body as LearningAdminConfigInput)
  sendSuccess(res, config)
})

export const listPendingPaths = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getContext(req)
  sendSuccess(res, await learningAdminService.listPendingPaths(universityId))
})

export const getPendingPathDetail = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getContext(req)
  sendSuccess(res, await learningAdminService.getPendingPathDetail(universityId, req.params.id as string))
})

export const approvePath = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getContext(req)
  await learningAdminService.approvePath(universityId, req.params.id as string)
  sendSuccess(res, { success: true })
})

export const discardPath = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getContext(req)
  await learningAdminService.discardPath(universityId, req.params.id as string)
  sendSuccess(res, { success: true })
})

export const listPendingQuizBatches = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getContext(req)
  sendSuccess(res, await learningAdminService.listPendingQuizBatches(universityId))
})

export const getPendingQuizDetail = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getContext(req)
  sendSuccess(res, await learningAdminService.getPendingQuizDetail(universityId, req.params.id as string))
})

export const approveQuizBatch = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getContext(req)
  await learningAdminService.approveQuizBatch(universityId, req.params.id as string)
  sendSuccess(res, { success: true })
})

export const discardQuizBatch = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getContext(req)
  await learningAdminService.discardQuizBatch(universityId, req.params.id as string)
  sendSuccess(res, { success: true })
})

export const triggerGenerateNow = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getContext(req)
  await learningAdminService.triggerGenerateNow(universityId)
  sendSuccess(res, { success: true })
})

export const getUpcomingQuizzes = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getContext(req)
  sendSuccess(res, await learningAdminService.getUpcomingQuizzes(universityId))
})

export const getAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getContext(req)
  const days = Math.min(90, Math.max(1, Number(req.query.days) || 14))
  sendSuccess(res, await learningAdminService.getAnalytics(universityId, days))
})

function getContext(req: Request) {
  if (!req.user) throw unauthorized()
  return {
    userId: req.user.userId,
    universityId: req.university?.id ?? req.user.universityId,
  }
}
