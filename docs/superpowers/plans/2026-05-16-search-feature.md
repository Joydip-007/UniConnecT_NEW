# Search Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement full-stack search — a pg_trgm-backed backend search API and a floating in-page search panel + full `/search` results page on the frontend.

**Architecture:** Backend exposes 6 REST endpoints under `/api/v1/search` using ILIKE queries accelerated by pg_trgm GIN indexes. Frontend adds a `SearchPanel` component that floats below the TopNav search bar on any page, plus a `/search` page for paginated full results. All state lives in TanStack Query; the panel is co-located with `TopNav`.

**Tech Stack:** Express, Knex, Zod, PostgreSQL (pg_trgm extension), React 18, TanStack Query v5, Zustand, React Router v6, Vitest, Supertest, TypeScript strict

---

## File Map

### New files
```
apps/api/src/database/migrations/024_add_trgm_search_indexes.ts
apps/api/src/modules/search/schema.ts
apps/api/src/modules/search/service.ts
apps/api/src/modules/search/controller.ts
apps/api/src/modules/search/router.ts
apps/api/src/modules/search/index.ts
apps/api/src/__tests__/search.test.ts

apps/web/src/utils/highlightMatch.tsx
apps/web/src/utils/highlightMatch.test.tsx
apps/web/src/features/search/hooks/useSearchAll.ts
apps/web/src/features/search/hooks/useSearchPeople.ts
apps/web/src/features/search/hooks/useSearchPosts.ts
apps/web/src/features/search/hooks/useSearchJobs.ts
apps/web/src/features/search/hooks/useSearchEvents.ts
apps/web/src/features/search/hooks/useSearchGroups.ts
apps/web/src/features/search/components/PeopleResultCard.tsx
apps/web/src/features/search/components/PostResultCard.tsx
apps/web/src/features/search/components/GroupResultCard.tsx
apps/web/src/features/search/components/SearchPanel.tsx
apps/web/src/features/search/index.ts
```

### Modified files
```
apps/api/src/app.ts                           — register searchRouter
apps/web/src/components/TopNav.tsx            — controlled input + SearchPanel
apps/web/src/pages/SearchPage.tsx             — full results page
```

---

## Task 1: Database migration — pg_trgm extension + GIN indexes

**Files:**
- Create: `apps/api/src/database/migrations/024_add_trgm_search_indexes.ts`

- [ ] **Step 1: Create the migration file**

```typescript
// apps/api/src/database/migrations/024_add_trgm_search_indexes.ts
import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS pg_trgm')

  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_full_name_trgm
      ON profiles USING GIN (full_name gin_trgm_ops)
  `)
  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_content_trgm
      ON posts USING GIN (content gin_trgm_ops)
  `)
  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_title_trgm
      ON jobs USING GIN (title gin_trgm_ops)
  `)
  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_company_trgm
      ON jobs USING GIN (company gin_trgm_ops)
  `)
  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_title_trgm
      ON events USING GIN (title gin_trgm_ops)
  `)
  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_groups_name_trgm
      ON groups USING GIN (name gin_trgm_ops)
  `)
}

export async function down(knex: Knex) {
  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS idx_profiles_full_name_trgm')
  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS idx_posts_content_trgm')
  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS idx_jobs_title_trgm')
  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS idx_jobs_company_trgm')
  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS idx_events_title_trgm')
  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS idx_groups_name_trgm')
}
```

- [ ] **Step 2: Run the migration**

```bash
npx pnpm --filter api db:migrate
```

Expected: migration `024_add_trgm_search_indexes` appears in the output with no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/database/migrations/024_add_trgm_search_indexes.ts
git commit -m "chore(db): add pg_trgm extension and GIN search indexes"
```

---

## Task 2: Search Zod schemas

**Files:**
- Create: `apps/api/src/modules/search/schema.ts`

- [ ] **Step 1: Create the schema file**

```typescript
// apps/api/src/modules/search/schema.ts
import { z } from 'zod'

export const SearchAllQuerySchema = z.object({
  q: z.string().min(2, 'Query must be at least 2 characters').max(100),
  limit: z.coerce.number().int().min(1).max(10).default(3),
})

