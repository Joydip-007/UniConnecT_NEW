import { db } from '../../config/db'

// ── Types ────────────────────────────────────────────────────────────────────

export interface UserSearchResult {
  id: string
  fullName: string
  headline: string | null
  department: string | null
  batchYear: string | null
  avatarUrl: string | null
  role: string
  isFollowing: boolean
}

export interface PostSearchResult {
  id: string
  content: string
  createdAt: string
  reactionCount: number
  commentCount: number
  author: { id: string; fullName: string; avatarUrl: string | null }
}

export interface JobSearchResult {
  id: string
  title: string
  company: string
  type: string
  location: string
  deadline: string | null
}

export interface EventSearchResult {
  id: string
  title: string
  startsAt: string
  location: string
  coverUrl: string | null
  myRsvp: 'going' | 'maybe' | null
}

export interface GroupSearchResult {
  id: string
  name: string
  type: string
  avatarUrl: string | null
  memberCount: number
  isMember: boolean
}

export interface SearchPagedResult<T> {
  items: T[]
  total: number
  page: number
  hasMore: boolean
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function paginate<T>(items: T[], total: number, page: number, limit: number): SearchPagedResult<T> {
  return { items, total, page, hasMore: page * limit < total }
}

// ── People ───────────────────────────────────────────────────────────────────

export async function searchPeople(
  universityId: string,
  q: string,
  page: number,
  limit: number,
  requesterId: string,
): Promise<SearchPagedResult<UserSearchResult>> {
  const pattern = `%${q}%`

  const [{ count }] = await db('profiles as p')
    .join('users as u', 'u.id', 'p.user_id')
    .where('u.university_id', universityId)
    .where('u.is_active', true)
    .whereRaw('p.full_name ILIKE ?', [pattern])
    .count<[{ count: string }]>('u.id as count')

  const rows = await db('profiles as p')
    .join('users as u', 'u.id', 'p.user_id')
    .leftJoin('follows as f', function () {
      this.on('f.following_id', 'u.id').andOn('f.follower_id', db.raw('?', [requesterId]))
    })
    .where('u.university_id', universityId)
    .where('u.is_active', true)
    .whereRaw('p.full_name ILIKE ?', [pattern])
    .select(
      'u.id',
      'u.role',
      'p.full_name as fullName',
      'p.headline',
      'p.department',
      'p.batch_year as batchYear',
      'p.avatar_url as avatarUrl',
      db.raw('f.follower_id IS NOT NULL as "isFollowing"'),
    )
    .limit(limit)
    .offset((page - 1) * limit)
    .orderByRaw('p.full_name ILIKE ? DESC, p.full_name ASC', [`${q}%`])

  const items: UserSearchResult[] = rows.map((r) => ({
    id: r.id,
    fullName: r.fullName,
    headline: r.headline,
    department: r.department,
    batchYear: r.batchYear,
    avatarUrl: r.avatarUrl,
    role: r.role,
    isFollowing: Boolean(r.isFollowing),
  }))

  return paginate(items, Number(count), page, limit)
}

// ── Posts ────────────────────────────────────────────────────────────────────

export async function searchPosts(
  universityId: string,
  q: string,
  page: number,
  limit: number,
): Promise<SearchPagedResult<PostSearchResult>> {
  const pattern = `%${q}%`

  const [{ count }] = await db('posts as po')
    .where('po.university_id', universityId)
    .whereRaw('po.content ILIKE ?', [pattern])
    .count<[{ count: string }]>('po.id as count')

  const rows = await db('posts as po')
    .join('users as u', 'u.id', 'po.author_id')
    .join('profiles as p', 'p.user_id', 'u.id')
    .where('po.university_id', universityId)
    .whereRaw('po.content ILIKE ?', [pattern])
    .select(
      'po.id',
      'po.content',
      'po.created_at as createdAt',
      'u.id as authorId',
      'p.full_name as authorName',
      'p.avatar_url as authorAvatarUrl',
    )
    .limit(limit)
    .offset((page - 1) * limit)
    .orderBy('po.created_at', 'desc')

  const postIds = rows.map((r) => r.id)

  const reactionCounts =
    postIds.length === 0
      ? []
      : await db('reactions')
          .whereIn('target_id', postIds)
          .where('target_type', 'post')
          .groupBy('target_id')
          .select('target_id', db.raw('count(*) as cnt'))

  const commentCounts =
    postIds.length === 0
      ? []
      : await db('comments')
          .whereIn('post_id', postIds)
          .groupBy('post_id')
          .select('post_id', db.raw('count(*) as cnt'))

  const rcMap = Object.fromEntries(reactionCounts.map((r) => [r.target_id, Number(r.cnt)]))
  const ccMap = Object.fromEntries(commentCounts.map((r) => [r.post_id, Number(r.cnt)]))

  const items: PostSearchResult[] = rows.map((r) => ({
    id: r.id,
    content: r.content,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    reactionCount: rcMap[r.id] ?? 0,
    commentCount: ccMap[r.id] ?? 0,
    author: { id: r.authorId, fullName: r.authorName, avatarUrl: r.authorAvatarUrl },
  }))

  return paginate(items, Number(count), page, limit)
}

// ── Jobs ─────────────────────────────────────────────────────────────────────

export async function searchJobs(
  universityId: string,
  q: string,
  page: number,
  limit: number,
): Promise<SearchPagedResult<JobSearchResult>> {
  const pattern = `%${q}%`

  const [{ count }] = await db('jobs')
    .where('university_id', universityId)
    .where('is_active', true)
    .where(function () {
      this.whereRaw('title ILIKE ?', [pattern]).orWhereRaw('company ILIKE ?', [pattern])
    })
    .count<[{ count: string }]>('id as count')

  const rows = await db('jobs')
    .where('university_id', universityId)
    .where('is_active', true)
    .where(function () {
      this.whereRaw('title ILIKE ?', [pattern]).orWhereRaw('company ILIKE ?', [pattern])
    })
    .select('id', 'title', 'company', 'type', 'location', 'deadline')
    .limit(limit)
    .offset((page - 1) * limit)
    .orderBy('created_at', 'desc')

  const items: JobSearchResult[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    company: r.company,
    type: r.type,
    location: r.location,
    deadline: r.deadline ? (r.deadline instanceof Date ? r.deadline.toISOString() : r.deadline) : null,
  }))

  return paginate(items, Number(count), page, limit)
}

