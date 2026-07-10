import type { Request, Response } from 'express'
import { asyncHandler } from '../../utils/asyncHandler'
import { sendPaginated, sendSuccess } from '../../utils/response'
import { unauthorized } from '../../utils/errors'
import { groupsService } from './service'
import type {
  CreateFlashcardDeckInput,
  CreateFlashcardInput,
  CreateGroupInput,
  CreateSharedNoteInput,
  GroupListQuery,
  FlashcardReviewInput,
  InviteToGroupInput,
  JoinRequestActionInput,
  MembersQuery,
  PaginationQuery,
  UpdateFlashcardDeckInput,
  UpdateFlashcardInput,
  UpdateGroupAISettingsInput,
  UpdateGroupInput,
  UpdateMemberInput,
  UpdateSharedNoteInput,
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

export const joinOrRequestGroup = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const result = await groupsService.joinOrRequest(context, getGroupIdParam(req), req.body?.message)
  if (result.kind === 'requested') {
    sendSuccess(res, { requested: true, requestId: result.requestId }, 202)
  } else {
    sendSuccess(res, result.group, 201)
  }
})

export const listJoinRequests = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const result = await groupsService.listJoinRequests(
    context,
    getGroupIdParam(req),
    req.query as unknown as PaginationQuery,
  )
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

export const reviewJoinRequest = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(
    res,
    await groupsService.reviewJoinRequest(
      context,
      getGroupIdParam(req),
      Array.isArray(req.params.requestId) ? req.params.requestId[0] : req.params.requestId,
      (req.body as JoinRequestActionInput).action,
    ),
  )
})

export const cancelJoinRequest = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await groupsService.cancelJoinRequest(context, getGroupIdParam(req)))
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

