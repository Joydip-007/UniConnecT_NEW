import { Router, type NextFunction, type Request, type Response } from 'express'
import {
  problemReportListQuerySchema,
  resolveAccountDeletionRequestSchema,
  resolveProblemReportSchema,
} from '@uniconnect/shared'
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
  getContentSummary,
  listAdminFeed,
  togglePostComments,
  togglePostRemoved,
  deleteUser,
  getAllowedDomains,
  getMentorRequests,
  getStats,
  getShuttleStats,
  getShuttleSettings,
  updateShuttleSettings,
  listAdminRedemptions,
  listContent,
  listDeletionRequests,
  listProblemReports,
  setProblemReportStatus,
  resolveDeletionRequest,
  listGroups,
  listInvitations,
  listInviteBatches,
  listBatchInvitations,
  listMentors,
  listReportedContentGroups,
  listReports,
  listUsers,
  resolveReport,
  resolveReportGroup,
  getReportedTarget,
  toggleActive,
  togglePin,
  togglePublish,
  updateAdminRedemption,
  updateAllowedDomains,
  updateUserRole,
  updateUserStatus,
  verifyUser,
} from './controller'
import {
  AdminFeedListQuerySchema,
  AdminFulfillRedemptionSchema,
  AdminRedemptionListSchema,
  ToggleCommentsSchema,
  ToggleRemovedSchema,
  ContentKindSchema,
  ContentListQuerySchema,
  CreateBulkInvitationsSchema,
  CreateDriverSchema,
  CreateInvitationSchema,
  ListUsersQuerySchema,
  PaginationQuerySchema,
  ResolveReportGroupSchema,
  ResolveReportSchema,
  ShuttleOpsSettingsSchema,
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

adminRouter.get('/shuttle/stats', requireRole('admin'), getShuttleStats)
adminRouter.get('/shuttle/settings', requireRole('admin'), getShuttleSettings)
adminRouter.patch('/shuttle/settings', requireRole('admin'), validate(ShuttleOpsSettingsSchema), updateShuttleSettings)

adminRouter.get('/users', validateRequest({ query: ListUsersQuerySchema }), listUsers)
adminRouter.get('/groups', validateRequest({ query: PaginationQuerySchema }), listGroups)
adminRouter.patch('/users/:userId/role', requireRole('admin'), validate(UpdateUserRoleSchema), updateUserRole)
adminRouter.patch('/users/:userId/status', requireRole('admin'), validate(UpdateUserStatusSchema), updateUserStatus)
adminRouter.patch('/users/:userId/verify', requireRole('admin'), verifyUser)
adminRouter.delete('/users/:userId', requireRole('admin'), deleteUser)
adminRouter.post('/users/driver', requireRole('admin'), validate(CreateDriverSchema), createDriver)

adminRouter.get('/reports', validateRequest({ query: PaginationQuerySchema }), listReports)
adminRouter.get('/reports/grouped', validateRequest({ query: PaginationQuerySchema }), listReportedContentGroups)
adminRouter.get('/reports/target/:targetType/:targetId', getReportedTarget)
adminRouter.patch(
  '/reports/target/:targetType/:targetId',
  validate(ResolveReportGroupSchema),
  resolveReportGroup,
)
adminRouter.patch('/reports/:reportId', validate(ResolveReportSchema), resolveReport)

adminRouter.get('/deletion-requests', validateRequest({ query: PaginationQuerySchema }), listDeletionRequests)
adminRouter.patch(
  '/deletion-requests/:requestId',
  requireRole('admin'),
  validate(resolveAccountDeletionRequestSchema),
  resolveDeletionRequest,
)

adminRouter.get(
  '/problem-reports',
  requireRole('admin'),
  validateRequest({ query: problemReportListQuerySchema }),
  listProblemReports,
)
adminRouter.patch(
  '/problem-reports/:reportId',
  requireRole('admin'),
  validate(resolveProblemReportSchema),
  setProblemReportStatus,
)
adminRouter.post('/invitations/bulk', requireRole('admin'), validate(CreateBulkInvitationsSchema), createBulkInvitations)
adminRouter.post('/invitations', validate(CreateInvitationSchema), createInvitation)
adminRouter.get('/invitations', validateRequest({ query: PaginationQuerySchema }), listInvitations)
adminRouter.get('/invitations/batches', requireRole('admin'), listInviteBatches)
// Declared after '/invitations/batches' so the literal segment still wins, and before
// the DELETE param route for the same reason.
adminRouter.get('/invitations/batches/:batchId', requireRole('admin'), listBatchInvitations)
adminRouter.delete('/invitations/:invitationId', requireRole('admin'), deleteInvitation)

adminRouter.get('/university/domains', requireRole('admin'), getAllowedDomains)
adminRouter.patch('/university/domains', requireRole('admin'), validate(UpdateAllowedDomainsSchema), updateAllowedDomains)

// Literal segments before '/content/:kind' so the param route cannot swallow them.
adminRouter.get('/content/summary', getContentSummary)
adminRouter.get('/content/feed', validateRequest({ query: AdminFeedListQuerySchema }), listAdminFeed)
adminRouter.patch('/content/posts/:id/comments', validate(ToggleCommentsSchema), togglePostComments)
adminRouter.patch('/content/posts/:id/removed', validate(ToggleRemovedSchema), togglePostRemoved)

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
