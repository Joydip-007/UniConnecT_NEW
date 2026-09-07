# Admin Announcements: Scheduling, Drafts, and Reach — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins save an announcement as a draft or schedule it for a future time from `AnnouncementsTab`, show a Published / Scheduled / Draft status pill per announcement, and show an approximate "reach" figure on published ones — without inventing new backend infrastructure, because the post-scheduling backend already exists.

**Architecture:** `posts.is_published` and `posts.publish_at` already exist (migration `008_create_posts.ts`, `064_...` for `is_published` defaults, and later migrations added `publish_at`/`expires_at`), and `FeedService.createPost` already schedules a delayed publish job on the `post-lifecycle` Bull queue (`apps/api/src/queues/post-lifecycle.queue.ts` + `apps/api/src/workers/post-lifecycle.worker.ts`) whenever `publish_at` is a future date, with a cron sweep as a safety net. `POST /posts` already accepts `is_published` and `publish_at` (`apps/api/src/modules/feed/schema.ts:37,39`) and the feed composer (`apps/web/src/features/feed/components/CreatePost.tsx`) already exposes a "Schedule for later" date-time input using exactly this contract. **No migration, no new queue, no new worker is needed.** The only real gaps are: (1) `AdminContentService.listPosts` doesn't select `is_published`/`publish_at` so the admin UI can't show status, and (2) `AnnouncementsTab`'s composer only ever posts immediately (no draft/schedule affordance) and its list has no status pill or reach figure.

**Tech Stack:** Express + Knex (existing `posts` table, existing `post-lifecycle` queue/worker — untouched), React + TanStack Query, existing `@/lib/axios` client.

**Spec:** This plan itself is the spec (scope was interactively negotiated with the user — see Global Constraints for the exact decisions made, since the mockup at `/Users/joydipdatta/Downloads/uniconnect-furnished-design/project/Feed Page.dc.html` (Admin role → Announcements) under-specifies several of them).

## Global Constraints

- **No new migration.** `is_published` (posts) exists since migration `064_add_drafts.ts`; `publish_at` exists on `posts` already (confirmed live in `FeedService.createPost`/`updatePost`, `apps/api/src/modules/feed/service.ts:248-260,396-415`). Do not add a `105_...` migration for this feature — there is nothing to add.
- **Composer scope is deliberately narrow.** `AnnouncementsTab`'s composer stays a plain `<textarea>` (no media, no poll, no hashtag UI) — do not port `CreatePost.tsx`'s full feature set in, only its publish/draft/schedule *pattern* (same field names, same date-time input idea), copied at the scope this screen needs.
- **"Reach" is an approximation, not new tracking infrastructure.** Per the user's explicit scope decision: reach = `activeUsers` from `GET /admin/stats` (already returned, `apps/api/src/modules/admin/service.ts:122,128`) shown as a static "≈N,NNN members reached" on **published** announcements only. Do **not** build a `post_views` table, client-side impression tracking, or a real open-rate. "Engagement" (a distinct, clearly-labeled figure) is the existing `reactionCount + commentCount` — never call it "open rate."
- **Status pill logic** (compute client-side from `isPublished` + `publishAt`, both newly exposed by the API):
  - `isPublished === true` → **Published**
  - `isPublished === false` and `publishAt` is a future ISO timestamp → **Scheduled**
  - `isPublished === false` and `publishAt` is `null` → **Draft**
