import { PutObjectCommand } from '@aws-sdk/client-s3'
import {
  CONTENT_SYNC_EVENTS,
  EVENT_SUB_CATEGORIES,
  skyvernItemSchema,
  type ContentSyncSource,
  type SkyvernItem,
} from '@uniconnect/shared'
import { db } from '../config/db'
import { contentSyncQueue, type ContentSyncJob } from '../queues/content-sync.queue'
import { notificationQueue } from '../queues/notification.queue'
import { contentSyncService } from '../modules/content-sync'
import { fetchContentItems, fetchWordPressItemByUrl } from '../services/content-source.service'
import { buildPublicUrl, createUploadKey, s3Client, sanitizeFileName } from '../services/upload.service'
import { env } from '../config/env'
import { getIo } from '../socket'
import { logger } from '../utils/logger'

const UNIQUE_VIOLATION = '23505'

contentSyncQueue.process(3, async (job) => {
  const data = job.data
  if (data.kind === 'sync-run') return runSync(data)
  if (data.kind === 'attachment-download') return downloadAttachment(data)
  if (data.kind === 'attachment-backfill') return backfillAttachments(data)
})

contentSyncQueue.on('failed', (job, error) => {
  logger.error('Content-sync queue job failed', { jobId: job?.id, kind: job?.data?.kind, error })
})

// ---------------------------------------------------------------------------
// sync-run
// ---------------------------------------------------------------------------

async function runSync(job: Extract<ContentSyncJob, { kind: 'sync-run' }>) {
  const { universityId, runId, triggeredBy } = job
  logger.info('Content sync started', { universityId, runId })

  try {
    const config = await contentSyncService.getConfig(universityId)
    const botUserId = await contentSyncService.ensureCampusBotUser(universityId)
    const importedByUrl = await loadImportedEntitiesBySourceUrl(universityId)

    const grouped = await fetchContentItems(config, [...importedByUrl.keys()], {
      perSourceOverride: job.entriesPerSource,
    })
    let itemsFound = 0
    let itemsNew = 0

    for (const source of ['news', 'notice', 'event'] as ContentSyncSource[]) {
      for (const raw of grouped[source]) {
        const parsed = skyvernItemSchema.safeParse(raw)
        if (!parsed.success) {
          logger.warn('Skipping malformed scraped item', { source, issues: parsed.error.issues })
          continue
        }
        itemsFound += 1

        // Already imported: don't re-insert, but heal any attachments missing from this item
        // (idempotent). Covers items imported before they had files, or edited upstream later.
        const known = importedByUrl.get(parsed.data.sourceUrl)
        if (known) {
          await enqueueAttachments(universityId, known.entityType, known.entityId, parsed.data)
          continue
        }

        const inserted =
          source === 'event'
            ? await insertImportedEvent(universityId, botUserId, parsed.data)
            : await insertImportedNews(universityId, botUserId, source, parsed.data)

        if (inserted) {
          itemsNew += 1
          await enqueueAttachments(universityId, inserted.entityType, inserted.id, parsed.data)
        }
      }
    }

    await db('content_sync_runs').where({ id: runId }).update({
      status: 'success',
      items_found: itemsFound,
      items_new: itemsNew,
      finished_at: db.fn.now(),
    })

    notifyComplete(universityId, triggeredBy, runId, 'success', itemsNew)
    logger.info('Content sync finished', { universityId, runId, itemsFound, itemsNew })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await db('content_sync_runs').where({ id: runId }).update({
      status: 'failed',
      error: message,
      finished_at: db.fn.now(),
    })
    notifyComplete(universityId, triggeredBy, runId, 'failed', 0)
    logger.error('Content sync failed', { universityId, runId, error: message })
    throw error
  }
}

// ---------------------------------------------------------------------------
// attachment-backfill
// ---------------------------------------------------------------------------

/**
 * Heals attachments for already-imported news/events that `runSync` can never reach
 * again — entries that have scrolled past the source's recency window so they no
 * longer appear in a normal (or even backfill-widened) listing scrape. Looks each
 * one up directly by its own source URL via WordPress's `?slug=` endpoint, independent
 * of feed position. Also retries any attachment stuck in `failed` from a prior download.
 */
