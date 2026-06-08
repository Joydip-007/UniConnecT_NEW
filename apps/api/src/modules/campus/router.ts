import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import { resolveUniversity } from '../../middleware/university'
import { validate, validateRequest } from '../../middleware/validate'
import {
  createCourse,
  createLostFound,
  createShuttleLocation,
  createShuttleRoute,
  deleteShuttleRoute,
  enrollCourse,
  getLostFound,
  listCourses,
  listLostFound,
  listMyCourses,
  listShuttleLocations,
  listShuttleRoutes,
  resolveLostFound,
  updateCourse,
  updateLostFound,
  updateShuttleRoute,
} from './controller'
import {
  CourseListQuerySchema,
  CourseSchema,
  CreateLostFoundSchema,
  EnrollCourseSchema,
  LostFoundListQuerySchema,
  ShuttleLocationSchema,
  ShuttleRouteSchema,
  UpdateLostFoundSchema,
} from './schema'

export const campusRouter = Router()

campusRouter.use(requireAuth, resolveUniversity)

campusRouter.get('/lost-found', validateRequest({ query: LostFoundListQuerySchema }), listLostFound)
campusRouter.post('/lost-found', validate(CreateLostFoundSchema), createLostFound)
campusRouter.get('/lost-found/:itemId', getLostFound)
campusRouter.patch('/lost-found/:itemId', requireRole('student', 'alumni', 'faculty', 'admin'), validate(UpdateLostFoundSchema), updateLostFound)
campusRouter.patch('/lost-found/:itemId/resolve', requireRole('student', 'alumni', 'faculty', 'admin'), resolveLostFound)

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
