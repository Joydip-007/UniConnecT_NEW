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
