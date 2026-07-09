import Queue from 'bull'
import { bullQueueOptions } from '../config/bull'

export type AIContentJob = { task: 'quiz-gen' } | { task: 'group-post' }
export const aiContentQueue = new Queue<AIContentJob>('ai-content', bullQueueOptions)
