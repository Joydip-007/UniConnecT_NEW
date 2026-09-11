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

export interface AdminLearningPathUnit {
  id: string
  displayOrder: number
  title: string
  type: 'read' | 'video' | 'exercise' | 'quiz'
  content: { body?: string; questions?: PendingQuizQuestion[] } | null
  completionRule: { passScore?: number } | null
}

export interface AdminLearningPath {
  id: string
  title: string
  description: string | null
  department: string | null
  category: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimatedDays: number
  isPublished: boolean
  source: 'manual' | 'ai'
  unitCount: number
  enrolledCount: number
  completedCount: number
  completionRate: number
  updatedAt: string
}

export interface CreateLearningPathInput {
  title: string
  description?: string | null
  department?: string | null
  category: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimatedDays: number
  units: Array<{
    title: string
    type: 'read' | 'video' | 'exercise' | 'quiz'
    content: Record<string, unknown>
    completionRule?: { passScore?: number }
  }>
}

export type UpdateLearningPathInput = Partial<
  Pick<CreateLearningPathInput, 'title' | 'description' | 'department' | 'category' | 'difficulty' | 'estimatedDays'>
>

/** One row of the admin Quizzes tab — a union over the three places a quiz lives. */
export type AdminQuizKind = 'path_unit' | 'ai_batch' | 'daily_slot'
export type AdminQuizStatus = 'published' | 'draft' | 'needs_review' | 'scheduled'

export interface AdminQuiz {
  id: string
  kind: AdminQuizKind
  title: string
  /** Null for daily-quiz rows, which are not attached to a path. */
  pathId: string | null
  /** Path title, or the daily-quiz department label. */
  pathTitle: string
  questionCount: number
  passMark: number
  attempts: number
  /** Null until the quiz has at least one attempt. */
  avgScore: number | null
  status: AdminQuizStatus
  source: 'ai' | 'staff'
  updatedAt: string
}

export interface DraftPathWithAiInput {
  topic: string
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  unitCount?: number
  department?: string | null
  includeCheckpointQuizzes?: boolean
}

/** An AI-drafted path that has NOT been persisted — the builder edits it, then creates it. */
export interface AiPathDraft {
  title: string
  description: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  units: Array<{
    title: string
    type: 'read' | 'video' | 'exercise' | 'quiz'
    content: Record<string, unknown>
    estimatedMinutes: number
    completionRule?: { passScore?: number }
  }>
}

export interface GenerateQuizWithAiInput {
  pathId: string
  count?: number
  style?: 'mcq' | 'true_false' | 'mixed'
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
}
