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

function getContext(req: Request) {
  if (!req.user) throw unauthorized()
  return {
    userId: req.user.userId,
    universityId: req.university?.id ?? req.user.universityId,
  }
}