- **Response/service conventions (CLAUDE.md):** service-layer DB access only (no queries in `router.ts`/`controller.ts`); controllers call `sendSuccess`/`sendPaginated` from `src/utils/response.ts`; Zod schema names are `camelCase + Schema`. No new error paths are introduced by this plan (existing `POST /posts` validation already covers `publish_at`).
- **Design tokens (CLAUDE.md):** no hardcoded hex, `0.5px solid var(--border-*)` for structural borders, `var(--r-pill)` for buttons/pills, font-weight 400/500 only, sentence case copy, `--uc-orange*` reserved for the viewer's own activity (the pin icon already uses it — keep that), status pill colors: Published → `--uc-mint`, Scheduled → `--uc-indigo`, Draft → `--text-tertiary`/`--surface-raised` (neutral, matching the existing `Badge` `neutral` variant look used elsewhere in `AdminPage.tsx`).
- **Test conventions:** backend integration tests live in `apps/api/src/__tests__/*.test.ts`, use `loginAs`/`DOMAIN`/`CREDENTIALS` from `./setup` (see `apps/api/src/__tests__/news-announcement.test.ts` for the exact shape to copy), always `.set('x-university-domain', DOMAIN)`. Frontend tests use `@testing-library/react` + MSW handlers at `src/tests/msw/handlers.ts`, paths pinned with the `*` wildcard prefix (`VITE_API_URL` is unset under vitest).

---

## Task 1: Expose `isPublished` / `publishAt` on the admin posts content list

**Files:**
- Modify: `apps/api/src/modules/admin/content.service.ts:39` (`PostRow` interface), `:83-121` (`listPosts` select), `:315-331` (`toAdminPost`)
- Test: `apps/api/src/__tests__/admin-content-posts.test.ts` (new)

**Interfaces:**
- Consumes: existing `posts.is_published` (boolean, default `true`), `posts.publish_at` (nullable timestamptz) columns — no schema change.
- Produces: `AdminContentService.listPosts()` items now include `isPublished: boolean` and `publishAt: string | null` — Task 3 (frontend `AnnouncementItem`) consumes these exact field names.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/__tests__/admin-content-posts.test.ts`:

```ts
import { describe, it, expect, afterAll } from 'vitest'
import supertest from 'supertest'
import { app, loginAs, DOMAIN, CREDENTIALS, TEST_UNIVERSITY_ID } from './setup'
import { db } from '../config/db'

const api = supertest(app)
const UNI = { 'x-university-domain': DOMAIN }
const CONTENT_PREFIX = 'ADMIN-CONTENT-TEST'

describe('GET /admin/content/posts exposes publish state', () => {
  afterAll(async () => {
    await db('posts').where({ university_id: TEST_UNIVERSITY_ID }).whereLike('content', `${CONTENT_PREFIX}%`).delete()
  })

  it('returns isPublished and publishAt for a scheduled announcement', async () => {
    const admin = await loginAs(CREDENTIALS.admin.email, CREDENTIALS.admin.password)
    const futureIso = new Date(Date.now() + 60 * 60 * 1000).toISOString()

    const createRes = await api
      .post('/api/v1/posts')
      .set(UNI)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ type: 'announcement', content: `${CONTENT_PREFIX} scheduled`, publish_at: futureIso })
    expect(createRes.status).toBe(201)

    const listRes = await api
      .get('/api/v1/admin/content/posts')
      .set(UNI)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .query({ filter: 'announcement', limit: 50 })
    expect(listRes.status).toBe(200)

    const item = listRes.body.data.items.find((i: { content: string }) => i.content === `${CONTENT_PREFIX} scheduled`)
    expect(item).toBeDefined()
    expect(item.isPublished).toBe(false)
    expect(item.publishAt).toBe(futureIso)
  })

  it('returns isPublished true and publishAt null for an immediately-published announcement', async () => {
    const admin = await loginAs(CREDENTIALS.admin.email, CREDENTIALS.admin.password)

    await api
      .post('/api/v1/posts')
      .set(UNI)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ type: 'announcement', content: `${CONTENT_PREFIX} live` })

    const listRes = await api
      .get('/api/v1/admin/content/posts')
      .set(UNI)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .query({ filter: 'announcement', limit: 50 })

    const item = listRes.body.data.items.find((i: { content: string }) => i.content === `${CONTENT_PREFIX} live`)
    expect(item).toBeDefined()
    expect(item.isPublished).toBe(true)
    expect(item.publishAt).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `DATABASE_URL="postgresql://$(whoami)@localhost:5432/uniconnect_test" GEMINI_API_KEY=test-key npx pnpm --filter api test admin-content-posts`
