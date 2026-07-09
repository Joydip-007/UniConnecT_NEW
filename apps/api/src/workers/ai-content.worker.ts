import { aiContentQueue } from '../queues/ai-content.queue'
import { db } from '../config/db'
import { generateQuizQuestions } from '../services/ai.service'
import { env } from '../config/env'
import { logger } from '../utils/logger'

const AI_CALLS_PER_MINUTE = 12

let aiCallsThisMinute = 0
let minuteStart = Date.now()

async function rateLimitedAICall<T>(fn: () => Promise<T>): Promise<T> {
  if (Date.now() - minuteStart > 60000) {
    aiCallsThisMinute = 0
    minuteStart = Date.now()
  }
  if (aiCallsThisMinute >= AI_CALLS_PER_MINUTE) {
    await new Promise((resolve) => setTimeout(resolve, 60000 - (Date.now() - minuteStart) + 1000))
    aiCallsThisMinute = 0
    minuteStart = Date.now()
  }
  aiCallsThisMinute++
  return fn()
}

export async function runQuizGeneration(): Promise<void> {
  const universities = await db('universities').select<{ id: string }[]>('id')

  for (const uni of universities) {
    const departments = await db('profiles as p')
      .join('users as u', 'u.id', 'p.user_id')
      .where('u.university_id', uni.id)
      .whereNotNull('p.department')
      .distinct<{ department: string }[]>('p.department as department')
      .then((rows) => rows.map((r) => r.department))

    for (const department of departments) {
      try {
        const questions = await rateLimitedAICall(() => generateQuizQuestions({ department, count: 5 }))
        await db('ai_quiz_pool').insert({
          university_id: uni.id,
          department,
          questions: JSON.stringify(questions),
        })
      } catch (error) {
        logger.error('AI quiz generation failed for department', { universityId: uni.id, department, error })
      }
    }
  }
}

if (env.AI_CONTENT_ENABLED) {
  void aiContentQueue.add(
    { task: 'quiz-gen' },
    { repeat: { cron: `0 ${env.AI_QUIZ_GEN_HOUR} * * *` }, jobId: 'ai-daily-quiz-gen' },
  )
}

aiContentQueue.process(async (job) => {
  if (job.data.task === 'quiz-gen') {
    await runQuizGeneration()
  }
})
