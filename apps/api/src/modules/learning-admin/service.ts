import { db } from '../../config/db'
import { notFound } from '../../utils/errors'
import { aiContentQueue } from '../../queues/ai-content.queue'
import type { LearningAdminConfigInput } from './schema'

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
  quizRequireApproval: boolean
}

interface SettingsRow {
  ai_learning_enabled: boolean
  ai_learning_topics: LearningTopic[]
  ai_learning_difficulty: string
  ai_learning_language: string
  ai_learning_est_days: number
  ai_learning_custom_instructions: string | null
  ai_learning_gen_hour: number
  ai_learning_count_per_run: number
  ai_quiz_require_approval: boolean
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
      quizRequireApproval: row.ai_quiz_require_approval,
    }
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
    if (input.quizRequireApproval !== undefined) patch.ai_quiz_require_approval = input.quizRequireApproval

    await db('university_settings').where({ university_id: universityId }).update(patch)
    return this.getConfig(universityId)
  }

  async listPendingPaths(universityId: string) {
    return db('skill_paths').where({ university_id: universityId, source: 'ai', is_published: false })
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
        'ai_quiz_require_approval',
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
      ai_quiz_require_approval: false,
    }
  }
}

export const learningAdminService = new LearningAdminService()
