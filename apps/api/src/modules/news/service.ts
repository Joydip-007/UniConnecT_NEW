import type { UserRole } from '@uniconnect/shared'
import { db } from '../../config/db'
import { getIo } from '../../socket'
import { forbidden, notFound } from '../../utils/errors'
import { logger } from '../../utils/logger'
import { getAttachmentsFor } from '../content-sync/attachments'
import type { CreateNewsInput, NewsListQuery, UpdateNewsInput } from './schema'

interface AuthContext {
  userId: string
  universityId: string
  role: UserRole
}

interface CountRow {
  count: string | number
}

interface NewsRow {
  id: string
  university_id: string
  author_id: string
  title: string
  slug: string
  body: string
  cover_url: string | null
  category: string
  is_published: boolean
  is_pinned: boolean
  is_announcement: boolean
  is_imported: boolean
  source_url: string | null
  view_count: number
  published_at: Date | null
  created_at: Date
  updated_at: Date
  author_full_name: string
  author_avatar_url: string | null
  author_headline: string | null
}

export class NewsService {
  async listNews(context: AuthContext, query: NewsListQuery) {
    // Drafts are never shown in the public list — for anyone. They surface only in the
    // author's "Drafts" view (and, for imported items, the admin content-sync review).
    const countQuery = db('news').where('university_id', context.universityId).andWhere('is_published', true)
    if (query.category) countQuery.andWhere('category', query.category)

    const [{ count }] = await countQuery.count<CountRow[]>({ count: '*' })
    const total = Number(count)

    const rows = (await newsSelectQuery()
      .where('news.university_id', context.universityId)
      .andWhere('news.is_published', true)
      .modify((builder) => {
        if (query.category) builder.andWhere('news.category', query.category)
      })
      .orderBy('news.is_pinned', 'desc')
      .orderBy('news.published_at', 'desc')
      .orderBy('news.created_at', 'desc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)) as NewsRow[]

    return { items: rows.map(toNews), total, page: query.page, limit: query.limit }
  }

  async createNews(context: AuthContext, input: CreateNewsInput) {
    const slug = await uniqueSlug(context.universityId, input.title)
    const [row] = await db('news')
      .insert({
        university_id: context.universityId,
        author_id: context.userId,
        title: input.title,
        slug,
        body: input.body,
        cover_url: input.cover_url ?? null,
        category: input.category,
        is_published: input.is_published,
        is_pinned: input.is_pinned,
        published_at: input.is_published ? db.fn.now() : null,
      })
      .returning<{ id: string }[]>('id')

    if (!row) throw notFound('News not found', 'NEWS_NOT_FOUND')

    const news = await this.getNews(context, row.id, { incrementView: false })
    if (input.is_published) {
      if (input.category === 'notice') await this.refreshLatestAnnouncement(context.universityId)
      getIo().to(`uni:${context.universityId}`).emit('news:published', { news })
    }
    return news
  }

  async getNews(context: AuthContext, newsId: string, options: { incrementView?: boolean } = { incrementView: true }) {
    const row = await newsSelectQuery()
      .where({ 'news.id': newsId, 'news.university_id': context.universityId })
      .first<NewsRow>()

    // Visible if published, or it's the author's own draft, or (for imported items) an admin reviewing.
    const canViewDraft =
      row && (row.author_id === context.userId || (context.role === 'admin' && row.is_imported))
    if (!row || (!row.is_published && !canViewDraft)) {
      throw notFound('News not found', 'NEWS_NOT_FOUND')
    }

    if (options.incrementView !== false) {
      void db('news')
        .where({ id: newsId, university_id: context.universityId })
        .increment('view_count', 1)
        .catch((error: unknown) => logger.warn('Failed to increment news view count', { error, newsId }))
    }

    const attachments = await getAttachmentsFor('news', newsId)
    return { ...toNews(row), attachments }
  }

  async updateNews(context: AuthContext, newsId: string, input: UpdateNewsInput) {
    const existing = await db('news')
      .select<
        {
          id: string
          author_id: string
          is_published: boolean
          title: string
          category: string
          is_imported: boolean
          source_published_at: Date | null
        }[]
      >('id', 'author_id', 'is_published', 'title', 'category', 'is_imported', 'source_published_at')
      .where({ id: newsId, university_id: context.universityId })
      .first()

    if (!existing) throw notFound('News not found', 'NEWS_NOT_FOUND')
    if (context.role !== 'admin' && existing.author_id !== context.userId) {
      throw forbidden('You do not have permission to update this news item', 'NEWS_FORBIDDEN')
    }

    const publishingNow = input.is_published === true && !existing.is_published
    const effectiveCategory = input.category ?? existing.category
    // Imported items publish at their original source date (so a backdated notice
    // lands at its real position in the feed); native posts publish at "now".
    const publishedAtValue = publishingNow
      ? existing.is_imported && existing.source_published_at
        ? existing.source_published_at
        : db.fn.now()
      : undefined
    await db('news')
      .where({ id: newsId, university_id: context.universityId })
      .update({
        ...pickDefined({
          title: input.title,
          slug: input.title ? await uniqueSlug(context.universityId, input.title, newsId) : undefined,
          body: input.body,
          cover_url: input.cover_url,
          category: input.category,
          is_published: input.is_published,
          is_pinned: input.is_pinned,
          published_at: publishedAtValue,
        }),
        updated_at: db.fn.now(),
      })

    // Publishing a notice may change which notice is the latest, so recompute the
    // single featured announcement (always the newest published notice).
    if (publishingNow && effectiveCategory === 'notice') {
      await this.refreshLatestAnnouncement(context.universityId)
    }

    const news = await this.getNews({ ...context, role: 'admin' }, newsId, { incrementView: false })
    if (publishingNow) {
      getIo().to(`uni:${context.universityId}`).emit('news:published', { news })
    }
    return news
  }

  /**
   * Promotes the single featured announcement to the **latest published notice**
   * (by source article date, falling back to publish/created date).
   *
   * A per-university advisory lock serialises concurrent calls so a bulk publish
   * (many notices at once) can't race on the partial unique index
   * `(university_id) where is_announcement` — the bug that produced 500s.
   * Idempotent: safe to call after every notice publish.
   */
  async refreshLatestAnnouncement(universityId: string) {
    await db.transaction(async (trx) => {
      await trx.raw('SELECT pg_advisory_xact_lock(hashtext(?))', [`news_announcement:${universityId}`])

      const latest = await trx('news')
        .where({ university_id: universityId, category: 'notice', is_published: true })
        .orderByRaw('COALESCE(source_published_at, published_at, created_at) DESC')
        .first<{ id: string }>('id')

      // Demote any stale announcement, then promote the latest notice.
      await trx('news')
        .where({ university_id: universityId, is_announcement: true })
        .modify((qb) => {
          if (latest) qb.whereNot('id', latest.id)
        })
        .update({ is_announcement: false })

      if (latest) {
        await trx('news').where({ id: latest.id, university_id: universityId }).update({ is_announcement: true })
      }
    })
  }

  async deleteNews(context: AuthContext, newsId: string) {
    const existing = await db('news')
      .select<{ author_id: string }[]>('author_id')
      .where({ id: newsId, university_id: context.universityId })
      .first()

    if (!existing) throw notFound('News not found', 'NEWS_NOT_FOUND')
    if (context.role !== 'admin' && existing.author_id !== context.userId) {
      throw forbidden('You do not have permission to delete this news item', 'NEWS_FORBIDDEN')
    }

    await db('news').where({ id: newsId, university_id: context.universityId }).delete()
    return { deleted: true }
  }
}

export const newsService = new NewsService()

function newsSelectQuery() {
  return db('news')
    .join('profiles', 'profiles.user_id', 'news.author_id')
    .select<NewsRow[]>(
      'news.id',
      'news.university_id',
      'news.author_id',
      'news.title',
      'news.slug',
      'news.body',
      'news.cover_url',
      'news.category',
      'news.is_published',
      'news.is_pinned',
      'news.is_announcement',
      'news.is_imported',
      'news.source_url',
      'news.view_count',
      'news.published_at',
      'news.created_at',
      'news.updated_at',
      'profiles.full_name as author_full_name',
      'profiles.avatar_url as author_avatar_url',
      'profiles.headline as author_headline',
    )
}

async function uniqueSlug(universityId: string, title: string, excludeId?: string) {
  const base = slugify(title)
  let slug = base
  let suffix = 2

  while (await slugExists(universityId, slug, excludeId)) {
    slug = `${base}-${suffix}`
    suffix += 1
  }

  return slug
}

async function slugExists(universityId: string, slug: string, excludeId?: string) {
  const query = db('news').where({ university_id: universityId, slug })
  if (excludeId) query.whereNot('id', excludeId)
  return Boolean(await query.first())
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'news'
}

function toNews(row: NewsRow) {
  return {
    id: row.id,
    universityId: row.university_id,
    authorId: row.author_id,
    title: row.title,
    slug: row.slug,
    body: row.body,
    coverUrl: row.cover_url,
    category: row.category,
    isPublished: row.is_published,
    isPinned: row.is_pinned,
    isAnnouncement: row.is_announcement,
    isImported: row.is_imported,
    sourceUrl: row.source_url,
    viewCount: row.view_count,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: {
      id: row.author_id,
      fullName: row.author_full_name,
      avatarUrl: row.author_avatar_url,
      headline: row.author_headline,
    },
  }
}

function pickDefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined))
}
