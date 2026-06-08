import { Router, type NextFunction, type Request, type Response } from 'express'
import { resolveAccountDeletionRequestSchema } from '@uniconnect/shared'
import { requireAuth, requireRole } from '../../middleware/auth'
import { resolveUniversity } from '../../middleware/university'
import { validate, validateRequest } from '../../middleware/validate'
import { AppError } from '../../utils/errors'
import {
  createBulkInvitations,
  createDriver,
  createInvitation,
  deleteContentItem,
  deleteInvitation,
  deleteUser,
  getAllowedDomains,
  getMentorRequests,
  getStats,
  listAdminRedemptions,
  listContent,
  listDeletionRequests,
  resolveDeletionRequest,
  listInvitations,
  listMentors,
  listReports,
  listUsers,
  resolveReport,
  toggleActive,
  togglePin,
  togglePublish,
  updateAdminRedemption,
  updateAllowedDomains,
  updateUserRole,
  updateUserStatus,
} from './controller'
import {
  AdminFulfillRedemptionSchema,
  AdminRedemptionListSchema,
  ContentKindSchema,
  ContentListQuerySchema,
  CreateBulkInvitationsSchema,
  CreateDriverSchema,
  CreateInvitationSchema,
  PaginationQuerySchema,
  ResolveReportSchema,
  ToggleActiveSchema,
  TogglePinSchema,
  TogglePublishSchema,
  UpdateAllowedDomainsSchema,
  UpdateUserRoleSchema,
  UpdateUserStatusSchema,
} from './schema'

function validateContentKind(req: Request, _res: Response, next: NextFunction) {
  const result = ContentKindSchema.safeParse(req.params.kind)
  if (!result.success) {
    return next(new AppError('Invalid content kind', 404, 'NOT_FOUND'))
  }
  next()
}

export const adminRouter = Router()

adminRouter.use(requireAuth, resolveUniversity, requireRole('faculty', 'admin'))

adminRouter.get('/stats', requireRole('admin'), getStats)

adminRouter.get('/users', validateRequest({ query: PaginationQuerySchema }), listUsers)
adminRouter.patch('/users/:userId/role', requireRole('admin'), validate(UpdateUserRoleSchema), updateUserRole)
adminRouter.patch('/users/:userId/status', requireRole('admin'), validate(UpdateUserStatusSchema), updateUserStatus)
adminRouter.delete('/users/:userId', requireRole('admin'), deleteUser)
adminRouter.post('/users/driver', requireRole('admin'), validate(CreateDriverSchema), createDriver)

adminRouter.get('/reports', validateRequest({ query: PaginationQuerySchema }), listReports)
adminRouter.patch('/reports/:reportId', validate(ResolveReportSchema), resolveReport)

adminRouter.get('/deletion-requests', validateRequest({ query: PaginationQuerySchema }), listDeletionRequests)
adminRouter.patch(
  '/deletion-requests/:requestId',
  requireRole('admin'),
  validate(resolveAccountDeletionRequestSchema),
  resolveDeletionRequest,
)

adminRouter.post('/invitations/bulk', requireRole('admin'), validate(CreateBulkInvitationsSchema), createBulkInvitations)
adminRouter.post('/invitations', validate(CreateInvitationSchema), createInvitation)
adminRouter.get('/invitations', validateRequest({ query: PaginationQuerySchema }), listInvitations)
adminRouter.delete('/invitations/:invitationId', requireRole('admin'), deleteInvitation)

adminRouter.get('/university/domains', requireRole('admin'), getAllowedDomains)
adminRouter.patch('/university/domains', requireRole('admin'), validate(UpdateAllowedDomainsSchema), updateAllowedDomains)

adminRouter.get(
  '/content/:kind',
  validateContentKind,
  validateRequest({ query: ContentListQuerySchema }),
  listContent,
)
adminRouter.delete('/content/:kind/:id', validateContentKind, deleteContentItem)
adminRouter.patch('/content/:kind/:id/pin', validateContentKind, validate(TogglePinSchema), togglePin)
adminRouter.patch('/content/:kind/:id/publish', validateContentKind, validate(TogglePublishSchema), togglePublish)
adminRouter.patch('/content/:kind/:id/active', validateContentKind, validate(ToggleActiveSchema), toggleActive)

adminRouter.get('/mentorship/mentors', validateRequest({ query: PaginationQuerySchema }), listMentors)
adminRouter.get('/mentorship/mentors/:alumniId', getMentorRequests)

adminRouter.get(
  '/mentorship/redemptions',
  requireRole('admin'),
  validateRequest({ query: AdminRedemptionListSchema }),
  listAdminRedemptions,
)
adminRouter.patch(
  '/mentorship/redemptions/:redemptionId',
  requireRole('admin'),
  validate(AdminFulfillRedemptionSchema),
  updateAdminRedemption,
)
