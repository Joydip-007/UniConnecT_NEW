import { Router } from 'express'
import { notificationPreferencesSchema } from '@uniconnect/shared'
import { requireAuth } from '../../middleware/auth'
import { resolveUniversity } from '../../middleware/university'
import { validate, validateRequest } from '../../middleware/validate'
import {
  acceptGroupInvite,
  deleteNotification,
  getPreferences,
  listNotifications,
  markAllRead,
  markRead,
  updatePreferences,
} from './controller'
import { NotificationListQuerySchema } from './schema'

export const notificationsRouter = Router()

notificationsRouter.use(requireAuth, resolveUniversity)

notificationsRouter.get('/preferences', getPreferences)
notificationsRouter.put('/preferences', validate(notificationPreferencesSchema), updatePreferences)
notificationsRouter.get('/', validateRequest({ query: NotificationListQuerySchema }), listNotifications)
notificationsRouter.patch('/:notificationId/read', markRead)
notificationsRouter.post('/read-all', markAllRead)
notificationsRouter.delete('/:notificationId', deleteNotification)
notificationsRouter.post('/:notificationId/accept', acceptGroupInvite)