export const SearchPagedQuerySchema = z.object({
  q: z.string().min(2, 'Query must be at least 2 characters').max(100),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export type SearchAllQuery = z.infer<typeof SearchAllQuerySchema>
export type SearchPagedQuery = z.infer<typeof SearchPagedQuerySchema>
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/search/schema.ts
git commit -m "feat(search): add search Zod schemas"
```

---

## Task 3: Search service — people, posts, jobs, events, groups

**Files:**
- Create: `apps/api/src/modules/search/service.ts`

The service exports 6 functions: `searchPeople`, `searchPosts`, `searchJobs`, `searchEvents`, `searchGroups`, and `searchAll`. Each accepts `(universityId: string, q: string, page: number, limit: number)`. `searchAll` accepts `(universityId: string, q: string, limit: number)`.

All queries filter by `university_id` and use `ILIKE '%q%'`.

- [ ] **Step 1: Create the service file**

```typescript
// apps/api/src/modules/search/service.ts
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

  // Fetch reaction + comment counts in one query per batch
  const postIds = rows.map((r) => r.id)

  const reactionCounts =
    postIds.length === 0
      ? []
      : await db('reactions').whereIn('post_id', postIds).groupBy('post_id').select(
          'post_id',
          db.raw('count(*) as cnt'),
        )

  const commentCounts =
    postIds.length === 0
      ? []
      : await db('comments').whereIn('post_id', postIds).groupBy('post_id').select(
          'post_id',
          db.raw('count(*) as cnt'),
        )

  const rcMap = Object.fromEntries(reactionCounts.map((r) => [r.post_id, Number(r.cnt)]))
  const ccMap = Object.fromEntries(commentCounts.map((r) => [r.post_id, Number(r.cnt)]))

  const items: PostSearchResult[] = rows.map((r) => ({
    id: r.id,
    content: r.content,
    createdAt: r.createdAt,
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
    deadline: r.deadline ? r.deadline.toISOString() : null,
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
    myRsvp: (r.myRsvp === 'going' || r.myRsvp === 'maybe') ? r.myRsvp : null,
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/search/service.ts
git commit -m "feat(search): add search service with ILIKE queries"
```

---

## Task 4: Search controller + router + barrel

**Files:**
- Create: `apps/api/src/modules/search/controller.ts`
- Create: `apps/api/src/modules/search/router.ts`
- Create: `apps/api/src/modules/search/index.ts`

- [ ] **Step 1: Create controller**

```typescript
// apps/api/src/modules/search/controller.ts
import type { Request, Response } from 'express'
import { asyncHandler } from '../../utils/asyncHandler'
import { sendSuccess, sendPaginated } from '../../utils/response'
import {
  searchAll,
  searchPeople,
  searchPosts,
  searchJobs,
  searchEvents,
  searchGroups,
} from './service'
import type { SearchAllQuery, SearchPagedQuery } from './schema'

export const handleSearchAll = asyncHandler(async (req: Request, res: Response) => {
  const { q, limit } = req.query as unknown as SearchAllQuery
  const universityId = req.university.id
  const requesterId = req.user.userId

  const result = await searchAll(universityId, q, limit, requesterId)
  sendSuccess(res, result)
})

export const handleSearchPeople = asyncHandler(async (req: Request, res: Response) => {
  const { q, page, limit } = req.query as unknown as SearchPagedQuery
  const { items, total } = await searchPeople(req.university.id, q, page, limit, req.user.userId)
  sendPaginated(res, items, total, page, limit)
})

export const handleSearchPosts = asyncHandler(async (req: Request, res: Response) => {
  const { q, page, limit } = req.query as unknown as SearchPagedQuery
  const { items, total } = await searchPosts(req.university.id, q, page, limit)
  sendPaginated(res, items, total, page, limit)
})

export const handleSearchJobs = asyncHandler(async (req: Request, res: Response) => {
  const { q, page, limit } = req.query as unknown as SearchPagedQuery
  const { items, total } = await searchJobs(req.university.id, q, page, limit)
  sendPaginated(res, items, total, page, limit)
})

export const handleSearchEvents = asyncHandler(async (req: Request, res: Response) => {
  const { q, page, limit } = req.query as unknown as SearchPagedQuery
  const { items, total } = await searchEvents(req.university.id, q, page, limit, req.user.userId)
  sendPaginated(res, items, total, page, limit)
})

export const handleSearchGroups = asyncHandler(async (req: Request, res: Response) => {
  const { q, page, limit } = req.query as unknown as SearchPagedQuery
  const { items, total } = await searchGroups(req.university.id, q, page, limit, req.user.userId)
  sendPaginated(res, items, total, page, limit)
})
```

- [ ] **Step 2: Create router**

```typescript
// apps/api/src/modules/search/router.ts
import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { resolveUniversity } from '../../middleware/university'
import { validateRequest } from '../../middleware/validate'
import { SearchAllQuerySchema, SearchPagedQuerySchema } from './schema'
import {
  handleSearchAll,
  handleSearchPeople,
  handleSearchPosts,
  handleSearchJobs,
  handleSearchEvents,
  handleSearchGroups,
} from './controller'

export const searchRouter = Router()

searchRouter.use(requireAuth, resolveUniversity)

searchRouter.get('/', validateRequest({ query: SearchAllQuerySchema }), handleSearchAll)
searchRouter.get('/people', validateRequest({ query: SearchPagedQuerySchema }), handleSearchPeople)
searchRouter.get('/posts', validateRequest({ query: SearchPagedQuerySchema }), handleSearchPosts)
searchRouter.get('/jobs', validateRequest({ query: SearchPagedQuerySchema }), handleSearchJobs)
searchRouter.get('/events', validateRequest({ query: SearchPagedQuerySchema }), handleSearchEvents)
searchRouter.get('/groups', validateRequest({ query: SearchPagedQuerySchema }), handleSearchGroups)
```

- [ ] **Step 3: Create barrel**

```typescript
// apps/api/src/modules/search/index.ts
export { searchRouter } from './router'
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/search/
git commit -m "feat(search): add search controller, router, and barrel"
```

---

## Task 5: Register search module in app.ts

**Files:**
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: Add import and route registration**

In `apps/api/src/app.ts`, add the import alongside the other module imports:

```typescript
import { searchRouter } from './modules/search'
```

Then add the route registration after the other `app.use` calls (e.g., after the `mentorshipRouter` line):

```typescript
app.use('/api/v1/search', searchRouter)
```

- [ ] **Step 2: Verify the app starts**

```bash
npx pnpm --filter api dev
```

Expected: server starts on port 4000 with no errors. Kill with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/app.ts
git commit -m "feat(search): register search router in app"
```

---

## Task 6: Backend integration tests

**Files:**
- Create: `apps/api/src/__tests__/search.test.ts`

The test setup (`apps/api/src/__tests__/setup.ts`) already seeds 4 users (admin, staff, alumni, student) at `TEST_UNIVERSITY_ID`. We insert test data in `beforeAll` and clean up in `afterAll`.

- [ ] **Step 1: Write the test file**

```typescript
// apps/api/src/__tests__/search.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { app, loginAs, DOMAIN, TEST_UNIVERSITY_ID, CREDENTIALS } from './setup'
import { db } from '../config/db'

const api = supertest(app)
const UNI = { 'x-university-domain': DOMAIN }

let token: string
let testPostId: string
let testJobId: string
let testEventId: string
let testGroupId: string
let studentUserId: string

beforeAll(async () => {
  const { accessToken } = await loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password)
  token = accessToken

  const auth = { Authorization: `Bearer ${token}` }

  // Find student user id
  const student = await db('users').where('email', CREDENTIALS.student.email).first()
  studentUserId = student.id

  // Insert test post
  const [post] = await db('posts')
    .insert({
      university_id: TEST_UNIVERSITY_ID,
      author_id: studentUserId,
      type: 'post',
      content: 'Looking for a Searchable teammate for the hackathon',
    })
    .returning('id')
  testPostId = post.id

  // Insert test job
  const [job] = await db('jobs')
    .insert({
      university_id: TEST_UNIVERSITY_ID,
      posted_by: studentUserId,
      title: 'Searchable Engineer Position',
      company: 'AcmeCorp',
      location: 'Dhaka',
      type: 'full_time',
      description: 'Test job',
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      is_active: true,
    })
    .returning('id')
  testJobId = job.id

  // Insert test event
  const [event] = await db('events')
    .insert({
      university_id: TEST_UNIVERSITY_ID,
      organizer_id: studentUserId,
      title: 'Searchable Tech Seminar',
      description: 'Test event',
      location: 'UIU Campus',
      starts_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      type: 'seminar',
      is_published: true,
    })
    .returning('id')
  testEventId = event.id

  // Insert test group
  const [group] = await db('groups')
    .insert({
      university_id: TEST_UNIVERSITY_ID,
      created_by: studentUserId,
      name: 'Searchable Coders Club',
      description: 'Test group',
      type: 'club',
      member_count: 1,
    })
    .returning('id')
  testGroupId = group.id
})

afterAll(async () => {
  await db('group_members').where('group_id', testGroupId).delete()
  await db('groups').where('id', testGroupId).delete()
  await db('events').where('id', testEventId).delete()
  await db('jobs').where('id', testJobId).delete()
  await db('posts').where('id', testPostId).delete()
})

describe('GET /api/v1/search — omnibus', () => {
  it('returns 401 without auth', async () => {
    const res = await api.get('/api/v1/search').set(UNI).query({ q: 'test' })
    expect(res.status).toBe(401)
  })

  it('returns 422 when q is shorter than 2 chars', async () => {
    const res = await api
      .get('/api/v1/search')
      .set(UNI)
      .set('Authorization', `Bearer ${token}`)
      .query({ q: 'a' })
    expect(res.status).toBe(422)
  })

  it('returns all categories for a matching query', async () => {
    const res = await api
      .get('/api/v1/search')
      .set(UNI)
      .set('Authorization', `Bearer ${token}`)
      .query({ q: 'Searchable', limit: 3 })

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveProperty('people')
    expect(res.body.data).toHaveProperty('posts')
    expect(res.body.data).toHaveProperty('jobs')
    expect(res.body.data).toHaveProperty('events')
    expect(res.body.data).toHaveProperty('groups')

    expect(res.body.data.posts.some((p: { id: string }) => p.id === testPostId)).toBe(true)
    expect(res.body.data.jobs.some((j: { id: string }) => j.id === testJobId)).toBe(true)
    expect(res.body.data.events.some((e: { id: string }) => e.id === testEventId)).toBe(true)
    expect(res.body.data.groups.some((g: { id: string }) => g.id === testGroupId)).toBe(true)
  })
})

describe('GET /api/v1/search/people', () => {
  it('returns paginated people with isFollowing flag', async () => {
    const res = await api
      .get('/api/v1/search/people')
      .set(UNI)
      .set('Authorization', `Bearer ${token}`)
      .query({ q: 'User', page: 1, limit: 20 })

    expect(res.status).toBe(200)
    const { items, hasMore, page } = res.body.data
    expect(Array.isArray(items)).toBe(true)
    expect(typeof hasMore).toBe('boolean')
    expect(page).toBe(1)
    if (items.length > 0) {
      expect(items[0]).toHaveProperty('id')
      expect(items[0]).toHaveProperty('fullName')
      expect(items[0]).toHaveProperty('isFollowing')
    }
  })
})

describe('GET /api/v1/search/posts', () => {
  it('finds the seeded test post', async () => {
    const res = await api
      .get('/api/v1/search/posts')
      .set(UNI)
      .set('Authorization', `Bearer ${token}`)
      .query({ q: 'Searchable', page: 1, limit: 20 })

    expect(res.status).toBe(200)
    const { items } = res.body.data
    expect(items.some((p: { id: string }) => p.id === testPostId)).toBe(true)
    const post = items.find((p: { id: string }) => p.id === testPostId)
    expect(post).toHaveProperty('author')
    expect(post.author).toHaveProperty('fullName')
  })
})

describe('GET /api/v1/search/jobs', () => {
  it('finds the seeded test job', async () => {
    const res = await api
      .get('/api/v1/search/jobs')
      .set(UNI)
      .set('Authorization', `Bearer ${token}`)
      .query({ q: 'Searchable', page: 1, limit: 20 })

    expect(res.status).toBe(200)
    expect(res.body.data.items.some((j: { id: string }) => j.id === testJobId)).toBe(true)
  })
})

describe('GET /api/v1/search/events', () => {
  it('finds the seeded test event and includes myRsvp', async () => {
    const res = await api
      .get('/api/v1/search/events')
      .set(UNI)
      .set('Authorization', `Bearer ${token}`)
      .query({ q: 'Searchable', page: 1, limit: 20 })

    expect(res.status).toBe(200)
    const event = res.body.data.items.find((e: { id: string }) => e.id === testEventId)
    expect(event).toBeDefined()
    expect(event).toHaveProperty('myRsvp')
  })
})

describe('GET /api/v1/search/groups', () => {
  it('finds the seeded test group and includes isMember', async () => {
    const res = await api
      .get('/api/v1/search/groups')
      .set(UNI)
      .set('Authorization', `Bearer ${token}`)
      .query({ q: 'Searchable', page: 1, limit: 20 })

    expect(res.status).toBe(200)
    const group = res.body.data.items.find((g: { id: string }) => g.id === testGroupId)
    expect(group).toBeDefined()
    expect(group).toHaveProperty('isMember')
  })
})
```

- [ ] **Step 2: Run the tests**

```bash
npx pnpm --filter api test src/__tests__/search.test.ts
```

Expected: all tests PASS. If any fail, check that the migration ran (`npx pnpm --filter api db:migrate`) and that the app is not already running on port 4000.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/__tests__/search.test.ts
git commit -m "test(search): add integration tests for all search endpoints"
```

---

## Task 7: `highlightMatch` utility + unit test

**Files:**
- Create: `apps/web/src/utils/highlightMatch.tsx`
- Create: `apps/web/src/utils/highlightMatch.test.tsx`

- [ ] **Step 1: Write the failing test first**

```tsx
// apps/web/src/utils/highlightMatch.test.tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { highlightMatch } from './highlightMatch'

function renderNode(node: React.ReactNode) {
  const { container } = render(<span>{node}</span>)
  return container
}

describe('highlightMatch', () => {
  it('returns plain string when query is empty', () => {
    const result = highlightMatch('Hello World', '')
    expect(result).toBe('Hello World')
  })

  it('returns plain string when query is shorter than 2 chars', () => {
    const result = highlightMatch('Hello World', 'H')
    expect(result).toBe('Hello World')
  })

  it('wraps matched substring in a mark element', () => {
    const container = renderNode(highlightMatch('Hello World', 'World'))
    const mark = container.querySelector('mark')
    expect(mark).not.toBeNull()
    expect(mark?.textContent).toBe('World')
  })

  it('is case-insensitive', () => {
    const container = renderNode(highlightMatch('Hello World', 'hello'))
    const mark = container.querySelector('mark')
    expect(mark).not.toBeNull()
    expect(mark?.textContent).toBe('Hello')
  })

  it('highlights multiple occurrences', () => {
    const container = renderNode(highlightMatch('rafi and rafi', 'rafi'))
    const marks = container.querySelectorAll('mark')
    expect(marks.length).toBe(2)
  })

  it('escapes regex special characters in query', () => {
    expect(() => renderNode(highlightMatch('1+1=2', '1+1'))).not.toThrow()
    const container = renderNode(highlightMatch('1+1=2', '1+1'))
    const mark = container.querySelector('mark')
    expect(mark?.textContent).toBe('1+1')
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx pnpm --filter web test src/utils/highlightMatch.test.tsx
```

Expected: FAIL — "Cannot find module './highlightMatch'"

- [ ] **Step 3: Implement the utility**

```tsx
// apps/web/src/utils/highlightMatch.tsx
import React from 'react'

export function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || query.length < 2) return text

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const splitRe = new RegExp(`(${escaped})`, 'gi')
  const matchRe = new RegExp(`^${escaped}$`, 'i')
  const parts = text.split(splitRe)

  return parts.map((part, i) =>
    matchRe.test(part) ? (
      <mark
        key={i}
        style={{
          background: 'var(--uc-indigo-bg)',
          color: 'var(--uc-indigo-xl)',
          borderRadius: 2,
          padding: '0 2px',
        }}
      >
        {part}
      </mark>
    ) : (
      part
    ),
  )
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx pnpm --filter web test src/utils/highlightMatch.test.tsx
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/utils/highlightMatch.tsx apps/web/src/utils/highlightMatch.test.tsx
git commit -m "feat(search): add highlightMatch utility with tests"
```

---

## Task 8: Search hooks

**Files:**
- Create: `apps/web/src/features/search/hooks/useSearchAll.ts`
- Create: `apps/web/src/features/search/hooks/useSearchPeople.ts`
- Create: `apps/web/src/features/search/hooks/useSearchPosts.ts`
- Create: `apps/web/src/features/search/hooks/useSearchJobs.ts`
- Create: `apps/web/src/features/search/hooks/useSearchEvents.ts`
- Create: `apps/web/src/features/search/hooks/useSearchGroups.ts`

All hooks use `api` from `@/lib/axios`, follow the project convention of `{ data: T }` response wrapping, and are `enabled` only when `q.length >= 2`.

- [ ] **Step 1: Create `useSearchAll`**

```typescript
// apps/web/src/features/search/hooks/useSearchAll.ts
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type {
  UserSearchResult,
  PostSearchResult,
  JobSearchResult,
  EventSearchResult,
  GroupSearchResult,
} from '../types'

interface SearchAllResult {
  people: UserSearchResult[]
  posts: PostSearchResult[]
  jobs: JobSearchResult[]
  events: EventSearchResult[]
  groups: GroupSearchResult[]
}

export function useSearchAll(q: string, limit = 3) {
  return useQuery<SearchAllResult>({
    queryKey: ['search', 'all', { q }],
    queryFn: () =>
      api
        .get<{ data: SearchAllResult }>('/search', { params: { q, limit } })
        .then((r) => r.data.data),
    enabled: q.length >= 2,
    staleTime: 30_000,
  })
}
```

- [ ] **Step 2: Create shared types file**

Create `apps/web/src/features/search/types.ts` — these types mirror what the backend returns:

```typescript
// apps/web/src/features/search/types.ts
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

export interface PagedResult<T> {
  items: T[]
  total: number
  page: number
  hasMore: boolean
}
```

Update `useSearchAll.ts` to import from `'../types'` instead of duplicating.

- [ ] **Step 3: Create the 5 paged hooks**

```typescript
// apps/web/src/features/search/hooks/useSearchPeople.ts
import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { PagedResult, UserSearchResult } from '../types'

export function useSearchPeople(q: string, limit = 20) {
  return useInfiniteQuery<PagedResult<UserSearchResult>>({
    queryKey: ['search', 'people', { q }],
    queryFn: ({ pageParam = 1 }) =>
      api
        .get<{ data: PagedResult<UserSearchResult> }>('/search/people', {
          params: { q, page: pageParam, limit },
        })
        .then((r) => r.data.data),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: q.length >= 2,
    staleTime: 30_000,
  })
}
```

```typescript
// apps/web/src/features/search/hooks/useSearchPosts.ts
import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { PagedResult, PostSearchResult } from '../types'

export function useSearchPosts(q: string, limit = 20) {
  return useInfiniteQuery<PagedResult<PostSearchResult>>({
    queryKey: ['search', 'posts', { q }],
    queryFn: ({ pageParam = 1 }) =>
      api
        .get<{ data: PagedResult<PostSearchResult> }>('/search/posts', {
          params: { q, page: pageParam, limit },
        })
        .then((r) => r.data.data),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: q.length >= 2,
    staleTime: 30_000,
  })
}
```

```typescript
// apps/web/src/features/search/hooks/useSearchJobs.ts
import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { PagedResult, JobSearchResult } from '../types'

export function useSearchJobs(q: string, limit = 20) {
  return useInfiniteQuery<PagedResult<JobSearchResult>>({
    queryKey: ['search', 'jobs', { q }],
    queryFn: ({ pageParam = 1 }) =>
      api
        .get<{ data: PagedResult<JobSearchResult> }>('/search/jobs', {
          params: { q, page: pageParam, limit },
        })
        .then((r) => r.data.data),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: q.length >= 2,
    staleTime: 30_000,
  })
}
```

```typescript
// apps/web/src/features/search/hooks/useSearchEvents.ts
import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { PagedResult, EventSearchResult } from '../types'

export function useSearchEvents(q: string, limit = 20) {
  return useInfiniteQuery<PagedResult<EventSearchResult>>({
    queryKey: ['search', 'events', { q }],
    queryFn: ({ pageParam = 1 }) =>
      api
        .get<{ data: PagedResult<EventSearchResult> }>('/search/events', {
          params: { q, page: pageParam, limit },
        })
        .then((r) => r.data.data),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: q.length >= 2,
    staleTime: 30_000,
  })
}
```

```typescript
// apps/web/src/features/search/hooks/useSearchGroups.ts
import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { PagedResult, GroupSearchResult } from '../types'

export function useSearchGroups(q: string, limit = 20) {
  return useInfiniteQuery<PagedResult<GroupSearchResult>>({
    queryKey: ['search', 'groups', { q }],
    queryFn: ({ pageParam = 1 }) =>
      api
        .get<{ data: PagedResult<GroupSearchResult> }>('/search/groups', {
          params: { q, page: pageParam, limit },
        })
        .then((r) => r.data.data),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: q.length >= 2,
    staleTime: 30_000,
  })
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/search/
git commit -m "feat(search): add search hooks and shared types"
```

---

## Task 9: `PeopleResultCard` component

**Files:**
- Create: `apps/web/src/features/search/components/PeopleResultCard.tsx`

This card shows in both the floating panel and SearchPage. It renders avatar + name (highlighted) + headline + department/batch. Follow/unfollow via inline mutation calling `POST /users/:id/follow` / `DELETE /users/:id/follow`. Follow state is optimistic.

- [ ] **Step 1: Create the component**

```tsx
// apps/web/src/features/search/components/PeopleResultCard.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { Avatar } from '@/components/Avatar'
import { GhostBtn, PrimaryBtn } from '@/components/Button'
import { highlightMatch } from '@/utils/highlightMatch'
import { PATHS } from '@/router/paths'
import type { UserSearchResult } from '../types'

const AVATAR_PALETTE = ['var(--uc-indigo)', 'var(--uc-orange)', 'var(--uc-cyan)', 'var(--uc-mint)']

function seedColor(id: string): string {
  const sum = [...id].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_PALETTE[sum % AVATAR_PALETTE.length]
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
}

interface Props {
  person: UserSearchResult
  query: string
  compact?: boolean
}

export function PeopleResultCard({ person, query, compact = false }: Props) {
  const navigate = useNavigate()
  const [following, setFollowing] = useState(person.isFollowing)

  const followMutation = useMutation({
    mutationFn: (wasFollowing: boolean) =>
      wasFollowing
        ? api.delete(`/users/${person.id}/follow`)
        : api.post(`/users/${person.id}/follow`),
    onError: (_err, wasFollowing) => setFollowing(wasFollowing),
  })

  function handleFollow(e: React.MouseEvent) {
    e.stopPropagation()
    const was = following
    setFollowing(!was)
    followMutation.mutate(was)
  }

  const avatarSize = compact ? 32 : 40

  return (
    <div
      onClick={() => navigate(PATHS.PROFILE.replace(':id', person.id))}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: compact ? '9px 0' : '12px 0',
        cursor: 'pointer',
        borderBottom: '0.5px solid var(--border-default)',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = '0.85' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = '1' }}
    >
      <Avatar
        initials={getInitials(person.fullName)}
        color={person.avatarUrl ? undefined : seedColor(person.id)}
        size={avatarSize}
        src={person.avatarUrl ?? undefined}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4 }}>
          {highlightMatch(person.fullName, query)}
        </div>
        {person.headline && (
          <div
            style={{
              fontSize: 12,
              fontWeight: 400,
              color: 'var(--text-secondary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {person.headline}
          </div>
        )}
        {(person.department || person.batchYear) && (
          <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)' }}>
            {[person.department, person.batchYear ? `'${person.batchYear.slice(-2)}` : null]
              .filter(Boolean)
              .join(' · ')}
          </div>
        )}
      </div>

      <div onClick={(e) => e.stopPropagation()}>
        {following ? (
          <GhostBtn onClick={handleFollow} style={{ fontSize: 12, padding: '4px 12px' }}>
            Following
          </GhostBtn>
        ) : (
          <PrimaryBtn onClick={handleFollow} style={{ fontSize: 12, padding: '4px 12px' }}>
            Follow
          </PrimaryBtn>
        )}
      </div>
    </div>
  )
}
```

Note: if `Avatar` does not accept a `src` prop, check `apps/web/src/components/Avatar.tsx` and pass `avatarUrl` accordingly — the component may use `initials` + `color` only. In that case, remove the `src` prop and keep `initials`/`color`.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/search/components/PeopleResultCard.tsx
git commit -m "feat(search): add PeopleResultCard component"
```

---

## Task 10: `PostResultCard` component

**Files:**
- Create: `apps/web/src/features/search/components/PostResultCard.tsx`

Compact card: author avatar + name + 2-line content preview with highlight + reaction/comment counts. Clicking navigates to `/feed#post-{id}`.

- [ ] **Step 1: Create the component**

```tsx
// apps/web/src/features/search/components/PostResultCard.tsx
import { useNavigate } from 'react-router-dom'
import { MessageCircle, ThumbsUp } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { highlightMatch } from '@/utils/highlightMatch'
import { PATHS } from '@/router/paths'
import type { PostSearchResult } from '../types'

const AVATAR_PALETTE = ['var(--uc-indigo)', 'var(--uc-orange)', 'var(--uc-cyan)', 'var(--uc-mint)']

function seedColor(id: string): string {
  const sum = [...id].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_PALETTE[sum % AVATAR_PALETTE.length]
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
}

interface Props {
  post: PostSearchResult
  query: string
}

export function PostResultCard({ post, query }: Props) {
  const navigate = useNavigate()

  return (
    <div
      onClick={() => navigate(`${PATHS.FEED}#post-${post.id}`)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '12px 0',
        cursor: 'pointer',
        borderBottom: '0.5px solid var(--border-default)',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = '0.85' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = '1' }}
    >
      <Avatar
        initials={getInitials(post.author.fullName)}
        color={seedColor(post.author.id)}
        size={32}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 3 }}>
          {post.author.fullName}
        </div>

        <div
          style={{
            fontSize: 13,
            fontWeight: 400,
            color: 'var(--text-primary)',
            lineHeight: 1.55,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {highlightMatch(post.content, query)}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginTop: 6,
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              fontWeight: 400,
              color: 'var(--text-tertiary)',
            }}
          >
            <ThumbsUp size={11} strokeWidth={1.5} />
            {post.reactionCount}
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              fontWeight: 400,
              color: 'var(--text-tertiary)',
            }}
          >
            <MessageCircle size={11} strokeWidth={1.5} />
            {post.commentCount}
          </span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/search/components/PostResultCard.tsx
