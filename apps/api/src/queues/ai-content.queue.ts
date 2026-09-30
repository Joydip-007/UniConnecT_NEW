import { createQueue } from '../config/bull'

export type AIContentJob =
  | { task: 'quiz-gen'; universityId?: string }
  | { task: 'group-post' }
  | { task: 'learning-gen'; universityId?: string }
export const aiContentQueue = createQueue<AIContentJob>('ai-content')