async function backfillAttachments(job: Extract<ContentSyncJob, { kind: 'attachment-backfill' }>) {
  const { universityId } = job
  const config = await contentSyncService.getConfig(universityId)

  const [newsRows, eventRows] = await Promise.all([
    db('news')
      .where({ university_id: universityId, is_imported: true })
      .whereNotNull('source_url')
      .select<{ id: string; source_url: string; category: string }[]>('id', 'source_url', 'category'),
    db('events')
      .where({ university_id: universityId, is_imported: true })
      .whereNotNull('source_url')
      .select<{ id: string; source_url: string }[]>('id', 'source_url'),
  ])

  const doneEntityIds = new Set(
    await db('content_attachments')
      .where({ university_id: universityId, download_status: 'done' })
      .pluck<string[]>('entity_id'),
  )

  let healed = 0
  for (const row of newsRows) {
    if (doneEntityIds.has(row.id)) continue
    const isNotice = row.category === 'notice'
    const listUrl = isNotice ? config.noticeUrl : config.newsUrl
    if (!listUrl) continue
    const raw = await fetchWordPressItemByUrl(isNotice ? 'notice' : 'news', listUrl, row.source_url)
    const parsed = raw && skyvernItemSchema.safeParse(raw)
    if (parsed && parsed.success && parsed.data.attachments.length > 0) {
      await enqueueAttachments(universityId, 'news', row.id, parsed.data)
      healed += 1
    }
  }
  for (const row of eventRows) {
    if (doneEntityIds.has(row.id)) continue
    if (!config.eventUrl) continue
    const raw = await fetchWordPressItemByUrl('event', config.eventUrl, row.source_url)
    const parsed = raw && skyvernItemSchema.safeParse(raw)
    if (parsed && parsed.success && parsed.data.attachments.length > 0) {
      await enqueueAttachments(universityId, 'event', row.id, parsed.data)
      healed += 1
    }
  }

  // Retry attachments that failed to download previously (e.g. transient fetch/S3 error).
  const failed = await db('content_attachments')
    .where({ university_id: universityId, download_status: 'failed' })
    .select<{ id: string }[]>('id')
  for (const row of failed) {
    await db('content_attachments').where({ id: row.id }).update({ download_status: 'pending' })
    await contentSyncQueue.add(
      { kind: 'attachment-download', attachmentId: row.id, universityId },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    )
  }

  logger.info('Attachment backfill finished', {
    universityId,
    entitiesHealed: healed,
    failedRetried: failed.length,
  })
}

type ImportedEntityRef = { entityType: 'news' | 'event'; entityId: string }

/** Maps each already-imported source URL to its entity, so a re-run can heal missing
 *  attachments without re-inserting the entity. */
async function loadImportedEntitiesBySourceUrl(
  universityId: string,
): Promise<Map<string, ImportedEntityRef>> {
  const [news, events] = await Promise.all([
    db('news')
      .where({ university_id: universityId })
      .whereNotNull('source_url')
      .select<{ id: string; source_url: string }[]>('id', 'source_url'),
    db('events')
      .where({ university_id: universityId })
      .whereNotNull('source_url')
      .select<{ id: string; source_url: string }[]>('id', 'source_url'),
  ])

  const map = new Map<string, ImportedEntityRef>()
  for (const row of news) map.set(row.source_url, { entityType: 'news', entityId: row.id })
  for (const row of events) map.set(row.source_url, { entityType: 'event', entityId: row.id })
  return map
}

async function insertImportedNews(
  universityId: string,
  authorId: string,
  source: ContentSyncSource,
  item: SkyvernItem,
): Promise<{ id: string; entityType: 'news' } | null> {
  const category = mapNewsCategory(source, item.subCategory)
  const slug = await uniqueNewsSlug(universityId, item.title)

  try {
    const [row] = await db('news')
      .insert({
        university_id: universityId,
        author_id: authorId,
        title: item.title.slice(0, 500),
        slug,
        body: item.body,
        cover_url: item.coverUrl ?? null,
        category,
        is_published: false,
        is_pinned: false,
        is_imported: true,
        source_url: item.sourceUrl,
        published_at: null,
        source_published_at: parseSourceDate(item.publishedDate),
      })
      .returning<{ id: string }[]>('id')

    return row ? { id: row.id, entityType: 'news' } : null
  } catch (error) {
    if (isUniqueViolation(error)) return null // already imported — incremental dedup safety net
    throw error
  }
}

async function insertImportedEvent(
  universityId: string,
  organizerId: string,
  item: SkyvernItem,
): Promise<{ id: string; entityType: 'event' } | null> {
  const startsAt = item.startsAt ? new Date(item.startsAt) : null
  if (!startsAt || Number.isNaN(startsAt.getTime())) {
    logger.warn('Skipping event without a valid start date', { sourceUrl: item.sourceUrl })
    return null
  }
  const endsAt = item.endsAt ? new Date(item.endsAt) : null

  try {
    const [row] = await db('events')
      .insert({
        university_id: universityId,
        organizer_id: organizerId,
        title: item.title.slice(0, 255),
        description: item.body,
        location: (item.location ?? 'See event details').slice(0, 255),
        cover_url: item.coverUrl ?? null,
        starts_at: startsAt,
        ends_at: endsAt && !Number.isNaN(endsAt.getTime()) ? endsAt : null,
        type: mapEventType(item.subCategory),
        is_published: false,
        is_imported: true,
        source_url: item.sourceUrl,
      })
      .returning<{ id: string }[]>('id')

    return row ? { id: row.id, entityType: 'event' } : null
  } catch (error) {
    if (isUniqueViolation(error)) return null
    throw error
  }
}

