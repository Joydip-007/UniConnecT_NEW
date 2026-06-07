import type { Request, Response } from 'express'
import type { ContentSyncConfigInput } from '@uniconnect/shared'
import { asyncHandler } from '../../utils/asyncHandler'
import { unauthorized } from '../../utils/errors'
import { sendPaginated, sendSuccess } from '../../utils/response'
import { contentSyncService } from './service'
import type { RunContentSyncInput, RunsQuery } from './schema'

export const getConfig = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getContext(req)
  sendSuccess(res, await contentSyncService.getConfig(universityId))
})

export const updateConfig = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getContext(req)
  const config = await contentSyncService.updateConfig(universityId, req.body as ContentSyncConfigInput)
  sendSuccess(res, config)
})

export const triggerRun = asyncHandler(async (req: Request, res: Response) => {
  const { universityId, userId } = getContext(req)
  const { backfill } = req.body as RunContentSyncInput
  sendSuccess(res, await contentSyncService.triggerRun(universityId, userId, { backfill }), 202)
})

export const listPendingImported = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getContext(req)
  sendSuccess(res, await contentSyncService.listPendingImported(universityId))
})

export const listRuns = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getContext(req)
  const { page, limit } = req.query as unknown as RunsQuery
  const result = await contentSyncService.listRuns(universityId, page, limit)
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

function getContext(req: Request) {
  if (!req.user) throw unauthorized()
  return {
    userId: req.user.userId,
    universityId: req.university?.id ?? req.user.universityId,
  }
}
