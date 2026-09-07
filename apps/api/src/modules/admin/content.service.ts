import { db } from '../../config/db'
import { notFound, AppError } from '../../utils/errors'
import type { ContentKind, ContentListQuery } from './schema'

interface CountRow {
  count: string | number
}

type AuthorJoinRow = {
  author_id: string
  author_name: string | null
  author_avatar: string | null
}

interface PostRow extends AuthorJoinRow {
  id: string
  content: string
  media_urls: string[] | null
  type: string
  is_pinned: boolean
  view_count: number
  created_at: Date
  reaction_count: string | number
  comment_count: string | number
}

interface EventRow {
  id: string
  title: string
  description: string
  location: string
  cover_url: string | null
  starts_at: Date
  ends_at: Date | null
  is_published: boolean
  type: string
  created_at: Date
  organizer_id: string
  organizer_name: string | null
  organizer_avatar: string | null
  rsvp_count: string | number
}

interface JobRow {
  id: string
  title: string
  company: string
  location: string
  type: string
  salary_range: string | null
  deadline: Date
  is_active: boolean
  view_count: number
  created_at: Date
  posted_by: string
  poster_name: string | null
  poster_avatar: string | null
  application_count: string | number
}

interface NewsRow {
  id: string
  title: string
  slug: string
  cover_url: string | null
  category: string
  is_published: boolean
  is_pinned: boolean
  view_count: number
  published_at: Date | null
  created_at: Date
  author_id: string
  author_name: string | null
  author_avatar: string | null
}

const PIN_KINDS = new Set<ContentKind>(['posts', 'news'])
const PUBLISH_KINDS = new Set<ContentKind>(['events', 'news'])
const ACTIVE_KINDS = new Set<ContentKind>(['jobs'])

