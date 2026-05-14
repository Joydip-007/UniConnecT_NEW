import Queue from 'bull'
import { env } from '../config/env'

export interface NotificationQueueJob {
  universityId: string
  userId: string
  type: string
  actorId?: string | null
  referenceId?: string | null
  referenceType?: string | null
  content?: string
  payload: Record<string, unknown>
}

export const notificationQueue = new Queue<NotificationQueueJob>('notification', env.REDIS_URL)
