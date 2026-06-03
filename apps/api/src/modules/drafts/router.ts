import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { resolveUniversity } from '../../middleware/university'
import { listMyDrafts } from './controller'

export const draftsRouter = Router()

draftsRouter.use(requireAuth, resolveUniversity)

// Every user's own drafts across posts, jobs, news and events.
draftsRouter.get('/', listMyDrafts)
