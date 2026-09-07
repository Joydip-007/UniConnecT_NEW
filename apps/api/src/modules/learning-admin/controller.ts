import type { Request, Response } from 'express'
import { asyncHandler } from '../../utils/asyncHandler'
import { unauthorized } from '../../utils/errors'
import { sendSuccess } from '../../utils/response'
import { learningAdminService } from './service'
import type {
  LearningAdminConfigInput,
  AdminListPathsQuery,
  CreateLearningPathBody,
  UpdateLearningPathBody,
  SetPathPublishedBody,
  CreatePathUnitBody,
  UpdatePathUnitBody,
  ReorderPathUnitsBody,
} from './schema'

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

export const listAdminPaths = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getContext(req)
  sendSuccess(res, await learningAdminService.listAdminPaths(universityId, req.query as unknown as AdminListPathsQuery))
})

export const createPath = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getContext(req)
  const created = await learningAdminService.createPath(universityId, req.body as CreateLearningPathBody)
  sendSuccess(res, created, 201)
})

export const updatePath = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getContext(req)
  const updated = await learningAdminService.updatePath(universityId, req.params.id as string, req.body as UpdateLearningPathBody)
  sendSuccess(res, updated)
})

export const setPathPublished = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getContext(req)
  const { isPublished } = req.body as SetPathPublishedBody
  const updated = await learningAdminService.setPathPublished(universityId, req.params.id as string, isPublished)
  sendSuccess(res, updated)
})

export const getPathDetail = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getContext(req)
  sendSuccess(res, await learningAdminService.getPathDetail(universityId, req.params.id as string))
})

export const createUnit = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getContext(req)
  await learningAdminService.createUnit(universityId, req.params.id as string, req.body as CreatePathUnitBody)
  sendSuccess(res, { success: true }, 201)
})

export const updateUnit = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getContext(req)
  await learningAdminService.updateUnit(universityId, req.params.id as string, req.params.unitId as string, req.body as UpdatePathUnitBody)
  sendSuccess(res, { success: true })
})

export const deleteUnit = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getContext(req)
  await learningAdminService.deleteUnit(universityId, req.params.id as string, req.params.unitId as string)
  sendSuccess(res, { success: true })
})

export const reorderUnits = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getContext(req)
  const { unitIds } = req.body as ReorderPathUnitsBody
  await learningAdminService.reorderUnits(universityId, req.params.id as string, unitIds)
  sendSuccess(res, { success: true })
})

function getContext(req: Request) {
  if (!req.user) throw unauthorized()
  return {
    userId: req.user.userId,
    universityId: req.university?.id ?? req.user.universityId,
  }
}
