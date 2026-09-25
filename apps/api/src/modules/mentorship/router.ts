import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import { resolveUniversity } from '../../middleware/university'
import { validate, validateRequest } from '../../middleware/validate'
import {
  createRequest,
  createSession,
  createSessionRequest,
  deleteSession,
  endMentorship,
  getMentorSettings,
  joinWaitlist,
  leaveWaitlist,
  listMySessions,
  reopenMentorship,
  updateMentorSettings,
  withdrawSessionRequest,
  getIncomingRequests,
  getMyRequests,
  getMyRewards,
  getRequestFeedback,
  listAlumni,
  listGiftCards,
  listSessions,
  redeemGiftCard,
  submitFeedback,
  updateRequest,
  updateSession,
  withdrawRequest,
} from './controller'
import {
  AlumniListQuerySchema,
  CreateRequestSchema,
  CreateSessionRequestSchema,
  CreateSessionSchema,
  EndMentorshipSchema,
  IncomingRequestsQuerySchema,
  PaginationQuerySchema,
  RedeemGiftCardSchema,
  SubmitFeedbackSchema,
  UpdateMentorSettingsSchema,
  UpdateRequestSchema,
  UpdateSessionSchema,
} from './schema'

export const mentorshipRouter = Router()

mentorshipRouter.use(requireAuth, resolveUniversity)

mentorshipRouter.get('/alumni', validateRequest({ query: AlumniListQuerySchema }), listAlumni)

// "Notify me" when a full mentor opens a place
mentorshipRouter.post('/alumni/:alumniId/waitlist', requireRole('student'), joinWaitlist)
mentorshipRouter.delete('/alumni/:alumniId/waitlist', requireRole('student'), leaveWaitlist)

// The alumnus's own mentor settings: accepting, capacity, topics, weekly availability
mentorshipRouter.get('/settings', requireRole('alumni'), getMentorSettings)
mentorshipRouter.patch('/settings', requireRole('alumni'), validate(UpdateMentorSettingsSchema), updateMentorSettings)

// Every session the alumnus has logged, across mentees
mentorshipRouter.get('/sessions/mine', requireRole('alumni'), listMySessions)

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

mentorshipRouter.delete(
  '/requests/:id',
  requireRole('student'),
  withdrawRequest,
)

// Either participant ends an accepted mentorship; the one who ended it can undo shortly after
mentorshipRouter.post('/requests/:id/end', validate(EndMentorshipSchema), endMentorship)
mentorshipRouter.post('/requests/:id/reopen', reopenMentorship)

// Proposed (student) or scheduled (alumni) session times
mentorshipRouter.post(
  '/requests/:id/session-requests',
  validate(CreateSessionRequestSchema),
  createSessionRequest,
)
mentorshipRouter.delete('/requests/:id/session-requests/:srid', withdrawSessionRequest)

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

mentorshipRouter.get('/requests/:id/feedback', getRequestFeedback)
mentorshipRouter.post('/requests/:id/feedback', validate(SubmitFeedbackSchema), submitFeedback)

mentorshipRouter.get('/rewards/me', requireRole('alumni'), getMyRewards)
mentorshipRouter.get('/gift-cards', listGiftCards)
mentorshipRouter.post(
  '/redeem',
  requireRole('alumni'),
  validate(RedeemGiftCardSchema),
  redeemGiftCard,
)
