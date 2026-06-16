import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { resolveUniversity } from '../../middleware/university'
import { trending, searchItems, categories, share } from './controller'

export const klipyRouter = Router()

klipyRouter.use(resolveUniversity, requireAuth)

klipyRouter.get('/:media/trending', trending)
klipyRouter.get('/:media/search', searchItems)
klipyRouter.get('/:media/categories', categories)
klipyRouter.post('/:media/share/:slug', share)
