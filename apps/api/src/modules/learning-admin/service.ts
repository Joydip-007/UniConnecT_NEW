import { db } from '../../config/db'
import { notFound } from '../../utils/errors'
import { aiContentQueue } from '../../queues/ai-content.queue'
import type { LearningAdminConfigInput, AdminListPathsQuery, CreateLearningPathBody } from './schema'
import type { AdminLearningPath } from '@uniconnect/shared'

interface LearningTopic {
  category: string
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
}

export interface LearningAdminConfig {
  enabled: boolean
  topics: LearningTopic[]
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  language: 'en' | 'bn'
  estimatedDays: number
  customInstructions: string | null
  genHour: number
  countPerRun: number
  quizEnabled: boolean
  quizRequireApproval: boolean
  quizDifficulty: 'beginner' | 'intermediate' | 'advanced'
  quizLanguage: 'en' | 'bn'
  quizCount: number
  quizCustomInstructions: string | null
  lastAiError: string | null
  lastAiErrorAt: string | null
}

interface SettingsRow {
  ai_learning_enabled: boolean
  ai_learning_topics: LearningTopic[]
  ai_learning_difficulty: 'beginner' | 'intermediate' | 'advanced'
  ai_learning_language: 'en' | 'bn'
  ai_learning_est_days: number
  ai_learning_custom_instructions: string | null
  ai_learning_gen_hour: number
  ai_learning_count_per_run: number
  ai_quiz_enabled: boolean
  ai_quiz_require_approval: boolean
  ai_quiz_difficulty: 'beginner' | 'intermediate' | 'advanced'
  ai_quiz_language: 'en' | 'bn'
  ai_quiz_count: number
  ai_quiz_custom_instructions: string | null
  ai_last_error: string | null
  ai_last_error_at: string | null
}

export class LearningAdminService {
  /** Returns the tenant's AI-learning config, creating a settings row on first read if absent. */
  async getConfig(universityId: string): Promise<LearningAdminConfig> {
    const row = await this.ensureSettingsRow(universityId)
    return {
      enabled: row.ai_learning_enabled,
      topics: row.ai_learning_topics,
      difficulty: row.ai_learning_difficulty,
      language: row.ai_learning_language,
      estimatedDays: row.ai_learning_est_days,
      customInstructions: row.ai_learning_custom_instructions,
      genHour: row.ai_learning_gen_hour,
      countPerRun: row.ai_learning_count_per_run,
      quizEnabled: row.ai_quiz_enabled,
      quizRequireApproval: row.ai_quiz_require_approval,
      quizDifficulty: row.ai_quiz_difficulty,
      quizLanguage: row.ai_quiz_language,
      quizCount: row.ai_quiz_count,
      quizCustomInstructions: row.ai_quiz_custom_instructions,
      lastAiError: row.ai_last_error,
      lastAiErrorAt: row.ai_last_error_at,
    }
  }

  /** Records the most recent AI generation failure so the admin panel can surface it (e.g. quota reached). */
  async recordAiError(universityId: string, message: string): Promise<void> {
    await db('university_settings')
      .where({ university_id: universityId })
      .update({ ai_last_error: message, ai_last_error_at: db.fn.now() })
  }

  /** Clears the last-error banner after a successful generation. */
  async clearAiError(universityId: string): Promise<void> {
    await db('university_settings')
      .where({ university_id: universityId })
      .update({ ai_last_error: null, ai_last_error_at: null })
  }

  async updateConfig(universityId: string, input: LearningAdminConfigInput): Promise<LearningAdminConfig> {
    await this.ensureSettingsRow(universityId)

    const patch: Record<string, unknown> = { updated_at: db.fn.now() }
    if (input.enabled !== undefined) patch.ai_learning_enabled = input.enabled
    if (input.topics !== undefined) patch.ai_learning_topics = JSON.stringify(input.topics)
    if (input.difficulty !== undefined) patch.ai_learning_difficulty = input.difficulty
    if (input.language !== undefined) patch.ai_learning_language = input.language
    if (input.estimatedDays !== undefined) patch.ai_learning_est_days = input.estimatedDays
    if (input.customInstructions !== undefined) patch.ai_learning_custom_instructions = input.customInstructions
    if (input.genHour !== undefined) patch.ai_learning_gen_hour = input.genHour
    if (input.countPerRun !== undefined) patch.ai_learning_count_per_run = input.countPerRun
    if (input.quizEnabled !== undefined) patch.ai_quiz_enabled = input.quizEnabled
    if (input.quizRequireApproval !== undefined) patch.ai_quiz_require_approval = input.quizRequireApproval
    if (input.quizDifficulty !== undefined) patch.ai_quiz_difficulty = input.quizDifficulty
    if (input.quizLanguage !== undefined) patch.ai_quiz_language = input.quizLanguage
    if (input.quizCount !== undefined) patch.ai_quiz_count = input.quizCount
    if (input.quizCustomInstructions !== undefined) patch.ai_quiz_custom_instructions = input.quizCustomInstructions

    await db('university_settings').where({ university_id: universityId }).update(patch)
    return this.getConfig(universityId)
  }

