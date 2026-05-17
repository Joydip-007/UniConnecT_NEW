import type { Request, Response } from 'express'
import { asyncHandler } from '../../utils/asyncHandler'
import { sendPaginated, sendSuccess } from '../../utils/response'
import { unauthorized } from '../../utils/errors'
import { groupsService } from './service'
import type {
  CreateGroupInput,
  GroupListQuery,
  InviteToGroupInput,
  MembersQuery,
  PaginationQuery,
  UpdateGroupInput,
  UpdateMemberInput,
} from './schema'

export const listGroups = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const result = await groupsService.listGroups(context, req.query as unknown as GroupListQuery)
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

export const createGroup = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await groupsService.createGroup(context, req.body as CreateGroupInput), 201)
})

export const listMyGroups = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const result = await groupsService.listMyGroups(context, req.query as unknown as PaginationQuery)
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

export const getGroup = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await groupsService.getGroup(context, getGroupIdParam(req)))
})

export const updateGroup = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await groupsService.updateGroup(context, getGroupIdParam(req), req.body as UpdateGroupInput))
})

export const deleteGroup = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await groupsService.deleteGroup(context, getGroupIdParam(req)))
})

export const joinGroup = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await groupsService.joinGroup(context, getGroupIdParam(req)), 201)
})

export const leaveGroup = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await groupsService.leaveGroup(context, getGroupIdParam(req)))
})

export const listGroupMembers = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const result = await groupsService.listMembers(
    context,
    getGroupIdParam(req),
    req.query as unknown as MembersQuery,
  )
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

export const updateMember = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(
    res,
    await groupsService.updateMember(
      context,
      getGroupIdParam(req),
      getUserIdParam(req),
      (req.body as UpdateMemberInput).role,
    ),
  )
})

export const removeMember = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await groupsService.removeMember(context, getGroupIdParam(req), getUserIdParam(req)))
})

export const listGroupPosts = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const result = await groupsService.listGroupPosts(
    context,
    getGroupIdParam(req),
    req.query as unknown as PaginationQuery,
  )
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

export const listGroupEvents = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const result = await groupsService.listGroupEvents(
    context,
    getGroupIdParam(req),
    req.query as unknown as PaginationQuery,
  )
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

export const listGroupCollaborations = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const result = await groupsService.listGroupCollaborations(
    context,
    getGroupIdParam(req),
    req.query as unknown as PaginationQuery,
  )
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

export const inviteToGroup = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const result = await groupsService.inviteToGroup(
    context,
    getGroupIdParam(req),
    (req.body as InviteToGroupInput).userId,
  )
  sendSuccess(res, result, 201)
})

function getAuthContext(req: Request) {
  if (!req.user) throw unauthorized()

  return {
    userId: req.user.userId,
    universityId: req.university?.id ?? req.user.universityId,
    role: req.user.role,
  }
}

function getGroupIdParam(req: Request) {
  const value = req.params.groupId
  return Array.isArray(value) ? value[0] : value
}

function getUserIdParam(req: Request) {
  const value = req.params.userId
  return Array.isArray(value) ? value[0] : value
}
