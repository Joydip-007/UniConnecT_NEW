import type { Request, Response } from 'express'
import { asyncHandler } from '../../utils/asyncHandler'
import { sendSuccess } from '../../utils/response'
import { unauthorized } from '../../utils/errors'
import type { PresenceLookupInput } from '@uniconnect/shared'
import { lookupPresence, onlineConnections } from './service'

export const getPresence = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const { userIds } = req.query as unknown as PresenceLookupInput
  sendSuccess(res, await lookupPresence(context.userId, userIds, context.universityId))
})

export const getOnlineConnections = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await onlineConnections(context.userId, context.universityId))
})

function getAuthContext(req: Request) {
  if (!req.user) throw unauthorized()
  return req.user
}
