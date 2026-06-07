import type { Request, Response } from 'express'
import { asyncHandler } from '../../utils/asyncHandler'
import { unauthorized } from '../../utils/errors'
import { sendPaginated, sendSuccess } from '../../utils/response'
import { moderationService } from './service'
import type { CreateReportInput, ModerationListQuery } from './schema'

function getAuthContext(req: Request) {
  if (!req.user) throw unauthorized()
  return req.user
}

function getParam(req: Request, name: string): string {
  const value = req.params[name]
  return Array.isArray(value) ? value[0] : value
}

export const blockUser = asyncHandler(async (req: Request, res: Response) => {
  const { userId, universityId } = getAuthContext(req)
  sendSuccess(res, await moderationService.blockUser(userId, getParam(req, 'userId'), universityId), 201)
})

export const unblockUser = asyncHandler(async (req: Request, res: Response) => {
  const { userId, universityId } = getAuthContext(req)
  sendSuccess(res, await moderationService.unblockUser(userId, getParam(req, 'userId'), universityId))
})

export const listBlocks = asyncHandler(async (req: Request, res: Response) => {
  const { userId, universityId } = getAuthContext(req)
  const result = await moderationService.listBlocks(userId, universityId, req.query as unknown as ModerationListQuery)
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

export const muteUser = asyncHandler(async (req: Request, res: Response) => {
  const { userId, universityId } = getAuthContext(req)
  sendSuccess(res, await moderationService.muteUser(userId, getParam(req, 'userId'), universityId), 201)
})

export const unmuteUser = asyncHandler(async (req: Request, res: Response) => {
  const { userId, universityId } = getAuthContext(req)
  sendSuccess(res, await moderationService.unmuteUser(userId, getParam(req, 'userId'), universityId))
})

export const listMutes = asyncHandler(async (req: Request, res: Response) => {
  const { userId, universityId } = getAuthContext(req)
  const result = await moderationService.listMutes(userId, universityId, req.query as unknown as ModerationListQuery)
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

export const createReport = asyncHandler(async (req: Request, res: Response) => {
  const { userId, universityId } = getAuthContext(req)
  const input = req.body as CreateReportInput
  sendSuccess(res, await moderationService.createReport(userId, universityId, input), 201)
})
