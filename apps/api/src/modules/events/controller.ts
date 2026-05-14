import type { Request, Response } from 'express'
import { asyncHandler } from '../../utils/asyncHandler'
import { sendPaginated, sendSuccess } from '../../utils/response'
import { unauthorized } from '../../utils/errors'
import { eventsService } from './service'
import type {
  AttendeesQuery,
  CreateEventInput,
  EventListQuery,
  PaginationQuery,
  RsvpInput,
  UpdateEventInput,
} from './schema'

export const listEvents = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const result = await eventsService.listEvents(context, req.query as unknown as EventListQuery)
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

export const createEvent = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await eventsService.createEvent(context, req.body as CreateEventInput), 201)
})

export const listMyEvents = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const result = await eventsService.listMyEvents(context, req.query as unknown as PaginationQuery)
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

export const getEvent = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await eventsService.getEvent(context, getEventIdParam(req)))
})

export const updateEvent = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await eventsService.updateEvent(context, getEventIdParam(req), req.body as UpdateEventInput))
})

export const deleteEvent = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await eventsService.deleteEvent(context, getEventIdParam(req)))
})

export const publishEvent = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await eventsService.publishEvent(context, getEventIdParam(req)))
})

export const rsvpEvent = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await eventsService.rsvpEvent(context, getEventIdParam(req), (req.body as RsvpInput).status), 201)
})

export const deleteRsvp = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await eventsService.deleteRsvp(context, getEventIdParam(req)))
})

export const listAttendees = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const result = await eventsService.listAttendees(context, getEventIdParam(req), req.query as unknown as AttendeesQuery)
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

export const getEventIcal = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const calendar = await eventsService.getEventIcal(context, getEventIdParam(req))
  res.type('text/calendar').send(calendar)
})

function getAuthContext(req: Request) {
  if (!req.user) throw unauthorized()

  return {
    userId: req.user.userId,
    universityId: req.university?.id ?? req.user.universityId,
    role: req.user.role,
  }
}

function getEventIdParam(req: Request) {
  const value = req.params.eventId
  return Array.isArray(value) ? value[0] : value
}
