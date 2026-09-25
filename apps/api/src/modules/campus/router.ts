import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import { resolveUniversity } from '../../middleware/university'
import { validate, validateRequest } from '../../middleware/validate'
import {
  createCourse,
  createLostFound,
  createShuttleLocation,
  createShuttleRoute,
  deleteLostFound,
  deleteShuttleRoute,
  enrollCourse,
  getLostFound,
  getLostFoundStats,
  listCourses,
  listLostFound,
  listMyCourses,
  listSavedLostFound,
  pinLostFound,
  listShuttleLocations,
  listShuttleRoutes,
  resolveLostFound,
  saveLostFound,
  unsaveLostFound,
  updateCourse,
  updateLostFoundDesk,
  updateLostFound,
  updateShuttleRoute,
} from './controller'
import {
  CourseListQuerySchema,
  CourseSchema,
  CreateLostFoundSchema,
  EnrollCourseSchema,
  LostFoundDeskSchema,
  LostFoundListQuerySchema,
  LostFoundPinSchema,
  LostFoundResolveSchema,
  ShuttleLocationSchema,
  ShuttleRouteSchema,
  UpdateLostFoundSchema,
} from './schema'

export const campusRouter = Router()

campusRouter.use(requireAuth, resolveUniversity)

const LOST_FOUND_MEMBERS = requireRole('student', 'alumni', 'faculty', 'admin')

campusRouter.get('/lost-found', validateRequest({ query: LostFoundListQuerySchema }), listLostFound)
campusRouter.post('/lost-found', LOST_FOUND_MEMBERS, validate(CreateLostFoundSchema), createLostFound)
// Static paths are declared before `/lost-found/:itemId`, or the param route would swallow them.
campusRouter.get('/lost-found/saved', validateRequest({ query: LostFoundListQuerySchema }), listSavedLostFound)
campusRouter.get('/lost-found/stats', getLostFoundStats)
campusRouter.put('/lost-found/desk', requireRole('admin'), validate(LostFoundDeskSchema), updateLostFoundDesk)
campusRouter.get('/lost-found/:itemId', getLostFound)
campusRouter.patch('/lost-found/:itemId', LOST_FOUND_MEMBERS, validate(UpdateLostFoundSchema), updateLostFound)
campusRouter.delete('/lost-found/:itemId', LOST_FOUND_MEMBERS, deleteLostFound)
campusRouter.patch('/lost-found/:itemId/resolve', LOST_FOUND_MEMBERS, validate(LostFoundResolveSchema), resolveLostFound)
campusRouter.patch('/lost-found/:itemId/pin', requireRole('admin'), validate(LostFoundPinSchema), pinLostFound)
campusRouter.post('/lost-found/:itemId/save', LOST_FOUND_MEMBERS, saveLostFound)
campusRouter.delete('/lost-found/:itemId/save', LOST_FOUND_MEMBERS, unsaveLostFound)

campusRouter.get('/shuttle/routes', listShuttleRoutes)
campusRouter.post('/shuttle/routes', requireRole('faculty', 'admin'), validate(ShuttleRouteSchema), createShuttleRoute)
campusRouter.patch('/shuttle/routes/:routeId', requireRole('faculty', 'admin'), validate(ShuttleRouteSchema), updateShuttleRoute)
campusRouter.delete('/shuttle/routes/:routeId', requireRole('faculty', 'admin'), deleteShuttleRoute)
campusRouter.get('/shuttle/locations', listShuttleLocations)
campusRouter.post('/shuttle/locations', requireRole('driver', 'admin'), validate(ShuttleLocationSchema), createShuttleLocation)

campusRouter.get('/courses', validateRequest({ query: CourseListQuerySchema }), listCourses)
campusRouter.post('/courses', requireRole('faculty', 'admin'), validate(CourseSchema), createCourse)
campusRouter.patch('/courses/:courseId', requireRole('faculty', 'admin'), validate(CourseSchema), updateCourse)
campusRouter.post('/courses/:courseId/enroll', validate(EnrollCourseSchema), enrollCourse)
campusRouter.get('/courses/my', listMyCourses)
