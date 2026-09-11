import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import { resolveUniversity } from '../../middleware/university'
import { validate, validateRequest } from '../../middleware/validate'
import {
  getConfig,
  updateConfig,
  listPendingPaths,
  getPendingPathDetail,
  approvePath,
  discardPath,
  listPendingQuizBatches,
  getPendingQuizDetail,
  approveQuizBatch,
  discardQuizBatch,
  triggerGenerateNow,
  getUpcomingQuizzes,
  getAnalytics,
  listAdminPaths,
  createPath,
  updatePath,
  setPathPublished,
  getPathDetail,
  createUnit,
  updateUnit,
  deleteUnit,
  reorderUnits,
  draftPathWithAi,
  listAdminQuizzes,
  generateQuizWithAi,
  getAdminQuizQuestions,
} from './controller'
import {
  LearningAdminConfigSchema,
  AdminListPathsQuerySchema,
  CreateLearningPathSchema,
  PathIdParamSchema,
  UpdateLearningPathSchema,
  SetPathPublishedSchema,
  UnitIdParamSchema,
  CreatePathUnitSchema,
  UpdatePathUnitSchema,
  ReorderPathUnitsSchema,
  TriggerGenerateSchema,
  DraftPathWithAiSchema,
  GenerateQuizWithAiSchema,
  AdminQuizParamSchema,
} from './schema'

export const learningAdminRouter = Router()

// Managing AI-learning preferences is a higher-trust action — admin-only.
learningAdminRouter.use(requireAuth, resolveUniversity, requireRole('admin'))

learningAdminRouter.get('/config', getConfig)
learningAdminRouter.patch('/config', validate(LearningAdminConfigSchema), updateConfig)

learningAdminRouter.get('/pending-paths', listPendingPaths)
learningAdminRouter.get('/pending-paths/:id', getPendingPathDetail)
learningAdminRouter.post('/pending-paths/:id/approve', approvePath)
learningAdminRouter.post('/pending-paths/:id/discard', discardPath)

learningAdminRouter.get('/pending-quiz', listPendingQuizBatches)
learningAdminRouter.get('/pending-quiz/:id', getPendingQuizDetail)
learningAdminRouter.post('/pending-quiz/:id/approve', approveQuizBatch)
learningAdminRouter.post('/pending-quiz/:id/discard', discardQuizBatch)

learningAdminRouter.post('/generate', validate(TriggerGenerateSchema), triggerGenerateNow)

learningAdminRouter.get('/upcoming-quizzes', getUpcomingQuizzes)
learningAdminRouter.get('/analytics', getAnalytics)

learningAdminRouter.get('/quizzes', listAdminQuizzes)
learningAdminRouter.post('/quizzes/generate', validate(GenerateQuizWithAiSchema), generateQuizWithAi)
learningAdminRouter.get('/quizzes/:kind/:id', validateRequest({ params: AdminQuizParamSchema }), getAdminQuizQuestions)

// Literal '/paths/draft' is declared before any '/paths/:id' route so the param route never swallows it.
learningAdminRouter.post('/paths/draft', validate(DraftPathWithAiSchema), draftPathWithAi)
learningAdminRouter.get('/paths', validateRequest({ query: AdminListPathsQuerySchema }), listAdminPaths)
learningAdminRouter.post('/paths', validate(CreateLearningPathSchema), createPath)
learningAdminRouter.patch(
  '/paths/:id',
  validateRequest({ params: PathIdParamSchema, body: UpdateLearningPathSchema }),
  updatePath,
)
learningAdminRouter.patch(
  '/paths/:id/publish',
  validateRequest({ params: PathIdParamSchema, body: SetPathPublishedSchema }),
  setPathPublished,
)

learningAdminRouter.get('/paths/:id', validateRequest({ params: PathIdParamSchema }), getPathDetail)
learningAdminRouter.post('/paths/:id/units', validateRequest({ params: PathIdParamSchema, body: CreatePathUnitSchema }), createUnit)
// IMPORTANT: register '/paths/:id/units/reorder' before '/paths/:id/units/:unitId' —
// Express matches the more specific literal segment first only if it's declared first,
// otherwise 'reorder' is captured as a :unitId value and the reorder schema's UUID check
// (which would 422, not silently misroute) fires instead of the intended handler.
learningAdminRouter.patch('/paths/:id/units/reorder', validateRequest({ params: PathIdParamSchema, body: ReorderPathUnitsSchema }), reorderUnits)
learningAdminRouter.patch('/paths/:id/units/:unitId', validateRequest({ params: UnitIdParamSchema, body: UpdatePathUnitSchema }), updateUnit)
learningAdminRouter.delete('/paths/:id/units/:unitId', validateRequest({ params: UnitIdParamSchema }), deleteUnit)
