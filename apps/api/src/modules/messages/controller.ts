import type { Request, Response } from 'express'
import { asyncHandler } from '../../utils/asyncHandler'
import { sendSuccess } from '../../utils/response'
import { unauthorized } from '../../utils/errors'
import { messagesService } from './service'
import type {
  CreateConversationInput,
  CreateMessageInput,
  MessageListQuery,
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
