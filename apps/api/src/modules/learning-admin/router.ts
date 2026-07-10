import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import { resolveUniversity } from '../../middleware/university'
import { validate } from '../../middleware/validate'
import { getConfig, updateConfig } from './controller'
import { LearningAdminConfigSchema } from './schema'

export const learningAdminRouter = Router()

// Managing AI-learning preferences is a higher-trust action — admin-only.
learningAdminRouter.use(requireAuth, resolveUniversity, requireRole('admin'))

learningAdminRouter.get('/config', getConfig)
learningAdminRouter.patch('/config', validate(LearningAdminConfigSchema), updateConfig)
