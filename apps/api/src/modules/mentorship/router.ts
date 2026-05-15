import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import { resolveUniversity } from '../../middleware/university'
import { validate, validateRequest } from '../../middleware/validate'
import {
  createRequest,
  getIncomingRequests,
  getMyRequests,
  listAlumni,
  updateRequest,
} from './controller'
import {
  AlumniListQuerySchema,
  CreateRequestSchema,
  IncomingRequestsQuerySchema,
  PaginationQuerySchema,
  UpdateRequestSchema,
} from './schema'

export const mentorshipRouter = Router()

mentorshipRouter.use(requireAuth, resolveUniversity)

mentorshipRouter.get('/alumni', validateRequest({ query: AlumniListQuerySchema }), listAlumni)

mentorshipRouter.post(
  '/requests',
  requireRole('student'),
  validate(CreateRequestSchema),
  createRequest,
)

mentorshipRouter.get(
  '/requests/mine',
  requireRole('student'),
  validateRequest({ query: PaginationQuerySchema }),
  getMyRequests,
)

mentorshipRouter.get(
  '/requests/incoming',
  requireRole('alumni', 'admin'),
  validateRequest({ query: IncomingRequestsQuerySchema }),
  getIncomingRequests,
)

mentorshipRouter.patch(
  '/requests/:id',
  requireRole('alumni', 'admin'),
  validate(UpdateRequestSchema),
  updateRequest,
)
