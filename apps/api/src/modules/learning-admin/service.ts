import { db } from '../../config/db'
import { badRequest, notFound } from '../../utils/errors'
import { aiContentQueue } from '../../queues/ai-content.queue'
import type {
  LearningAdminConfigInput,
  AdminListPathsQuery,
  CreateLearningPathBody,
  UpdateLearningPathBody,
  CreatePathUnitBody,
  UpdatePathUnitBody,
  DraftPathWithAiBody,
  GenerateQuizWithAiBody,
} from './schema'
import type { AdminLearningPath, AdminLearningPathUnit, AdminQuiz, AiPathDraft } from '@uniconnect/shared'
import { generateQuizQuestions, generateSkillPath } from '../../services/ai.service'

/** Pass threshold applied to every quiz the admin screen reports on — matches the
 *  0.6 ratio `getAnalytics` uses for daily-quiz pass rate. */
const QUIZ_PASS_MARK = 60

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

  async triggerGenerateNow(universityId: string, task: 'learning' | 'quiz' | 'both' = 'both'): Promise<void> {
    if (task === 'learning' || task === 'both') {
      await aiContentQueue.add({ task: 'learning-gen', universityId })
    }
    if (task === 'quiz' || task === 'both') {
      await aiContentQueue.add({ task: 'quiz-gen', universityId })
    }
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

  /**
   * Synchronous AI draft for the path builder. Nothing is written — the admin reviews the
   * units in the builder and saves/publishes from there, which is what turns it into a row.
   */
  async draftPathWithAi(input: DraftPathWithAiBody): Promise<AiPathDraft> {
    const path = await generateSkillPath({
      category: input.topic,
      difficulty: input.difficulty,
      unitCount: input.unitCount,
      includeCheckpointQuizzes: input.includeCheckpointQuizzes,
      customInstructions: input.department ? `The audience is the "${input.department}" department.` : undefined,
    })
    const difficulty = (['beginner', 'intermediate', 'advanced'] as const).includes(path.difficulty)
      ? path.difficulty
      : input.difficulty
    return {
      title: path.title,
      description: path.description,
      difficulty,
      units: (path.units ?? []).map((u) => ({
        title: u.title,
        type: u.type === 'quiz' ? 'quiz' : u.type === 'video' ? 'video' : u.type === 'exercise' ? 'exercise' : 'read',
        content: u.content ?? {},
        estimatedMinutes: Number(u.estimatedMinutes) || 10,
        ...(u.type === 'quiz' ? { completionRule: { passScore: QUIZ_PASS_MARK } } : {}),
      })),
    }
  }

  /** Generates a checkpoint quiz from a path's existing units and appends it as a quiz unit. */
  async generateQuizWithAi(universityId: string, input: GenerateQuizWithAiBody): Promise<{ unitId: string }> {
    const path = await db('skill_paths')
      .where({ id: input.pathId, university_id: universityId })
      .first<{ id: string; title: string; department: string | null; category: string }>('id', 'title', 'department', 'category')
    if (!path) throw notFound('Learning path not found')

    const units = await db('skill_path_units')
      .where({ path_id: path.id })
      .orderBy('display_order', 'asc')
      .select<{ title: string; type: string; display_order: number }[]>('title', 'type', 'display_order')

    const questions = await generateQuizQuestions({
      department: path.department ?? path.category,
      count: input.count,
      style: input.style,
      difficulty: input.difficulty,
      topic: `${path.title}: ${units.filter((u) => u.type !== 'quiz').map((u) => u.title).join(', ')}`,
    })
    if (!Array.isArray(questions) || questions.length === 0) throw badRequest('AI returned no questions')

    const nextOrder = units.reduce((max, u) => Math.max(max, u.display_order), 0) + 1
    const [unit] = await db('skill_path_units')
      .insert({
        path_id: path.id,
        display_order: nextOrder,
        title: `${path.title} checkpoint`,
        type: 'quiz',
        content: JSON.stringify({ questions }),
        completion_rule: JSON.stringify({ passScore: QUIZ_PASS_MARK }),
      })
      .returning<{ id: string }[]>('id')
    await db('skill_paths').where({ id: path.id }).update({ updated_at: db.fn.now() })
    return { unitId: unit.id }
  }

  /**
   * The Quizzes tab is one list over three sources: quiz units inside learning paths
   * (draft/published with the path), unconsumed AI batches in the daily-quiz pool
   * (needs review / scheduled), and recent daily-quiz slots (published, with attempts).
   */
  async listAdminQuizzes(universityId: string): Promise<AdminQuiz[]> {
    const [config, unitRows, poolRows, slotRows] = await Promise.all([
      this.getConfig(universityId),
      db('skill_path_units as u')
        .join('skill_paths as p', 'p.id', 'u.path_id')
        .leftJoin('unit_completions as c', 'c.unit_id', 'u.id')
        .where('p.university_id', universityId)
        .where('u.type', 'quiz')
        .groupBy('u.id', 'p.id')
        .orderBy('u.updated_at', 'desc')
        .select<
          {
            id: string; title: string; pathId: string; pathTitle: string; isPublished: boolean
            source: 'manual' | 'ai'; updatedAt: string; questionCount: string; passMark: string | null
            attempts: string; avgScore: string | null
          }[]
        >(
          'u.id',
          'u.title',
          'p.id as pathId',
          'p.title as pathTitle',
          'p.is_published as isPublished',
          'p.source',
          'u.updated_at as updatedAt',
          db.raw(`jsonb_array_length(coalesce(u.content->'questions', '[]'::jsonb)) as "questionCount"`),
          db.raw(`u.completion_rule->>'passScore' as "passMark"`),
          db.raw('count(c.id) as "attempts"'),
          db.raw('avg(c.score) as "avgScore"'),
        ),
      db('ai_quiz_pool')
        .where({ university_id: universityId })
        .whereNull('consumed_at')
        .where((qb) => qb.whereNull('is_approved').orWhere('is_approved', true))
        .orderBy('generated_at', 'desc')
        .select<{ id: string; department: string; generated_at: string; is_approved: boolean | null; questionCount: string }[]>(
          'id',
          'department',
          'generated_at',
          'is_approved',
          db.raw('jsonb_array_length(questions) as "questionCount"'),
        ),
      db('daily_quiz_slots as s')
        .leftJoin('daily_quiz_attempts as a', 'a.slot_id', 's.id')
        .where('s.university_id', universityId)
        .where('s.date', '>=', db.raw("CURRENT_DATE - interval '14 days'"))
        .groupBy('s.id')
        .orderBy('s.date', 'desc')
        .select<{ id: string; department: string; date: string; created_at: string; questionCount: string; attempts: string; avgScore: string | null }[]>(
          's.id',
          's.department',
          's.date',
          's.created_at',
          db.raw('jsonb_array_length(s.questions) as "questionCount"'),
          db.raw('count(a.id) as "attempts"'),
          db.raw('avg(a.score) as "avgScore"'),
        ),
    ])

    const fromUnits: AdminQuiz[] = unitRows.map((r) => ({
      id: r.id,
      kind: 'path_unit',
      title: r.title,
      pathId: r.pathId,
      pathTitle: r.pathTitle,
      questionCount: Number(r.questionCount),
      passMark: r.passMark !== null ? Number(r.passMark) : QUIZ_PASS_MARK,
      attempts: Number(r.attempts),
      avgScore: r.avgScore !== null ? Math.round(Number(r.avgScore)) : null,
      status: r.isPublished ? 'published' : 'draft',
      source: r.source === 'ai' ? 'ai' : 'staff',
      updatedAt: r.updatedAt,
    }))

    const fromPool: AdminQuiz[] = poolRows.map((r) => ({
      id: r.id,
      kind: 'ai_batch',
      title: `${r.department} question batch`,
      pathId: null,
      pathTitle: 'Daily quiz pool',
      questionCount: Number(r.questionCount),
      passMark: QUIZ_PASS_MARK,
      attempts: 0,
      avgScore: null,
      // Without an approval gate a null batch is consumed as-is, so it is effectively scheduled.
      status: r.is_approved === null && config.quizRequireApproval ? 'needs_review' : 'scheduled',
      source: 'ai',
      updatedAt: r.generated_at,
    }))

    const fromSlots: AdminQuiz[] = slotRows.map((r) => ({
      id: r.id,
      kind: 'daily_slot',
      title: `${r.department} daily quiz`,
      pathId: null,
      pathTitle: `Daily quiz · ${r.date}`,
      questionCount: Number(r.questionCount),
      passMark: QUIZ_PASS_MARK,
      attempts: Number(r.attempts),
      avgScore: r.avgScore !== null ? Math.round(Number(r.avgScore)) : null,
      status: 'published',
      source: 'ai',
      updatedAt: r.created_at,
    }))

    return [...fromUnits, ...fromPool, ...fromSlots].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
  }

  /** Questions behind one Quizzes-tab row, whichever table it came from. */
  async getAdminQuizQuestions(universityId: string, kind: AdminQuiz['kind'], id: string): Promise<{ questions: unknown[] }> {
    if (kind === 'path_unit') {
      const row = await db('skill_path_units as u')
        .join('skill_paths as p', 'p.id', 'u.path_id')
        .where({ 'u.id': id, 'p.university_id': universityId, 'u.type': 'quiz' })
        .first<{ content: { questions?: unknown[] } | null }>('u.content')
      if (!row) throw notFound()
      return { questions: row.content?.questions ?? [] }
    }
    const table = kind === 'ai_batch' ? 'ai_quiz_pool' : 'daily_quiz_slots'
    const row = await db(table).where({ id, university_id: universityId }).first<{ questions: unknown[] }>('questions')
    if (!row) throw notFound()
    return { questions: row.questions ?? [] }
  }

  private async findOwnedPath(universityId: string, pathId: string): Promise<void> {
    const path = await db('skill_paths').where({ id: pathId, university_id: universityId }).first('id')
    if (!path) throw notFound('Learning path not found')
  }

  async updatePath(universityId: string, pathId: string, patch: UpdateLearningPathBody): Promise<AdminLearningPath> {
    await this.findOwnedPath(universityId, pathId)
    const columnPatch: Record<string, unknown> = { updated_at: db.fn.now() }
    if (patch.title !== undefined) columnPatch.title = patch.title
    if (patch.description !== undefined) columnPatch.description = patch.description
    if (patch.department !== undefined) columnPatch.department = patch.department
    if (patch.category !== undefined) columnPatch.category = patch.category
    if (patch.difficulty !== undefined) columnPatch.difficulty = patch.difficulty
    if (patch.estimatedDays !== undefined) columnPatch.estimated_days = patch.estimatedDays

    await db('skill_paths').where({ id: pathId }).update(columnPatch)
    const [updated] = await this.listAdminPaths(universityId, { status: 'all' }).then((rows) =>
      rows.filter((r) => r.id === pathId),
    )
    return updated
  }

  async setPathPublished(universityId: string, pathId: string, isPublished: boolean): Promise<AdminLearningPath> {
    await this.findOwnedPath(universityId, pathId)
    await db('skill_paths').where({ id: pathId }).update({ is_published: isPublished, updated_at: db.fn.now() })
    const [updated] = await this.listAdminPaths(universityId, { status: 'all' }).then((rows) =>
      rows.filter((r) => r.id === pathId),
    )
    return updated
  }

  /** Full path + ordered units, for the Manage page's initial load (Task 10). */
  async getPathDetail(universityId: string, pathId: string): Promise<AdminLearningPath & { units: AdminLearningPathUnit[] }> {
    const [path] = await this.listAdminPaths(universityId, { status: 'all' }).then((rows) =>
      rows.filter((r) => r.id === pathId),
    )
    if (!path) throw notFound('Learning path not found')

    const units = await db('skill_path_units')
      .where({ path_id: pathId })
      .orderBy('display_order', 'asc')
      .select<{ id: string; display_order: number; title: string; type: AdminLearningPathUnit['type']; content: unknown; completion_rule: unknown }[]>(
        'id', 'display_order', 'title', 'type', 'content', 'completion_rule',
      )

    return {
      ...path,
      units: units.map((u) => ({
        id: u.id,
        displayOrder: u.display_order,
        title: u.title,
        type: u.type,
        content: u.content as AdminLearningPathUnit['content'],
        completionRule: u.completion_rule as AdminLearningPathUnit['completionRule'],
      })),
    }
  }

  async createUnit(universityId: string, pathId: string, input: CreatePathUnitBody): Promise<void> {
    await this.findOwnedPath(universityId, pathId)
    const [{ maxOrder }] = await db('skill_path_units')
      .where({ path_id: pathId })
      .max('display_order as maxOrder')
    await db('skill_path_units').insert({
      path_id: pathId,
      display_order: Number(maxOrder ?? 0) + 1,
      title: input.title,
      type: input.type,
      content: JSON.stringify(input.content),
      completion_rule: JSON.stringify(input.completionRule ?? {}),
    })
    await db('skill_paths').where({ id: pathId }).update({ updated_at: db.fn.now() })
  }

  async updateUnit(universityId: string, pathId: string, unitId: string, patch: UpdatePathUnitBody): Promise<void> {
    await this.findOwnedPath(universityId, pathId)
    const columnPatch: Record<string, unknown> = {}
    if (patch.title !== undefined) columnPatch.title = patch.title
    if (patch.type !== undefined) columnPatch.type = patch.type
    if (patch.content !== undefined) columnPatch.content = JSON.stringify(patch.content)
    if (patch.completionRule !== undefined) columnPatch.completion_rule = JSON.stringify(patch.completionRule)

    const updated = await db('skill_path_units').where({ id: unitId, path_id: pathId }).update(columnPatch)
    if (updated === 0) throw notFound('Unit not found')
    await db('skill_paths').where({ id: pathId }).update({ updated_at: db.fn.now() })
  }

  async deleteUnit(universityId: string, pathId: string, unitId: string): Promise<void> {
    await this.findOwnedPath(universityId, pathId)
    const deleted = await db('skill_path_units').where({ id: unitId, path_id: pathId }).delete()
    if (deleted === 0) throw notFound('Unit not found')
    await db('skill_paths').where({ id: pathId }).update({ updated_at: db.fn.now() })
  }

  async reorderUnits(universityId: string, pathId: string, unitIds: string[]): Promise<void> {
    await this.findOwnedPath(universityId, pathId)

    // The two-phase staged update below is only collision-safe for a complete reorder:
    // a partial submission (omitting a unit) can still collide with an untouched unit's
    // display_order in phase 2, violating the (path_id, display_order) unique constraint.
    const existingUnits = await db('skill_path_units').where({ path_id: pathId }).select<{ id: string }[]>('id')
    const existingIds = new Set(existingUnits.map((u) => u.id))
    const submittedIds = new Set(unitIds)
    const sameSet =
      existingIds.size === submittedIds.size && [...existingIds].every((id) => submittedIds.has(id))
    if (!sameSet) {
      throw badRequest('unitIds must include every unit in the path exactly once')
    }

    await db.transaction(async (trx) => {
      // Two-phase update: `skill_path_units` has a unique (path_id, display_order)
      // constraint, so writing final positions in a single pass can collide mid-loop
      // (e.g. moving unit B into slot 1 while unit A still occupies it). Stage every
      // row onto a negative, collision-free offset first, then assign final positions.
      for (let i = 0; i < unitIds.length; i++) {
        const staged = await trx('skill_path_units')
          .where({ id: unitIds[i], path_id: pathId })
          .update({ display_order: -(i + 1) })
        if (staged === 0) throw notFound('Unit not found')
      }
      for (let i = 0; i < unitIds.length; i++) {
        await trx('skill_path_units')
          .where({ id: unitIds[i], path_id: pathId })
          .update({ display_order: i + 1 })
      }
    })
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
