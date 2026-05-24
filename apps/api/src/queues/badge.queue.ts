import Queue from 'bull'
import { bullQueueOptions } from '../config/bull'

export interface BadgeQueueJob {
  userId: string
  universityId: string
  action: string
  payload?: Record<string, unknown>
}

export const badgeQueue = new Queue<BadgeQueueJob>('badge', bullQueueOptions)
