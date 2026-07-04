import { Router } from 'express'
import {
  completeUnitSchema,
  pathIdParamsSchema,
  showcaseBadgeSchema,
  unitIdParamsSchema,
  userIdParamsSchema,
} from '@uniconnect/shared'
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
learningRouter.get('/me/today', c.getToday)
learningRouter.get('/me/stats', c.getStats)
learningRouter.post(
  '/units/:unitId/complete',
  validateRequest({ params: unitIdParamsSchema, body: completeUnitSchema }),
  c.completeUnit,
)
learningRouter.get('/me/badges', c.listMyBadges)
learningRouter.put(
  '/me/badges/showcase',
  validateRequest({ body: showcaseBadgeSchema }),
  c.setShowcase,
)
learningRouter.get(
  '/users/:userId/badges',
  validateRequest({ params: userIdParamsSchema }),
  c.listBadgesForUser,
)