export const listResources = asyncHandler(async (req, res) => {
  const context = getAuthContext(req)
  const result = await groupsService.listResources(
    context,
    getGroupIdParam(req),
    req.query as unknown as import('./schema').ResourceListQuery,
  )
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

export const createResource = asyncHandler(async (req, res) => {
  const context = getAuthContext(req)
  sendSuccess(res, await groupsService.createResource(context, getGroupIdParam(req), req.body as import('./schema').CreateResourceInput), 201)
})

export const deleteResource = asyncHandler(async (req, res) => {
  const context = getAuthContext(req)
  sendSuccess(res, await groupsService.deleteResource(context, getGroupIdParam(req), getResourceIdParam(req)))
})

export const trackResource = asyncHandler(async (req, res) => {
  const context = getAuthContext(req)
  sendSuccess(res, await groupsService.trackResource(context, getGroupIdParam(req), getResourceIdParam(req)))
})

export const setPinned = asyncHandler(async (req, res) => {
  const context = getAuthContext(req)
  sendSuccess(
    res,
    await groupsService.setPinned(context, getGroupIdParam(req), (req.body as import('./schema').SetPinnedInput).text),
  )
})

export const setRules = asyncHandler(async (req, res) => {
  const context = getAuthContext(req)
  sendSuccess(
    res,
    await groupsService.setRules(context, getGroupIdParam(req), (req.body as import('./schema').SetRulesInput).content),
  )
})

export const getGroupStats = asyncHandler(async (req, res) => {
  const context = getAuthContext(req)
  sendSuccess(res, await groupsService.getGroupStats(context, getGroupIdParam(req)))
})

export const listStudySessions = asyncHandler(async (req, res) => {
  const context = getAuthContext(req)
  const result = await groupsService.listStudySessions(
    context,
    getGroupIdParam(req),
    req.query as unknown as import('./schema').PaginationQuery,
  )
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

export const createStudySession = asyncHandler(async (req, res) => {
  const context = getAuthContext(req)
  sendSuccess(
    res,
    await groupsService.createStudySession(context, getGroupIdParam(req), req.body as import('./schema').CreateStudySessionInput),
    201,
  )
})

export const deleteStudySession = asyncHandler(async (req, res) => {
  const context = getAuthContext(req)
  sendSuccess(res, await groupsService.deleteStudySession(context, getGroupIdParam(req), getSessionIdParam(req)))
})

export const rsvpStudySession = asyncHandler(async (req, res) => {
  const context = getAuthContext(req)
  sendSuccess(
    res,
    await groupsService.rsvpStudySession(
      context,
      getGroupIdParam(req),
      getSessionIdParam(req),
      (req.body as import('./schema').RsvpStudySessionInput).status,
    ),
  )
})

export const listFlashcardDecks = asyncHandler(async (req, res) => {
  const context = getAuthContext(req)
  sendSuccess(res, await groupsService.listFlashcardDecks(context, getGroupIdParam(req)))
})

export const createFlashcardDeck = asyncHandler(async (req, res) => {
  const context = getAuthContext(req)
  sendSuccess(
    res,
    await groupsService.createFlashcardDeck(context, getGroupIdParam(req), req.body as CreateFlashcardDeckInput),
    201,
  )
})

export const updateFlashcardDeck = asyncHandler(async (req, res) => {
  const context = getAuthContext(req)
  sendSuccess(
    res,
    await groupsService.updateFlashcardDeck(
      context,
      getGroupIdParam(req),
      getDeckIdParam(req),
      req.body as UpdateFlashcardDeckInput,
    ),
  )
})

export const deleteFlashcardDeck = asyncHandler(async (req, res) => {
  const context = getAuthContext(req)
  sendSuccess(res, await groupsService.deleteFlashcardDeck(context, getGroupIdParam(req), getDeckIdParam(req)))
})

export const listFlashcards = asyncHandler(async (req, res) => {
  const context = getAuthContext(req)
  sendSuccess(res, await groupsService.listFlashcards(context, getGroupIdParam(req), getDeckIdParam(req)))
})

export const createFlashcard = asyncHandler(async (req, res) => {
  const context = getAuthContext(req)
  sendSuccess(
    res,
    await groupsService.createFlashcard(
      context,
      getGroupIdParam(req),
      getDeckIdParam(req),
      req.body as CreateFlashcardInput,
    ),
    201,
  )
})

export const updateFlashcard = asyncHandler(async (req, res) => {
  const context = getAuthContext(req)
  sendSuccess(
    res,
    await groupsService.updateFlashcard(
      context,
      getGroupIdParam(req),
      getCardIdParam(req),
      req.body as UpdateFlashcardInput,
    ),
  )
})

export const deleteFlashcard = asyncHandler(async (req, res) => {
  const context = getAuthContext(req)
  sendSuccess(res, await groupsService.deleteFlashcard(context, getGroupIdParam(req), getCardIdParam(req)))
})

export const getFlashcardReviewQueue = asyncHandler(async (req, res) => {
  const context = getAuthContext(req)
  sendSuccess(
    res,
    await groupsService.getFlashcardReviewQueue(
      context,
      getGroupIdParam(req),
      getDeckIdParam(req),
      req.query as unknown as PaginationQuery,
    ),
  )
})

export const reviewFlashcard = asyncHandler(async (req, res) => {
  const context = getAuthContext(req)
  sendSuccess(
    res,
    await groupsService.reviewFlashcard(
      context,
      getGroupIdParam(req),
      getCardIdParam(req),
      req.body as FlashcardReviewInput,
    ),
  )
})

export const listSharedNotes = asyncHandler(async (req, res) => {
  const context = getAuthContext(req)
  const result = await groupsService.listSharedNotes(
    context,
    getGroupIdParam(req),
    req.query as unknown as PaginationQuery,
  )
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

export const createSharedNote = asyncHandler(async (req, res) => {
  const context = getAuthContext(req)
  sendSuccess(res, await groupsService.createSharedNote(context, getGroupIdParam(req), req.body as CreateSharedNoteInput), 201)
})

export const updateSharedNote = asyncHandler(async (req, res) => {
  const context = getAuthContext(req)
  sendSuccess(
    res,
    await groupsService.updateSharedNote(
      context,
      getGroupIdParam(req),
      getNoteIdParam(req),
      req.body as UpdateSharedNoteInput,
    ),
  )
})

export const deleteSharedNote = asyncHandler(async (req, res) => {
  const context = getAuthContext(req)
  sendSuccess(res, await groupsService.deleteSharedNote(context, getGroupIdParam(req), getNoteIdParam(req)))
})

export const getAiSettings = asyncHandler(async (req, res) => {
  const context = getAuthContext(req)
  sendSuccess(res, await groupsService.getAiSettings(context, getGroupIdParam(req)))
})

export const updateAiSettings = asyncHandler(async (req, res) => {
  const context = getAuthContext(req)
  sendSuccess(
    res,
    await groupsService.updateAiSettings(context, getGroupIdParam(req), req.body as UpdateGroupAISettingsInput),
  )
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

function getResourceIdParam(req: Request) {
  const value = req.params.resourceId
  return Array.isArray(value) ? value[0] : value
}

function getSessionIdParam(req: Request) {
  const value = req.params.sessionId
  return Array.isArray(value) ? value[0] : value
}

function getDeckIdParam(req: Request) {
  const value = req.params.deckId
  return Array.isArray(value) ? value[0] : value
}

function getCardIdParam(req: Request) {
  const value = req.params.cardId
  return Array.isArray(value) ? value[0] : value
}

function getNoteIdParam(req: Request) {
  const value = req.params.noteId
  return Array.isArray(value) ? value[0] : value
}
