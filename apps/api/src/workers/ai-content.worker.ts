import { aiContentQueue } from '../queues/ai-content.queue'
import { db } from '../config/db'
import { generateQuizQuestions, generateFlashcards, generateSkillPath, AIQuotaExceededError } from '../services/ai.service'
import { env } from '../config/env'
import { logger } from '../utils/logger'
import { courseOutlineService } from '../modules/academic/course-outline.service'
import { feedService } from '../modules/feed/service'
import { learningAdminService } from '../modules/learning-admin/service'
import { mergeAiSettings } from '../modules/groups/service'

function describeAiError(error: unknown): string {
  if (error instanceof AIQuotaExceededError) {
    return 'AI quota reached — all configured models hit their rate limit or free-tier daily cap. This is usually the per-day free-tier quota (separate from billing/paid quota) and typically resets within 24 hours; generation will resume automatically on the next scheduled run.'
  }
  return `AI generation failed: ${error instanceof Error ? error.message : String(error)}`
}

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

export async function runQuizGeneration(universityId?: string, now: Date = new Date()): Promise<void> {
  const universities = universityId
    ? await db('universities').where({ id: universityId }).select<{ id: string }[]>('id')
    : await db('universities').select<{ id: string }[]>('id')

  for (const uni of universities) {
    const departments = await db('profiles as p')
      .join('users as u', 'u.id', 'p.user_id')
      .where('u.university_id', uni.id)
      .whereNotNull('p.department')
      .distinct<{ department: string }[]>('p.department as department')
      .then((rows) => rows.map((r) => r.department))

    const config = await learningAdminService.getConfig(uni.id)
    if (!config.quizEnabled) continue
    if (!universityId && config.genHour !== now.getUTCHours()) continue

    for (const department of departments) {
      try {
        const questions = await rateLimitedAICall(() => generateQuizQuestions({ 
          department, 
          count: config.quizCount,
          difficulty: config.quizDifficulty,
          language: config.quizLanguage as 'en' | 'bn',
          customInstructions: config.quizCustomInstructions ?? undefined,
        }))
        await db('ai_quiz_pool').insert({
          university_id: uni.id,
          department,
          questions: JSON.stringify(questions),
        })
        await learningAdminService.clearAiError(uni.id)
      } catch (error) {
        logger.error('AI quiz generation failed for department', { universityId: uni.id, department, error })
        await learningAdminService.recordAiError(uni.id, describeAiError(error))
      }
    }
  }
}

interface AiSettings {
  ai_flashcards_enabled?: boolean
  ai_quiz_enabled?: boolean
  require_approval?: boolean
  subject?: string
  difficulty?: string
  language?: 'en' | 'bn'
  custom_instructions?: string
  last_ai_post_date?: string
  pending_deck_id?: string | null
}

export async function runGroupPosting(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10)

  const groups = await db('groups')
    .where({ type: 'academic' })
    .andWhere((builder) => {
      builder
        .whereRaw(`ai_settings->>'ai_flashcards_enabled' = 'true'`)
        .orWhereRaw(`ai_settings->>'ai_quiz_enabled' = 'true'`)
    })
    .andWhere((builder) => {
      builder
        .whereRaw(`ai_settings->>'last_ai_post_date' IS NULL`)
        .orWhereRaw(`ai_settings->>'last_ai_post_date' != ?`, [today])
    })

  for (const group of groups as Array<{ id: string; university_id: string; created_by: string; ai_settings: AiSettings | null }>) {
    try {
      const settings: AiSettings = group.ai_settings ?? {}
      if (!settings.ai_flashcards_enabled) continue

      const topic = await courseOutlineService.resolveAITopic(group.id, group.university_id)

      const cards = await rateLimitedAICall(() =>
        generateFlashcards({
          topic,
          count: 10,
          difficulty: settings.difficulty,
          language: settings.language,
          customInstructions: settings.custom_instructions,
        }),
      )

      const [deck] = await db('group_flashcard_decks')
        .insert({
          group_id: group.id,
          university_id: group.university_id,
          created_by: group.created_by,
          title: `AI deck — ${topic}`,
          is_archived: !!settings.require_approval,
          card_count: cards.length,
        })
        .returning<{ id: string }[]>('*')

      if (cards.length > 0) {
        await db('group_flashcards').insert(
          cards.map((c) => ({
            deck_id: deck.id,
            group_id: group.id,
            university_id: group.university_id,
            created_by: group.created_by,
            front: c.front,
            back: c.back,
            hint: c.hint ?? null,
          })),
        )
      }

      if (settings.require_approval) {
        await mergeAiSettings(group.id, { pending_deck_id: deck.id, last_ai_post_date: today })
      } else {
        await feedService.createPost(
          { userId: group.created_by, universityId: group.university_id, role: 'faculty' },
          {
            type: 'post',
            content: `📚 New AI flashcard deck: ${topic} — ${cards.length} cards ready!`,
            group_id: group.id,
            media_urls: [],
            is_published: true,
          },
        )
        await mergeAiSettings(group.id, { last_ai_post_date: today })
      }
      await learningAdminService.clearAiError(group.university_id)
    } catch (error) {
      logger.error('AI group posting failed', { groupId: group.id, error })
      await learningAdminService.recordAiError(group.university_id, describeAiError(error))
    }
  }
}

