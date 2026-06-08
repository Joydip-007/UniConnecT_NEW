import Queue from 'bull'
import { bullQueueOptions } from '../config/bull'

/** Daily email digest of unread notifications for users who opted in. */
export const notificationDigestQueue = new Queue('notification-digest', bullQueueOptions)