  async listPendingPaths(universityId: string) {
    return db('skill_paths').where({ university_id: universityId, source: 'ai', is_published: false })
  }

  /** Full path + ordered units, for the admin review-before-publish preview. */
  async getPendingPathDetail(universityId: string, pathId: string) {
    const path = await db('skill_paths')
      .where({ id: pathId, university_id: universityId, source: 'ai', is_published: false })
      .first()
    if (!path) throw notFound()

    const units = await db('skill_path_units').where('path_id', pathId).orderBy('display_order', 'asc')
    return { ...path, units }
  }

  async approvePath(universityId: string, pathId: string): Promise<void> {
    const count = await db('skill_paths')
      .where({ id: pathId, university_id: universityId, source: 'ai', is_published: false })
      .update({ is_published: true })
    if (count === 0) throw notFound()
  }

  async discardPath(universityId: string, pathId: string): Promise<void> {
    const path = await db('skill_paths')
      .where({ id: pathId, university_id: universityId, source: 'ai', is_published: false })
      .first<{ id: string }>('id')
    if (!path) throw notFound()

    await db('skill_path_units').where({ path_id: pathId }).del()
    await db('skill_paths').where({ id: pathId }).del()
  }

  async listPendingQuizBatches(universityId: string) {
    const config = await this.getConfig(universityId)
    if (!config.quizRequireApproval) return []
    return db('ai_quiz_pool').where({ university_id: universityId }).whereNull('is_approved')
  }

  /** Full quiz batch including its generated questions, for the admin review-before-publish preview. */
  async getPendingQuizDetail(universityId: string, batchId: string) {
    const batch = await db('ai_quiz_pool')
      .where({ id: batchId, university_id: universityId })
      .whereNull('is_approved')
      .first()
    if (!batch) throw notFound()
    return batch
  }

  async approveQuizBatch(universityId: string, batchId: string): Promise<void> {
    const count = await db('ai_quiz_pool')
      .where({ id: batchId, university_id: universityId })
      .whereNull('is_approved')
      .update({ is_approved: true })
    if (count === 0) throw notFound()
  }

  async discardQuizBatch(universityId: string, batchId: string): Promise<void> {
    const count = await db('ai_quiz_pool')
      .where({ id: batchId, university_id: universityId })
      .whereNull('is_approved')
      .update({ is_approved: false })
    if (count === 0) throw notFound()
  }

  async triggerGenerateNow(universityId: string): Promise<void> {
    await aiContentQueue.add({ task: 'learning-gen', universityId })
    await aiContentQueue.add({ task: 'quiz-gen', universityId })
  }

