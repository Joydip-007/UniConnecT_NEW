import type { Request, Response } from 'express'
import { asyncHandler } from '../../utils/asyncHandler'
import { unauthorized } from '../../utils/errors'
import { sendPaginated, sendSuccess } from '../../utils/response'
import { connectionsService } from './service'
import type { PaginationQuery, SendConnectionRequestInput } from './schema'

export const sendRequest = asyncHandler(async (req: Request, res: Response) => {
  const { userId, universityId } = getAuthContext(req)
  const input = req.body as SendConnectionRequestInput
  const result = await connectionsService.sendRequest(userId, getParam(req, 'userId'), universityId, input.note)
  sendSuccess(res, result, 201)
})

export const withdrawRequest = asyncHandler(async (req: Request, res: Response) => {
  const { userId, universityId } = getAuthContext(req)
  sendSuccess(res, await connectionsService.withdrawRequest(userId, getParam(req, 'userId'), universityId))
})

export const acceptRequest = asyncHandler(async (req: Request, res: Response) => {
  const { userId, universityId } = getAuthContext(req)
  sendSuccess(res, await connectionsService.acceptRequest(userId, getParam(req, 'connectionId'), universityId))
})

export const declineRequest = asyncHandler(async (req: Request, res: Response) => {
  const { userId, universityId } = getAuthContext(req)
  sendSuccess(res, await connectionsService.declineRequest(userId, getParam(req, 'connectionId'), universityId))
})

export const removeConnection = asyncHandler(async (req: Request, res: Response) => {
  const { userId, universityId } = getAuthContext(req)
  sendSuccess(res, await connectionsService.removeConnection(userId, getParam(req, 'userId'), universityId))
})

export const listConnections = asyncHandler(async (req: Request, res: Response) => {
  const { userId, universityId } = getAuthContext(req)
  const result = await connectionsService.listConnections(
    userId,
    universityId,
    req.query as unknown as PaginationQuery,
  )
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

export const listPendingReceived = asyncHandler(async (req: Request, res: Response) => {
  const { userId, universityId } = getAuthContext(req)
  const result = await connectionsService.listPendingReceived(
    userId,
    universityId,
    req.query as unknown as PaginationQuery,
  )
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

export const listPendingSent = asyncHandler(async (req: Request, res: Response) => {
  const { userId, universityId } = getAuthContext(req)
  const result = await connectionsService.listPendingSent(
    userId,
    universityId,
    req.query as unknown as PaginationQuery,
  )
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

export const getMutualConnections = asyncHandler(async (req: Request, res: Response) => {
  const { userId, universityId } = getAuthContext(req)
  const result = await connectionsService.getMutualConnections(
    userId,
    getParam(req, 'userId'),
    universityId,
    req.query as unknown as PaginationQuery,
  )
  sendSuccess(res, result)
})

function getAuthContext(req: Request) {
  if (!req.user) throw unauthorized()
  return req.user
}

function getParam(req: Request, name: string): string {
  const value = req.params[name]
  return Array.isArray(value) ? value[0] : value
}
