import Queue from 'bull'
import { bullQueueOptions } from '../config/bull'

export type LearningQueueJob = Record<string, never>
export const learningQueue = new Queue<LearningQueueJob>('learning', bullQueueOptions)