  /**
   * Quiz slots are generated reactively (today only, per department) by the quiz worker —
   * there's no forward date-scheduled row to query for "next N days". So "upcoming" here
   * means: today's already-generated slots (with live attempt counts), plus the AI-generated
   * question pool sitting unconsumed per department — that pool is what tomorrow's/future
   * slots will be built from, so its per-department count is the closest honest signal of
   * what's queued for upcoming days.
   */
  async getUpcomingQuizzes(universityId: string) {
    const [todaySlots, pooled] = await Promise.all([
      db('daily_quiz_slots as s')
        .where('s.university_id', universityId)
        .whereRaw('s.date = CURRENT_DATE')
        .leftJoin('daily_quiz_attempts as a', 'a.slot_id', 's.id')
        .groupBy('s.id', 's.department', 's.date')
        .select<{ id: string; department: string; date: string; attemptCount: string }[]>(
          's.id',
          's.department',
          's.date',
          db.raw('count(a.id) as "attemptCount"'),
        ),
      // Queued = not yet consumed into a slot, and not explicitly discarded (is_approved false).
      db('ai_quiz_pool')
        .where({ university_id: universityId })
        .whereNull('consumed_at')
        .where((qb) => qb.whereNull('is_approved').orWhere('is_approved', true))
        .groupBy('department')
        .select<{ department: string; queuedBatches: string }[]>('department', db.raw('count(*) as "queuedBatches"')),
    ])

    return {
      today: todaySlots.map((row) => ({
        department: row.department,
        date: row.date,
        attemptCount: Number(row.attemptCount),
      })),
      queuedByDepartment: pooled.map((row) => ({
        department: row.department,
        queuedBatches: Number(row.queuedBatches),
      })),
    }
  }

  /** Lists every learning path for a university (published and draft) with per-path enrollment/completion aggregates. */
  async listAdminPaths(universityId: string, query: AdminListPathsQuery): Promise<AdminLearningPath[]> {
    let base = db('skill_paths as p')
      .where('p.university_id', universityId)
      .leftJoin('skill_path_units as u', 'u.path_id', 'p.id')
      .leftJoin('skill_path_enrollments as e', 'e.path_id', 'p.id')
      .leftJoin('unit_completions as c', 'c.path_id', 'p.id')

    if (query.status === 'published') base = base.where('p.is_published', true)
    if (query.status === 'draft') base = base.where('p.is_published', false)
    if (query.category) base = base.where('p.category', query.category)

    const rows = await base
      .groupBy('p.id')
      .orderBy('p.updated_at', 'desc')
      .select<
        {
          id: string
          title: string
          description: string | null
          department: string | null
          category: string
          difficulty: 'beginner' | 'intermediate' | 'advanced'
          estimated_days: number
          is_published: boolean
          source: 'manual' | 'ai'
          updated_at: string
          unitCount: string
          enrolledCount: string
          completedCount: string
        }[]
      >(
        'p.id', 'p.title', 'p.description', 'p.department', 'p.category', 'p.difficulty',
        'p.estimated_days', 'p.is_published', 'p.source', 'p.updated_at',
        db.raw('count(distinct u.id) as "unitCount"'),
        db.raw("count(distinct e.id) filter (where e.status in ('active','completed')) as \"enrolledCount\""),
        db.raw('count(distinct c.id) as "completedCount"'),
      )

    return rows.map((row) => {
      const unitCount = Number(row.unitCount)
      const enrolledCount = Number(row.enrolledCount)
      const completedCount = Number(row.completedCount)
      // Avg completion = share of (enrollment × unit) pairs actually completed —
      // matches the mockup's "NN% avg completion" per path.
      const possible = unitCount * enrolledCount
      return {
        id: row.id,
        title: row.title,
        description: row.description,
        department: row.department,
        category: row.category,
        difficulty: row.difficulty,
        estimatedDays: row.estimated_days,
        isPublished: row.is_published,
        source: row.source,
        unitCount,
        enrolledCount,
        completedCount,
        completionRate: possible > 0 ? completedCount / possible : 0,
        updatedAt: row.updated_at,
      }
    })
  }

  /** Transactionally inserts a manual, unpublished path plus its ordered units. */
  async createPath(universityId: string, input: CreateLearningPathBody): Promise<AdminLearningPath> {
    const pathId = await db.transaction(async (trx) => {
      const [path] = await trx('skill_paths')
        .insert({
          university_id: universityId,
          title: input.title,
          description: input.description ?? null,
          department: input.department ?? null,
          category: input.category,
          difficulty: input.difficulty,
          estimated_days: input.estimatedDays,
          is_published: false,
          source: 'manual',
        })
        .returning<{ id: string }[]>('id')

      await trx('skill_path_units').insert(
        input.units.map((u, i) => ({
          path_id: path.id,
          display_order: i + 1,
          title: u.title,
          type: u.type,
          content: JSON.stringify(u.content),
          completion_rule: JSON.stringify(u.completionRule ?? {}),
        })),
      )

      return path.id
    })

    const rows = await this.listAdminPaths(universityId, { status: 'all' })
    const created = rows.find((r) => r.id === pathId)
    if (!created) throw notFound()
    return created
  }

