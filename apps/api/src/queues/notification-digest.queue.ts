import { createQueue } from '../config/bull'

/** Daily email digest of unread notifications for users who opted in. */
export const notificationDigestQueue = createQueue('notification-digest')