git commit -m "feat(search): add PostResultCard component"
```

---

## Task 11: `GroupResultCard` component

**Files:**
- Create: `apps/web/src/features/search/components/GroupResultCard.tsx`

Shows group avatar + name + type badge + member count + join/leave button. Clicking navigates to `/groups/:id`. Join/leave via inline mutation.

- [ ] **Step 1: Create the component**

```tsx
// apps/web/src/features/search/components/GroupResultCard.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import { api } from '@/lib/axios'
import { GhostBtn, PrimaryBtn } from '@/components/Button'
import { PATHS } from '@/router/paths'
import type { GroupSearchResult } from '../types'

const AVATAR_PALETTE = ['#5B5BD6', '#F05A28', '#06B6D4', '#10B981', '#8B5CF6']

function seedColor(id: string): string {
  let hash = 0
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return (parts[0]![0] ?? '').toUpperCase()
  return ((parts[0]![0] ?? '') + (parts[parts.length - 1]![0] ?? '')).toUpperCase()
}

const TYPE_LABEL: Record<string, string> = {
  department: 'Department',
  club: 'Club',
  batch: 'Batch',
  research: 'Research',
  interest: 'Interest',
  other: 'Other',
}

interface Props {
  group: GroupSearchResult
}

export function GroupResultCard({ group }: Props) {
  const navigate = useNavigate()
  const [isMember, setIsMember] = useState(group.isMember)
  const [memberCount, setMemberCount] = useState(group.memberCount)

  const joinMutation = useMutation({
    mutationFn: (wasMember: boolean) =>
      wasMember ? api.delete(`/groups/${group.id}/leave`) : api.post(`/groups/${group.id}/join`),
    onError: (_err, wasMember) => {
      setIsMember(wasMember)
      setMemberCount((c) => (wasMember ? c + 1 : c - 1))
    },
  })

  function handleJoin(e: React.MouseEvent) {
    e.stopPropagation()
    const was = isMember
    setIsMember(!was)
    setMemberCount((c) => (was ? c - 1 : c + 1))
    joinMutation.mutate(was)
  }

  const avatarColor = seedColor(group.id)

  return (
    <div
      onClick={() => navigate(PATHS.GROUP_DETAIL.replace(':id', group.id))}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 0',
        cursor: 'pointer',
        borderBottom: '0.5px solid var(--border-default)',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = '0.85' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = '1' }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 'var(--r-md)',
          background: group.avatarUrl ? undefined : avatarColor,
          backgroundImage: group.avatarUrl ? `url(${group.avatarUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
          fontWeight: 500,
          color: '#fff',
          flexShrink: 0,
        }}
      >
        {!group.avatarUrl && getInitials(group.name)}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{group.name}</div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 3,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              padding: '1px 8px',
              borderRadius: 'var(--r-pill)',
              background: 'var(--uc-indigo-bg)',
              color: 'var(--uc-indigo-xl)',
            }}
          >
            {TYPE_LABEL[group.type] ?? group.type}
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 11,
              fontWeight: 400,
              color: 'var(--text-tertiary)',
            }}
          >
            <Users size={10} strokeWidth={1.5} />
            {memberCount.toLocaleString()}
          </span>
        </div>
      </div>

      <div onClick={(e) => e.stopPropagation()}>
        {isMember ? (
          <GhostBtn onClick={handleJoin} style={{ fontSize: 12, padding: '4px 12px' }}>
            Joined
          </GhostBtn>
        ) : (
          <PrimaryBtn onClick={handleJoin} style={{ fontSize: 12, padding: '4px 12px' }}>
            Join
          </PrimaryBtn>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/search/components/GroupResultCard.tsx
git commit -m "feat(search): add GroupResultCard component"
```

---

## Task 12: `SearchPanel` component

**Files:**
- Create: `apps/web/src/features/search/components/SearchPanel.tsx`

This is the floating panel rendered inside TopNav. It receives `q` (the current query string), `onClose` callback, and `onViewAll` callback. It manages its own active tab state. Uses `useSearchAll` for the All tab and the paged hooks for per-type tabs. Shows skeleton rows while loading, empty message if no results. "See all" links call `onViewAll(tab)`. Clicking a result calls `onClose()` after navigation so the panel dismisses.

- [ ] **Step 1: Create the component**

```tsx
// apps/web/src/features/search/components/SearchPanel.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useSearchAll } from '../hooks/useSearchAll'
import { useSearchPeople } from '../hooks/useSearchPeople'
import { useSearchPosts } from '../hooks/useSearchPosts'
import { useSearchJobs } from '../hooks/useSearchJobs'
import { useSearchEvents } from '../hooks/useSearchEvents'
import { useSearchGroups } from '../hooks/useSearchGroups'
import { PeopleResultCard } from './PeopleResultCard'
import { PostResultCard } from './PostResultCard'
import { GroupResultCard } from './GroupResultCard'
import { PATHS } from '@/router/paths'
import { format, parseISO } from 'date-fns'
import type { JobSearchResult, EventSearchResult } from '../types'

type PanelTab = 'all' | 'people' | 'posts' | 'jobs' | 'events' | 'groups'

const TABS: { label: string; value: PanelTab }[] = [
  { label: 'All', value: 'all' },
  { label: 'People', value: 'people' },
  { label: 'Posts', value: 'posts' },
  { label: 'Jobs', value: 'jobs' },
  { label: 'Events', value: 'events' },
  { label: 'Groups', value: 'groups' },
]

const SHIMMER: React.CSSProperties = {
  background: 'var(--surface-raised)',
  animation: 'shimmer 1.6s ease-in-out infinite',
  borderRadius: 'var(--r-sm)',
}

function SkeletonRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, ...SHIMMER }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ height: 12, width: '45%', ...SHIMMER }} />
        <div style={{ height: 10, width: '65%', ...SHIMMER }} />
      </div>
    </div>
  )
}

function SeeAllRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '6px 0 10px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 500,
        color: 'var(--uc-indigo-l)',
      }}
    >
      <ArrowRight size={12} strokeWidth={1.5} />
      {label}
    </button>
  )
}

function JobRow({ job, onClick }: { job: JobSearchResult; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 0',
        cursor: 'pointer',
        borderBottom: '0.5px solid var(--border-default)',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 'var(--r-sm)',
          background: 'var(--uc-indigo-bg)',
          border: '0.5px solid var(--uc-indigo-bdr)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--uc-indigo-xl)',
          flexShrink: 0,
        }}
      >
        {job.company.charAt(0).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {job.title}
        </div>
        <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)' }}>
          {job.company} · {job.location}
        </div>
      </div>
    </div>
  )
}

function EventRow({ event, onClick }: { event: EventSearchResult; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 0',
        cursor: 'pointer',
        borderBottom: '0.5px solid var(--border-default)',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 'var(--r-sm)',
          background: event.coverUrl ? undefined : 'var(--uc-orange-bg)',
          backgroundImage: event.coverUrl ? `url(${event.coverUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          border: '0.5px solid var(--uc-orange-bdr)',
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {event.title}
        </div>
        <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)' }}>
          {format(parseISO(event.startsAt), 'MMM d · h:mm a')} · {event.location}
        </div>
      </div>
      {event.myRsvp && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            padding: '2px 7px',
            borderRadius: 'var(--r-pill)',
            background: 'var(--uc-indigo-bg)',
            color: 'var(--uc-indigo-xl)',
            flexShrink: 0,
          }}
        >
          {event.myRsvp === 'going' ? 'Going' : 'Maybe'}
        </span>
      )}
    </div>
  )
}