export class AdminContentService {
  async listPosts(universityId: string, query: ContentListQuery) {
    const base = db('posts').where('posts.university_id', universityId)

    if (query.filter === 'pinned') base.andWhere('posts.is_pinned', true)
    if (query.filter === 'announcement') base.andWhere('posts.type', 'announcement')

    const [{ count }] = await base.clone().count<CountRow[]>({ count: '*' })

    const rows = await base
      .clone()
      .leftJoin('profiles', 'profiles.user_id', 'posts.author_id')
      .leftJoin(
        db('reactions')
          .select('target_id')
          .count<{ target_id: string; count: string }[]>({ count: '*' })
          .where('target_type', 'post')
          .groupBy('target_id')
          .as('r'),
        'r.target_id',
        'posts.id',
      )
      .leftJoin(
        db('comments').select('post_id').count<{ post_id: string; count: string }[]>({ count: '*' }).groupBy('post_id').as('c'),
        'c.post_id',
        'posts.id',
      )
      .select<PostRow[]>(
        'posts.id',
        'posts.content',
        'posts.media_urls',
        'posts.type',
        'posts.is_pinned',
        'posts.view_count',
        'posts.created_at',
        'posts.author_id',
        'profiles.full_name as author_name',
        'profiles.avatar_url as author_avatar',
        db.raw('COALESCE(r.count, 0) as reaction_count'),
        db.raw('COALESCE(c.count, 0) as comment_count'),
      )
      .orderBy('posts.is_pinned', 'desc')
      .orderBy('posts.created_at', 'desc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)

    return {
      items: rows.map(toAdminPost),
      total: Number(count),
      page: query.page,
      limit: query.limit,
    }
  }

  async listEvents(universityId: string, query: ContentListQuery) {
    const base = db('events').where('events.university_id', universityId)

    if (query.filter === 'published') base.andWhere('events.is_published', true)
    if (query.filter === 'unpublished') base.andWhere('events.is_published', false)

    const [{ count }] = await base.clone().count<CountRow[]>({ count: '*' })

    const rows = await base
      .clone()
      .leftJoin('profiles', 'profiles.user_id', 'events.organizer_id')
      .leftJoin(
        db('event_rsvps').select('event_id').count<{ event_id: string; count: string }[]>({ count: '*' }).groupBy('event_id').as('rs'),
        'rs.event_id',
        'events.id',
      )
      .select<EventRow[]>(
        'events.id',
        'events.title',
        'events.description',
        'events.location',
        'events.cover_url',
        'events.starts_at',
        'events.ends_at',
        'events.is_published',
        'events.type',
        'events.created_at',
        'events.organizer_id',
        'profiles.full_name as organizer_name',
        'profiles.avatar_url as organizer_avatar',
        db.raw('COALESCE(rs.count, 0) as rsvp_count'),
      )
      .orderBy('events.starts_at', 'desc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)

    return {
      items: rows.map(toAdminEvent),
      total: Number(count),
      page: query.page,
      limit: query.limit,
    }
  }

  async listJobs(universityId: string, query: ContentListQuery) {
    const base = db('jobs').where('jobs.university_id', universityId)

    if (query.filter === 'active') base.andWhere('jobs.is_active', true)
    if (query.filter === 'closed') base.andWhere('jobs.is_active', false)

    const [{ count }] = await base.clone().count<CountRow[]>({ count: '*' })

    const rows = await base
      .clone()
      .leftJoin('profiles', 'profiles.user_id', 'jobs.posted_by')
      .leftJoin(
        db('job_applications').select('job_id').count<{ job_id: string; count: string }[]>({ count: '*' }).groupBy('job_id').as('ap'),
        'ap.job_id',
        'jobs.id',
      )
      .select<JobRow[]>(
        'jobs.id',
        'jobs.title',
        'jobs.company',
        'jobs.location',
        'jobs.type',
        'jobs.salary_range',
        'jobs.deadline',
        'jobs.is_active',
        'jobs.view_count',
        'jobs.created_at',
        'jobs.posted_by',
        'profiles.full_name as poster_name',
        'profiles.avatar_url as poster_avatar',
        db.raw('COALESCE(ap.count, 0) as application_count'),
      )
      .orderBy('jobs.created_at', 'desc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)

    return {
      items: rows.map(toAdminJob),
      total: Number(count),
      page: query.page,
      limit: query.limit,
    }
  }

  async listNews(universityId: string, query: ContentListQuery) {
    const base = db('news').where('news.university_id', universityId)

    if (query.filter === 'pinned') base.andWhere('news.is_pinned', true)
    if (query.filter === 'published') base.andWhere('news.is_published', true)
    if (query.filter === 'unpublished') base.andWhere('news.is_published', false)

    const [{ count }] = await base.clone().count<CountRow[]>({ count: '*' })

    const rows = await base
      .clone()
      .leftJoin('profiles', 'profiles.user_id', 'news.author_id')
      .select<NewsRow[]>(
        'news.id',
        'news.title',
        'news.slug',
        'news.cover_url',
        'news.category',
        'news.is_published',
        'news.is_pinned',
        'news.view_count',
        'news.published_at',
        'news.created_at',
        'news.author_id',
        'profiles.full_name as author_name',
        'profiles.avatar_url as author_avatar',
      )
      .orderBy('news.is_pinned', 'desc')
      .orderBy('news.published_at', 'desc')
      .orderBy('news.created_at', 'desc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)

    return {
      items: rows.map(toAdminNews),
      total: Number(count),
      page: query.page,
      limit: query.limit,
    }
  }

  async deleteItem(kind: ContentKind, universityId: string, id: string) {
    const table = tableFor(kind)
    const deleted = await db(table).where({ id, university_id: universityId }).delete()
    if (deleted === 0) throw notFound(`${humanKind(kind)} not found`)
    return { deleted: true }
  }

  async togglePin(kind: ContentKind, universityId: string, id: string, isPinned: boolean) {
    if (!PIN_KINDS.has(kind)) {
      throw new AppError(`${humanKind(kind)} does not support pinning`, 400, 'UNSUPPORTED_ACTION')
    }
    const table = tableFor(kind)
    const updated = await db(table).where({ id, university_id: universityId }).update({ is_pinned: isPinned })
    if (updated === 0) throw notFound(`${humanKind(kind)} not found`)
    return { id, isPinned }
  }

  async togglePublish(kind: ContentKind, universityId: string, id: string, isPublished: boolean) {
    if (!PUBLISH_KINDS.has(kind)) {
      throw new AppError(`${humanKind(kind)} does not support publish toggle`, 400, 'UNSUPPORTED_ACTION')
    }
    const table = tableFor(kind)
    const patch: Record<string, unknown> = { is_published: isPublished }
    if (kind === 'news' && isPublished) patch.published_at = db.fn.now()

    const updated = await db(table).where({ id, university_id: universityId }).update(patch)
    if (updated === 0) throw notFound(`${humanKind(kind)} not found`)
    return { id, isPublished }
  }

  async toggleActive(kind: ContentKind, universityId: string, id: string, isActive: boolean) {
    if (!ACTIVE_KINDS.has(kind)) {
      throw new AppError(`${humanKind(kind)} does not support active toggle`, 400, 'UNSUPPORTED_ACTION')
    }
    const table = tableFor(kind)
    const updated = await db(table).where({ id, university_id: universityId }).update({ is_active: isActive })
    if (updated === 0) throw notFound(`${humanKind(kind)} not found`)
    return { id, isActive }
  }
}

export const adminContentService = new AdminContentService()

function tableFor(kind: ContentKind) {
  return kind
}

function humanKind(kind: ContentKind) {
  return kind.charAt(0).toUpperCase() + kind.slice(1, -1)
}

function toAdminPost(row: PostRow) {
  return {
    id: row.id,
    content: row.content,
    mediaUrls: row.media_urls ?? [],
    type: row.type,
    isPinned: row.is_pinned,
    viewCount: row.view_count,
    reactionCount: Number(row.reaction_count),
    commentCount: Number(row.comment_count),
    createdAt: row.created_at,
    author: {
      id: row.author_id,
      fullName: row.author_name,
      avatarUrl: row.author_avatar,
    },
  }
}

function toAdminEvent(row: EventRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    location: row.location,
    coverUrl: row.cover_url,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    isPublished: row.is_published,
    type: row.type,
    rsvpCount: Number(row.rsvp_count),
    createdAt: row.created_at,
    organizer: {
      id: row.organizer_id,
      fullName: row.organizer_name,
      avatarUrl: row.organizer_avatar,
    },
  }
}

function toAdminJob(row: JobRow) {
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    location: row.location,
    type: row.type,
    salaryRange: row.salary_range,
    deadline: row.deadline,
    isActive: row.is_active,
    viewCount: row.view_count,
    applicationCount: Number(row.application_count),
    createdAt: row.created_at,
    poster: {
      id: row.posted_by,
      fullName: row.poster_name,
      avatarUrl: row.poster_avatar,
    },
  }
}

function toAdminNews(row: NewsRow) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    coverUrl: row.cover_url,
    category: row.category,
    isPublished: row.is_published,
    isPinned: row.is_pinned,
    viewCount: row.view_count,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    author: {
      id: row.author_id,
      fullName: row.author_name,
      avatarUrl: row.author_avatar,
    },
  }
}
