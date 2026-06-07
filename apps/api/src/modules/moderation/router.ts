import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { writeLimiter } from '../../middleware/rateLimiter'
import { resolveUniversity } from '../../middleware/university'
import { validate, validateRequest } from '../../middleware/validate'
import {
  blockUser,
  createReport,
  listBlocks,
  listMutes,
  muteUser,
  unblockUser,
  unmuteUser,
} from './controller'
import { CreateReportSchema, ModerationListQuerySchema } from './schema'

export const moderationRouter = Router()

moderationRouter.use(requireAuth, resolveUniversity)

moderationRouter.get('/blocks', validateRequest({ query: ModerationListQuerySchema }), listBlocks)
moderationRouter.post('/block/:userId', writeLimiter, blockUser)
moderationRouter.delete('/block/:userId', unblockUser)

moderationRouter.get('/mutes', validateRequest({ query: ModerationListQuerySchema }), listMutes)
moderationRouter.post('/mute/:userId', writeLimiter, muteUser)
moderationRouter.delete('/mute/:userId', unmuteUser)

moderationRouter.post('/report', writeLimiter, validate(CreateReportSchema), createReport)