interface Props {
  q: string
  onClose: () => void
}

export function SearchPanel({ q, onClose }: Props) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<PanelTab>('all')

  const allQuery = useSearchAll(q, 3)
  const peopleQuery = useSearchPeople(q)
  const postsQuery = useSearchPosts(q)
  const jobsQuery = useSearchJobs(q)
  const eventsQuery = useSearchEvents(q)
  const groupsQuery = useSearchGroups(q)

  function goTo(path: string) {
    onClose()
    navigate(path)
  }

  function seeAll(tab: PanelTab) {
    goTo(`${PATHS.SEARCH}?q=${encodeURIComponent(q)}&tab=${tab}`)
  }

  function renderAllTab() {
    if (allQuery.isLoading) {
      return (
        <div style={{ padding: '0 16px' }}>
          {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      )
    }

    const data = allQuery.data
    if (!data) return null

    const hasAny =
      data.people.length + data.posts.length + data.jobs.length +
      data.events.length + data.groups.length > 0

    if (!hasAny) {
      return (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
          Nothing found for "{q}". Try a different keyword.
        </div>
      )
    }

    return (
      <>
        {data.people.length > 0 && (
          <section style={{ padding: '8px 16px 0' }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>
              People
            </div>
            {data.people.map((p) => (
              <div key={p.id} onClick={onClose}>
                <PeopleResultCard person={p} query={q} compact />
              </div>
            ))}
            <SeeAllRow label="See all people results" onClick={() => seeAll('people')} />
          </section>
        )}

        {data.posts.length > 0 && (
          <section style={{ padding: '0 16px', borderTop: data.people.length > 0 ? '0.5px solid var(--border-default)' : undefined }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '10px 0 2px' }}>
              Posts
            </div>
            {data.posts.map((p) => (
              <div key={p.id} onClick={onClose}>
                <PostResultCard post={p} query={q} />
              </div>
            ))}
            <SeeAllRow label="See all post results" onClick={() => seeAll('posts')} />
          </section>
        )}

        {data.jobs.length > 0 && (
          <section style={{ padding: '0 16px', borderTop: '0.5px solid var(--border-default)' }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '10px 0 2px' }}>
              Jobs
            </div>
            {data.jobs.map((j) => (
              <JobRow key={j.id} job={j} onClick={() => goTo(PATHS.JOB_DETAIL.replace(':id', j.id))} />
            ))}
            <SeeAllRow label="See all job results" onClick={() => seeAll('jobs')} />
          </section>
        )}

        {data.events.length > 0 && (
          <section style={{ padding: '0 16px', borderTop: '0.5px solid var(--border-default)' }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '10px 0 2px' }}>
              Events
            </div>
            {data.events.map((e) => (
              <EventRow key={e.id} event={e} onClick={() => goTo(PATHS.EVENT_DETAIL.replace(':id', e.id))} />
            ))}
            <SeeAllRow label="See all event results" onClick={() => seeAll('events')} />
          </section>
        )}

        {data.groups.length > 0 && (
          <section style={{ padding: '0 16px', borderTop: '0.5px solid var(--border-default)' }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '10px 0 2px' }}>
              Groups
            </div>
            {data.groups.map((g) => (
              <div key={g.id} onClick={onClose}>
                <GroupResultCard group={g} />
              </div>
            ))}
            <SeeAllRow label="See all group results" onClick={() => seeAll('groups')} />
          </section>
        )}

        {/* Footer */}
        <div
          style={{
            borderTop: '0.5px solid var(--border-default)',
            padding: '10px 16px',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={() => goTo(`${PATHS.SEARCH}?q=${encodeURIComponent(q)}`)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--uc-indigo-l)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            View all results for "{q}"
            <ArrowRight size={11} strokeWidth={1.5} />
          </button>
        </div>
      </>
    )
  }

  function renderPagedTab() {
    const queryMap = {
      people: peopleQuery,
      posts: postsQuery,
      jobs: jobsQuery,
      events: eventsQuery,
      groups: groupsQuery,
    }
    const q_ = activeTab === 'all' ? allQuery : queryMap[activeTab as keyof typeof queryMap]
    const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = q_ as ReturnType<typeof useSearchPeople>

    if (isLoading) {
      return (
        <div style={{ padding: '0 16px' }}>
          {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      )
    }

    const items = data?.pages.flatMap((p) => p.items) ?? []

    if (items.length === 0) {
      return (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
          No {activeTab} found for "{q}".
        </div>
      )
    }

    return (
      <div style={{ padding: '0 16px' }}>
        {activeTab === 'people' && (items as ReturnType<typeof useSearchPeople>['data']['pages'][0]['items']).map((p) => (
          <div key={(p as { id: string }).id} onClick={onClose}>
            <PeopleResultCard person={p as Parameters<typeof PeopleResultCard>[0]['person']} query={q} compact />
          </div>
        ))}
        {activeTab === 'posts' && (items as Parameters<typeof PostResultCard>[0]['post'][]).map((p) => (
          <div key={p.id} onClick={onClose}>
            <PostResultCard post={p} query={q} />
          </div>
        ))}
        {activeTab === 'jobs' && (items as JobSearchResult[]).map((j) => (
          <JobRow key={j.id} job={j} onClick={() => goTo(PATHS.JOB_DETAIL.replace(':id', j.id))} />
        ))}
        {activeTab === 'events' && (items as EventSearchResult[]).map((e) => (
          <EventRow key={e.id} event={e} onClick={() => goTo(PATHS.EVENT_DETAIL.replace(':id', e.id))} />
        ))}
        {activeTab === 'groups' && (items as Parameters<typeof GroupResultCard>[0]['group'][]).map((g) => (
          <div key={g.id} onClick={onClose}>
            <GroupResultCard group={g} />
          </div>
        ))}

        {hasNextPage && (
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            style={{
              width: '100%',
              margin: '12px 0',
              padding: '8px',
              background: 'var(--surface-raised)',
              border: '0.5px solid var(--border-hover)',
              borderRadius: 'var(--r-pill)',
              cursor: isFetchingNextPage ? 'not-allowed' : 'pointer',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--text-secondary)',
              opacity: isFetchingNextPage ? 0.6 : 1,
            }}
          >
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </button>
        )}
      </div>
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 190,
          background: 'rgba(6,13,26,0.4)',
          backdropFilter: 'blur(1px)',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 500,
          maxHeight: 520,
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-hover)',
          borderRadius: 'var(--r-lg)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.55), 0 4px 16px rgba(0,0,0,0.35)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 200,
        }}
      >
        {/* Tab bar */}
        <div
          style={{
            display: 'flex',
            padding: '0 16px',
            borderBottom: '0.5px solid var(--border-default)',
            background: 'var(--surface-raised)',
            flexShrink: 0,
            overflowX: 'auto',
          }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              style={{
                padding: '10px 12px',
                fontSize: 12,
                fontWeight: 500,
                color: activeTab === tab.value ? 'var(--uc-indigo-l)' : 'var(--text-tertiary)',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.value ? '2px solid var(--uc-indigo)' : '2px solid transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'color 0.15s, border-color 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {q.length < 2 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
              Type at least 2 characters to search.
            </div>
          ) : activeTab === 'all' ? (
            renderAllTab()
          ) : (
            renderPagedTab()
          )}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/search/components/SearchPanel.tsx
git commit -m "feat(search): add SearchPanel floating component"
```

---

## Task 13: Feature barrel

**Files:**
- Create: `apps/web/src/features/search/index.ts`

- [ ] **Step 1: Create barrel**

```typescript
// apps/web/src/features/search/index.ts
export { SearchPanel } from './components/SearchPanel'
export { PeopleResultCard } from './components/PeopleResultCard'
export { PostResultCard } from './components/PostResultCard'
export { GroupResultCard } from './components/GroupResultCard'
export * from './hooks/useSearchAll'
export * from './hooks/useSearchPeople'
export * from './hooks/useSearchPosts'
export * from './hooks/useSearchJobs'
export * from './hooks/useSearchEvents'
export * from './hooks/useSearchGroups'
export type * from './types'
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/search/index.ts
git commit -m "feat(search): add feature barrel"
```

---

## Task 14: Modify TopNav to integrate SearchPanel

**Files:**
- Modify: `apps/web/src/components/TopNav.tsx`

The existing TopNav has an uncontrolled input that navigates only on Enter. Replace it with a controlled input that:
1. Reads initial value from `?q=` param when on `/search` route.
2. Debounces keystrokes 400ms — after debounce, if `q.length >= 2`, opens the panel.
3. Opens panel on focus if `q.length >= 2`.
4. Enter key navigates to `/search?q=…` (replace: true) and closes panel.
5. Escape closes panel.
6. Panel renders below the input via `SearchPanel` component.

Replace the entire `TopNav.tsx` file with the following:

- [ ] **Step 1: Replace TopNav.tsx**

```tsx
// apps/web/src/components/TopNav.tsx
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Bell, LogOut, MessageSquare, Search, User } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationsStore } from '@/stores/notificationsStore'
import { NotificationDropdown } from '@/features/notifications'
import { SearchPanel } from '@/features/search'
import { PATHS } from '@/router/paths'
import { BrandLogo } from '@/components/BrandLogo'

