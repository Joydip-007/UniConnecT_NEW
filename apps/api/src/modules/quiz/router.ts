import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { resolveUniversity } from '../../middleware/university'
import { validate, validateRequest } from '../../middleware/validate'
import { getTodaySlot, submitAttempt, getTodayLeaderboard, getMyHistory } from './controller'
import { SubmitAnswersSchema, QuizHistoryQuerySchema } from './schema'

export const quizRouter = Router()
quizRouter.use(requireAuth, resolveUniversity)

quizRouter.get('/today', getTodaySlot)
quizRouter.post('/today/:slotId/attempt', validate(SubmitAnswersSchema), submitAttempt)
quizRouter.get('/today/leaderboard', getTodayLeaderboard)
quizRouter.get('/me/history', validateRequest({ query: QuizHistoryQuerySchema }), getMyHistory)
