import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { resolveUniversity } from '../../middleware/university'
import { validate, validateRequest } from '../../middleware/validate'
import {
  followUser,
  getMe,
  getProgress,
  getSuggestions,
  getUser,
  listFollowers,
  listFollowing,
  listUsers,
  unfollowUser,
  updateMe,
  updateMyPreferences,
} from './controller'
import {
  PaginationQuerySchema,
  UpdatePreferencesSchema,
  UpdateProfileSchema,
  UserListQuerySchema,
} from './schema'

export const usersRouter = Router()

usersRouter.use(requireAuth, resolveUniversity)

usersRouter.get('/me', getMe)
usersRouter.patch('/me', validate(UpdateProfileSchema), updateMe)
usersRouter.patch('/me/preferences', validate(UpdatePreferencesSchema), updateMyPreferences)
usersRouter.get('/me/progress', getProgress)
usersRouter.get('/suggestions', getSuggestions)
usersRouter.get('/', validateRequest({ query: UserListQuerySchema }), listUsers)
usersRouter.get('/:userId', getUser)
usersRouter.post('/:userId/follow', followUser)
usersRouter.delete('/:userId/follow', unfollowUser)
usersRouter.get('/:userId/followers', validateRequest({ query: PaginationQuerySchema }), listFollowers)
usersRouter.get('/:userId/following', validateRequest({ query: PaginationQuerySchema }), listFollowing)
