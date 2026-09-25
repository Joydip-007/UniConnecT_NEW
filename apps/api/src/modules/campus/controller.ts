import type { Request, Response } from 'express'
import { asyncHandler } from '../../utils/asyncHandler'
import { sendPaginated, sendSuccess } from '../../utils/response'
import { unauthorized } from '../../utils/errors'
import { campusService } from './service'
import { shuttleService } from './shuttle.service'
import type {
  CourseInput,
  CourseListQuery,
  CreateLostFoundInput,
  EnrollCourseInput,
  LostFoundDeskInput,
  LostFoundListQuery,
  LostFoundPinInput,
  LostFoundResolveInput,
  ShuttleDutyQuery,
  ShuttleLocationInput,
  ShuttleNoticeInput,
  ShuttleRiderPrefsInput,
  ShuttleRidersInput,
  ShuttleRouteInput,
  ShuttleShiftStartInput,
  UpdateLostFoundInput,
} from './schema'

export const listLostFound = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const result = await campusService.listLostFound(context, req.query as unknown as LostFoundListQuery)
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

export const createLostFound = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await campusService.createLostFound(context, req.body as CreateLostFoundInput), 201)
})

export const getLostFound = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await campusService.getLostFound(context, getItemIdParam(req)))
})

export const updateLostFound = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await campusService.updateLostFound(context, getItemIdParam(req), req.body as UpdateLostFoundInput))
})

export const resolveLostFound = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const { is_resolved } = req.body as LostFoundResolveInput
  sendSuccess(res, await campusService.resolveLostFound(context, getItemIdParam(req), is_resolved))
})

export const listSavedLostFound = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const { page, limit } = req.query as unknown as LostFoundListQuery
  const result = await campusService.listSavedLostFound(context, { page, limit })
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

export const pinLostFound = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const { is_pinned } = req.body as LostFoundPinInput
  sendSuccess(res, await campusService.pinLostFound(context, getItemIdParam(req), is_pinned))
})

export const deleteLostFound = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await campusService.deleteLostFound(context, getItemIdParam(req)))
})

export const saveLostFound = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await campusService.setLostFoundSaved(context, getItemIdParam(req), true))
})

export const unsaveLostFound = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await campusService.setLostFoundSaved(context, getItemIdParam(req), false))
})

export const getLostFoundStats = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await campusService.getLostFoundStats(context.universityId))
})

export const updateLostFoundDesk = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await campusService.updateLostFoundDesk(context.universityId, (req.body as LostFoundDeskInput).desk))
})

export const listShuttleRoutes = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const includeInactive =
    req.query.includeInactive === 'true' && (context.role === 'faculty' || context.role === 'admin')
  sendSuccess(res, await campusService.listShuttleRoutes(context.universityId, includeInactive))
})

export const deleteShuttleRoute = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  await campusService.deleteShuttleRoute(context.universityId, getRouteIdParam(req))
  res.status(204).end()
})

export const createShuttleRoute = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await campusService.createShuttleRoute(context.universityId, req.body as ShuttleRouteInput), 201)
})

export const updateShuttleRoute = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await campusService.updateShuttleRoute(context.universityId, getRouteIdParam(req), req.body as ShuttleRouteInput))
})

export const listShuttleLocations = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await campusService.listShuttleLocations(context.universityId))
})

export const createShuttleLocation = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await campusService.createShuttleLocation(context, req.body as ShuttleLocationInput), 201)
})

export const startShuttleShift = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await shuttleService.startShift(context, (req.body as ShuttleShiftStartInput).route_id), 201)
})

export const stopShuttleShift = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await shuttleService.stopShift(getAuthContext(req)))
})

export const adjustShuttleRiders = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await shuttleService.adjustRiders(getAuthContext(req), (req.body as ShuttleRidersInput).delta))
})

export const getShuttleDuty = asyncHandler(async (req: Request, res: Response) => {
  const { since } = req.query as unknown as ShuttleDutyQuery
  sendSuccess(res, await shuttleService.getDuty(getAuthContext(req), since))
})

export const getShuttleRiderPrefs = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await shuttleService.getRiderPrefs(getAuthContext(req)))
})

export const putShuttleRiderPrefs = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await shuttleService.putRiderPrefs(getAuthContext(req), req.body as ShuttleRiderPrefsInput))
})

export const listShuttleNotices = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await shuttleService.listNotices(getAuthContext(req).universityId))
})

export const createShuttleNotice = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await shuttleService.createNotice(getAuthContext(req), req.body as ShuttleNoticeInput), 201)
})

export const deleteShuttleNotice = asyncHandler(async (req: Request, res: Response) => {
  const value = req.params.noticeId
  await shuttleService.deleteNotice(getAuthContext(req), Array.isArray(value) ? value[0] : value)
  res.status(204).end()
})

export const listCourses = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const result = await campusService.listCourses(context.universityId, req.query as unknown as CourseListQuery)
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

export const createCourse = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await campusService.createCourse(context.universityId, req.body as CourseInput), 201)
})

export const updateCourse = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await campusService.updateCourse(context.universityId, getCourseIdParam(req), req.body as CourseInput))
})

export const enrollCourse = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await campusService.enrollCourse(context, getCourseIdParam(req), req.body as EnrollCourseInput), 201)
})

export const listMyCourses = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await campusService.listMyCourses(context))
})

function getAuthContext(req: Request) {
  if (!req.user) throw unauthorized()

  return {
    userId: req.user.userId,
    universityId: req.university?.id ?? req.user.universityId,
    role: req.user.role,
  }
}

function getItemIdParam(req: Request) {
  const value = req.params.itemId
  return Array.isArray(value) ? value[0] : value
}

function getRouteIdParam(req: Request) {
  const value = req.params.routeId
  return Array.isArray(value) ? value[0] : value
}

function getCourseIdParam(req: Request) {
  const value = req.params.courseId
  return Array.isArray(value) ? value[0] : value
}
