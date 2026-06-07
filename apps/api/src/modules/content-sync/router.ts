import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import { resolveUniversity } from '../../middleware/university'
import { validate, validateRequest } from '../../middleware/validate'
import { getConfig, listPendingImported, listRuns, triggerRun, updateConfig } from './controller'
import { RunContentSyncSchema, RunsQuerySchema, contentSyncConfigSchema } from './schema'

export const contentSyncRouter = Router()

// Repointing the scraper is a higher-trust action — admin-only.
contentSyncRouter.use(requireAuth, resolveUniversity, requireRole('admin'))

contentSyncRouter.get('/config', getConfig)
contentSyncRouter.patch('/config', validate(contentSyncConfigSchema), updateConfig)
contentSyncRouter.post('/run', validate(RunContentSyncSchema), triggerRun)
contentSyncRouter.get('/pending', listPendingImported)
contentSyncRouter.get('/runs', validateRequest({ query: RunsQuerySchema }), listRuns)
