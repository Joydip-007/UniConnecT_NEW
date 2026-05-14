import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import { resolveUniversity } from '../../middleware/university'
import { validate, validateRequest } from '../../middleware/validate'
import { createNews, deleteNews, getNews, listNews, updateNews } from './controller'
import { CreateNewsSchema, NewsListQuerySchema, UpdateNewsSchema } from './schema'

export const newsRouter = Router()

newsRouter.use(requireAuth, resolveUniversity)

newsRouter.get('/', validateRequest({ query: NewsListQuerySchema }), listNews)
newsRouter.post('/', requireRole('staff', 'admin'), validate(CreateNewsSchema), createNews)
newsRouter.get('/:newsId', getNews)
newsRouter.patch('/:newsId', requireRole('staff', 'admin'), validate(UpdateNewsSchema), updateNews)
newsRouter.delete('/:newsId', requireRole('staff', 'admin'), deleteNews)
