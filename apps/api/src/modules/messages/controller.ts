import type { Request, Response } from 'express'
import { asyncHandler } from '../../utils/asyncHandler'
import { sendSuccess } from '../../utils/response'
import { unauthorized } from '../../utils/errors'
import { messagesService } from './service'
import type {
  ConversationPreferencesInput,
  CreateConversationInput,
  CreateMessageInput,
  MessageListQuery,
  MessageReactionInput,
  SharedFilesQuery,
  UpdateConversationInput,
  UpdateMessageInput,
} from './schema'

export const listConversations = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await messagesService.listConversations(context))
})

export const createConversation = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const { data, created } = await messagesService.createConversation(context, req.body as CreateConversationInput)
  sendSuccess(res, data, created ? 201 : 200)
})

export const getConversation = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await messagesService.getConversation(context, getConversationIdParam(req)))
})

export const updateConversation = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(
    res,
    await messagesService.updateConversation(
      context,
      getConversationIdParam(req),
      req.body as UpdateConversationInput,
    ),
  )
})

export const leaveConversation = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await messagesService.leaveConversation(context, getConversationIdParam(req)))
})

export const listMessages = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const items = await messagesService.listMessages(context, getConversationIdParam(req), req.query as unknown as MessageListQuery)
  sendSuccess(res, { items })
})

export const createMessage = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await messagesService.createMessage(context, getConversationIdParam(req), req.body as CreateMessageInput), 201)
})

export const updateMessage = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(
    res,
    await messagesService.updateMessage(
      context,
      getConversationIdParam(req),
      getMessageIdParam(req),
      req.body as UpdateMessageInput,
    ),
  )
})

export const deleteMessage = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await messagesService.deleteMessage(context, getConversationIdParam(req), getMessageIdParam(req)))
})

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await messagesService.markRead(context, getConversationIdParam(req)))
})

export const updatePreferences = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(
    res,
    await messagesService.updatePreferences(
      context,
      getConversationIdParam(req),
      req.body as ConversationPreferencesInput,
    ),
  )
})

export const listCommonGroups = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await messagesService.listCommonGroups(context, getConversationIdParam(req)))
})

export const listSharedFiles = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(
    res,
    await messagesService.listSharedFiles(
      context,
      getConversationIdParam(req),
      req.query as unknown as SharedFilesQuery,
    ),
  )
})

export const hideMessage = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await messagesService.hideMessage(context, getConversationIdParam(req), getMessageIdParam(req)))
})

export const openViewOnce = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await messagesService.openViewOnce(context, getConversationIdParam(req), getMessageIdParam(req)))
})

function getAuthContext(req: Request) {
  if (!req.user) throw unauthorized()

  return {
    userId: req.user.userId,
    universityId: req.university?.id ?? req.user.universityId,
    role: req.user.role,
  }
}

function getConversationIdParam(req: Request) {
  const value = req.params.convId
  return Array.isArray(value) ? value[0] : value
}

function getMessageIdParam(req: Request) {
  const value = req.params.msgId
  return Array.isArray(value) ? value[0] : value
}

export const upsertMessageReaction = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const { reaction_type } = req.body as MessageReactionInput
  const reactions = await messagesService.upsertMessageReaction(
    context,
    getConversationIdParam(req),
    getMessageIdParam(req),
    reaction_type,
  )
  sendSuccess(res, reactions)
})

export const removeMessageReaction = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const reactions = await messagesService.removeMessageReaction(
    context,
    getConversationIdParam(req),
    getMessageIdParam(req),
  )
  sendSuccess(res, reactions)
})
