import { db } from '../../config/db'

/**
 * Aggregates the current user's own unpublished drafts across every content type.
 * Drafts are author-only (`is_published = false`); this is the single surface where
 * a user can see and resume them. Each item is a lightweight card, not the full row.
 */

export interface DraftItem {
  kind: 'post' | 'job' | 'news' | 'event'
  id: string
  title: string
  excerpt: string | null
  createdAt: Date
  updatedAt: Date
  /** Posts only: a future publish time means this draft is scheduled, not a plain draft. */
  publishAt: Date | null
}

interface RawDraft {
  id: string
  title: string
  excerpt: string | null
  created_at: Date
  updated_at: Date
  publish_at?: Date | null
}

export class DraftsService {
  async listMine(universityId: string, userId: string): Promise<{ items: DraftItem[]; counts: Record<DraftItem['kind'], number> }> {
    const [posts, jobs, news, events] = await Promise.all([
      db('posts')
        .where({ university_id: universityId, author_id: userId, is_published: false })
        .select<RawDraft[]>(
          'id',
          db.raw("left(content, 120) as title"),
          db.raw('content as excerpt'),
          'created_at',
          'updated_at',
          'publish_at',
        ),
      db('jobs')
        // The jobs table has no updated_at column, so fall back to created_at for ordering.
        .where({ university_id: universityId, posted_by: userId, is_published: false })
        .select<RawDraft[]>('id', 'title', db.raw('company as excerpt'), 'created_at', db.raw('created_at as updated_at')),
      db('news')
        .where({ university_id: universityId, author_id: userId, is_published: false })
        .select<RawDraft[]>('id', 'title', db.raw('left(body, 160) as excerpt'), 'created_at', 'updated_at'),
      db('events')
        .where({ university_id: universityId, organizer_id: userId, is_published: false })
        .select<RawDraft[]>('id', 'title', db.raw('left(description, 160) as excerpt'), 'created_at', 'updated_at'),
    ])

    const items: DraftItem[] = [
      ...posts.map((r) => toItem('post', r)),
      ...jobs.map((r) => toItem('job', r)),
      ...news.map((r) => toItem('news', r)),
      ...events.map((r) => toItem('event', r)),
    ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

    return {
      items,
      counts: {
        post: posts.length,
        job: jobs.length,
        news: news.length,
        event: events.length,
      },
    }
  }
}

export const draftsService = new DraftsService()

function toItem(kind: DraftItem['kind'], row: RawDraft): DraftItem {
  const title = (row.title ?? '').trim()
  return {
    kind,
    id: row.id,
    title: title || '(untitled draft)',
    excerpt: row.excerpt?.trim() || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishAt: row.publish_at ?? null,
  }
}
