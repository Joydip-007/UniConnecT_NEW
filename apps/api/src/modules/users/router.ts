import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { resolveUniversity } from '../../middleware/university'
import { validate, validateRequest } from '../../middleware/validate'
import {
  createEducation,
  createExperience,
  createFeatured,
  deactivateMe,
  deleteEducation,
  deleteExperience,
  deleteFeatured,
  getMe,
  getMyAnalytics,
  getMyViewers,
  getProgress,
  getSuggestions,
  getUser,
  getUserConnections,
  getUserEducation,
  getUserExperience,
  getUserFeatured,
  listUsers,
  reorderFeatured,
  updateEducation,
  updateExperience,
  updateMe,
  updateMyPreferences,
} from './controller'
import {
  EducationSchema,
  ExperienceSchema,
  FeaturedSchema,
  PaginationQuerySchema,
  ReorderFeaturedSchema,
  UpdatePreferencesSchema,
  UpdateProfileSchema,
  UserListQuerySchema,
} from './schema'

export const usersRouter = Router()

usersRouter.use(requireAuth, resolveUniversity)

usersRouter.get('/me', getMe)
usersRouter.patch('/me', validate(UpdateProfileSchema), updateMe)
usersRouter.patch('/me/preferences', validate(UpdatePreferencesSchema), updateMyPreferences)
usersRouter.post('/me/deactivate', deactivateMe)
usersRouter.get('/me/progress', getProgress)
usersRouter.get('/suggestions', getSuggestions)
usersRouter.get('/', validateRequest({ query: UserListQuerySchema }), listUsers)
usersRouter.get('/:userId', getUser)

// Experience
usersRouter.get('/:userId/experience', getUserExperience)
usersRouter.post('/me/experience', validate(ExperienceSchema), createExperience)
usersRouter.patch('/me/experience/:entryId', validate(ExperienceSchema.partial()), updateExperience)
usersRouter.delete('/me/experience/:entryId', deleteExperience)

// Education
usersRouter.get('/:userId/education', getUserEducation)
usersRouter.post('/me/education', validate(EducationSchema), createEducation)
usersRouter.patch('/me/education/:entryId', validate(EducationSchema.partial()), updateEducation)
usersRouter.delete('/me/education/:entryId', deleteEducation)

// Featured
usersRouter.get('/:userId/featured', getUserFeatured)
usersRouter.post('/me/featured', validate(FeaturedSchema), createFeatured)
usersRouter.delete('/me/featured/:entryId', deleteFeatured)
usersRouter.patch('/me/featured/reorder', validate(ReorderFeaturedSchema), reorderFeatured)

// Analytics + Viewers
usersRouter.get('/me/analytics', getMyAnalytics)
usersRouter.get('/me/viewers', validateRequest({ query: PaginationQuerySchema }), getMyViewers)
usersRouter.get('/:userId/connections', validateRequest({ query: PaginationQuerySchema }), getUserConnections)
