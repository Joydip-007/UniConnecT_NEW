import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import { resolveUniversity } from '../../middleware/university'
import { validate, validateRequest } from '../../middleware/validate'
import { createNews, deleteNews, getNews, getNewsRail, listNews, updateNews } from './controller'
import { CreateNewsSchema, NewsListQuerySchema, UpdateNewsSchema } from './schema'

export const newsRouter = Router()

newsRouter.use(requireAuth, resolveUniversity)

newsRouter.get('/', validateRequest({ query: NewsListQuerySchema }), listNews)
// Declared before `/:newsId`, or the param route would swallow it.
newsRouter.get('/rail', getNewsRail)
newsRouter.post('/', requireRole('faculty', 'admin'), validate(CreateNewsSchema), createNews)
newsRouter.get('/:newsId', getNews)
newsRouter.patch('/:newsId', requireRole('faculty', 'admin'), validate(UpdateNewsSchema), updateNews)
newsRouter.delete('/:newsId', requireRole('faculty', 'admin'), deleteNews)
