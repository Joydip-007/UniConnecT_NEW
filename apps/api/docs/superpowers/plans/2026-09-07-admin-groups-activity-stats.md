# Admin Groups — Pending-Requester Avatars + Activity Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the admin Groups screen (`apps/web/src/pages/admin/GroupsTab.tsx`) to parity with the design mockup by (1) showing an avatar stack of the most recent pending joiners on each group card, and (2) adding a "Group activity" summary panel (total groups, private groups, total members, pending join requests, groups created this week).

**Architecture:** Extend the existing `GET /admin/groups` endpoint's single query round-trip — no new endpoint, no migration. `AdminService.listGroups` gains a per-row `pendingRequesters` array (top 3, via a ranked subquery joined against `group_join_requests` + `profiles`) and a university-wide `summary` aggregate (a second, unpaginated query over `groups` + a `group_join_requests` count). The controller switches from `sendPaginated` (which cannot carry extra top-level fields) to `sendSuccess` with a hand-built `{ items, total, page, hasMore, summary }` payload — same shape `sendPaginated` produces, plus `summary`. Frontend: a new `PendingRequesterStack` sub-component (overlapping `Avatar` circles + "+N" overflow) rendered on each `GroupCard`, and a `GroupActivityPanel` rendered above the cards grid using `data.summary`.

**Tech Stack:** Express + Knex (Postgres) on the API; React + TanStack Query on the web. No new dependencies.

**Spec:** This plan's own "Scope" and "Mockup reference" sections below (no separate spec doc — derived directly from the design mockup at `/Users/joydipdatta/Downloads/uniconnect-furnished-design/project/Feed Page.dc.html`, Admin role → Groups screen, and from reading the current implementation).

## Mockup reference (what "done" looks like)

- Each group card additionally shows 2–3 small overlapping avatar circles (the most recently-requested pending joiners) next to its pending-count text, with a "+N" badge if there are more pending requesters than shown.
- A "Group activity" panel shows: total groups (with private-groups count as a sub-value), total members across all groups, total pending join requests across all groups, and groups created in the last 7 days.
- Per CLAUDE.md's documented, tested right-rail architecture (`roleShell.test.ts`'s "four member roles carry the same number of widgets" rule — the right rail is not admin-customizable), this panel goes **inline in the main `GroupsTab` content**, above the cards grid — not in the shell's right rail, even though the mockup puts an equivalent widget there.

## Global Constraints

- Service-layer-only DB access via Knex — routes/controllers never query the DB directly.
- Throw `notFound()` / `badRequest()` from services (`src/utils/errors.ts`) — not used in this plan (no new error paths) but any new service code follows this if it needs to.
- Controllers use `sendSuccess()` / `sendPaginated()` from `src/utils/response.ts` — never raw `res.json()`.
- No new migration: `group_join_requests` (migration `039_create_group_join_requests.ts`), `groups`, and `profiles` already carry every column this plan needs. Latest migration on disk is `104_add_group_member_mute.ts` — confirms no new one is required here.
- TypeScript strict, no `any`.
- Design tokens only: no hardcoded hex, `0.5px solid var(--border-default)` for structural borders, `var(--r-pill)` for pill/button radii, font-weight 400/500 only, sentence case copy.
- React Query key stays `['admin', 'groups', page]` (already used in `GroupsTab.tsx:42`) — extending the same query's response shape, not adding a new query.

---

### Task 1: Backend — `GET /admin/groups` returns `pendingRequesters` per group and a `summary` block

**Files:**
- Modify: `apps/api/src/modules/admin/service.ts:83-91` (the `AdminGroupRow` interface), `apps/api/src/modules/admin/service.ts:172-218` (the `listGroups` method)
- Modify: `apps/api/src/modules/admin/controller.ts:37-40` (the `listGroups` controller)
- Test: `apps/api/src/__tests__/admin-groups.test.ts` (new file)

**Interfaces:**
- Produces: `AdminService.listGroups(universityId: string, query: PaginationQuery)` now resolves to
  ```ts
  {
    items: Array<{
      id: string; name: string; description: string; type: string; isPrivate: boolean
      memberCount: number; pendingRequestCount: number
      pendingRequesters: Array<{ userId: string; fullName: string; avatarUrl: string | null }>
      createdAt: Date
    }>
    total: number; page: number; limit: number
    summary: { totalGroups: number; privateGroups: number; totalMembers: number; pendingRequests: number; createdThisWeek: number }
  }
  ```