// ── Events ───────────────────────────────────────────────────────────────────

export async function searchEvents(
  universityId: string,
  q: string,
  page: number,
  limit: number,
  requesterId: string,
): Promise<SearchPagedResult<EventSearchResult>> {
  const pattern = `%${q}%`

  const [{ count }] = await db('events')
    .where('university_id', universityId)
    .where('is_published', true)
    .whereRaw('title ILIKE ?', [pattern])
    .count<[{ count: string }]>('id as count')

  const rows = await db('events as e')
    .leftJoin('event_rsvps as r', function () {
      this.on('r.event_id', 'e.id').andOn('r.user_id', db.raw('?', [requesterId]))
    })
    .where('e.university_id', universityId)
    .where('e.is_published', true)
    .whereRaw('e.title ILIKE ?', [pattern])
    .select(
      'e.id',
      'e.title',
      'e.starts_at as startsAt',
      'e.location',
      'e.cover_url as coverUrl',
      'r.status as myRsvp',
    )
    .limit(limit)
    .offset((page - 1) * limit)
    .orderBy('e.starts_at', 'asc')

  const items: EventSearchResult[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    startsAt: r.startsAt instanceof Date ? r.startsAt.toISOString() : r.startsAt,
    location: r.location,
    coverUrl: r.coverUrl,
    myRsvp: r.myRsvp === 'going' || r.myRsvp === 'maybe' ? r.myRsvp : null,
  }))

  return paginate(items, Number(count), page, limit)
}

// ── Groups ───────────────────────────────────────────────────────────────────

export async function searchGroups(
  universityId: string,
  q: string,
  page: number,
  limit: number,
  requesterId: string,
): Promise<SearchPagedResult<GroupSearchResult>> {
  const pattern = `%${q}%`

  const [{ count }] = await db('groups')
    .where('university_id', universityId)
    .whereRaw('name ILIKE ?', [pattern])
    .count<[{ count: string }]>('id as count')

  const rows = await db('groups as g')
    .leftJoin('group_members as gm', function () {
      this.on('gm.group_id', 'g.id').andOn('gm.user_id', db.raw('?', [requesterId]))
    })
    .where('g.university_id', universityId)
    .whereRaw('g.name ILIKE ?', [pattern])
    .select(
      'g.id',
      'g.name',
      'g.type',
      'g.avatar_url as avatarUrl',
      'g.member_count as memberCount',
      db.raw('gm.user_id IS NOT NULL as "isMember"'),
    )
    .limit(limit)
    .offset((page - 1) * limit)
    .orderBy('g.member_count', 'desc')

  const items: GroupSearchResult[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    avatarUrl: r.avatarUrl,
    memberCount: r.memberCount,
    isMember: Boolean(r.isMember),
  }))

  return paginate(items, Number(count), page, limit)
}

// ── All (omnibus) ─────────────────────────────────────────────────────────────

export async function searchAll(
  universityId: string,
  q: string,
  limit: number,
  requesterId: string,
) {
  const [people, posts, jobs, events, groups] = await Promise.all([
    searchPeople(universityId, q, 1, limit, requesterId),
    searchPosts(universityId, q, 1, limit),
    searchJobs(universityId, q, 1, limit),
    searchEvents(universityId, q, 1, limit, requesterId),
    searchGroups(universityId, q, 1, limit, requesterId),
  ])

  return {
    people: people.items,
    posts: posts.items,
    jobs: jobs.items,
    events: events.items,
    groups: groups.items,
  }
}
