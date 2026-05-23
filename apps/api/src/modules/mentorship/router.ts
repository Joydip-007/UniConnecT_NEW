import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import { resolveUniversity } from '../../middleware/university'
import { validate, validateRequest } from '../../middleware/validate'
import {
  createRequest,
  createSession,
  deleteSession,
  getIncomingRequests,
  getMyRequests,
  getMyRewards,
  listAlumni,
  listGiftCards,
  listSessions,
  redeemGiftCard,
  updateRequest,
  updateSession,
} from './controller'
import {
  AlumniListQuerySchema,
  CreateRequestSchema,
  CreateSessionSchema,
  IncomingRequestsQuerySchema,
  PaginationQuerySchema,
  RedeemGiftCardSchema,
  UpdateRequestSchema,
  UpdateSessionSchema,
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

// Session CRUD — accessible to both student and alumni on the request
mentorshipRouter.get('/requests/:id/sessions', listSessions)

mentorshipRouter.post(
  '/requests/:id/sessions',
  validate(CreateSessionSchema),
  createSession,
)

mentorshipRouter.patch(
  '/requests/:id/sessions/:sid',
  validate(UpdateSessionSchema),
  updateSession,
)

mentorshipRouter.delete('/requests/:id/sessions/:sid', deleteSession)

mentorshipRouter.get('/rewards/me', requireRole('alumni'), getMyRewards)
mentorshipRouter.get('/gift-cards', listGiftCards)
mentorshipRouter.post(
  '/redeem',
  requireRole('alumni'),
  validate(RedeemGiftCardSchema),
  redeemGiftCard,
)