- Consumes: existing `db` (Knex instance, `../../config/db`), existing `PaginationQuery` type from `./schema`, existing `CountRow` interface (service.ts:39-41).

- [ ] **Step 1: Write the failing integration test**

Create `apps/api/src/__tests__/admin-groups.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { app, loginAs, DOMAIN, TEST_UNIVERSITY_ID, CREDENTIALS } from './setup'
import { db } from '../config/db'

const api = supertest(app)
const UNI = { 'x-university-domain': DOMAIN }

let adminToken: string
let groupId: string
const requesterIds: string[] = []

beforeAll(async () => {
  const admin = await loginAs(CREDENTIALS.admin.email, CREDENTIALS.admin.password)
  adminToken = admin.accessToken

  const [group] = await db('groups')
    .insert({
      university_id: TEST_UNIVERSITY_ID,
      name: 'Admin groups test club',
      description: 'Fixture group for admin groups summary test',
      type: 'club',
      is_private: true,
      member_count: 5,
      created_by: (await db('users').where({ university_id: TEST_UNIVERSITY_ID, role: 'student' }).first('id'))!.id,
    })
    .returning('id')
  groupId = group.id

  // Four pending requesters, most-recent-first ordering matters
  const students = await db('users')
    .join('profiles', 'profiles.user_id', 'users.id')
    .where({ 'users.university_id': TEST_UNIVERSITY_ID })
    .limit(4)
    .select('users.id')
  for (const [i, s] of students.entries()) {
    const [row] = await db('group_join_requests')
      .insert({
        group_id: groupId,
        user_id: s.id,
        university_id: TEST_UNIVERSITY_ID,
        status: 'pending',
        created_at: new Date(Date.now() - (students.length - i) * 1000),
      })
      .returning('id')
    requesterIds.push(row.id)
  }
})

afterAll(async () => {
  await db('group_join_requests').where({ group_id: groupId }).delete()
  await db('groups').where({ id: groupId }).delete()
})

describe('GET /api/v1/admin/groups', () => {
  it('includes up to 3 pending requesters per group, most recent first', async () => {
    const res = await api
      .get('/api/v1/admin/groups')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ page: 1, limit: 50 })

    expect(res.status).toBe(200)
    const row = res.body.data.items.find((g: { id: string }) => g.id === groupId)
    expect(row).toBeTruthy()
    expect(row.pendingRequestCount).toBe(4)
    expect(row.pendingRequesters).toHaveLength(3)
    expect(row.pendingRequesters[0]).toHaveProperty('userId')
    expect(row.pendingRequesters[0]).toHaveProperty('fullName')
    expect(row.pendingRequesters[0]).toHaveProperty('avatarUrl')
  })

  it('returns a university-wide summary block', async () => {
    const res = await api
      .get('/api/v1/admin/groups')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ page: 1, limit: 50 })

    expect(res.status).toBe(200)
    expect(res.body.data.summary).toMatchObject({
      totalGroups: expect.any(Number),
      privateGroups: expect.any(Number),
      totalMembers: expect.any(Number),
      pendingRequests: expect.any(Number),
      createdThisWeek: expect.any(Number),
    })
    expect(res.body.data.summary.totalGroups).toBeGreaterThanOrEqual(1)
    expect(res.body.data.summary.pendingRequests).toBeGreaterThanOrEqual(4)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `DATABASE_URL="postgresql://$(whoami)@localhost:5432/uniconnect_test" GEMINI_API_KEY=test-key npx pnpm --filter api test admin-groups`
Expected: FAIL — `row.pendingRequesters` is `undefined` and `res.body.data.summary` is `undefined` (current `listGroups` doesn't produce either field).

- [ ] **Step 3: Extend the `AdminGroupRow` interface**

In `apps/api/src/modules/admin/service.ts`, replace the existing interface at lines 83-91:

```ts
interface AdminGroupRow {
  id: string
  name: string
  description: string
  type: string
  is_private: boolean
  member_count: number
  created_at: Date
  pending_request_count: string | number
  pending_requesters: { userId: string; fullName: string; avatarUrl: string | null }[] | null
}

