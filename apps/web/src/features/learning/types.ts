export interface LearningPath {
  id: string
  title: string
  description: string | null
  category: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimated_days: number
  badge_name: string | null
  badge_icon: string | null
  unitCount: number
  enrolledCount: number
  myEnrollmentStatus: 'active' | 'completed' | 'abandoned' | null
  /** Units the caller has finished in this path. 0 when they are not enrolled. */
  completedUnitCount: number
  /** Title of the unit the caller resumes at, or null when enrolled and finished. */
  nextUnitTitle: string | null
}

export interface QuizQuestion {
  q: string
  options: string[]
  answer: number
}

export interface LearningUnit {
  id: string
  display_order: number
  title: string
  type: 'read' | 'video' | 'exercise' | 'quiz'
  completed: boolean
  /** One-line description; public even while the unit is locked. */
  summary?: string | null
  /** Authored duration, or an estimate from the body length for reading units. */
  minutes?: number | null
  questionCount?: number
  hasVideo?: boolean
  // `text` is a legacy shape (pre-fix AI generations wrote `{ text }` instead of `{ body }`) —
  // kept readable here so already-generated units still render; new generations write `body`.
  // `null` while the unit is locked for the caller.
  content?: { body?: string; text?: string; video_url?: string; questions?: QuizQuestion[] } | null
  completion_rule?: { passScore?: number }
}

// The detail payload carries `units` in full, so per-caller progress is derivable from it
// and the endpoint does not repeat the list's `completedUnitCount` / `nextUnitTitle`.
export interface PathDetail
  extends Omit<LearningPath, 'myEnrollmentStatus' | 'completedUnitCount' | 'nextUnitTitle'> {
  units: LearningUnit[]
  enrollment: { status: 'active' | 'completed' | 'abandoned' } | null
}

export interface TodayEntry {
  pathId: string
  unit: LearningUnit
  completedToday: boolean
}

export interface LearningStats {
  currentStreak: number
  longestStreak: number
  lastActivityDate: string | null
  freezesRemaining: number
}

export interface UserBadge {
  id: string
  name: string
  description: string | null
  iconUrl: string | null
  category: 'path' | 'streak' | 'volume' | 'social'
  points: number
  rarity: 'common' | 'rare' | 'epic'
  isShowcased: boolean
  showcasedAt?: string | null
  awardedAt: string
  skillPathId: string | null
}

export interface CompleteUnitResult {
  completed: boolean
  alreadyCompleted?: boolean
  pathCompleted: boolean
  streak: { currentStreak: number; longestStreak: number }
}

export interface UnitQuizReviewItem {
  question: string
  options: string[]
  selectedIndex: number | null
  correctIndex: number
  isCorrect: boolean
}

export interface UnitQuizAttempt {
  id: string
  createdAt: string
  score: number
  correctCount: number
  totalQuestions: number
  passed: boolean
  review: UnitQuizReviewItem[]
}

export interface SubmitUnitQuizResult {
  attempt: UnitQuizAttempt
  passScore: number
  completion: CompleteUnitResult | null
  /** Why a passing attempt did not complete the unit (e.g. the one-unit-per-day pace). */
  completionError: string | null
}

/** A checkpoint quiz row on the Quizzes tab. */
export interface MyQuiz {
  unitId: string
  pathId: string
  pathTitle: string
  title: string
  summary: string | null
  questionCount: number
  passScore: number
  state: 'completed' | 'next' | 'locked'
  pathStarted: boolean
  blockedByTitle: string | null
  attemptCount: number
  bestScore: number | null
  lastScore: number | null
  passed: boolean
}

export type BadgeTrigger = 'streak_milestone' | 'unit_completed' | 'quiz_win' | 'path_completed'

export interface BadgeProgress {
  id: string
  name: string
  description: string | null
  iconUrl: string | null
  triggerType: BadgeTrigger
  skillPathId: string | null
  pathTitle: string | null
  current: number
  target: number
  earned: boolean
  awardedAt: string | null
  pinned: boolean
  pinnedAt: string | null
  heldByPct: number
}