async function enqueueAttachments(
  universityId: string,
  entityType: 'news' | 'event',
  entityId: string,
  item: SkyvernItem,
) {
  if (item.attachments.length === 0) return

  // Idempotent: skip attachments already captured for this entity (by source URL) so
  // re-runs and backfills don't create duplicate rows or re-enqueue downloads.
  const existing = await db('content_attachments')
    .where({ entity_type: entityType, entity_id: entityId })
    .whereNotNull('source_url')
    .pluck<string[]>('source_url')
  const seen = new Set(existing)

  for (const attachment of item.attachments) {
    if (seen.has(attachment.url)) continue
    const fileName = attachment.fileName?.trim() || fileNameFromUrl(attachment.url)
    const [row] = await db('content_attachments')
      .insert({
        university_id: universityId,
        entity_type: entityType,
        entity_id: entityId,
        source_url: attachment.url,
        file_name: fileName,
        download_status: 'pending',
      })
      .returning<{ id: string }[]>('id')

    if (row) {
      seen.add(attachment.url)
      await contentSyncQueue.add(
        { kind: 'attachment-download', attachmentId: row.id, universityId },
        { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
      )
    }
  }
}

// ---------------------------------------------------------------------------
// attachment-download
// ---------------------------------------------------------------------------

async function downloadAttachment(job: Extract<ContentSyncJob, { kind: 'attachment-download' }>) {
  const attachment = await db('content_attachments')
    .where({ id: job.attachmentId })
    .first<{ id: string; source_url: string; file_name: string }>('id', 'source_url', 'file_name')

  if (!attachment) return

  try {
    const response = await fetch(attachment.source_url)
    if (!response.ok) throw new Error(`Fetch failed (${response.status})`)

    const contentType = response.headers.get('content-type') ?? 'application/octet-stream'
    const buffer = Buffer.from(await response.arrayBuffer())
    const key = createUploadKey({ fileName: attachment.file_name, contentType, folder: 'imported' })

    await s3Client.send(
      new PutObjectCommand({
        Bucket: env.AWS_S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    )

    await db('content_attachments').where({ id: attachment.id }).update({
      file_url: buildPublicUrl(key),
      mime_type: contentType,
      size_bytes: buffer.length,
      download_status: 'done',
    })
  } catch (error) {
    await db('content_attachments').where({ id: attachment.id }).update({ download_status: 'failed' })
    logger.warn('Attachment download failed', {
      attachmentId: attachment.id,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error // let Bull retry per the job's backoff policy
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function notifyComplete(
  universityId: string,
  triggeredBy: string,
  runId: string,
  status: 'success' | 'failed',
  itemsNew: number,
) {
  getIo().to(`user:${triggeredBy}`).emit(CONTENT_SYNC_EVENTS.RUN_COMPLETED, { runId, status, itemsNew })
  void notificationQueue
    .add({
      universityId,
      userId: triggeredBy,
      type: 'content_sync_completed',
      referenceId: runId,
      referenceType: 'content_sync_run',
      content:
        status === 'success'
          ? `Content sync finished — ${itemsNew} new item${itemsNew === 1 ? '' : 's'} to review`
          : 'Content sync failed',
      payload: { runId, status, itemsNew },
    })
    .catch((error: unknown) => logger.warn('Failed to enqueue sync notification', { error }))
}

function mapNewsCategory(source: ContentSyncSource, subCategory?: string): string {
  if (source === 'notice') return 'notice'
  const value = (subCategory ?? '').toLowerCase()
  if (value.includes('event')) return 'events'
  if (value.includes('campus')) return 'campus'
  return 'academic'
}

function mapEventType(subCategory?: string): string {
  const value = (subCategory ?? '').toLowerCase().replace(/[\s-]+/g, '_')
  const match = EVENT_SUB_CATEGORIES.find((type) => value.includes(type))
  return match ?? 'general'
}

function fileNameFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname
    const last = path.split('/').filter(Boolean).pop()
    return last ? sanitizeFileName(decodeURIComponent(last)) : 'attachment'
  } catch {
    return 'attachment'
  }
}

async function uniqueNewsSlug(universityId: string, title: string): Promise<string> {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 480) || 'news'

  let slug = base
  let suffix = 2
  while (await slugExists(universityId, slug)) {
    slug = `${base}-${suffix}`
    suffix += 1
  }
  return slug
}

async function slugExists(universityId: string, slug: string): Promise<boolean> {
  const row = await db('news').where({ university_id: universityId, slug }).first<{ id: string }>('id')
  return Boolean(row)
}

/** Parses the source's publish date (WordPress article date) for ordering; null if absent/invalid. */
function parseSourceDate(value: string | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === UNIQUE_VIOLATION)
}