interface GroupsSummaryRow {
  total_groups: string | number
  private_groups: string | number
  total_members: string | number
  created_this_week: string | number
}
```

- [ ] **Step 4: Rewrite `listGroups`**

Replace the method at `apps/api/src/modules/admin/service.ts:172-218` with:

```ts
  /**
   * Every group in the university, private or not — unlike `groups.listGroups`, which
   * only shows a private group to members. Platform admin oversight needs the full roster.
   */
  async listGroups(universityId: string, query: PaginationQuery) {
    const [{ count }] = await db('groups')
      .where('university_id', universityId)
      .count<CountRow[]>({ count: '*' })

    const rows = await db('groups')
      .where('groups.university_id', universityId)
      .leftJoin(
        db('group_join_requests')
          .select('group_id')
          .count<{ group_id: string; count: string }[]>({ count: '*' })
          .where('status', 'pending')
          .groupBy('group_id')
          .as('jr'),
        'jr.group_id',
        'groups.id',
      )
      .leftJoin(
        db.raw(`(
          SELECT group_id, json_agg(json_build_object(
            'userId', user_id,
            'fullName', full_name,
            'avatarUrl', avatar_url
          ) ORDER BY created_at DESC) AS requesters
          FROM (
            SELECT gjr.group_id, gjr.user_id, gjr.created_at, p.full_name, p.avatar_url,
                   row_number() OVER (PARTITION BY gjr.group_id ORDER BY gjr.created_at DESC) AS rn
            FROM group_join_requests gjr
            JOIN profiles p ON p.user_id = gjr.user_id
            WHERE gjr.status = 'pending'
          ) ranked
          WHERE rn <= 3
          GROUP BY group_id
        ) as jrt`),
        'jrt.group_id',
        'groups.id',
      )
      .select<AdminGroupRow[]>(
        'groups.id',
        'groups.name',
        'groups.description',
        'groups.type',
        'groups.is_private',
        'groups.member_count',
        'groups.created_at',
        db.raw('COALESCE(jr.count, 0) as pending_request_count'),
        db.raw(`COALESCE(jrt.requesters, '[]'::json) as pending_requesters`),
      )
      .orderBy('groups.created_at', 'desc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)

    const summaryRow = await db('groups')
      .where('university_id', universityId)
      .select<GroupsSummaryRow[]>(
        db.raw('COUNT(*)::int as total_groups'),
        db.raw('COUNT(*) FILTER (WHERE is_private)::int as private_groups'),
        db.raw('COALESCE(SUM(member_count), 0)::int as total_members'),
        db.raw(`COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days')::int as created_this_week`),
      )
      .first()

    const [{ count: pendingTotal }] = await db('group_join_requests')
      .where({ university_id: universityId, status: 'pending' })
      .count<CountRow[]>({ count: '*' })

    return {
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        type: r.type,
        isPrivate: r.is_private,
        memberCount: r.member_count,
        pendingRequestCount: Number(r.pending_request_count),
        pendingRequesters: r.pending_requesters ?? [],
        createdAt: r.created_at,
      })),
      total: Number(count),
      page: query.page,
      limit: query.limit,
      summary: {
        totalGroups: Number(summaryRow?.total_groups ?? 0),
        privateGroups: Number(summaryRow?.private_groups ?? 0),
        totalMembers: Number(summaryRow?.total_members ?? 0),
        pendingRequests: Number(pendingTotal ?? 0),
        createdThisWeek: Number(summaryRow?.created_this_week ?? 0),
      },
    }
  }
