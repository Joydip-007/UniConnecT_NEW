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
  // `text` is a legacy shape (pre-fix AI generations wrote `{ text }` instead of `{ body }`) —
  // kept readable here so already-generated units still render; new generations write `body`.
  content?: { body?: string; text?: string; questions?: QuizQuestion[] }
  completion_rule?: { passScore?: number }
}

export interface PathDetail extends Omit<LearningPath, 'myEnrollmentStatus'> {
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
  awardedAt: string
  skillPathId: string | null
}

export interface CompleteUnitResult {
  completed: boolean
  alreadyCompleted?: boolean
  pathCompleted: boolean
  streak: { currentStreak: number; longestStreak: number }
}
