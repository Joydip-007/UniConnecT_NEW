import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { resolveUniversity } from '../../middleware/university'
import { validateRequest } from '../../middleware/validate'
import { listNotifications, markAllRead, markRead } from './controller'
import { NotificationListQuerySchema } from './schema'

export const notificationsRouter = Router()

notificationsRouter.use(requireAuth, resolveUniversity)

notificationsRouter.get('/', validateRequest({ query: NotificationListQuerySchema }), listNotifications)
notificationsRouter.patch('/:notificationId/read', markRead)
notificationsRouter.post('/read-all', markAllRead)
