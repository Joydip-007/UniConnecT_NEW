import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { resolveUniversity } from '../../middleware/university'
import { validateRequest } from '../../middleware/validate'
import { TagPostsQuerySchema } from './schema'
import { discoveryController, tagPostsController } from './controller'

export const exploreRouter = Router()

exploreRouter.use(resolveUniversity, requireAuth)

exploreRouter.get('/discovery', discoveryController)
exploreRouter.get('/tags/:tag', validateRequest({ query: TagPostsQuerySchema }), tagPostsController)