Expected: FAIL — `item.isPublished` is `undefined`, not `false`/`true` (the field isn't selected yet).

- [ ] **Step 3: Add the columns to `PostRow`, the select, and the mapper**

In `apps/api/src/modules/admin/content.service.ts`, extend `PostRow` (around line 39):

```ts
interface PostRow extends AuthorJoinRow {
  id: string
  content: string
  media_urls: string[] | null
  type: string
  is_pinned: boolean
  is_published: boolean
  publish_at: Date | null
  view_count: number
  created_at: Date
  reaction_count: string | number
  comment_count: string | number
}
```

In `listPosts`'s `.select<PostRow[]>(...)` call (around line 108-121), add the two columns:

```ts
      .select<PostRow[]>(
        'posts.id',
        'posts.content',
        'posts.media_urls',
        'posts.type',
        'posts.is_pinned',
        'posts.is_published',
        'posts.publish_at',
        'posts.view_count',
        'posts.created_at',
        'posts.author_id',
        'profiles.full_name as author_name',
        'profiles.avatar_url as author_avatar',
        db.raw('COALESCE(r.count, 0) as reaction_count'),
        db.raw('COALESCE(c.count, 0) as comment_count'),
      )
```

In `toAdminPost` (around line 315-331):

```ts
function toAdminPost(row: PostRow) {
  return {
    id: row.id,
    content: row.content,
    mediaUrls: row.media_urls ?? [],
    type: row.type,
    isPinned: row.is_pinned,
    isPublished: row.is_published,
    publishAt: row.publish_at ? new Date(row.publish_at).toISOString() : null,
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `DATABASE_URL="postgresql://$(whoami)@localhost:5432/uniconnect_test" GEMINI_API_KEY=test-key npx pnpm --filter api test admin-content-posts`
Expected: PASS (both cases)

- [ ] **Step 5: Run the full admin content suite to check for regressions**

Run: `DATABASE_URL="postgresql://$(whoami)@localhost:5432/uniconnect_test" GEMINI_API_KEY=test-key npx pnpm --filter api test admin`
Expected: PASS — no other admin test asserts on the exact shape of a posts-list item in a way that a new field would break.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/admin/content.service.ts apps/api/src/__tests__/admin-content-posts.test.ts
git commit -m "feat(admin): expose isPublished/publishAt on admin posts content list

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017JRVZzfLB9LALRcnS9f2p2"
```

---

## Task 2: Frontend — status pill + reach/engagement on `AnnouncementsTab`'s list

**Files:**
- Modify: `apps/web/src/pages/admin/AnnouncementsTab.tsx`
- Test: `apps/web/src/pages/admin/AnnouncementsTab.test.tsx` (new)

**Interfaces:**
- Consumes: `AdminContentService.listPosts()` items now carrying `isPublished: boolean`, `publishAt: string | null` (Task 1) via the existing `GET /admin/content/posts?filter=announcement` call; `activeUsers: number` from `GET /admin/stats` (`apps/api/src/modules/admin/service.ts:128`, already wired into the web app via the `['admin','stats']` query key used elsewhere, e.g. `apps/web/src/pages/AdminPage.tsx` `InsightsTab`).
- Produces: an exported `announcementStatus(item: { isPublished: boolean; publishAt: string | null }): 'published' | 'scheduled' | 'draft'` helper other admin screens could reuse later (not required elsewhere in this plan, but keep it a named, tested export rather than inlined JSX logic).

- [ ] **Step 1: Write the failing test for the status helper**

Create `apps/web/src/pages/admin/AnnouncementsTab.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { announcementStatus } from './AnnouncementsTab'

describe('announcementStatus', () => {
  it('returns published when isPublished is true', () => {
    expect(announcementStatus({ isPublished: true, publishAt: null })).toBe('published')
  })

  it('returns scheduled when unpublished with a future publishAt', () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    expect(announcementStatus({ isPublished: false, publishAt: future })).toBe('scheduled')
  })

  it('returns draft when unpublished with no publishAt', () => {
    expect(announcementStatus({ isPublished: false, publishAt: null })).toBe('draft')
  })

  it('returns draft when unpublished and publishAt has already passed (safety-net window)', () => {
    const past = new Date(Date.now() - 60_000).toISOString()
    expect(announcementStatus({ isPublished: false, publishAt: past })).toBe('draft')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx pnpm --filter web test src/pages/admin/AnnouncementsTab.test.tsx`
Expected: FAIL — `announcementStatus` is not exported (doesn't exist yet).

- [ ] **Step 3: Add the helper, extend the item type, and render the pill + reach/engagement line**

In `apps/web/src/pages/admin/AnnouncementsTab.tsx`, extend `AnnouncementItem` (near the top, currently lines 12-20):

```ts
interface AnnouncementItem {
  id: string
  content: string
  isPinned: boolean
  isPublished: boolean
  publishAt: string | null
  viewCount: number
  reactionCount: number
  commentCount: number
  createdAt: string
  author: AuthorMeta
}

export type AnnouncementStatus = 'published' | 'scheduled' | 'draft'

export function announcementStatus(item: Pick<AnnouncementItem, 'isPublished' | 'publishAt'>): AnnouncementStatus {
  if (item.isPublished) return 'published'
  if (item.publishAt && new Date(item.publishAt).getTime() > Date.now()) return 'scheduled'
  return 'draft'
}

const STATUS_META: Record<AnnouncementStatus, { label: string; color: string; bg: string; bdr: string }> = {
  published: { label: 'Published', color: 'var(--uc-mint)', bg: 'var(--uc-mint-bg)', bdr: 'var(--uc-mint-bdr)' },
  scheduled: { label: 'Scheduled', color: 'var(--uc-indigo-l)', bg: 'var(--uc-indigo-bg)', bdr: 'var(--uc-indigo-bdr)' },
  draft: { label: 'Draft', color: 'var(--text-tertiary)', bg: 'var(--surface-raised)', bdr: 'var(--border-default)' },
}

function StatusPill({ status }: { status: AnnouncementStatus }) {
  const meta = STATUS_META[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 'var(--r-pill)',
      fontSize: 11, fontWeight: 500, color: meta.color, background: meta.bg, border: `0.5px solid ${meta.bdr}`,
    }}>
      {meta.label}
    </span>
  )
}
```

Fetch `activeUsers` for the reach figure — add near the top of the `AnnouncementsTab` function body (after the existing `useQuery` for the list):

```ts
  const { data: stats } = useQuery<{ activeUsers: number }>({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.get<{ data: { activeUsers: number } }>('/admin/stats').then((r) => r.data.data),
    staleTime: 60_000,
  })
```

(This reuses the exact `['admin','stats']` query key already populated elsewhere in the admin panel, so it's typically already cached — no extra network round trip in practice.)

Pass `stats?.activeUsers` down to `AnnouncementRow` as a new prop, and render status + reach/engagement in the row's meta line. In `AnnouncementRow` (function signature and JSX, roughly lines 121-165):

```tsx
function AnnouncementRow({ item, queryKey, activeUsers }: { item: AnnouncementItem; queryKey: QueryKey; activeUsers?: number }) {
  // ...unchanged pin/delete mutation code...
  const status = announcementStatus(item)

  return (
    <div style={{ /* unchanged container styles */ }}>
      {/* unchanged icon */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.4 }}>{item.content}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 6, fontSize: 12, color: 'var(--text-tertiary)' }}>
          <StatusPill status={status} />
          <span>{item.author.fullName ?? 'Unknown'}</span>
          <span>· {relativeTime(item.createdAt)}</span>
          {status === 'published' ? (
            <span>· ≈{(activeUsers ?? 0).toLocaleString()} members reached · {item.reactionCount + item.commentCount} engagement</span>
          ) : status === 'scheduled' && item.publishAt ? (
            <span>· publishes {new Date(item.publishAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
          ) : null}
        </div>
      </div>
      {/* unchanged pin/delete buttons */}
    </div>
  )
}
```

Update the call site that renders `AnnouncementRow` (in the main `AnnouncementsTab` return, where `data.items.map(...)` is):

```tsx
{data.items.map((item) => (
  <AnnouncementRow key={item.id} item={item} queryKey={queryKey} activeUsers={stats?.activeUsers} />
))}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx pnpm --filter web test src/pages/admin/AnnouncementsTab.test.tsx`
Expected: PASS (all 4 cases)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/admin/AnnouncementsTab.tsx apps/web/src/pages/admin/AnnouncementsTab.test.tsx
git commit -m "feat(admin): show status pill and reach/engagement on announcement rows

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017JRVZzfLB9LALRcnS9f2p2"
```

---

## Task 3: Frontend — composer gets Publish now / Save as draft / Schedule for

**Files:**
- Modify: `apps/web/src/pages/admin/AnnouncementsTab.tsx`
- Test: `apps/web/src/pages/admin/AnnouncementsTab.composer.test.tsx` (new)
- Reference (read-only, do not modify): `apps/web/src/features/feed/components/CreatePost.tsx:67,191,313-323,809-830` (the existing schedule-input pattern this task copies at a smaller scope), `apps/api/src/modules/feed/schema.ts:34-39` (`CreatePostSchema` accepting `is_published`/`publish_at`)

**Interfaces:**
- Consumes: `POST /posts` with `{ type: 'announcement', content, is_published?: boolean, publish_at?: string }` — an existing, unchanged endpoint contract.
- Produces: nothing new consumed elsewhere in this plan; this is the last task.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/pages/admin/AnnouncementsTab.composer.test.tsx`. Add an MSW handler for `POST */posts` (per CLAUDE.md's MSW convention — wildcard-prefixed path) in the test file itself via `server.use(...)` so this test doesn't depend on the shared handler file having an announcement-specific case:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { server } from '@/tests/msw/server'
import { AnnouncementsTab } from './AnnouncementsTab'

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <AnnouncementsTab />
    </QueryClientProvider>,
  )
}

describe('AnnouncementsTab composer', () => {
  it('sends is_published: false when saving as a draft', async () => {
    const user = userEvent.setup()
    let captured: Record<string, unknown> | null = null
    server.use(
      http.get('*/admin/content/posts', () => HttpResponse.json({ data: { items: [], total: 0, page: 1, limit: 20 } })),
      http.get('*/admin/stats', () => HttpResponse.json({ data: { activeUsers: 4821 } })),
      http.post('*/posts', async ({ request }) => {
        captured = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ data: { id: 'p1' } }, { status: 201 })
      }),
    )

    renderTab()
    await user.type(await screen.findByPlaceholderText(/write an announcement/i), 'Draft body')
    await user.click(screen.getByRole('button', { name: /save as draft/i }))

    await waitFor(() => expect(captured).not.toBeNull())
    expect(captured).toMatchObject({ type: 'announcement', content: 'Draft body', is_published: false })
    expect(captured!.publish_at).toBeUndefined()
  })

  it('sends publish_at when scheduling for later', async () => {
    const user = userEvent.setup()
    let captured: Record<string, unknown> | null = null
    server.use(
      http.get('*/admin/content/posts', () => HttpResponse.json({ data: { items: [], total: 0, page: 1, limit: 20 } })),
      http.get('*/admin/stats', () => HttpResponse.json({ data: { activeUsers: 4821 } })),
      http.post('*/posts', async ({ request }) => {
        captured = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ data: { id: 'p2' } }, { status: 201 })
      }),
    )

    renderTab()
    await user.type(await screen.findByPlaceholderText(/write an announcement/i), 'Scheduled body')
    await user.click(screen.getByRole('button', { name: /schedule for/i }))
    const dtInput = screen.getByLabelText(/schedule date and time/i)
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const local = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}T${String(future.getHours()).padStart(2, '0')}:${String(future.getMinutes()).padStart(2, '0')}`
    await user.type(dtInput, local)
    await user.click(screen.getByRole('button', { name: /^schedule$/i }))

    await waitFor(() => expect(captured).not.toBeNull())
    expect(captured).toMatchObject({ type: 'announcement', content: 'Scheduled body' })
    expect(typeof captured!.publish_at).toBe('string')
  })

  it('publishes immediately with no extra fields on the default action', async () => {
    const user = userEvent.setup()
    let captured: Record<string, unknown> | null = null
    server.use(
      http.get('*/admin/content/posts', () => HttpResponse.json({ data: { items: [], total: 0, page: 1, limit: 20 } })),
      http.get('*/admin/stats', () => HttpResponse.json({ data: { activeUsers: 4821 } })),
      http.post('*/posts', async ({ request }) => {
        captured = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ data: { id: 'p3' } }, { status: 201 })
      }),
    )

    renderTab()
    await user.type(await screen.findByPlaceholderText(/write an announcement/i), 'Live now body')
    await user.click(screen.getByRole('button', { name: /^publish now$/i }))

    await waitFor(() => expect(captured).not.toBeNull())
    expect(captured).toMatchObject({ type: 'announcement', content: 'Live now body' })
    expect(captured!.is_published).toBeUndefined()
    expect(captured!.publish_at).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx pnpm --filter web test src/pages/admin/AnnouncementsTab.composer.test.tsx`
Expected: FAIL — there is no "Save as draft" / "Schedule for" / "Publish now" button yet, only "New announcement".

- [ ] **Step 3: Rebuild the composer with three actions**

Replace the composer block in `AnnouncementsTab` (the `<div>` containing the `<textarea>` and the single `PrimaryBtn`, currently around lines 74-96) with:

```tsx
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleAt, setScheduleAt] = useState('')

  const postMutation = useMutation({
    mutationFn: (payload: { content: string; is_published?: boolean; publish_at?: string }) =>
      api.post('/posts', { type: 'announcement', ...payload }),
    onSuccess: () => {
      setDraft('')
      setScheduleAt('')
      setScheduleOpen(false)
      void qc.invalidateQueries({ queryKey: ['admin', 'content', 'posts', 'announcement'] })
      void qc.invalidateQueries({ queryKey: ['admin', 'stats'] })
    },
  })

  function publishNow() {
    postMutation.mutate({ content: draft.trim() })
  }
  function saveAsDraft() {
    postMutation.mutate({ content: draft.trim(), is_published: false })
  }
  function schedule() {
    if (!scheduleAt) return
    postMutation.mutate({ content: draft.trim(), publish_at: new Date(scheduleAt).toISOString() })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        background: 'var(--surface-card)', border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)', padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write an announcement for the whole campus…"
          rows={3}
          style={{
            resize: 'vertical', background: 'var(--surface-raised)', border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-md)', padding: '10px 12px', fontSize: 13, color: 'var(--text-primary)',
            fontFamily: 'inherit', outline: 'none',
          }}
        />

        {scheduleOpen && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label htmlFor="announcement-schedule-at" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Schedule date and time
            </label>
            <input
              id="announcement-schedule-at"
              aria-label="Schedule date and time"
              type="datetime-local"
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
              min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
              style={{
                background: 'var(--surface-raised)', border: '0.5px solid var(--border-default)',
                borderRadius: 'var(--r-sm)', padding: '7px 10px', fontSize: 13, color: 'var(--text-primary)',
                fontFamily: 'inherit', outline: 'none',
              }}
            />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
          <GhostBtn
            disabled={!draft.trim() || postMutation.isPending}
            onClick={saveAsDraft}
          >
            Save as draft
          </GhostBtn>
          {scheduleOpen ? (
            <>
              <GhostBtn onClick={() => { setScheduleOpen(false); setScheduleAt('') }}>Cancel</GhostBtn>
              <PrimaryBtn disabled={!draft.trim() || !scheduleAt || postMutation.isPending} onClick={schedule}>
                {postMutation.isPending ? 'Scheduling…' : 'Schedule'}
              </PrimaryBtn>
            </>
          ) : (
            <GhostBtn disabled={!draft.trim() || postMutation.isPending} onClick={() => setScheduleOpen(true)}>
              Schedule for…
            </GhostBtn>
          )}
          <PrimaryBtn
            disabled={!draft.trim() || postMutation.isPending}
            onClick={publishNow}
          >
            {postMutation.isPending ? 'Posting…' : 'Publish now'}
          </PrimaryBtn>
        </div>
      </div>
      {/* ...unchanged list rendering below... */}
```

Remove the old standalone `postMutation` definition that this replaces (the original `mutationFn: (content: string) => api.post('/posts', { content, type: 'announcement' })` block) — there is now exactly one `postMutation` with the object-payload signature above.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx pnpm --filter web test src/pages/admin/AnnouncementsTab.composer.test.tsx`
Expected: PASS (all 3 cases)

- [ ] **Step 5: Run the full AnnouncementsTab test file set for regressions**

Run: `npx pnpm --filter web test src/pages/admin/AnnouncementsTab`
Expected: PASS (Task 2's `AnnouncementsTab.test.tsx` and this task's `AnnouncementsTab.composer.test.tsx` both green)

- [ ] **Step 6: Manual verification against the running app**

Run `npx pnpm --filter api dev`, `npx pnpm --filter api worker`, and `npx pnpm --filter web dev`, sign in as the seeded admin, go to `/admin?tab=announcements`, and confirm: "Save as draft" creates a row with a Draft pill and no reach line; "Schedule for…" reveals the date-time input and "Schedule" creates a row with a Scheduled pill showing "publishes …"; waiting past the scheduled time (or using a near-future time) flips it to Published via the `post-lifecycle` worker without a page reload (socket-driven `feed:post:new`/query invalidation — confirm the row updates on the next `admin/content/posts` refetch, e.g. after switching tabs and back, since this tab doesn't currently subscribe to the socket event; note if that feels stale, it's out of scope for this plan to add a socket listener here).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/pages/admin/AnnouncementsTab.tsx apps/web/src/pages/admin/AnnouncementsTab.composer.test.tsx
git commit -m "feat(admin): add draft and schedule actions to the announcement composer

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017JRVZzfLB9LALRcnS9f2p2"
```

---

## Self-Review

**1. Spec coverage:**
- Scheduling + drafts → Task 3 (composer), backed by already-existing `publish_at`/`is_published`/queue/worker (explicitly not re-plumbed, per Global Constraints).
- Status pill (Published/Scheduled/Draft) → Task 2.
- Reach → Task 2 (`activeUsers` from `/admin/stats`, labeled "≈N members reached").
- Engagement (explicitly not "open rate") → Task 2 (`reactionCount + commentCount`).
- Existing pin/delete behavior preserved → untouched in all three tasks, only the surrounding JSX/props changed.
- No task gap found.

**2. Placeholder scan:** No "TBD"/"handle appropriately"/"similar to Task N" found — every step has literal code. Checked.

**3. Type consistency:**
- `AnnouncementItem` gains `isPublished`/`publishAt` in Task 2, matching the exact field names `toAdminPost` produces in Task 1.
- `announcementStatus` signature (`Pick<AnnouncementItem, 'isPublished' | 'publishAt'>`) matches both the Task 2 test's inline object shape and the real `AnnouncementItem`.
- `AnnouncementRow`'s new `activeUsers?: number` prop matches what `stats?.activeUsers` (possibly `undefined` before the query resolves) can pass — handled with `activeUsers ?? 0` at the render site.
- Task 3's `postMutation.mutate({ content, is_published?, publish_at? })` payload shape matches `CreatePostSchema` (`type`, `content`, `is_published` optional boolean, `publish_at` optional ISO datetime string) — no server-side change required, confirmed against `apps/api/src/modules/feed/schema.ts:34-39`.
