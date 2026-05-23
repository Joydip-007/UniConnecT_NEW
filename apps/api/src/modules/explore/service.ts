import { db } from '../../config/db'

// ── Types ────────────────────────────────────────────────────────────────────

export interface TrendingPost {
  id: string
  content: string
  createdAt: string
  authorId: string
  authorName: string
  authorAvatarUrl: string | null
  authorRole: string
  reactionCount: number
  commentCount: number
}

export interface UserSuggestion {
  id: string
  role: string
  fullName: string
  headline: string | null
  department: string | null
  batchYear: string | null
  avatarUrl: string | null
  followerCount: number
  isFollowing: boolean
}

export interface GroupSummary {
  id: string
  name: string
  type: string
  avatarUrl: string | null
  memberCount: number
  recentPostCount: number
}

export interface EventSummary {
  id: string
  title: string
  startsAt: string
  location: string
  coverUrl: string | null
  rsvpCount: number
  myRsvp: 'going' | 'maybe' | null
}

export interface DiscoveryResult {
  trendingPosts: TrendingPost[]
  peopleSuggestions: UserSuggestion[]
  activeGroups: GroupSummary[]
  upcomingEvents: EventSummary[]
  featuredAlumni: UserSuggestion[]
}

export interface TagPost {
  id: string
  content: string
  createdAt: string
  authorId: string
  authorName: string
  authorAvatarUrl: string | null
  authorRole: string
  reactionCount: number
  commentCount: number
}

export interface TagPostsResult {
  items: TagPost[]
  total: number
  page: number
  hasMore: boolean
  relatedTags: string[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString()
  return String(v)
}

// ── Discovery queries ─────────────────────────────────────────────────────────

async function getTrendingPosts(universityId: string, requesterId: string): Promise<TrendingPost[]> {
  const rows = await db('posts as p')
    .join('users as u', 'u.id', 'p.author_id')
    .join('profiles as pr', 'pr.user_id', 'u.id')
    .where('p.university_id', universityId)
    .whereNot('p.author_id', requesterId)
    .where('p.created_at', '>', db.raw("NOW() - INTERVAL '48 hours'"))
    .select(
      'p.id',
      'p.content',
      'p.created_at as createdAt',
      'p.author_id as authorId',
      'pr.full_name as authorName',
      'pr.avatar_url as authorAvatarUrl',
      'u.role as authorRole',
      db.raw(`COALESCE((SELECT COUNT(*)::int FROM reactions WHERE target_id = p.id AND target_type = 'post'), 0) AS reaction_count`),
      db.raw(`COALESCE((SELECT COUNT(*)::int FROM comments WHERE post_id = p.id), 0) AS comment_count`),
      db.raw(`
        (
          COALESCE((SELECT COUNT(*)::int FROM reactions WHERE target_id = p.id AND target_type = 'post'), 0)
          + COALESCE((SELECT COUNT(*)::int FROM comments WHERE post_id = p.id), 0) * 2
        )::float
        / POWER(EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600.0 + 1.0, 1.2)
        AS score
      `),
    )
    .orderBy('score', 'desc')
    .limit(5)

  return rows.map((r) => ({
    id: r.id,
    content: r.content,
    createdAt: toIso(r.createdAt),
    authorId: r.authorId,
    authorName: r.authorName,
    authorAvatarUrl: r.authorAvatarUrl,
    authorRole: r.authorRole,
    reactionCount: Number(r.reaction_count),
    commentCount: Number(r.comment_count),
  }))
}

async function getPeopleSuggestions(universityId: string, requesterId: string): Promise<UserSuggestion[]> {
  const requesterProfile = await db('profiles')
    .where('user_id', requesterId)
    .select<{ department: string | null; batch_year: string | null }>('department', 'batch_year')
    .first()

  const dept = requesterProfile?.department ?? ''
  const batch = requesterProfile?.batch_year ?? ''

  const rows = await db('users as u')
    .join('profiles as p', 'p.user_id', 'u.id')
    .leftJoin('follows as f', function () {
      this.on('f.following_id', 'u.id').andOn('f.follower_id', db.raw('?', [requesterId]))
    })
    .where('u.university_id', universityId)
    .where('u.is_active', true)
    .whereNot('u.id', requesterId)
    .whereNull('f.follower_id')
    .select(
      'u.id',
      'u.role',
      'p.full_name as fullName',
      'p.headline',
      'p.department',
      'p.batch_year as batchYear',
      'p.avatar_url as avatarUrl',
      db.raw(`(SELECT COUNT(*)::int FROM follows WHERE following_id = u.id) AS follower_count`),
    )
    .orderByRaw(
      `(
        CASE
          WHEN p.department = ? AND p.batch_year = ? THEN 3
          WHEN p.department = ? THEN 2
          WHEN p.batch_year = ? THEN 1
          ELSE 0
        END
        + LEAST(
            COALESCE((
              SELECT COUNT(*)::int FROM follows
              WHERE following_id = u.id
              AND follower_id IN (SELECT following_id FROM follows WHERE follower_id = ?)
            ), 0),
            1
          )
      ) DESC,
      (SELECT COUNT(*)::int FROM follows WHERE following_id = u.id) DESC`,
      [dept, batch, dept, batch, requesterId],
    )
    .limit(6)

  return rows.map((r) => ({
    id: r.id,
    role: r.role,
    fullName: r.fullName,
    headline: r.headline,
    department: r.department,
    batchYear: r.batchYear,
    avatarUrl: r.avatarUrl,
    followerCount: Number(r.follower_count),
    isFollowing: false,
  }))
}

async function getActiveGroups(universityId: string, requesterId: string): Promise<GroupSummary[]> {
  const rows = await db('groups as g')
    .leftJoin('group_members as gm', function () {
      this.on('gm.group_id', 'g.id').andOn('gm.user_id', db.raw('?', [requesterId]))
    })
    .where('g.university_id', universityId)
    .whereNot('g.type', 'secret')
    .whereNull('gm.user_id')
    .select(
      'g.id',
      'g.name',
      'g.type',
      'g.avatar_url as avatarUrl',
      'g.member_count as memberCount',
      db.raw(`
        COALESCE((
          SELECT COUNT(*)::int FROM posts
          WHERE group_id = g.id
          AND created_at > NOW() - INTERVAL '7 days'
        ), 0) AS recent_post_count
      `),
    )
    .orderBy('recent_post_count', 'desc')
    .limit(4)

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    avatarUrl: r.avatarUrl,
    memberCount: Number(r.memberCount),
    recentPostCount: Number(r.recent_post_count),
  }))
}

