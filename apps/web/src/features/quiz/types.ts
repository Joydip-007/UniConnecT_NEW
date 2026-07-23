export interface ClientQuestion { q: string; options: string[] }

export interface QuizReviewItem {
  question: string
  options: string[]
  selectedIndex: number
  correctIndex: number
  isCorrect: boolean
}

export interface MyAttempt {
  score: number
  correctCount: number
  totalQuestions: number
  review: QuizReviewItem[]
}

export interface DailyQuizSlot {
  id: string
  department: string
  date: string
  questions: ClientQuestion[]
  myAttempt: MyAttempt | null
}

export interface QuizAttemptResult {
  score: number
  correctCount: number
  totalQuestions: number
  passed: boolean
  review: QuizReviewItem[]
}

export interface LeaderboardEntry {
  rank: number
  userId: string
  fullName: string
  avatarUrl: string | null
  score: number
  correctCount: number
}

export interface QuizHistoryItem {
  id: string
  score: number
  correctCount: number
  totalQuestions: number
  completedAt: string
  department: string
  date: string
}
