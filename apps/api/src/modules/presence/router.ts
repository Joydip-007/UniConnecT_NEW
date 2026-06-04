import { Router } from 'express'
import { presenceLookupSchema } from '@uniconnect/shared'
import { requireAuth } from '../../middleware/auth'
import { resolveUniversity } from '../../middleware/university'
import { validateRequest } from '../../middleware/validate'
import { getOnlineConnections, getPresence } from './controller'

export const presenceRouter = Router()

presenceRouter.use(requireAuth, resolveUniversity)

presenceRouter.get('/', validateRequest({ query: presenceLookupSchema }), getPresence)
presenceRouter.get('/online', getOnlineConnections)
