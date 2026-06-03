import type { Request, Response } from 'express'
import { asyncHandler } from '../../utils/asyncHandler'
import { unauthorized } from '../../utils/errors'
import { sendSuccess } from '../../utils/response'
import { draftsService } from './service'

export const listMyDrafts = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized()
  const universityId = req.university?.id ?? req.user.universityId
  sendSuccess(res, await draftsService.listMine(universityId, req.user.userId))
})
