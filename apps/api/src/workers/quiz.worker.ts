import { learningQueue } from '../queues/learning.queue'
import { db } from '../config/db'
import { logger } from '../utils/logger'
import { selectDailyQuestions } from '../modules/quiz/quizEngine'
import type { StoredQuestion } from '../modules/quiz/quizEngine'

// Piggybacks on the hourly learning queue sweep.
// Only generates slots when local hour === 0 for a given university.

const FALLBACK_QUESTIONS: StoredQuestion[] = [
  { q: 'Which protocol underlies most modern web APIs?', options: ['FTP', 'HTTP', 'SSH', 'SMTP'], answer: 1 },
  { q: 'What does DNS stand for?', options: ['Domain Name System', 'Data Network Service', 'Dynamic Node Selector', 'Distributed Name Service'], answer: 0 },
  { q: 'Which data structure uses FIFO?', options: ['Stack', 'Tree', 'Queue', 'Graph'], answer: 2 },
  { q: 'Git command to create a branch?', options: ['git fork', 'git branch', 'git checkout -c', 'git split'], answer: 1 },
  { q: 'What is O(1) complexity?', options: ['Linear', 'Logarithmic', 'Constant', 'Quadratic'], answer: 2 },
]

const QUESTIONS_PER_QUIZ = 5

export async function generateDailyQuizSlots(now: Date): Promise<void> {
  const universities = await db('universities').select<{ id: string; timezone: string }[]>('id', 'timezone')

  for (const uni of universities) {
    const localDate = now.toLocaleDateString('en-CA', { timeZone: uni.timezone })

    const departments = await db('profiles as p')
      .join('users as u', 'u.id', 'p.user_id')
      .where('u.university_id', uni.id)
      .whereNotNull('p.department')
      .distinct<{ department: string }[]>('p.department as department')

    for (const { department } of departments) {
      const exists = await db('daily_quiz_slots')
        .where({ university_id: uni.id, department, date: localDate })
        .first<{ id: string }>('id')
      if (exists) continue

      const pooled = await db('ai_quiz_pool')
        .where({ university_id: uni.id, department, consumed_at: null })
        .orderBy('generated_at', 'asc')
        .first<{ id: string; questions: StoredQuestion[] | string }>()

      if (pooled) {
        try {
          await db('ai_quiz_pool').where({ id: pooled.id }).update({ consumed_at: db.fn.now() })
          const pooledQuestions =
            typeof pooled.questions === 'string' ? (JSON.parse(pooled.questions) as StoredQuestion[]) : pooled.questions
          await db('daily_quiz_slots').insert({
            university_id: uni.id,
            department,
            date: localDate,
            questions: JSON.stringify(pooledQuestions),
          })
          logger.info('daily quiz slot created from ai_quiz_pool', { university_id: uni.id, department, date: localDate })
        } catch (err: unknown) {
          // 23505 = unique violation: another worker beat us, safe to skip
          if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === '23505') continue
          logger.error('Failed to create daily quiz slot from ai_quiz_pool', { err })
        }
        continue
      }

      const units = await db('skill_path_units as u')
        .join('skill_paths as p', 'p.id', 'u.path_id')
        .where('u.type', 'quiz')
        .where(function () {
          this.whereNull('p.university_id').orWhere('p.university_id', uni.id)
        })
        .select<{ content: { questions?: StoredQuestion[] } | string }[]>('u.content')

      const pool: StoredQuestion[] = units.flatMap((unit) => {
        const content = typeof unit.content === 'string' ? JSON.parse(unit.content) : unit.content
        return Array.isArray(content?.questions) ? content.questions : []
      })

      const seed = `${uni.id}-${department}-${localDate}`
      const questions =
        pool.length > 0
          ? selectDailyQuestions(pool, QUESTIONS_PER_QUIZ, seed)
          : selectDailyQuestions(FALLBACK_QUESTIONS, QUESTIONS_PER_QUIZ, seed)

      try {
        await db('daily_quiz_slots').insert({
          university_id: uni.id,
          department,
          date: localDate,
          questions: JSON.stringify(questions),
        })
        logger.info('daily quiz slot created', { university_id: uni.id, department, date: localDate })
      } catch (err: unknown) {
        // 23505 = unique violation: another worker beat us, safe to skip
        if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === '23505') continue
        logger.error('Failed to create daily quiz slot', { err })
      }
    }
  }
}

learningQueue.on('completed', async () => {
  try {
    await generateDailyQuizSlots(new Date())
  } catch (err) {
    logger.error('quiz slot generator failed', { err })
  }
})

// Run once on startup so today's slots exist immediately after deploy/restart.
void generateDailyQuizSlots(new Date()).catch((err) => {
  logger.error('quiz slot startup generation failed', { err })
})