const AVATAR_COLORS = ['#5B5BD6', '#F05A28', '#06B6D4', '#10B981', '#1E3A70']

function avatarColor(userId: string): string {
  let sum = 0
  for (const ch of userId) sum += ch.charCodeAt(0)
  return AVATAR_COLORS[sum % AVATAR_COLORS.length]
}

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]![0]!.toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

const iconBtnStyle: React.CSSProperties = {
  position: 'relative',
  width: 34,
  height: 34,
  borderRadius: '50%',
  background: 'transparent',
  border: '0.5px solid var(--border-default)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  color: 'var(--text-secondary)',
  flexShrink: 0,
  transition: 'border-color 0.15s, background 0.15s',
}

const badgeStyle: React.CSSProperties = {
  position: 'absolute',
  top: -3,
  right: -3,
  minWidth: 16,
  height: 16,
  borderRadius: 'var(--r-pill)',
  background: 'var(--uc-red)',
  color: '#fff',
  fontSize: 10,
  fontWeight: 500,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 3px',
  lineHeight: 1,
  border: '2px solid var(--surface-card)',
}

const menuItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '8px 10px',
  background: 'none',
  border: 'none',
  borderRadius: 'var(--r-sm)',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--text-secondary)',
  textAlign: 'left',
}

function BadgeCount({ count }: { count: number }) {
  if (count <= 0) return null
  return <span style={badgeStyle}>{count > 99 ? '99+' : count}</span>
}

