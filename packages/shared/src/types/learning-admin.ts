export interface LearningTopic {
  category: string
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
}

export interface LearningAdminConfig {
  enabled: boolean
  topics: LearningTopic[]
  difficulty: string
  language: string
  estimatedDays: number
  customInstructions: string | null
  genHour: number
  countPerRun: number
  quizEnabled: boolean
  quizRequireApproval: boolean
  quizDifficulty: string
  quizLanguage: string
  quizCount: number
  quizCustomInstructions: string | null
  lastAiError: string | null
  lastAiErrorAt: string | null
}

export type LearningAdminConfigInput = Partial<LearningAdminConfig>

export interface PendingPath {
  id: string
  title: string
  description: string | null
  category: string
  difficulty: string
  estimated_days: number
  created_at: string
}

export interface PendingQuizBatch {
  id: string
  department: string
  generated_at: string
}

export interface PendingQuizQuestion {
  q: string
  options: string[]
  answer: number
}

export interface PendingPathUnit {
  id: string
  display_order: number
  title: string
  type: 'read' | 'video' | 'exercise' | 'quiz'
  // `text` is a legacy shape (pre-fix AI generations wrote `{ text }` instead of `{ body }`) —
  // kept readable here so already-pending rows still preview; new generations write `body`.
  content: { body?: string; text?: string; questions?: PendingQuizQuestion[] } | null
  completion_rule: { passScore?: number } | null
}

export interface PendingPathDetail extends PendingPath {
  units: PendingPathUnit[]
}

export interface PendingQuizBatchDetail extends PendingQuizBatch {
  questions: PendingQuizQuestion[]
}

export interface UpcomingQuizzes {
  today: Array<{ department: string; date: string; attemptCount: number }>
  queuedByDepartment: Array<{ department: string; queuedBatches: number }>
}

export interface LearningAnalytics {
  windowDays: number
  paths: Array<{
    pathId: string
    title: string
    unitCount: number
    enrolledCount: number
    completedCount: number
    completionRate: number
    avgUnitScore: number | null
  }>
  quizzes: Array<{
    department: string
    attemptCount: number
    avgScore: number
    passRate: number
  }>
}
