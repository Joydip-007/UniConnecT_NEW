import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { writeLimiter } from '../../middleware/rateLimiter'
import { resolveUniversity } from '../../middleware/university'
import { validate, validateRequest } from '../../middleware/validate'
import {
  acceptRequest,
  declineRequest,
  getMutualConnections,
  listConnections,
  listPendingReceived,
  listPendingSent,
  removeConnection,
  sendRequest,
  withdrawRequest,
} from './controller'
import { PaginationQuerySchema, SendConnectionRequestSchema } from './schema'

export const connectionsRouter = Router()

connectionsRouter.use(requireAuth, resolveUniversity)

connectionsRouter.post('/request/:userId', writeLimiter, validate(SendConnectionRequestSchema), sendRequest)
connectionsRouter.delete('/request/:userId', withdrawRequest)
connectionsRouter.post('/:connectionId/accept', acceptRequest)
connectionsRouter.post('/:connectionId/decline', declineRequest)
connectionsRouter.delete('/:userId', removeConnection)
connectionsRouter.get('/', validateRequest({ query: PaginationQuerySchema }), listConnections)
connectionsRouter.get('/pending', validateRequest({ query: PaginationQuerySchema }), listPendingReceived)
connectionsRouter.get('/sent', validateRequest({ query: PaginationQuerySchema }), listPendingSent)
connectionsRouter.get('/mutual/:userId', validateRequest({ query: PaginationQuerySchema }), getMutualConnections)