```

- [ ] **Step 5: Update the controller to carry `summary` through**

`sendPaginated` (`src/utils/response.ts:23-30`) only forwards `items/total/page/hasMore` — it can't carry an extra top-level field. Replace `apps/api/src/modules/admin/controller.ts:37-40`:

```ts
export const listGroups = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getAdminContext(req)
  const result = await adminService.listGroups(universityId, req.query as unknown as PaginationQuery)
  sendSuccess(res, {
    items: result.items,
    total: result.total,
    page: result.page,
    hasMore: result.page * result.limit < result.total,
    summary: result.summary,
  })
})
```

(`sendSuccess` is already imported at the top of `controller.ts:4`.)

- [ ] **Step 6: Run the test to verify it passes**

Run: `DATABASE_URL="postgresql://$(whoami)@localhost:5432/uniconnect_test" GEMINI_API_KEY=test-key npx pnpm --filter api test admin-groups`
Expected: PASS

- [ ] **Step 7: Typecheck and commit**

Run: `npx pnpm --filter api typecheck`

```bash
git add apps/api/src/modules/admin/service.ts apps/api/src/modules/admin/controller.ts apps/api/src/__tests__/admin-groups.test.ts
git commit -m "feat(admin): return pending-requester avatars and a groups summary from GET /admin/groups"
```

---

### Task 2: Frontend — pending-requester avatar stack on each group card

**Files:**
- Modify: `apps/web/src/pages/admin/GroupsTab.tsx`

**Interfaces:**
- Consumes: `AdminService.listGroups` response from Task 1 — each item now has `pendingRequesters: { userId: string; fullName: string; avatarUrl: string | null }[]`; `Avatar` component (`apps/web/src/components/Avatar.tsx`, props `{ initials, color, size?, online?, src? }`); `avatarColor(id)` and `getInitials(fullName)` from `apps/web/src/utils/avatar.ts` (already used elsewhere in the admin page, e.g. `AdminPage.tsx:22`).
- Produces: a `PendingRequesterStack` component, exported only for local use within this file (not consumed elsewhere).

- [ ] **Step 1: Update the local types**

In `apps/web/src/pages/admin/GroupsTab.tsx`, replace the `AdminGroupItem` interface (lines 9-18):

```ts
interface PendingRequester {
  userId: string
  fullName: string
  avatarUrl: string | null
}

