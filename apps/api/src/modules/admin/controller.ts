import type { Request, Response } from 'express'
import { asyncHandler } from '../../utils/asyncHandler'
import { sendPaginated, sendSuccess } from '../../utils/response'
import { AppError } from '../../utils/errors'
import { adminService } from './service'
import { adminContentService } from './content.service'
import type {
  AdminFulfillRedemptionInput,
  AdminRedemptionListQuery,
  ContentKind,
  ContentListQuery,
  CreateBulkInvitationsInput,
  CreateInvitationInput,
  PaginationQuery,
  ResolveReportInput,
  ToggleActiveInput,
  TogglePinInput,
  TogglePublishInput,
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

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const { universityId, userId: adminUserId } = getAdminContext(req)
  const userId = req.params.userId as string
  sendSuccess(res, await adminService.deleteUser(universityId, adminUserId, userId))
})

export const listReports = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getAdminContext(req)
  const result = await adminService.listReports(universityId, req.query as unknown as PaginationQuery)
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

export const resolveReport = asyncHandler(async (req: Request, res: Response) => {
  const { universityId, userId } = getAdminContext(req)
  const reportId = req.params.reportId as string
  sendSuccess(res, await adminService.resolveReport(universityId, userId, reportId, req.body as ResolveReportInput))
})

export const createInvitation = asyncHandler(async (req: Request, res: Response) => {
  const { universityId, userId } = getAdminContext(req)
  sendSuccess(
    res,
    await adminService.createInvitation(
      universityId,
      userId,
      req.body as CreateInvitationInput,
      req.university!.name,
    ),
    201,
  )
})

export const createBulkInvitations = asyncHandler(async (req: Request, res: Response) => {
  const { universityId, userId } = getAdminContext(req)
  sendSuccess(
    res,
    await adminService.createBulkInvitations(
      universityId,
      userId,
      req.body as CreateBulkInvitationsInput,
      req.university!.name,
    ),
    201,
  )
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
  const { universityId, userId } = getAdminContext(req)
  const { allowed_email_domains } = req.body as UpdateAllowedDomainsInput
  sendSuccess(res, await adminService.updateAllowedEmailDomains(universityId, userId, allowed_email_domains))
})

function getAdminContext(req: Request) {
  if (!req.user) throw new AppError('Unauthorized', 401, 'AUTH_REQUIRED')
  if (!req.university) throw new AppError('University not resolved', 500, 'UNIVERSITY_NOT_RESOLVED')
  return { userId: req.user.userId, universityId: req.university.id, role: req.user.role }
}

export const listContent = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getAdminContext(req)
  const kind = req.params.kind as ContentKind
  const query = req.query as unknown as ContentListQuery

  const result =
    kind === 'posts' ? await adminContentService.listPosts(universityId, query) :
    kind === 'events' ? await adminContentService.listEvents(universityId, query) :
    kind === 'jobs' ? await adminContentService.listJobs(universityId, query) :
    await adminContentService.listNews(universityId, query)

  sendPaginated(res, result.items as unknown[], result.total, result.page, result.limit)
})

export const deleteContentItem = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getAdminContext(req)
  const kind = req.params.kind as ContentKind
  const id = req.params.id as string
  sendSuccess(res, await adminContentService.deleteItem(kind, universityId, id))
})

export const togglePin = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getAdminContext(req)
  const kind = req.params.kind as ContentKind
  const id = req.params.id as string
  const { is_pinned } = req.body as TogglePinInput
  sendSuccess(res, await adminContentService.togglePin(kind, universityId, id, is_pinned))
})

export const togglePublish = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getAdminContext(req)
  const kind = req.params.kind as ContentKind
  const id = req.params.id as string
  const { is_published } = req.body as TogglePublishInput
  sendSuccess(res, await adminContentService.togglePublish(kind, universityId, id, is_published))
})

export const toggleActive = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getAdminContext(req)
  const kind = req.params.kind as ContentKind
  const id = req.params.id as string
  const { is_active } = req.body as ToggleActiveInput
  sendSuccess(res, await adminContentService.toggleActive(kind, universityId, id, is_active))
})

export const listAdminRedemptions = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getAdminContext(req)
  const result = await adminService.listRedemptions(
    universityId,
    req.query as unknown as AdminRedemptionListQuery,
  )
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

export const updateAdminRedemption = asyncHandler(async (req: Request, res: Response) => {
  const { universityId, userId } = getAdminContext(req)
  const redemptionId = req.params.redemptionId as string
  sendSuccess(
    res,
    await adminService.updateRedemption(
      universityId,
      userId,
      redemptionId,
      req.body as AdminFulfillRedemptionInput,
    ),
  )
})
