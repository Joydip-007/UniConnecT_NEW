import { Router } from 'express'
import {
  badgeIdParamsSchema,
  completeUnitSchema,
  pinBadgeSchema,
  submitUnitQuizAttemptSchema,
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
learningRouter.get(
  '/units/:unitId/attempts',
  validateRequest({ params: unitIdParamsSchema }),
  c.listUnitQuizAttempts,
)
learningRouter.post(
  '/units/:unitId/attempts',
  validateRequest({ params: unitIdParamsSchema, body: submitUnitQuizAttemptSchema }),
  c.submitUnitQuizAttempt,
)
learningRouter.get('/me/quizzes', c.listMyQuizzes)
learningRouter.get('/me/badges', c.listMyBadges)
// Declared before any `/me/badges/:badgeId/…` route so the literal segment is never read as an id.
learningRouter.get('/me/badges/progress', c.getBadgeProgress)
learningRouter.put(
  '/me/badges/showcase',
  validateRequest({ body: showcaseBadgeSchema }),
  c.setShowcase,
)
learningRouter.put(
  '/me/badges/:badgeId/pin',
  validateRequest({ params: badgeIdParamsSchema, body: pinBadgeSchema }),
  c.setBadgePin,
)
learningRouter.get(
  '/users/:userId/badges',
  validateRequest({ params: userIdParamsSchema }),
  c.listBadgesForUser,
)