interface AdminGroupItem {
  id: string
  name: string
  description: string
  type: string
  isPrivate: boolean
  memberCount: number
  pendingRequestCount: number
  pendingRequesters: PendingRequester[]
  createdAt: string
}
```

- [ ] **Step 2: Import the avatar helpers**

Add to the top imports (after the existing `lucide-react` import, line 4):

```ts
import { Avatar } from '@/components/Avatar'
import { avatarColor, getInitials } from '@/utils/avatar'
```

- [ ] **Step 3: Add the `PendingRequesterStack` component**

Add this new component right before `GroupCard` (before line 94):

```tsx
function PendingRequesterStack({ requesters, total }: { requesters: PendingRequester[]; total: number }) {
  if (requesters.length === 0) return null
  const overflow = total - requesters.length

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {requesters.map((r, i) => (
        <div
          key={r.userId}
          title={r.fullName}
          style={{
            marginLeft: i === 0 ? 0 : -8,
            border: '2px solid var(--surface-card)',
            borderRadius: '50%',
            zIndex: requesters.length - i,
          }}
        >
          <Avatar initials={getInitials(r.fullName)} color={avatarColor(r.userId)} size={22} src={r.avatarUrl} />
        </div>
      ))}
      {overflow > 0 && (
        <div
          style={{
            marginLeft: -8,
            width: 22,
            height: 22,
            borderRadius: '50%',
            border: '2px solid var(--surface-card)',
            background: 'var(--surface-raised)',
            color: 'var(--text-tertiary)',
            fontSize: 10,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Render the stack on `GroupCard`**

In `GroupCard` (currently lines 94-146), replace the bottom row (lines 124-143):

```tsx
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, paddingTop: 12, borderTop: '0.5px solid var(--border-default)',
      }}>
        <PendingRequesterStack requesters={group.pendingRequesters} total={group.pendingRequestCount} />
        <span style={{
          fontSize: 12, fontWeight: 500, flex: 1, minWidth: 0,
          color: group.pendingRequestCount > 0 ? 'var(--uc-orange-l)' : 'var(--text-tertiary)',
        }}>
          {group.pendingRequestCount > 0 ? `${group.pendingRequestCount} pending requests` : 'No pending requests'}
        </span>
        <Link
          to={PATHS.GROUP_DETAIL.replace(':id', group.id)}
          style={{
            padding: '6px 14px', fontSize: 12, fontWeight: 500, borderRadius: 'var(--r-pill)',
            border: '0.5px solid var(--uc-indigo-bdr)', background: 'var(--uc-indigo-bg)',
            color: 'var(--uc-indigo-l)', textDecoration: 'none', flexShrink: 0,
          }}
        >
          Manage
        </Link>
      </div>
```

- [ ] **Step 5: Manual verification**

Run: `npx pnpm --filter web dev`, sign in as admin (or use `?dev-auth=1` per `screenshots/` conventions), visit `/admin?tab=groups`. Confirm a group with pending requests shows overlapping avatar circles (or initials) followed by the pending-count text, and a group with none shows neither.

- [ ] **Step 6: Typecheck, lint, and commit**

Run: `npx pnpm --filter web typecheck && npx pnpm --filter web lint`

```bash
git add apps/web/src/pages/admin/GroupsTab.tsx
git commit -m "feat(admin): show pending-requester avatar stack on group cards"
```

---

### Task 3: Frontend — "Group activity" summary panel

**Files:**
- Modify: `apps/web/src/pages/admin/GroupsTab.tsx`
- Test: `apps/web/src/pages/admin/GroupsTab.test.tsx` (new file)

**Interfaces:**
- Consumes: `data.summary` from the `GET /admin/groups` response (Task 1): `{ totalGroups, privateGroups, totalMembers, pendingRequests, createdThisWeek }`.

- [ ] **Step 1: Write the failing component test**

First check whether `packages/shared/dist/` exists (`ls packages/shared/dist`); if absent, run `npx pnpm --filter @uniconnect/shared build` first, or this test fails with a resolution error unrelated to the change under test.

Create `apps/web/src/pages/admin/GroupsTab.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { GroupsTab } from './GroupsTab'
import { api } from '@/lib/axios'

vi.mock('@/lib/axios', () => ({
  api: { get: vi.fn() },
}))

function renderWithProviders() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <GroupsTab />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('GroupsTab — Group activity panel', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        data: {
          items: [],
          total: 0,
          page: 1,
          hasMore: false,
          summary: {
            totalGroups: 42,
            privateGroups: 9,
            totalMembers: 1830,
            pendingRequests: 12,
            createdThisWeek: 3,
          },
        },
      },
    })
  })

  it('renders the summary metrics once loaded', async () => {
    renderWithProviders()
    expect(await screen.findByText('42')).toBeInTheDocument()
    expect(screen.getByText('9 private')).toBeInTheDocument()
    expect(screen.getByText('1,830')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx pnpm --filter web test src/pages/admin/GroupsTab.test.tsx`
Expected: FAIL — no "Group activity" panel exists yet, so none of the summary text is on the page (component currently returns `<SkeletonGrid />` or the empty-state / grid only).

- [ ] **Step 3: Thread `summary` through the query and add the panel**

In `apps/web/src/pages/admin/GroupsTab.tsx`, update the `Paginated<T>` shape and query (replace lines 20-47):

```ts
interface GroupsSummary {
  totalGroups: number
  privateGroups: number
  totalMembers: number
  pendingRequests: number
  createdThisWeek: number
}

interface Paginated<T> {
  items: T[]
  total: number
  page: number
  limit: number
  summary: GroupsSummary
}

const LIMIT = 20

const TYPE_ICON: Record<string, typeof Building2> = {
  department: Building2,
  club: Sparkles,
  batch: GraduationCap,
  research: FlaskConical,
  interest: Layers,
  other: Users,
}

export function GroupsTab() {
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery<Paginated<AdminGroupItem>>({
    queryKey: ['admin', 'groups', page],
    queryFn: () =>
      api
        .get<{ data: Paginated<AdminGroupItem> }>('/admin/groups', { params: { page, limit: LIMIT } })
        .then((r) => ({ ...r.data.data, limit: LIMIT })),
  })

  if (isLoading || !data) return <SkeletonGrid />
```

Then insert the panel and adjust the empty-state / grid branches (replace the body from the current empty-state check through the end of the grid, lines 51-90):

```tsx
  const totalPages = Math.max(1, Math.ceil(data.total / LIMIT))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <GroupActivityPanel summary={data.summary} />

      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>
        {data.total.toLocaleString()} {data.total === 1 ? 'group' : 'groups'} across the university
      </p>

      {data.items.length === 0 ? (
        <div style={{
          background: 'var(--surface-card)', border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)', padding: '56px 24px', display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 12, textAlign: 'center',
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 'var(--r-md)', background: 'var(--surface-raised)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)',
          }}>
            <Users size={20} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>No groups yet</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            {data.items.map((g) => (
              <GroupCard key={g.id} group={g} />
            ))}
          </div>
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 4 }}>
              <GhostBtn disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</GhostBtn>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', alignSelf: 'center' }}>
                {page} / {totalPages}
              </span>
              <GhostBtn disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Next</GhostBtn>
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Add the `GroupActivityPanel` component**

Add this new component right after the `GroupsTab` function (before `GroupCard`):

```tsx
function GroupActivityPanel({ summary }: { summary: GroupsSummary }) {
  const tiles: { label: string; value: string; sub: string }[] = [
    { label: 'Total groups', value: summary.totalGroups.toLocaleString(), sub: `${summary.privateGroups} private` },
    { label: 'Total members', value: summary.totalMembers.toLocaleString(), sub: 'across all groups' },
    { label: 'Pending requests', value: summary.pendingRequests.toLocaleString(), sub: 'awaiting review' },
    { label: 'New this week', value: summary.createdThisWeek.toLocaleString(), sub: 'groups created' },
  ]

  return (
    <div style={{
      background: 'var(--surface-card)',
      border: '0.5px solid var(--border-default)',
      borderRadius: 'var(--r-lg)',
      display: 'flex',
      overflow: 'hidden',
    }}>
      {tiles.map((t, i) => (
        <div key={t.label} style={{
          flex: '1 1 0',
          minWidth: 100,
          padding: '16px 18px',
          borderLeft: i > 0 ? '0.5px solid var(--border-default)' : 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-label)', letterSpacing: '0.04em' }}>
            {t.label}
          </span>
          <span style={{ fontSize: 24, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1 }}>
            {t.value}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{t.sub}</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx pnpm --filter web test src/pages/admin/GroupsTab.test.tsx`
Expected: PASS

- [ ] **Step 6: Typecheck, lint, and commit**

Run: `npx pnpm --filter web typecheck && npx pnpm --filter web lint`

```bash
git add apps/web/src/pages/admin/GroupsTab.tsx apps/web/src/pages/admin/GroupsTab.test.tsx
git commit -m "feat(admin): add Group activity summary panel to the admin Groups tab"
```

---

## Self-Review

**1. Spec coverage:**
- Avatar stack of pending requesters per group card → Task 2. ✅
- "+N" overflow badge → Task 2, Step 3. ✅
- Group activity panel (total groups/private, total members, pending requests, created this week) → Task 3. ✅
- Backend support for both (no migration needed) → Task 1. ✅
- Placement decision documented (inline panel, not right rail, per the shared-rail architecture constraint) → "Mockup reference" section. ✅

**2. Placeholder scan:** No "TBD"/"implement later"/"add appropriate handling" language anywhere in the steps above; every step has runnable code or an exact command.

**3. Type consistency:**
- `PendingRequester` (frontend, Task 2) matches the backend's `pendingRequesters` item shape from Task 1 (`userId`, `fullName`, `avatarUrl: string | null`) — same field names, no snake/camel drift since the service already converts snake_case DB rows to camelCase before returning.
- `GroupsSummary` (Task 3) field names (`totalGroups`, `privateGroups`, `totalMembers`, `pendingRequests`, `createdThisWeek`) match the backend `summary` object built in Task 1, Step 4 exactly.
- `AdminGroupItem` (Task 2, Step 1) carries both `pendingRequestCount` (existing) and the new `pendingRequesters` array — `PendingRequesterStack`'s `total` prop is fed `group.pendingRequestCount`, not `pendingRequesters.length`, so the overflow count (`total - requesters.length`) is correct even though only 3 requesters are ever sent from the API.
