import type { UserRole } from '@uniconnect/shared'
import { db } from '../../config/db'
import { getIo } from '../../socket'
import { forbidden, notFound } from '../../utils/errors'
import { logger } from '../../utils/logger'
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
    const countQuery = db('news').where('university_id', context.universityId)
    if (context.role !== 'admin') countQuery.andWhere('is_published', true)
    if (query.category) countQuery.andWhere('category', query.category)

    const [{ count }] = await countQuery.count<CountRow[]>({ count: '*' })
    const total = Number(count)

    const rows = (await newsSelectQuery()
      .where('news.university_id', context.universityId)
      .modify((builder) => {
        if (context.role !== 'admin') builder.andWhere('news.is_published', true)
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
      getIo().to(`uni:${context.universityId}`).emit('news:published', { news })
    }
    return news
  }

  async getNews(context: AuthContext, newsId: string, options: { incrementView?: boolean } = { incrementView: true }) {
    const row = await newsSelectQuery()
      .where({ 'news.id': newsId, 'news.university_id': context.universityId })
      .first<NewsRow>()

    if (!row || (context.role !== 'admin' && !row.is_published)) {
      throw notFound('News not found', 'NEWS_NOT_FOUND')
    }

    if (options.incrementView !== false) {
      void db('news')
        .where({ id: newsId, university_id: context.universityId })
        .increment('view_count', 1)
        .catch((error: unknown) => logger.warn('Failed to increment news view count', { error, newsId }))
    }

    return toNews(row)
  }

  async updateNews(context: AuthContext, newsId: string, input: UpdateNewsInput) {
    const existing = await db('news')
      .select<{ id: string; author_id: string; is_published: boolean; title: string }[]>('id', 'author_id', 'is_published', 'title')
      .where({ id: newsId, university_id: context.universityId })
      .first()

    if (!existing) throw notFound('News not found', 'NEWS_NOT_FOUND')
    if (context.role !== 'admin' && existing.author_id !== context.userId) {
      throw forbidden('You do not have permission to update this news item', 'NEWS_FORBIDDEN')
    }

    const publishingNow = input.is_published === true && !existing.is_published
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
          published_at: publishingNow ? db.fn.now() : undefined,
        }),
        updated_at: db.fn.now(),
      })

    const news = await this.getNews({ ...context, role: 'admin' }, newsId, { incrementView: false })
    if (publishingNow) {
      getIo().to(`uni:${context.universityId}`).emit('news:published', { news })
    }
    return news
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
