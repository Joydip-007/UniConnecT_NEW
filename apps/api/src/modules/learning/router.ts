import { Router } from 'express'
import { pathIdParamsSchema } from '@uniconnect/shared'
import { requireAuth } from '../../middleware/auth'
import { resolveUniversity } from '../../middleware/university'
import { validateRequest } from '../../middleware/validate'
import * as c from './controller'

export const learningRouter = Router()
learningRouter.use(requireAuth, resolveUniversity)

learningRouter.get('/paths', c.listPaths)
learningRouter.get('/paths/:pathId', validateRequest({ params: pathIdParamsSchema }), c.getPath)
learningRouter.post('/paths/:pathId/enroll', validateRequest({ params: pathIdParamsSchema }), c.enroll)
learningRouter.post('/paths/:pathId/abandon', validateRequest({ params: pathIdParamsSchema }), c.abandon)
// Tasks 6–7 add: GET /me/today, POST /units/:unitId/complete, GET /me/stats,
// GET /me/badges, PUT /me/badges/showcase, GET /users/:userId/badges
