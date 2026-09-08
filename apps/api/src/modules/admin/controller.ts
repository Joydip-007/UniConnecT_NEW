import type { Request, Response } from 'express'
import type { ResolveAccountDeletionRequestInput } from '@uniconnect/shared'
import { asyncHandler } from '../../utils/asyncHandler'
import { sendPaginated, sendSuccess } from '../../utils/response'
import { AppError } from '../../utils/errors'
import { adminService } from './service'
import { adminContentService } from './content.service'
import { adminShuttleService } from './shuttle.service'
import type {
  AdminFulfillRedemptionInput,
  AdminRedemptionListQuery,
  ContentKind,
  ContentListQuery,
  CreateBulkInvitationsInput,
  CreateDriverInput,
  CreateInvitationInput,
  ListUsersQuery,
  PaginationQuery,
  ResolveReportGroupInput,
  ResolveReportInput,
  ShuttleOpsSettingsInput,
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

export const getShuttleStats = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getAdminContext(req)
  sendSuccess(res, await adminShuttleService.getStats(universityId))
})

export const getShuttleSettings = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getAdminContext(req)
  sendSuccess(res, await adminShuttleService.getSettings(universityId))
})

export const updateShuttleSettings = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getAdminContext(req)
  const input = req.body as ShuttleOpsSettingsInput
  sendSuccess(res, await adminShuttleService.updateSettings(universityId, input))
})

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getAdminContext(req)
  const result = await adminService.listUsers(universityId, req.query as unknown as ListUsersQuery)
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

export const listGroups = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getAdminContext(req)
  const result = await adminService.listGroups(universityId, req.query as unknown as PaginationQuery)
  sendSuccess(res, {
    items: result.items,
    total: result.total,
    page: result.page,
    hasMore: result.page * result.limit < result.total,
    summary: result.summary,
  })
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

export const verifyUser = asyncHandler(async (req: Request, res: Response) => {
  const { universityId, userId: actorId } = getAdminContext(req)
  const userId = req.params.userId as string
  sendSuccess(res, await adminService.verifyUser(universityId, actorId, userId))
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

export const listReportedContentGroups = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getAdminContext(req)
  const result = await adminService.listReportedContentGroups(universityId, req.query as unknown as PaginationQuery)
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

export const resolveReportGroup = asyncHandler(async (req: Request, res: Response) => {
  const { universityId, userId } = getAdminContext(req)
  const targetType = req.params.targetType as string
  const targetId = req.params.targetId as string
  const { action } = req.body as ResolveReportGroupInput
  sendSuccess(res, await adminService.resolveReportGroup(universityId, userId, targetType, targetId, action))
})

export const listDeletionRequests = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getAdminContext(req)
  const result = await adminService.listDeletionRequests(universityId, req.query as unknown as PaginationQuery)
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

export const resolveDeletionRequest = asyncHandler(async (req: Request, res: Response) => {
  const { universityId, userId } = getAdminContext(req)
  const requestId = req.params.requestId as string
  sendSuccess(
    res,
    await adminService.resolveDeletionRequest(
      universityId,
      userId,
      requestId,
      req.body as ResolveAccountDeletionRequestInput,
    ),
  )
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

export const createDriver = asyncHandler(async (req: Request, res: Response) => {
  const { universityId, userId } = getAdminContext(req)
  sendSuccess(res, await adminService.createDriver(universityId, userId, req.body as CreateDriverInput), 201)
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

export const listInviteBatches = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getAdminContext(req)
  sendSuccess(res, await adminService.listInviteBatches(universityId))
})

export const listBatchInvitations = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getAdminContext(req)
  const batchId = req.params.batchId as string
  sendSuccess(res, await adminService.listBatchInvitations(universityId, batchId))
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

export const listMentors = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getAdminContext(req)
  const page = Number(req.query.page ?? 1)
  const limit = Number(req.query.limit ?? 20)
  const result = await adminService.listMentors(universityId, { page, limit })
  sendPaginated(res, result.items, result.total, result.page, limit)
})

export const getMentorRequests = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getAdminContext(req)
  const alumniId = req.params.alumniId as string
  sendSuccess(res, await adminService.getMentorRequests(universityId, alumniId))
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
