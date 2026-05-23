import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { resolveUniversity } from '../../middleware/university'
import { validateRequest } from '../../middleware/validate'
import { SearchAllQuerySchema, SearchPagedQuerySchema, SearchPeopleQuerySchema, SearchPostsQuerySchema } from './schema'
import {
  searchAllController,
  searchPeopleController,
  searchPostsController,
  searchJobsController,
  searchEventsController,
  searchGroupsController,
} from './controller'

export const searchRouter = Router()

searchRouter.use(resolveUniversity, requireAuth)

searchRouter.get('/', validateRequest({ query: SearchAllQuerySchema }), searchAllController)
searchRouter.get('/people', validateRequest({ query: SearchPeopleQuerySchema }), searchPeopleController)
searchRouter.get('/posts', validateRequest({ query: SearchPostsQuerySchema }), searchPostsController)
searchRouter.get('/jobs', validateRequest({ query: SearchPagedQuerySchema }), searchJobsController)
searchRouter.get('/events', validateRequest({ query: SearchPagedQuerySchema }), searchEventsController)
searchRouter.get('/groups', validateRequest({ query: SearchPagedQuerySchema }), searchGroupsController)