export function TopNav() {
  const { user, clearAuth } = useAuthStore()
  const { messageCount, notificationCount } = useNotificationsStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [menuOpen, setMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '')

  const menuRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)
  const searchWrapperRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync input with ?q= param when navigating to /search from elsewhere
  useEffect(() => {
    const q = searchParams.get('q') ?? ''
    setSearchQuery(q)
  }, [searchParams])

  useEffect(() => {
    if (!menuOpen && !notifOpen) return
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [menuOpen, notifOpen])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && panelOpen) setPanelOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [panelOpen])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.currentTarget.value
    setSearchQuery(value)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (value.length >= 2) {
        setPanelOpen(true)
      } else {
        setPanelOpen(false)
      }
    }, 400)
  }

  function handleFocus() {
    if (searchQuery.length >= 2) setPanelOpen(true)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && searchQuery.trim()) {
      setPanelOpen(false)
      navigate(`${PATHS.SEARCH}?q=${encodeURIComponent(searchQuery.trim())}`, { replace: true })
    }
    if (e.key === 'Escape') {
      setPanelOpen(false)
      e.currentTarget.blur()
    }
  }

  function handleSignOut() {
    clearAuth()
    navigate(PATHS.LOGIN)
  }

  const initials = user?.profile.fullName ? getInitials(user.profile.fullName) : '?'
  const color = user ? avatarColor(user.id) : 'var(--uc-indigo)'

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        height: 60,
        background: 'var(--surface-card)',
        borderBottom: '0.5px solid var(--border-default)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 16,
      }}
    >
      {/* Left: logo */}
      <a
        href={PATHS.FEED}
        onClick={(e) => { e.preventDefault(); navigate(PATHS.FEED) }}
        style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0 }}
      >
        <BrandLogo height={36} />
      </a>

      {/* Center: search */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <div
          ref={searchWrapperRef}
          style={{ position: 'relative', minWidth: 200, width: '100%', maxWidth: 400 }}
        >
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-tertiary)',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />
          <input
            type="text"
            placeholder="Search people, jobs, events…"
            value={searchQuery}
            onChange={handleChange}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            style={{
              width: '100%',
              height: 36,
              background: 'var(--surface-raised)',
              border: `0.5px solid ${panelOpen ? 'var(--uc-indigo-bdr)' : 'var(--border-default)'}`,
              borderRadius: 'var(--r-pill)',
              padding: '0 14px 0 34px',
              fontSize: 13,
              color: 'var(--text-primary)',
              outline: 'none',
              boxSizing: 'border-box',
              position: 'relative',
              zIndex: 201,
            }}
          />

          {panelOpen && searchQuery.length >= 2 && (
            <SearchPanel q={searchQuery} onClose={() => setPanelOpen(false)} />
          )}
        </div>
      </div>

      {/* Right: icon actions + avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button
          onClick={() => navigate(PATHS.MESSAGES)}
          style={iconBtnStyle}
          aria-label="Messages"
        >
          <MessageSquare size={16} />
          <BadgeCount count={messageCount} />
        </button>

        <div style={{ position: 'relative' }} ref={notifRef}>
          <button
            onClick={() => setNotifOpen((o) => !o)}
            style={{
              ...iconBtnStyle,
              borderColor: notifOpen ? 'var(--border-hover)' : undefined,
              background: notifOpen ? 'var(--surface-raised)' : undefined,
            }}
            aria-label="Notifications"
            aria-expanded={notifOpen}
          >
            <Bell size={16} />
            <BadgeCount count={notificationCount} />
          </button>
          {notifOpen && <NotificationDropdown onClose={() => setNotifOpen(false)} />}
        </div>

        {/* Avatar + profile dropdown */}
        <div style={{ position: 'relative' }} ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', borderRadius: '50%' }}
            aria-label="Profile menu"
            aria-expanded={menuOpen}
          >
            <Avatar initials={initials} color={color} size={32} />
          </button>

          {menuOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                minWidth: 188,
                background: 'var(--surface-raised)',
                border: '0.5px solid var(--border-hover)',
                borderRadius: 'var(--r-md)',
                padding: 6,
                zIndex: 100,
              }}
            >
              {user && (
                <div
                  style={{
                    padding: '8px 10px 10px',
                    borderBottom: '0.5px solid var(--border-default)',
                    marginBottom: 4,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {user.profile.fullName}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {user.email}
                  </div>
                </div>
              )}

              <button
                onClick={() => { setMenuOpen(false); navigate(PATHS.PROFILE.replace(':id', user?.id ?? '')) }}
                style={menuItemStyle}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
              >
                <User size={14} />
                View profile
              </button>

              <button
                onClick={handleSignOut}
                style={menuItemStyle}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
              >
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/TopNav.tsx
git commit -m "feat(search): wire SearchPanel into TopNav with debounced controlled input"
```

---

## Task 15: Implement SearchPage

**Files:**
- Modify: `apps/web/src/pages/SearchPage.tsx`

The SearchPage is the full paginated results view. It reads `q` and `tab` from `useSearchParams`. Tabs change the URL via `setSearchParams` (replace: true). Uses `useSearchAll` for the All tab (showing top 3 per category with full result cards) and per-type infinite queries for individual tabs.

- [ ] **Step 1: Implement SearchPage.tsx**

```tsx
// apps/web/src/pages/SearchPage.tsx
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useSearchAll } from '@/features/search/hooks/useSearchAll'
import { useSearchPeople } from '@/features/search/hooks/useSearchPeople'
import { useSearchPosts } from '@/features/search/hooks/useSearchPosts'
import { useSearchJobs } from '@/features/search/hooks/useSearchJobs'
import { useSearchEvents } from '@/features/search/hooks/useSearchEvents'
import { useSearchGroups } from '@/features/search/hooks/useSearchGroups'
import { PeopleResultCard } from '@/features/search/components/PeopleResultCard'
import { PostResultCard } from '@/features/search/components/PostResultCard'
import { GroupResultCard } from '@/features/search/components/GroupResultCard'
import { EmptyState } from '@/components/EmptyState'
import { SkeletonPost } from '@/components/skeletons/SkeletonPost'
import { SkeletonJobCard } from '@/components/skeletons/SkeletonJobCard'
import { SkeletonEventCard } from '@/components/skeletons/SkeletonEventCard'
import { PATHS } from '@/router/paths'
import type { JobSearchResult, EventSearchResult } from '@/features/search/types'

type SearchTab = 'all' | 'people' | 'posts' | 'jobs' | 'events' | 'groups'

const TABS: { label: string; value: SearchTab }[] = [
  { label: 'All', value: 'all' },
  { label: 'People', value: 'people' },
  { label: 'Posts', value: 'posts' },
  { label: 'Jobs', value: 'jobs' },
  { label: 'Events', value: 'events' },
  { label: 'Groups', value: 'groups' },
]

const SHIMMER: React.CSSProperties = {
  background: 'var(--surface-raised)',
  animation: 'shimmer 1.6s ease-in-out infinite',
  borderRadius: 'var(--r-sm)',
}

function SkeletonRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderBottom: '0.5px solid var(--border-default)' }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, ...SHIMMER }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={{ height: 13, width: '36%', ...SHIMMER }} />
        <div style={{ height: 11, width: '55%', ...SHIMMER }} />
      </div>
    </div>
  )
}