export async function runLearningPathGeneration(now: Date = new Date(), universityId?: string): Promise<void> {
  const universities = universityId
    ? await db('universities').where({ id: universityId }).select<{ id: string }[]>('id')
    : await db('universities').select<{ id: string }[]>('id')

  for (const uni of universities) {
    try {
      const config = await learningAdminService.getConfig(uni.id)
      if (!config.enabled) continue
      if (!universityId && config.genHour !== now.getUTCHours()) continue
      if (config.topics.length === 0) continue

      for (let i = 0; i < config.countPerRun; i++) {
        const topic = config.topics[i % config.topics.length]
        try {
          const path = await rateLimitedAICall(() =>
            generateSkillPath({
              category: topic.category,
              difficulty: topic.difficulty ?? config.difficulty,
              language: config.language as 'en' | 'bn',
              estimatedDays: config.estimatedDays,
              customInstructions: config.customInstructions ?? undefined,
            }),
          )

          const [insertedPath] = await db('skill_paths')
            .insert({
              university_id: uni.id,
              title: path.title,
              description: path.description,
              category: topic.category,
              difficulty: path.difficulty,
              estimated_days: config.estimatedDays,
              is_published: false,
              source: 'ai',
            })
            .returning<{ id: string }[]>('id')

          if (path.units.length > 0) {
            await db('skill_path_units').insert(
              path.units.map((unit, index) => ({
                path_id: insertedPath.id,
                display_order: index,
                title: unit.title,
                type: unit.type,
                content: JSON.stringify(unit.content),
              })),
            )
          }
          await learningAdminService.clearAiError(uni.id)
        } catch (error) {
          logger.error('AI learning path generation failed for topic', {
            universityId: uni.id,
            category: topic.category,
            error,
          })
          await learningAdminService.recordAiError(uni.id, describeAiError(error))
        }
      }
    } catch (error) {
      logger.error('AI learning path generation failed for university', { universityId: uni.id, error })
      await learningAdminService.recordAiError(uni.id, describeAiError(error))
    }
  }
}

if (env.AI_CONTENT_ENABLED) {
  void aiContentQueue.add(
    { task: 'quiz-gen' },
    { repeat: { cron: '0 * * * *' }, jobId: 'ai-hourly-quiz-gen' },
  )
  void aiContentQueue.add(
    { task: 'group-post' },
    { repeat: { cron: `0 ${env.AI_GROUP_POST_HOUR} * * *` }, jobId: 'ai-daily-group-post' },
  )
  void aiContentQueue.add(
    { task: 'learning-gen' },
    { repeat: { cron: '0 * * * *' }, jobId: 'ai-hourly-learning-gen' },
  )
}

aiContentQueue.process(async (job) => {
  if (job.data.task === 'quiz-gen') {
    await runQuizGeneration(job.data.universityId, new Date())
  }
  if (job.data.task === 'group-post') {
    await runGroupPosting()
  }
  if (job.data.task === 'learning-gen') {
    await runLearningPathGeneration(new Date(), job.data.universityId)
  }
})