async function getUpcomingEvents(universityId: string, requesterId: string): Promise<EventSummary[]> {
  const rows = await db('events as e')
    .leftJoin('event_rsvps as r', function () {
      this.on('r.event_id', 'e.id').andOn('r.user_id', db.raw('?', [requesterId]))
    })
    .where('e.university_id', universityId)
    .where('e.is_published', true)
    .where('e.starts_at', '>', db.raw('NOW()'))
    .select(
      'e.id',
      'e.title',
      'e.starts_at as startsAt',
      'e.location',
      'e.cover_url as coverUrl',
      'r.status as myRsvp',
      db.raw(`
        COALESCE((SELECT COUNT(*)::int FROM event_rsvps WHERE event_id = e.id AND status = 'going'), 0) AS rsvp_count
      `),
    )
    .orderBy('rsvp_count', 'desc')
    .limit(4)

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    startsAt: toIso(r.startsAt),
    location: r.location,
    coverUrl: r.coverUrl,
    rsvpCount: Number(r.rsvp_count),
    myRsvp: r.myRsvp === 'going' || r.myRsvp === 'maybe' ? r.myRsvp : null,
  }))
}

async function getFeaturedAlumni(universityId: string, requesterId: string): Promise<UserSuggestion[]> {
  const rows = await db('users as u')
    .join('profiles as p', 'p.user_id', 'u.id')
    .leftJoin('follows as f', function () {
      this.on('f.following_id', 'u.id').andOn('f.follower_id', db.raw('?', [requesterId]))
    })
    .where('u.university_id', universityId)
    .where('u.role', 'alumni')
    .where('u.is_active', true)
    .whereNot('u.id', requesterId)
    .select(
      'u.id',
      'u.role',
      'p.full_name as fullName',
      'p.headline',
      'p.department',
      'p.batch_year as batchYear',
      'p.avatar_url as avatarUrl',
      db.raw(`(SELECT COUNT(*)::int FROM follows WHERE following_id = u.id) AS follower_count`),
      db.raw('f.follower_id IS NOT NULL AS "isFollowing"'),
    )
    .orderBy('follower_count', 'desc')
    .limit(4)

  return rows.map((r) => ({
    id: r.id,
    role: r.role,
    fullName: r.fullName,
    headline: r.headline,
    department: r.department,
    batchYear: r.batchYear,
    avatarUrl: r.avatarUrl,
    followerCount: Number(r.follower_count),
    isFollowing: Boolean(r.isFollowing),
  }))
}

