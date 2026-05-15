import type { Request, Response } from 'express'
import { asyncHandler } from '../../utils/asyncHandler'
import { sendPaginated, sendSuccess } from '../../utils/response'
import { unauthorized } from '../../utils/errors'
import { campusService } from './service'
import type {
  CourseInput,
  CourseListQuery,
  CreateLostFoundInput,
  EnrollCourseInput,
  LostFoundListQuery,
  ShuttleLocationInput,
  ShuttleRouteInput,
  UpdateLostFoundInput,
} from './schema'

export const listLostFound = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const result = await campusService.listLostFound(context.universityId, req.query as unknown as LostFoundListQuery)
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

export const createLostFound = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await campusService.createLostFound(context, req.body as CreateLostFoundInput), 201)
})

export const getLostFound = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await campusService.getLostFound(context.universityId, getItemIdParam(req)))
})

export const updateLostFound = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await campusService.updateLostFound(context, getItemIdParam(req), req.body as UpdateLostFoundInput))
})

export const resolveLostFound = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await campusService.resolveLostFound(context, getItemIdParam(req)))
})

export const listShuttleRoutes = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await campusService.listShuttleRoutes(context.universityId))
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
