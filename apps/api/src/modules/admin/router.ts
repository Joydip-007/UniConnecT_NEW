import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import { resolveUniversity } from '../../middleware/university'
import { validate, validateRequest } from '../../middleware/validate'
import {
  createBulkInvitations,
  createInvitation,
  deleteInvitation,
  getAllowedDomains,
  getStats,
  listInvitations,
  listReports,
  listUsers,
  resolveReport,
  updateAllowedDomains,
  updateUserRole,
  updateUserStatus,
} from './controller'
import {
  CreateBulkInvitationsSchema,
  CreateInvitationSchema,
  PaginationQuerySchema,
  ResolveReportSchema,
  UpdateAllowedDomainsSchema,
  UpdateUserRoleSchema,
  UpdateUserStatusSchema,
} from './schema'

export const adminRouter = Router()

adminRouter.use(requireAuth, resolveUniversity, requireRole('staff', 'admin'))

adminRouter.get('/stats', requireRole('admin'), getStats)

adminRouter.get('/users', validateRequest({ query: PaginationQuerySchema }), listUsers)
adminRouter.patch('/users/:userId/role', requireRole('admin'), validate(UpdateUserRoleSchema), updateUserRole)
adminRouter.patch('/users/:userId/status', requireRole('admin'), validate(UpdateUserStatusSchema), updateUserStatus)

adminRouter.get('/reports', validateRequest({ query: PaginationQuerySchema }), listReports)
adminRouter.patch('/reports/:reportId', validate(ResolveReportSchema), resolveReport)

adminRouter.post('/invitations/bulk', requireRole('admin'), validate(CreateBulkInvitationsSchema), createBulkInvitations)
adminRouter.post('/invitations', validate(CreateInvitationSchema), createInvitation)
adminRouter.get('/invitations', validateRequest({ query: PaginationQuerySchema }), listInvitations)
adminRouter.delete('/invitations/:invitationId', requireRole('admin'), deleteInvitation)

adminRouter.get('/university/domains', requireRole('admin'), getAllowedDomains)
adminRouter.patch('/university/domains', requireRole('admin'), validate(UpdateAllowedDomainsSchema), updateAllowedDomains)
