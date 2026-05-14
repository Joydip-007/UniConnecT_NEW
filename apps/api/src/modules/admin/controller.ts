import type { Request, Response } from 'express'
import { asyncHandler } from '../../utils/asyncHandler'
import { sendPaginated, sendSuccess } from '../../utils/response'
import { AppError } from '../../utils/errors'
import { adminService } from './service'
import type {
  CreateInvitationInput,
  PaginationQuery,
  ResolveReportInput,
  UpdateAllowedDomainsInput,
  UpdateUserRoleInput,
  UpdateUserStatusInput,
} from './schema'

export const getStats = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getAdminContext(req)
  sendSuccess(res, await adminService.getStats(universityId))
})

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getAdminContext(req)
  const result = await adminService.listUsers(universityId, req.query as unknown as PaginationQuery)
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

export const updateUserRole = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getAdminContext(req)
  const userId = req.params.userId as string
  sendSuccess(res, await adminService.updateUserRole(universityId, userId, req.body as UpdateUserRoleInput))
})

export const updateUserStatus = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getAdminContext(req)
  const userId = req.params.userId as string
  sendSuccess(res, await adminService.updateUserStatus(universityId, userId, req.body as UpdateUserStatusInput))
})

export const listReports = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getAdminContext(req)
  const result = await adminService.listReports(universityId, req.query as unknown as PaginationQuery)
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

export const resolveReport = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = getAdminContext(req)
  const reportId = req.params.reportId as string
  sendSuccess(res, await adminService.resolveReport(userId, reportId, req.body as ResolveReportInput))
})

export const createInvitation = asyncHandler(async (req: Request, res: Response) => {
  const { universityId, userId } = getAdminContext(req)
  sendSuccess(res, await adminService.createInvitation(universityId, userId, req.body as CreateInvitationInput), 201)
})

export const listInvitations = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getAdminContext(req)
  const result = await adminService.listInvitations(universityId, req.query as unknown as PaginationQuery)
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

export const deleteInvitation = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getAdminContext(req)
  const invitationId = req.params.invitationId as string
  sendSuccess(res, await adminService.deleteInvitation(universityId, invitationId))
})

export const getAllowedDomains = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getAdminContext(req)
  sendSuccess(res, await adminService.getAllowedEmailDomains(universityId))
})

export const updateAllowedDomains = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getAdminContext(req)
  const { allowed_email_domains } = req.body as UpdateAllowedDomainsInput
  sendSuccess(res, await adminService.updateAllowedEmailDomains(universityId, allowed_email_domains))
})

function getAdminContext(req: Request) {
  if (!req.user) throw new AppError('Unauthorized', 401, 'AUTH_REQUIRED')
  if (!req.university) throw new AppError('University not resolved', 500, 'UNIVERSITY_NOT_RESOLVED')
  return { userId: req.user.userId, universityId: req.university.id, role: req.user.role }
}
