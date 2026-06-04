import type { Request, Response } from 'express'
import { asyncHandler } from '../../utils/asyncHandler'
import { sendSuccess } from '../../utils/response'
import { badRequest, unauthorized } from '../../utils/errors'
import { pushService } from './service'
import type { PushSubscribeInput } from './schema'

export const subscribe = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const userAgent = req.headers['user-agent'] ?? null
  const result = await pushService.subscribe(
    context.userId,
    context.universityId,
    req.body as PushSubscribeInput,
    Array.isArray(userAgent) ? userAgent.join(' ') : userAgent,
  )
  sendSuccess(res, result, 201)
})

export const unsubscribe = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const endpoint = (req.body as { endpoint?: unknown })?.endpoint
  if (typeof endpoint !== 'string' || !endpoint) throw badRequest('endpoint is required')
  sendSuccess(res, await pushService.unsubscribe(context.userId, endpoint))
})

function getAuthContext(req: Request) {
  if (!req.user) throw unauthorized()
  return req.user
}