  /** Participation + outcome analytics for learning paths and daily quizzes, last `days`. */
  async getAnalytics(universityId: string, days: number) {
    const [pathStats, quizStats] = await Promise.all([
      db('skill_paths as p')
        .where('p.university_id', universityId)
        .where('p.is_published', true)
        .leftJoin('skill_path_units as u', 'u.path_id', 'p.id')
        .leftJoin('skill_path_enrollments as e', 'e.path_id', 'p.id')
        .leftJoin('unit_completions as c', function () {
          this.on('c.path_id', '=', 'p.id').andOn('c.completed_at', '>=', db.raw(`now() - interval '${days} days'`))
        })
        .groupBy('p.id', 'p.title')
        .select<
          { id: string; title: string; unitCount: string; enrolledCount: string; completedCount: string; avgScore: string | null }[]
        >(
          'p.id',
          'p.title',
          db.raw('count(distinct u.id) as "unitCount"'),
          db.raw('count(distinct e.id) as "enrolledCount"'),
          db.raw("count(distinct e.id) filter (where e.status = 'completed') as \"completedCount\""),
          db.raw('avg(c.score) as "avgScore"'),
        ),
      db('daily_quiz_slots as s')
        .where('s.university_id', universityId)
        .where('s.date', '>=', db.raw(`CURRENT_DATE - interval '${days} days'`))
        .join('daily_quiz_attempts as a', 'a.slot_id', 's.id')
        .groupBy('s.department')
        .select<{ department: string; attemptCount: string; avgScore: string; passCount: string }[]>(
          's.department',
          db.raw('count(a.id) as "attemptCount"'),
          db.raw('avg(a.score) as "avgScore"'),
          db.raw("count(*) filter (where a.correct_count::float / nullif(a.total_questions, 0) >= 0.6) as \"passCount\""),
        ),
    ])

    return {
      windowDays: days,
      paths: pathStats.map((row) => ({
        pathId: row.id,
        title: row.title,
        unitCount: Number(row.unitCount),
        enrolledCount: Number(row.enrolledCount),
        completedCount: Number(row.completedCount),
        completionRate: Number(row.enrolledCount) > 0 ? Number(row.completedCount) / Number(row.enrolledCount) : 0,
        avgUnitScore: row.avgScore !== null ? Number(row.avgScore) : null,
      })),
      quizzes: quizStats.map((row) => ({
        department: row.department,
        attemptCount: Number(row.attemptCount),
        avgScore: Number(row.avgScore),
        passRate: Number(row.attemptCount) > 0 ? Number(row.passCount) / Number(row.attemptCount) : 0,
      })),
    }
  }

  /** Ensures a university_settings row exists; returns the AI-learning columns. */
  private async ensureSettingsRow(universityId: string): Promise<SettingsRow> {
    const existing = await db('university_settings')
      .where({ university_id: universityId })
      .first<SettingsRow>(
        'ai_learning_enabled',
        'ai_learning_topics',
        'ai_learning_difficulty',
        'ai_learning_language',
        'ai_learning_est_days',
        'ai_learning_custom_instructions',
        'ai_learning_gen_hour',
        'ai_learning_count_per_run',
        'ai_quiz_enabled',
        'ai_quiz_require_approval',
        'ai_quiz_difficulty',
        'ai_quiz_language',
        'ai_quiz_count',
        'ai_quiz_custom_instructions',
        'ai_last_error',
        'ai_last_error_at',
      )
    if (existing) return existing

    await db('university_settings').insert({ university_id: universityId }).onConflict('university_id').ignore()

    return {
      ai_learning_enabled: false,
      ai_learning_topics: [],
      ai_learning_difficulty: 'intermediate',
      ai_learning_language: 'en',
      ai_learning_est_days: 7,
      ai_learning_custom_instructions: null,
      ai_learning_gen_hour: 2,
      ai_learning_count_per_run: 1,
      ai_quiz_enabled: false,
      ai_quiz_require_approval: false,
      ai_quiz_difficulty: 'intermediate',
      ai_quiz_language: 'en',
      ai_quiz_count: 5,
      ai_quiz_custom_instructions: null,
      ai_last_error: null,
      ai_last_error_at: null,
    }
  }
}

export const learningAdminService = new LearningAdminService()
