import { createQueue } from '../config/bull'

export interface BadgeQueueJob {
  userId: string
  universityId: string
  action: string
  payload?: Record<string, unknown>
}

export const badgeQueue = createQueue<BadgeQueueJob>('badge')
