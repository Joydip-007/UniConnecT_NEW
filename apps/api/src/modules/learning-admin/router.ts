import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import { resolveUniversity } from '../../middleware/university'
import { validate } from '../../middleware/validate'
import {
  getConfig,
  updateConfig,
  listPendingPaths,
  getPendingPathDetail,
  approvePath,
  discardPath,
  listPendingQuizBatches,
  getPendingQuizDetail,
  approveQuizBatch,
  discardQuizBatch,
  triggerGenerateNow,
} from './controller'
import { LearningAdminConfigSchema } from './schema'

export const learningAdminRouter = Router()

// Managing AI-learning preferences is a higher-trust action — admin-only.
learningAdminRouter.use(requireAuth, resolveUniversity, requireRole('admin'))

learningAdminRouter.get('/config', getConfig)
learningAdminRouter.patch('/config', validate(LearningAdminConfigSchema), updateConfig)

learningAdminRouter.get('/pending-paths', listPendingPaths)
learningAdminRouter.get('/pending-paths/:id', getPendingPathDetail)
learningAdminRouter.post('/pending-paths/:id/approve', approvePath)
learningAdminRouter.post('/pending-paths/:id/discard', discardPath)

learningAdminRouter.get('/pending-quiz', listPendingQuizBatches)
learningAdminRouter.get('/pending-quiz/:id', getPendingQuizDetail)
learningAdminRouter.post('/pending-quiz/:id/approve', approveQuizBatch)
learningAdminRouter.post('/pending-quiz/:id/discard', discardQuizBatch)

learningAdminRouter.post('/generate', triggerGenerateNow)
