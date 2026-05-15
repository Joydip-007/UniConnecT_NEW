import Queue from 'bull'
import { env } from '../config/env'

export interface BadgeQueueJob {
  userId: string
  universityId: string
  action: string
  payload?: Record<string, unknown>
}

export const badgeQueue = new Queue<BadgeQueueJob>('badge', env.REDIS_URL)
