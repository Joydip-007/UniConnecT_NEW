import type { ContentSyncConfig, ContentSyncConfigInput } from '@uniconnect/shared'
import { db } from '../../config/db'
import { contentSyncQueue } from '../../queues/content-sync.queue'
import { badRequest, conflict, notFound } from '../../utils/errors'

interface SettingsRow {
  content_sync_news_url: string | null
  content_sync_notice_url: string | null
  content_sync_event_url: string | null
  content_sync_enabled: boolean
}

interface RunRow {
  id: string
  status: 'running' | 'success' | 'failed'
  items_found: number
  items_new: number
  error: string | null
  started_at: Date
  finished_at: Date | null
}

export class ContentSyncService {
  /** Returns the tenant config, creating a settings row on first read if absent. */
  async getConfig(universityId: string): Promise<ContentSyncConfig> {
    const row = await this.ensureSettingsRow(universityId)
    return {
      newsUrl: row.content_sync_news_url,
      noticeUrl: row.content_sync_notice_url,
      eventUrl: row.content_sync_event_url,
      enabled: row.content_sync_enabled,
    }
  }

  async updateConfig(universityId: string, input: ContentSyncConfigInput): Promise<ContentSyncConfig> {
    await this.ensureSettingsRow(universityId)

    const patch: Record<string, unknown> = { updated_at: db.fn.now() }
    if (input.newsUrl !== undefined) patch.content_sync_news_url = input.newsUrl
    if (input.noticeUrl !== undefined) patch.content_sync_notice_url = input.noticeUrl
    if (input.eventUrl !== undefined) patch.content_sync_event_url = input.eventUrl
    if (input.enabled !== undefined) patch.content_sync_enabled = input.enabled

    await db('university_settings').where({ university_id: universityId }).update(patch)
    return this.getConfig(universityId)
  }

  /** Enqueues a sync run. Throws 409 if one is already running, 400 if not enabled/configured. */
  async triggerRun(universityId: string, triggeredBy: string): Promise<{ runId: string }> {
    const config = await this.getConfig(universityId)

    if (!config.enabled) {
      throw badRequest('Content sync is disabled for this university', 'CONTENT_SYNC_DISABLED')
    }
    if (!config.newsUrl && !config.noticeUrl && !config.eventUrl) {
      throw badRequest('Configure at least one source URL before syncing', 'CONTENT_SYNC_NO_SOURCES')
    }

    const running = await db('content_sync_runs')
      .where({ university_id: universityId, status: 'running' })
      .first<{ id: string }>('id')
    if (running) {
      throw conflict('A sync is already running for this university', 'CONTENT_SYNC_RUNNING')
    }

    // No Skyvern precondition: WordPress tenants fetch via the free REST API.
    // The worker falls back to Skyvern per-source only when a site isn't WordPress.

    const [run] = await db('content_sync_runs')
      .insert({ university_id: universityId, triggered_by: triggeredBy, status: 'running' })
      .returning<{ id: string }[]>('id')

    if (!run) throw notFound('Failed to create sync run', 'CONTENT_SYNC_RUN_NOT_CREATED')

    await contentSyncQueue.add({
      kind: 'sync-run',
      universityId,
      runId: run.id,
      triggeredBy,
    })

    return { runId: run.id }
  }

  /**
   * Imported drafts awaiting admin review. Imported items are authored by the campus bot,
   * so they never appear in any author's "Drafts" view — this is the admin review queue.
   */
  async listPendingImported(universityId: string) {
    const [news, events] = await Promise.all([
      db('news')
        .where({ university_id: universityId, is_imported: true, is_published: false })
        .orderBy('created_at', 'desc')
        .select<{ id: string; title: string; category: string; created_at: Date }[]>(
          'id',
          'title',
          'category',
          'created_at',
        ),
      db('events')
        .where({ university_id: universityId, is_imported: true, is_published: false })
        .orderBy('created_at', 'desc')
        .select<{ id: string; title: string; starts_at: Date; created_at: Date }[]>(
          'id',
          'title',
          'starts_at',
          'created_at',
        ),
    ])

    return {
      news: news.map((n) => ({ id: n.id, title: n.title, category: n.category, createdAt: n.created_at })),
      events: events.map((e) => ({ id: e.id, title: e.title, startsAt: e.starts_at, createdAt: e.created_at })),
    }
  }

  async listRuns(universityId: string, page: number, limit: number) {
    const [{ count }] = await db('content_sync_runs')
      .where({ university_id: universityId })
      .count<{ count: string }[]>({ count: '*' })

    const rows = (await db('content_sync_runs')
      .where({ university_id: universityId })
      .orderBy('started_at', 'desc')
      .limit(limit)
      .offset((page - 1) * limit)) as RunRow[]

    return {
      items: rows.map(toRun),
      total: Number(count),
      page,
      limit,
    }
  }

  /** Ensures a university_settings row exists; returns the content-sync columns. */
  async ensureSettingsRow(universityId: string): Promise<SettingsRow> {
    const existing = await db('university_settings')
      .where({ university_id: universityId })
      .first<SettingsRow>(
        'content_sync_news_url',
        'content_sync_notice_url',
        'content_sync_event_url',
        'content_sync_enabled',
      )
    if (existing) return existing

    await db('university_settings')
      .insert({ university_id: universityId })
      .onConflict('university_id')
      .ignore()

    return {
      content_sync_news_url: null,
      content_sync_notice_url: null,
      content_sync_event_url: null,
      content_sync_enabled: false,
    }
  }

  /**
   * Returns the "Campus Feed" bot user id for a university, creating it if missing.
   * Used by the worker as the author of all imported content.
   */
  async ensureCampusBotUser(universityId: string): Promise<string> {
    const university = await db('universities')
      .where({ id: universityId })
      .first<{ domain: string }>('domain')
    if (!university) throw notFound('University not found', 'UNIVERSITY_NOT_FOUND')

    const email = `campus-bot@${university.domain}`
    const existing = await db('users').where({ email }).first<{ id: string }>('id')
    if (existing) return existing.id

    const [user] = await db('users')
      .insert({
        university_id: universityId,
        email,
        password_hash: null,
        role: 'faculty',
        is_verified: true,
        is_active: true,
      })
      .returning<{ id: string }[]>('id')

    if (!user) throw notFound('Failed to create campus bot user', 'CAMPUS_BOT_NOT_CREATED')

    await db('profiles').insert({
      user_id: user.id,
      full_name: 'Campus Feed',
      headline: 'Automated campus news & notices',
    })

    return user.id
  }
}

export const contentSyncService = new ContentSyncService()

function toRun(row: RunRow) {
  return {
    id: row.id,
    status: row.status,
    itemsFound: row.items_found,
    itemsNew: row.items_new,
    error: row.error,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  }
}
