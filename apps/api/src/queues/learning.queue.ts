import { createQueue } from '../config/bull'

export type LearningQueueJob = Record<string, never>
export const learningQueue = createQueue<LearningQueueJob>('learning')
