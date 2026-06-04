import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { resolveUniversity } from '../../middleware/university'
import { validate } from '../../middleware/validate'
import { subscribe, unsubscribe } from './controller'
import { pushSubscribeSchema } from './schema'

export const pushRouter = Router()

pushRouter.use(requireAuth, resolveUniversity)

pushRouter.post('/subscribe', validate(pushSubscribeSchema), subscribe)
pushRouter.delete('/subscribe', unsubscribe)
