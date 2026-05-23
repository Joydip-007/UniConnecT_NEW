import type { Request, Response } from 'express'
import { asyncHandler } from '../../utils/asyncHandler'
import { sendSuccess } from '../../utils/response'
import { unauthorized, AppError } from '../../utils/errors'
import { mentorshipService } from './service'
import type {
  AlumniListQuery,
  CreateRequestInput,
  CreateSessionInput,
  IncomingRequestsQuery,
  PaginationQuery,
  RedeemGiftCardInput,
  UpdateRequestInput,
  UpdateSessionInput,
} from './schema'

function getAuthContext(req: Request) {
  if (!req.user) throw unauthorized()
  if (!req.university) throw new AppError('University not resolved', 500, 'UNIVERSITY_NOT_RESOLVED')
  return {
    userId: req.user.userId,
    universityId: req.university.id,
    role: req.user.role,
  }
}

function sendPage<T>(res: Response, result: { items: T[]; total: number; page: number; hasMore: boolean }) {
  return res.json({ data: result })
}

export const listAlumni = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getAuthContext(req)
  const query = req.query as unknown as AlumniListQuery
  sendPage(res, await mentorshipService.listAlumni(universityId, query))
})

export const createRequest = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await mentorshipService.createRequest(context, req.body as CreateRequestInput), 201)
})

export const getMyRequests = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const query = req.query as unknown as PaginationQuery
  sendPage(res, await mentorshipService.getMyRequests(context.universityId, context.userId, query))
})

export const getIncomingRequests = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const query = req.query as unknown as IncomingRequestsQuery
  sendPage(res, await mentorshipService.getIncomingRequests(context.universityId, context.userId, query))
})

export const updateRequest = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const requestId = req.params.id as string
  sendSuccess(res, await mentorshipService.updateRequest(context, requestId, req.body as UpdateRequestInput))
})

export const getMyRewards = asyncHandler(async (req: Request, res: Response) => {
  const { userId, universityId } = getAuthContext(req)
  sendSuccess(res, await mentorshipService.getMyRewards(universityId, userId))
})

export const listGiftCards = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await mentorshipService.listGiftCards())
})

export const redeemGiftCard = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await mentorshipService.redeem(context, req.body as RedeemGiftCardInput), 201)
})

// ── SESSION CRUD ──────────────────────────────────────────────────────────────

export const listSessions = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const requestId = req.params.id as string
  sendSuccess(res, await mentorshipService.listSessions(context, requestId))
})

export const createSession = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const requestId = req.params.id as string
  sendSuccess(res, await mentorshipService.createSession(context, requestId, req.body as CreateSessionInput), 201)
})

export const updateSession = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const requestId = req.params.id as string
  const sessionId = req.params.sid as string
  sendSuccess(res, await mentorshipService.updateSession(context, requestId, sessionId, req.body as UpdateSessionInput))
})

export const deleteSession = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const requestId = req.params.id as string
  const sessionId = req.params.sid as string
  await mentorshipService.deleteSession(context, requestId, sessionId)
  res.status(204).end()
})
