import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { writeLimiter } from '../../middleware/rateLimiter'
import { resolveUniversity } from '../../middleware/university'
import { validate, validateRequest } from '../../middleware/validate'
import {
  createConversation,
  createMessage,
  deleteMessage,
  getConversation,
  leaveConversation,
  listConversations,
  listMessages,
  markRead,
  removeMessageReaction,
  updateConversation,
  updateMessage,
  upsertMessageReaction,
} from './controller'
import {
  CreateConversationSchema,
  CreateMessageSchema,
  MessageListQuerySchema,
  MessageReactionSchema,
  UpdateConversationSchema,
  UpdateMessageSchema,
} from './schema'

export const messagesRouter = Router()

messagesRouter.use(requireAuth, resolveUniversity)

messagesRouter.get('/', listConversations)
messagesRouter.post('/', writeLimiter, validate(CreateConversationSchema), createConversation)
messagesRouter.get('/:convId', getConversation)
messagesRouter.patch('/:convId', validate(UpdateConversationSchema), updateConversation)
messagesRouter.delete('/:convId/leave', leaveConversation)
messagesRouter.get('/:convId/messages', validateRequest({ query: MessageListQuerySchema }), listMessages)
messagesRouter.post('/:convId/messages', validate(CreateMessageSchema), createMessage)
messagesRouter.patch('/:convId/messages/:msgId', validate(UpdateMessageSchema), updateMessage)
messagesRouter.delete('/:convId/messages/:msgId', deleteMessage)
messagesRouter.post('/:convId/messages/:msgId/reactions', writeLimiter, validate(MessageReactionSchema), upsertMessageReaction)
messagesRouter.delete('/:convId/messages/:msgId/reactions', removeMessageReaction)
messagesRouter.post('/:convId/read', markRead)