// ── Public service functions ──────────────────────────────────────────────────

export async function getDiscovery(universityId: string, requesterId: string): Promise<DiscoveryResult> {
  const [trendingPosts, peopleSuggestions, activeGroups, upcomingEvents, featuredAlumni] =
    await Promise.all([
      getTrendingPosts(universityId, requesterId),
      getPeopleSuggestions(universityId, requesterId),
      getActiveGroups(universityId, requesterId),
      getUpcomingEvents(universityId, requesterId),
      getFeaturedAlumni(universityId, requesterId),
    ])

  return { trendingPosts, peopleSuggestions, activeGroups, upcomingEvents, featuredAlumni }
}

export async function getTagPosts(
  universityId: string,
  requesterId: string,
  tag: string,
  page: number,
  limit: number,
): Promise<TagPostsResult> {
  const normalizedTag = tag.toLowerCase()

  const [{ count }] = await db('posts as p')
    .join('post_tags as pt', 'pt.post_id', 'p.id')
    .join('tags as t', 't.id', 'pt.tag_id')
    .where('p.university_id', universityId)
    .whereRaw('LOWER(t.name) = ?', [normalizedTag])
    .count<[{ count: string }]>('p.id as count')

  const rows = await db('posts as p')
    .join('post_tags as pt', 'pt.post_id', 'p.id')
    .join('tags as t', 't.id', 'pt.tag_id')
    .join('users as u', 'u.id', 'p.author_id')
    .join('profiles as pr', 'pr.user_id', 'u.id')
    .where('p.university_id', universityId)
    .whereRaw('LOWER(t.name) = ?', [normalizedTag])
    .select(
      'p.id',
      'p.content',
      'p.created_at as createdAt',
      'p.author_id as authorId',
      'pr.full_name as authorName',
      'pr.avatar_url as authorAvatarUrl',
      'u.role as authorRole',
      db.raw(`COALESCE((SELECT COUNT(*)::int FROM reactions WHERE target_id = p.id AND target_type = 'post'), 0) AS reaction_count`),
      db.raw(`COALESCE((SELECT COUNT(*)::int FROM comments WHERE post_id = p.id), 0) AS comment_count`),
    )
    .orderBy('p.created_at', 'desc')
    .limit(limit)
    .offset((page - 1) * limit)

  // Related tags: top 5 co-occurring tags on posts that have this tag
  const relatedTagRows = await db('tags as t')
    .join('post_tags as pt', 'pt.tag_id', 't.id')
    .join('post_tags as pt2', 'pt2.post_id', 'pt.post_id')
    .join('tags as t2', 't2.id', 'pt2.tag_id')
    .where('t.university_id', universityId)
    .whereRaw('LOWER(t.name) = ?', [normalizedTag])
    .whereRaw('LOWER(t2.name) != ?', [normalizedTag])
    .groupBy('t2.name')
    .select<{ name: string; cnt: string }[]>('t2.name as name')
    .count('* as cnt')
    .orderBy('cnt', 'desc')
    .limit(5)

  const total = Number(count)
  return {
    items: rows.map((r) => ({
      id: r.id,
      content: r.content,
      createdAt: toIso(r.createdAt),
      authorId: r.authorId,
      authorName: r.authorName,
      authorAvatarUrl: r.authorAvatarUrl,
      authorRole: r.authorRole,
      reactionCount: Number(r.reaction_count),
      commentCount: Number(r.comment_count),
    })),
    total,
    page,
    hasMore: page * limit < total,
    relatedTags: relatedTagRows.map((r) => r.name),
  }
}