function LoadMoreBtn({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        width: '100%',
        marginTop: 16,
        padding: '10px',
        background: 'var(--surface-raised)',
        border: '0.5px solid var(--border-hover)',
        borderRadius: 'var(--r-pill)',
        cursor: loading ? 'not-allowed' : 'pointer',
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--text-secondary)',
        opacity: loading ? 0.6 : 1,
      }}
    >
      {loading ? 'Loading…' : 'Load more'}
    </button>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2
      style={{
        margin: '24px 0 12px',
        fontSize: 11,
        fontWeight: 500,
        color: 'var(--text-tertiary)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}
    >
      {title}
    </h2>
  )
}

function JobCard({ job }: { job: JobSearchResult }) {
  const navigate = useNavigate()
  return (
    <div
      onClick={() => navigate(PATHS.JOB_DETAIL.replace(':id', job.id))}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        cursor: 'pointer',
        transition: 'border-color 200ms',
        marginBottom: 8,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-hover)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-default)' }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 'var(--r-md)',
          background: 'var(--uc-indigo-bg)',
          border: '0.5px solid var(--uc-indigo-bdr)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          fontWeight: 500,
          color: 'var(--uc-indigo-xl)',
          flexShrink: 0,
        }}
      >
        {job.company.charAt(0).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{job.title}</div>
        <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)', marginTop: 2 }}>{job.company}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)' }}>{job.location}</span>
          <span style={{ fontSize: 11, fontWeight: 500, padding: '1px 8px', borderRadius: 'var(--r-pill)', background: 'var(--uc-indigo-bg)', color: 'var(--uc-indigo-xl)' }}>
            {job.type.replace('_', ' ')}
          </span>
          {job.deadline && (
            <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)' }}>
              Closes {format(parseISO(job.deadline), 'MMM d')}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function EventCard({ event }: { event: EventSearchResult }) {
  const navigate = useNavigate()
  return (
    <div
      onClick={() => navigate(PATHS.EVENT_DETAIL.replace(':id', event.id))}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        cursor: 'pointer',
        transition: 'border-color 200ms',
        marginBottom: 8,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-hover)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-default)' }}
    >
      <div
        style={{
          width: 56,
          height: 44,
          borderRadius: 'var(--r-sm)',
          background: event.coverUrl ? undefined : 'var(--uc-orange-bg)',
          backgroundImage: event.coverUrl ? `url(${event.coverUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          border: '0.5px solid var(--uc-orange-bdr)',
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {event.title}
        </div>
        <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)', marginTop: 2 }}>
          {format(parseISO(event.startsAt), 'EEE, MMM d · h:mm a')} · {event.location}
        </div>
      </div>
      {event.myRsvp && (
        <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 9px', borderRadius: 'var(--r-pill)', background: 'var(--uc-indigo-bg)', color: 'var(--uc-indigo-xl)', flexShrink: 0 }}>
          {event.myRsvp === 'going' ? 'Going' : 'Maybe'}
        </span>
      )}
    </div>
  )
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q') ?? ''
  const rawTab = searchParams.get('tab') as SearchTab | null
  const activeTab: SearchTab =
    rawTab && TABS.some((t) => t.value === rawTab) ? rawTab : 'all'

  function setTab(tab: SearchTab) {
    setSearchParams({ q, tab }, { replace: true })
  }

  const allQuery = useSearchAll(q, 3)
  const peopleQuery = useSearchPeople(q)
  const postsQuery = useSearchPosts(q)
  const jobsQuery = useSearchJobs(q)
  const eventsQuery = useSearchEvents(q)
  const groupsQuery = useSearchGroups(q)

  const isShortQuery = q.length < 2

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 0' }}>

      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          borderBottom: '0.5px solid var(--border-default)',
          marginBottom: 24,
          gap: 0,
          overflowX: 'auto',
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setTab(tab.value)}
            style={{
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 500,
              color: activeTab === tab.value ? 'var(--uc-indigo-l)' : 'var(--text-tertiary)',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.value ? '2px solid var(--uc-indigo)' : '2px solid transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Short query guard */}
      {isShortQuery && (
        <EmptyState
          icon={Search}
          title="Type at least 2 characters to search."
        />
      )}

      {/* All tab */}
      {!isShortQuery && activeTab === 'all' && (() => {
        if (allQuery.isLoading) return Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)

        const data = allQuery.data
        if (!data) return null

        const hasAny =
          data.people.length + data.posts.length + data.jobs.length +
          data.events.length + data.groups.length > 0

        if (!hasAny) {
          return (
            <EmptyState
              icon={Search}
              title={`Nothing found for "${q}".`}
              description="Try a different keyword."
            />
          )
        }

        return (
          <>
            {data.people.length > 0 && (
              <>
                <SectionHeader title="People" />
                {data.people.map((p) => <PeopleResultCard key={p.id} person={p} query={q} />)}
              </>
            )}
            {data.posts.length > 0 && (
              <>
                <SectionHeader title="Posts" />
                {data.posts.map((p) => <PostResultCard key={p.id} post={p} query={q} />)}
              </>
            )}
            {data.jobs.length > 0 && (
              <>
                <SectionHeader title="Jobs" />
                {data.jobs.map((j) => <JobCard key={j.id} job={j} />)}
              </>
            )}
            {data.events.length > 0 && (
              <>
                <SectionHeader title="Events" />
                {data.events.map((e) => <EventCard key={e.id} event={e} />)}
              </>
            )}
            {data.groups.length > 0 && (
              <>
                <SectionHeader title="Groups" />
                {data.groups.map((g) => <GroupResultCard key={g.id} group={g} />)}
              </>
            )}
          </>
        )
      })()}

      {/* People tab */}
      {!isShortQuery && activeTab === 'people' && (() => {
        const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = peopleQuery
        if (isLoading) return Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
        const items = data?.pages.flatMap((p) => p.items) ?? []
        if (items.length === 0) return <EmptyState icon={Search} title={`No people found for "${q}".`} />
        return (
          <>
            {items.map((p) => <PeopleResultCard key={p.id} person={p} query={q} />)}
            {hasNextPage && <LoadMoreBtn onClick={() => fetchNextPage()} loading={isFetchingNextPage} />}
          </>
        )
      })()}

      {/* Posts tab */}
      {!isShortQuery && activeTab === 'posts' && (() => {
        const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = postsQuery
        if (isLoading) return Array.from({ length: 3 }).map((_, i) => <SkeletonPost key={i} />)
        const items = data?.pages.flatMap((p) => p.items) ?? []
        if (items.length === 0) return <EmptyState icon={Search} title={`No posts found for "${q}".`} />
        return (
          <>
            {items.map((p) => <PostResultCard key={p.id} post={p} query={q} />)}
            {hasNextPage && <LoadMoreBtn onClick={() => fetchNextPage()} loading={isFetchingNextPage} />}
          </>
        )
      })()}

      {/* Jobs tab */}
      {!isShortQuery && activeTab === 'jobs' && (() => {
        const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = jobsQuery
        if (isLoading) return Array.from({ length: 3 }).map((_, i) => <SkeletonJobCard key={i} />)
        const items = data?.pages.flatMap((p) => p.items) ?? []
        if (items.length === 0) return <EmptyState icon={Search} title={`No jobs found for "${q}".`} />
        return (
          <>
            {items.map((j) => <JobCard key={j.id} job={j} />)}
            {hasNextPage && <LoadMoreBtn onClick={() => fetchNextPage()} loading={isFetchingNextPage} />}
          </>
        )
      })()}

      {/* Events tab */}
      {!isShortQuery && activeTab === 'events' && (() => {
        const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = eventsQuery
        if (isLoading) return Array.from({ length: 3 }).map((_, i) => <SkeletonEventCard key={i} />)
        const items = data?.pages.flatMap((p) => p.items) ?? []
        if (items.length === 0) return <EmptyState icon={Search} title={`No events found for "${q}".`} />
        return (
          <>
            {items.map((e) => <EventCard key={e.id} event={e} />)}
            {hasNextPage && <LoadMoreBtn onClick={() => fetchNextPage()} loading={isFetchingNextPage} />}
          </>
        )
      })()}

      {/* Groups tab */}
      {!isShortQuery && activeTab === 'groups' && (() => {
        const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = groupsQuery
        if (isLoading) return Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
        const items = data?.pages.flatMap((p) => p.items) ?? []
        if (items.length === 0) return <EmptyState icon={Search} title={`No groups found for "${q}".`} />
        return (
          <>
            {items.map((g) => <GroupResultCard key={g.id} group={g} />)}
            {hasNextPage && <LoadMoreBtn onClick={() => fetchNextPage()} loading={isFetchingNextPage} />}
          </>
        )
      })()}

    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/SearchPage.tsx
git commit -m "feat(search): implement full SearchPage with tabbed paginated results"
```

---

## Task 16: Typecheck, lint, run all tests

**Files:** no new files

- [ ] **Step 1: Check Avatar component signature**

Read `apps/web/src/components/Avatar.tsx`. If it does not accept a `src` prop, remove the `src` prop from `PeopleResultCard.tsx` (the avatar will fall back to initials only).

- [ ] **Step 2: Run typecheck**

```bash
npx pnpm typecheck
```

Fix any errors before continuing. Common issues:
- `Avatar` prop mismatch → remove unsupported props.
- `useInfiniteQuery` generic type mismatch → ensure `PagedResult<T>` matches the `queryFn` return type.
- Import path typos.

- [ ] **Step 3: Run lint**

```bash
npx pnpm lint
```

Fix any lint errors.

- [ ] **Step 4: Run backend tests**

```bash
npx pnpm --filter api test
```

Expected: all tests pass including the new search tests.

- [ ] **Step 5: Run frontend tests**

```bash
npx pnpm --filter web test
```

Expected: `highlightMatch.test.tsx` passes; no regressions in existing tests.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: typecheck and lint pass for search feature"
```

---

## Self-Review Notes

- **Spec coverage:** All 6 backend endpoints ✓, pg_trgm migration ✓, `highlightMatch` ✓, 6 TanStack Query hooks ✓, `PeopleResultCard` with follow ✓, `PostResultCard` ✓, `GroupResultCard` with join ✓, `SearchPanel` floating panel ✓, `TopNav` debounced controlled input ✓, `SearchPage` with all tabs ✓.
- **Avatar `src` prop:** Task 16 Step 1 explicitly handles this edge case.
- **`SkeletonJobCard` / `SkeletonEventCard`:** These components are referenced in `SearchPage`. Verify they exist at `apps/web/src/components/skeletons/SkeletonJobCard.tsx` and `SkeletonEventCard.tsx` before Task 15 — the file listing confirmed they do.
- **Type casts in `SearchPanel.renderPagedTab`:** The tab-specific rendering uses type assertions because a single function handles all tab types. If TypeScript rejects them, split into dedicated per-tab render functions (same pattern as `SearchPage`).
- **`reactions` table name:** The `searchPosts` service queries a `reactions` table. Confirm this matches the actual table created in `010_create_reactions.ts`.
