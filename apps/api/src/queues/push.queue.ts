import { createQueue } from '../config/bull'

export interface PushNotificationPayload {
  title: string
  body: string
  url?: string
  icon?: string
}

export interface PushQueueJob {
  userId: string
  notification: PushNotificationPayload
}

export const pushQueue = createQueue<PushQueueJob>('push')
