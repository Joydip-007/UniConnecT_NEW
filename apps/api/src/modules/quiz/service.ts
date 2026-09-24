import { db } from '../../config/db'
import { badgeQueue } from '../../queues/badge.queue'
import { conflict, notFound } from '../../utils/errors'
import { scoreQuiz, buildQuizReview } from './quizEngine'
import type { StoredQuestion } from './quizEngine'
import type { SubmitAnswersInput, QuizHistoryQuery } from './schema'

interface AuthContext { userId: string; universityId: string }
interface ClientQuestion { q: string; options: string[] }

interface QuizSlotRow {
  id: string; university_id: string; department: string; date: string
  questions: StoredQuestion[] | string
}

interface AttemptRow {
  id: string; slot_id: string; user_id: string
  answers: number[] | string
  score: number; correct_count: number; total_questions: number; completed_at: Date
}

function parseAnswers(raw: number[] | string): number[] {
  if (typeof raw === 'string') return JSON.parse(raw) as number[]
  return raw
}

function todayLocalDate(tz: string): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: tz })
}

function parseQuestions(raw: StoredQuestion[] | string): StoredQuestion[] {
  if (typeof raw === 'string') return JSON.parse(raw) as StoredQuestion[]
  return raw
}

async function getUniversityTimezone(universityId: string): Promise<string> {
  const row = await db('universities').where({ id: universityId }).first<{ timezone: string }>('timezone')
  return row?.timezone ?? 'UTC'
}

async function getDepartment(userId: string): Promise<string> {
  const row = await db('profiles').where({ user_id: userId }).first<{ department: string | null }>('department')
  return row?.department ?? 'General'
}

export async function getTodaySlot(context: AuthContext) {
  const tz = await getUniversityTimezone(context.universityId)
  const date = todayLocalDate(tz)
  const department = await getDepartment(context.userId)

  const slot = await db<QuizSlotRow>('daily_quiz_slots')
    .where({ university_id: context.universityId, department, date })
    .first()

  if (!slot) return null

  const stored = parseQuestions(slot.questions)
  const clientQuestions: ClientQuestion[] = stored.map(({ q, options }) => ({ q, options }))

  const attempt = await db<AttemptRow>('daily_quiz_attempts')
    .where({ slot_id: slot.id, user_id: context.userId })
    .first()

  return {
    id: slot.id,
    department,
    date,
    questions: clientQuestions,
    myAttempt: attempt
      ? {
          score: attempt.score,
          correctCount: attempt.correct_count,
          totalQuestions: attempt.total_questions,
          review: buildQuizReview(stored, parseAnswers(attempt.answers)),
        }
      : null,
  }
}

export async function submitAttempt(context: AuthContext, slotId: string, input: SubmitAnswersInput) {
  const slot = await db<QuizSlotRow>('daily_quiz_slots')
    .where({ id: slotId, university_id: context.universityId })
    .first()
  if (!slot) throw notFound('Quiz slot not found', 'SLOT_NOT_FOUND')

  const existing = await db('daily_quiz_attempts')
    .where({ slot_id: slotId, user_id: context.userId })
    .first<{ id: string }>('id')
  if (existing) throw conflict('You have already attempted this quiz', 'ALREADY_ATTEMPTED')

  const stored = parseQuestions(slot.questions)
  const { score, correctCount, totalQuestions } = scoreQuiz(stored, input.answers)
  const passed = score >= 70

  await db('daily_quiz_attempts').insert({
    slot_id: slotId,
    user_id: context.userId,
    university_id: context.universityId,
    answers: JSON.stringify(input.answers),
    score,
    correct_count: correctCount,
    total_questions: totalQuestions,
  })

  if (passed) {
    await badgeQueue.add({
      userId: context.userId,
      universityId: context.universityId,
      action: 'quiz_win',
      payload: { slotId },
    })
  }

  const review = buildQuizReview(stored, input.answers)

  return { score, correctCount, totalQuestions, passed, review }
}

export async function getTodayLeaderboard(context: AuthContext) {
  const tz = await getUniversityTimezone(context.universityId)
  const date = todayLocalDate(tz)
  const department = await getDepartment(context.userId)

  const slot = await db<QuizSlotRow>('daily_quiz_slots')
    .where({ university_id: context.universityId, department, date })
    .first()
  if (!slot) return []

  return db('daily_quiz_attempts as a')
    .join('profiles as p', 'p.user_id', 'a.user_id')
    .join('users as u', 'u.id', 'a.user_id')
    .where({ 'a.slot_id': slot.id })
    .orderBy('a.score', 'desc')
    .orderBy('a.completed_at', 'asc')
    .limit(10)
    .select(
      db.raw('ROW_NUMBER() OVER (ORDER BY a.score DESC, a.completed_at ASC) AS rank'),
      'a.user_id as userId',
      'p.full_name as fullName',
      'p.avatar_url as avatarUrl',
      'u.role as role',
      'a.score',
      'a.correct_count as correctCount',
    )
}

export async function getMyHistory(context: AuthContext, query: QuizHistoryQuery) {
  const rows = await db('daily_quiz_attempts as a')
    .join('daily_quiz_slots as s', 's.id', 'a.slot_id')
    .where({ 'a.user_id': context.userId, 'a.university_id': context.universityId })
    .orderBy('a.completed_at', 'desc')
    .limit(query.limit)
    .offset((query.page - 1) * query.limit)
    .select('a.id', 'a.score', 'a.correct_count', 'a.total_questions', 'a.completed_at', 's.department', 's.date')

  const [{ count }] = await db('daily_quiz_attempts')
    .where({ user_id: context.userId, university_id: context.universityId })
    .count<{ count: string | number }[]>({ count: '*' })

  return { items: rows, total: Number(count), page: query.page, limit: query.limit }
}
