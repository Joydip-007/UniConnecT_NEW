# Admin Insights + Moderation Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the admin Insights and Moderation screens to visual/data parity with `Feed Page.dc.html`'s admin mockup: a 4-tile Insights metric strip with a content-mix widget and needs-attention list, and a Moderation screen with escalated/verification/deletion stat tiles, a report-target-grouped "Reported content" list carrying a computed severity badge, and a "Moderation health" panel.

**Architecture:** Severity is computed on the fly from `reports.reason` via a fixed, in-code mapping — no new column. Reports are aggregated by `(target_id, target_type)` at query time so multiple reports on the same post collapse into one queue row with a count. "Verification requests" reuses the existing `users.is_verified` boolean (no new table). All new data flows through `AdminService`/`AdminContentService` and the existing `adminRouter`, following the current controller → service → Knex pattern.

**Tech Stack:** Express + Knex + Zod (apps/api), React + TanStack Query (apps/web), Vitest + supertest for API tests.

**Spec:** This plan file is self-contained; the source of truth for the target visuals is `/Users/joydipdatta/Downloads/uniconnect-furnished-design/project/Feed Page.dc.html` (Admin role → Insights / Moderation screens).

## Global Constraints

- **Depends on:** the `admin-members-invite-batches-and-verification` plan must ship first — Task 1 below reads `invitations.batch_id`, a column that plan introduces. If that plan hasn't landed, skip the `pendingInviteBatches` field in Task 1 (leave it `0`) rather than blocking this plan.
- No new migration in this plan — every new field is either computed (severity) or backed by an existing column (`is_verified`, `reports.status`, `reports.created_at`/`resolved_at`).
- Route/service conventions: routes only declare `router.METHOD(...)`, all logic in `AdminService`/`AdminContentService`; validate with `validate(schema)`/`validateRequest({...})`; controllers use `sendSuccess`/`sendPaginated` from `src/utils/response.ts`; services throw `notFound()`/`badRequest()` from `src/utils/errors.ts`.
- Zod schema naming: `camelCase` + `Schema` suffix, added to `apps/api/src/modules/admin/schema.ts`.
- DB access is Knex query builder; raw SQL only for the severity `CASE` expression and aggregate functions Knex can't express directly.
- Frontend: React Query key convention `['admin', 'action', {params}]`; no hardcoded hex colors (`var(--token)` only); borders `0.5px solid`; pill radius `var(--r-pill)`; font-weight 400/500 only.
- Design tokens used: `--uc-red`/`--uc-red-bg`/`--uc-red-bdr` (High), `--uc-amber`/`--uc-amber-bg`/`--uc-amber-bdr` (Medium), `--surface-raised`/`--text-tertiary` (Low/neutral) — all already defined in `apps/web/src/styles/tokens.css`.
- Every admin route already sits behind `adminRouter.use(requireAuth, resolveUniversity, requireRole('faculty', 'admin'))` (apps/api/src/modules/admin/router.ts:63); routes that must be admin-only (not faculty) add `requireRole('admin')` per-route, matching the existing `/stats` pattern.

---

### Task 1: Severity helper + extended `/admin/stats`

**Files:**
- Create: `apps/api/src/modules/admin/severity.ts`
- Modify: `apps/api/src/modules/admin/service.ts` (`getStats`, ~line 106-129)
- Test: `apps/api/src/__tests__/admin-insights-stats.test.ts`

**Interfaces:**
- Produces: `severityForReason(reason: string): 'high' | 'medium' | 'low'` and `severityCaseSql(column: string): string` from `severity.ts`, used by Task 1 and Task 2.
- Produces: `AdminService.getStats()` now additionally returns `{ escalatedReports, verificationRequests, deletionRequests, resolvedPct7d, pendingInviteBatches, moderationHealth: { reportsOpen, resolvedPct7d, medianResponseHours, repeatOffenders } }` alongside the existing `{ users, posts, jobs, events, groups, news, reports, activeUsers, usersByRole, postsByDay }`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/__tests__/admin-insights-stats.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { app, loginAs, DOMAIN, TEST_UNIVERSITY_ID, CREDENTIALS } from './setup'
import { db } from '../config/db'

const api = supertest(app)
const UNI = { 'x-university-domain': DOMAIN }

let adminToken: string
let reporterId: string
let targetPostId: string
const seededReportIds: string[] = []

beforeAll(async () => {
  const admin = await loginAs(CREDENTIALS.admin.email, CREDENTIALS.admin.password)
  adminToken = admin.accessToken

  const reporter = await db('users').where({ email: CREDENTIALS.student.email }).first('id')
  reporterId = reporter.id

  const post = await db('posts')
    .insert({
      university_id: TEST_UNIVERSITY_ID,
      author_id: reporterId,
      content: 'Stats test post',
      type: 'post',
    })
    .returning('id')
  targetPostId = post[0].id ?? post[0]

  const [highReport, mediumReport] = await db('reports')
    .insert([
      { reporter_id: reporterId, target_id: targetPostId, target_type: 'post', reason: 'harassment', status: 'pending' },
      { reporter_id: reporterId, target_id: targetPostId, target_type: 'post', reason: 'misinformation', status: 'resolved', resolved_at: db.fn.now() },
    ])
    .returning('id')
  seededReportIds.push(highReport.id ?? highReport, mediumReport.id ?? mediumReport)
})

afterAll(async () => {
  await db('reports').whereIn('id', seededReportIds).delete()
  await db('posts').where({ id: targetPostId }).delete()
})

describe('GET /api/v1/admin/stats — extended moderation/insights fields', () => {
  it('returns escalatedReports, verificationRequests, resolvedPct7d and moderationHealth', async () => {
    const res = await api
      .get('/api/v1/admin/stats')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveProperty('escalatedReports')
    expect(res.body.data).toHaveProperty('verificationRequests')
    expect(res.body.data).toHaveProperty('resolvedPct7d')
    expect(res.body.data).toHaveProperty('pendingInviteBatches')
    expect(res.body.data.moderationHealth).toMatchObject({
      reportsOpen: expect.any(Number),
      resolvedPct7d: expect.any(Number),
      medianResponseHours: expect.any(Number),
      repeatOffenders: expect.any(Number),
    })
    // The seeded pending 'harassment' report is high-severity and open, so it counts as escalated.
    expect(res.body.data.escalatedReports).toBeGreaterThanOrEqual(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `DATABASE_URL="postgresql://$(whoami)@localhost:5432/uniconnect_test" GEMINI_API_KEY=test-key npx pnpm --filter api test admin-insights-stats`
Expected: FAIL — `res.body.data.moderationHealth` is `undefined` (property doesn't exist yet).

- [ ] **Step 3: Write the severity helper**

```ts
// apps/api/src/modules/admin/severity.ts

/**
 * Report severity is derived, not stored — `reports.reason` mirrors the fixed
 * enum in packages/shared/src/schemas/moderation.ts (reportReasonSchema). This
 * mapping must stay exhaustive against that enum: spam, harassment,
 * hate_speech, violence, nudity, misinformation, impersonation, self_harm, other.
 */
const HIGH_REASONS = ['harassment', 'hate_speech', 'violence', 'nudity', 'self_harm'] as const
const MEDIUM_REASONS = ['misinformation', 'impersonation'] as const
// spam, other -> low (the SQL/JS default branch)

export type ReportSeverity = 'high' | 'medium' | 'low'

export function severityForReason(reason: string): ReportSeverity {
  if ((HIGH_REASONS as readonly string[]).includes(reason)) return 'high'
  if ((MEDIUM_REASONS as readonly string[]).includes(reason)) return 'medium'
  return 'low'
}

/** SQL CASE expression over a fixed, code-defined reason list — safe to inline, no user input reaches this string. */
export function severityCaseSql(column: string): string {
  const high = HIGH_REASONS.map((r) => `'${r}'`).join(', ')
  const medium = MEDIUM_REASONS.map((r) => `'${r}'`).join(', ')
  return `CASE WHEN ${column} IN (${high}) THEN 3 WHEN ${column} IN (${medium}) THEN 2 ELSE 1 END`
}

export function severityFromRank(rank: number): ReportSeverity {
  if (rank >= 3) return 'high'
  if (rank === 2) return 'medium'
  return 'low'
}
```

- [ ] **Step 4: Extend `getStats` in `service.ts`**

Replace the existing `getStats` method (apps/api/src/modules/admin/service.ts:106-129) with:

```ts
import { severityCaseSql } from './severity'

// ...

async getStats(universityId: string) {
  const universityUserIds = db('users').where('university_id', universityId).select('id')

  const [users, posts, jobs, events, groups, news, reports] = await Promise.all([
    countWhere('users', { university_id: universityId }),
    countWhere('posts', { university_id: universityId }),
    countWhere('jobs', { university_id: universityId }),
    countWhere('events', { university_id: universityId }),
    countWhere('groups', { university_id: universityId }),
    countWhere('news', { university_id: universityId }),
    db('reports')
      .whereIn('reporter_id', universityUserIds)
      .where('status', 'pending')
      .count<CountRow[]>({ count: '*' })
      .first()
      .then((r) => Number(r?.count ?? 0)),
  ])

  const activeUsers = await countActive(universityId)
  const [usersByRole, postsByDay] = await Promise.all([
    countUsersByRole(universityId),
    countPostsByDay(universityId),
  ])

  const [escalatedReports, verificationRequests, deletionRequests, resolvedPct7d, moderationHealth, pendingInviteBatches] =
    await Promise.all([
      countEscalatedReports(universityId),
      countWhere('users', { university_id: universityId, is_deleted: false, is_verified: false }),
      db('account_deletion_requests')
        .where({ university_id: universityId, status: 'pending' })
        .count<CountRow[]>({ count: '*' })
        .first()
        .then((r) => Number(r?.count ?? 0)),
      resolvedPercentLast7Days(universityId),
      getModerationHealth(universityId),
      countPendingInviteBatches(universityId),
    ])

  return {
    users, posts, jobs, events, groups, news, reports, activeUsers, usersByRole, postsByDay,
    escalatedReports, verificationRequests, deletionRequests, resolvedPct7d, pendingInviteBatches, moderationHealth,
  }
}
```

Add these module-level helper functions next to the existing `countWhere`/`countActive`/`countUsersByRole` helpers (apps/api/src/modules/admin/service.ts, near line 932):

```ts
async function countEscalatedReports(universityId: string): Promise<number> {
  const universityUserIds = db('users').where('university_id', universityId).select('id')
  const row = await db('reports')
    .whereIn('reporter_id', universityUserIds)
    .where('status', 'pending')
    .whereRaw(`${severityCaseSql('reason')} = 3`)
    .count<CountRow[]>({ count: '*' })
    .first()
  return Number(row?.count ?? 0)
}

async function resolvedPercentLast7Days(universityId: string): Promise<number> {
  const universityUserIds = db('users').where('university_id', universityId).select('id')
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - 7)

  const row = await db('reports')
    .whereIn('reporter_id', universityUserIds)
    .where('created_at', '>=', since)
    .select(
      db.raw("COUNT(*) FILTER (WHERE status IN ('resolved', 'dismissed'))::int as closed"),
      db.raw('COUNT(*)::int as total'),
    )
    .first<{ closed: number; total: number }>()

  if (!row || row.total === 0) return 100
  return Math.round((row.closed / row.total) * 100)
}

async function getModerationHealth(universityId: string) {
  const universityUserIds = db('users').where('university_id', universityId).select('id')

  const reportsOpen = await db('reports')
    .whereIn('reporter_id', universityUserIds)
    .whereIn('status', ['pending', 'reviewed'])
    .count<CountRow[]>({ count: '*' })
    .first()
    .then((r) => Number(r?.count ?? 0))

  const resolvedPct7d = await resolvedPercentLast7Days(universityId)

  const since = new Date()
  since.setUTCDate(since.getUTCDate() - 7)
  const medianRow = await db('reports')
    .whereIn('reporter_id', universityUserIds)
    .where('status', 'resolved')
    .andWhere('resolved_at', '>=', since)
    .select(
      db.raw(
        "PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600.0) as median_hours",
      ),
    )
    .first<{ median_hours: string | null }>()
  const medianResponseHours = medianRow?.median_hours ? Math.round(Number(medianRow.median_hours) * 10) / 10 : 0

  const repeatOffendersRow = await db
    .from(
      db('reports')
        .whereIn('reporter_id', universityUserIds)
        .whereIn('status', ['pending', 'reviewed'])
        .groupBy('target_id', 'target_type')
        .having(db.raw('COUNT(*)'), '>=', 2)
        .select('target_id')
        .as('repeats'),
    )
    .count<CountRow[]>({ count: '*' })
    .first()
  const repeatOffenders = Number(repeatOffendersRow?.count ?? 0)

  return { reportsOpen, resolvedPct7d, medianResponseHours, repeatOffenders }
}

/** Depends on `invitations.batch_id` from the admin-members-invite-batches-and-verification plan. Returns 0 until that column exists. */
async function countPendingInviteBatches(universityId: string): Promise<number> {
  const hasColumn = await db.schema.hasColumn('invitations', 'batch_id')
  if (!hasColumn) return 0

  const row = await db('invitations')
    .where({ university_id: universityId, is_used: false })
    .andWhere('expires_at', '>', db.fn.now())
    .whereNotNull('batch_id')
    .countDistinct<CountRow[]>({ count: 'batch_id' })
    .first()
  return Number(row?.count ?? 0)
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `DATABASE_URL="postgresql://$(whoami)@localhost:5432/uniconnect_test" GEMINI_API_KEY=test-key npx pnpm --filter api test admin-insights-stats`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/admin/severity.ts apps/api/src/modules/admin/service.ts apps/api/src/__tests__/admin-insights-stats.test.ts
git commit -m "feat(admin): extend /admin/stats with severity-derived moderation metrics

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017JRVZzfLB9LALRcnS9f2p2"
```

---

### Task 2: Grouped reported-content endpoint + remove/dismiss-by-target

**Files:**
- Modify: `apps/api/src/modules/admin/service.ts` (add `listReportedContentGroups`, `resolveReportGroup`)
- Modify: `apps/api/src/modules/admin/schema.ts` (add `ResolveReportGroupSchema`)
- Modify: `apps/api/src/modules/admin/controller.ts` (add `listReportedContentGroups`, `resolveReportGroup` handlers)
- Modify: `apps/api/src/modules/admin/router.ts` (add routes)
- Test: `apps/api/src/__tests__/admin-reported-content-groups.test.ts`

**Interfaces:**
- Consumes: `severityFromRank` from `severity.ts` (Task 1).
- Produces: `GET /admin/reports/grouped` → `{ data: { items: ReportGroup[], total, page, limit } }` where `ReportGroup = { targetId, targetType, title, severity: 'high'|'medium'|'low', reason, reportCount, lastReportedAt, removable: boolean }`. `PATCH /admin/reports/target/:targetType/:targetId` body `{ action: 'remove' | 'dismiss' }` → `{ data: { targetId, targetType, status } }`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/__tests__/admin-reported-content-groups.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { app, loginAs, DOMAIN, TEST_UNIVERSITY_ID, CREDENTIALS } from './setup'
import { db } from '../config/db'

const api = supertest(app)
const UNI = { 'x-university-domain': DOMAIN }

let adminToken: string
let reporterId: string
let secondReporterId: string
let postId: string
const reportIds: string[] = []

beforeAll(async () => {
  const admin = await loginAs(CREDENTIALS.admin.email, CREDENTIALS.admin.password)
  adminToken = admin.accessToken

  const reporter = await db('users').where({ email: CREDENTIALS.student.email }).first('id')
  reporterId = reporter.id
  const secondReporter = await db('users').where({ email: CREDENTIALS.alumni.email }).first('id')
  secondReporterId = secondReporter.id

  const post = await db('posts')
    .insert({ university_id: TEST_UNIVERSITY_ID, author_id: reporterId, content: 'Grouped report test post', type: 'post' })
    .returning('id')
  postId = post[0].id ?? post[0]

  const inserted = await db('reports')
    .insert([
      { reporter_id: reporterId, target_id: postId, target_type: 'post', reason: 'spam', status: 'pending' },
      { reporter_id: secondReporterId, target_id: postId, target_type: 'post', reason: 'harassment', status: 'pending' },
    ])
    .returning('id')
  reportIds.push(...inserted.map((r: { id: string } | string) => (typeof r === 'string' ? r : r.id)))
})

afterAll(async () => {
  await db('reports').whereIn('id', reportIds).delete()
  await db('posts').where({ id: postId }).delete()
})

describe('GET /api/v1/admin/reports/grouped', () => {
  it('collapses multiple reports on the same target into one row with a count and the highest severity', async () => {
    const res = await api
      .get('/api/v1/admin/reports/grouped')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    const row = res.body.data.items.find((i: { targetId: string }) => i.targetId === postId)
    expect(row).toBeDefined()
    expect(row.reportCount).toBe(2)
    expect(row.severity).toBe('high') // harassment outranks spam
    expect(row.targetType).toBe('post')
    expect(row.removable).toBe(true)
  })
})

describe('PATCH /api/v1/admin/reports/target/:targetType/:targetId', () => {
  it('dismiss resolves every open report for the target without deleting the post', async () => {
    const res = await api
      .patch(`/api/v1/admin/reports/target/post/${postId}`)
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'dismiss' })

    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('dismissed')

    const remainingOpen = await db('reports').whereIn('id', reportIds).where('status', 'dismissed')
    expect(remainingOpen).toHaveLength(2)

    const post = await db('posts').where({ id: postId }).first()
    expect(post).toBeDefined()
  })

  it('returns 404 when the target has no open reports', async () => {
    const res = await api
      .patch(`/api/v1/admin/reports/target/post/${postId}`)
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'dismiss' })

    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `DATABASE_URL="postgresql://$(whoami)@localhost:5432/uniconnect_test" GEMINI_API_KEY=test-key npx pnpm --filter api test admin-reported-content-groups`
Expected: FAIL — 404 on `GET /api/v1/admin/reports/grouped` (route doesn't exist).

- [ ] **Step 3: Add the schema**

In `apps/api/src/modules/admin/schema.ts`, add near `ResolveReportSchema`:

```ts
export const ResolveReportGroupSchema = z.object({
  action: z.enum(['remove', 'dismiss']),
})
export type ResolveReportGroupInput = z.infer<typeof ResolveReportGroupSchema>
```

- [ ] **Step 4: Add the service methods**

In `apps/api/src/modules/admin/service.ts`, add near `resolveReport` (~line 407):

```ts
import { severityCaseSql, severityFromRank } from './severity'

interface ReportGroupRow {
  target_id: string
  target_type: string
  report_count: string | number
  severity_rank: number
  latest_reason: string
  last_reported_at: Date
}

const REMOVABLE_TARGET_TABLES: Record<string, string> = { post: 'posts', job: 'jobs', event: 'events' }

async listReportedContentGroups(universityId: string, query: PaginationQuery) {
  const universityUserIds = db('users').where('university_id', universityId).select('id')

  const groupedBase = () =>
    db('reports')
      .whereIn('reporter_id', universityUserIds)
      .whereIn('status', ['pending', 'reviewed'])
      .groupBy('target_id', 'target_type')

  const totalRow = await db
    .from(groupedBase().select('target_id', 'target_type').as('groups'))
    .count<CountRow[]>({ count: '*' })
    .first()

  const rows = await groupedBase()
    .select<ReportGroupRow[]>(
      'target_id',
      'target_type',
      db.raw('COUNT(*)::int as report_count'),
      db.raw(`MAX(${severityCaseSql('reason')}) as severity_rank`),
      db.raw('(ARRAY_AGG(reason ORDER BY created_at DESC))[1] as latest_reason'),
      db.raw('MAX(created_at) as last_reported_at'),
    )
    .orderBy('last_reported_at', 'desc')
    .limit(query.limit)
    .offset((query.page - 1) * query.limit)

  const titleMap = await hydrateTargetTitles(rows.map((r) => ({ targetId: r.target_id, targetType: r.target_type })))

  return {
    items: rows.map((r) => ({
      targetId: r.target_id,
      targetType: r.target_type,
      title: titleMap.get(`${r.target_type}:${r.target_id}`) ?? `Reported ${r.target_type}`,
      severity: severityFromRank(Number(r.severity_rank)),
      reason: r.latest_reason,
      reportCount: Number(r.report_count),
      lastReportedAt: r.last_reported_at,
      removable: r.target_type in REMOVABLE_TARGET_TABLES,
    })),
    total: Number(totalRow?.count ?? 0),
    page: query.page,
    limit: query.limit,
  }
}

async resolveReportGroup(universityId: string, resolvedById: string, targetType: string, targetId: string, action: 'remove' | 'dismiss') {
  const universityUserIds = db('users').where('university_id', universityId).select('id')
  const status = action === 'remove' ? 'resolved' : 'dismissed'

  const updated = await db('reports')
    .where({ target_id: targetId, target_type: targetType })
    .whereIn('reporter_id', universityUserIds)
    .whereIn('status', ['pending', 'reviewed'])
    .update({ status, resolved_by: resolvedById, resolved_at: db.fn.now() })

  if (updated === 0) throw notFound('No open reports for this target')

  if (action === 'remove') {
    const table = REMOVABLE_TARGET_TABLES[targetType]
    if (table) {
      await db(table).where({ id: targetId, university_id: universityId }).delete()
    }
  }

  return { targetId, targetType, status }
}
```

Add the title-hydration helper near the other module-level helpers (~line 932):

```ts
function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text
}

async function hydrateTargetTitles(targets: { targetId: string; targetType: string }[]): Promise<Map<string, string>> {
  const postIds = targets.filter((t) => t.targetType === 'post').map((t) => t.targetId)
  const jobIds = targets.filter((t) => t.targetType === 'job').map((t) => t.targetId)
  const eventIds = targets.filter((t) => t.targetType === 'event').map((t) => t.targetId)

  const [posts, jobs, events] = await Promise.all([
    postIds.length ? db('posts').whereIn('id', postIds).select<{ id: string; content: string }[]>('id', 'content') : [],
    jobIds.length ? db('jobs').whereIn('id', jobIds).select<{ id: string; title: string }[]>('id', 'title') : [],
    eventIds.length ? db('events').whereIn('id', eventIds).select<{ id: string; title: string }[]>('id', 'title') : [],
  ])

  const map = new Map<string, string>()
  posts.forEach((p) => map.set(`post:${p.id}`, truncate(p.content, 60)))
  jobs.forEach((j) => map.set(`job:${j.id}`, j.title))
  events.forEach((e) => map.set(`event:${e.id}`, e.title))
  return map
}
```

- [ ] **Step 5: Add controller handlers**

In `apps/api/src/modules/admin/controller.ts`, add near `resolveReport`:

```ts
import type { ResolveReportGroupInput } from './schema'

export const listReportedContentGroups = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getAdminContext(req)
  const result = await adminService.listReportedContentGroups(universityId, req.query as unknown as PaginationQuery)
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

export const resolveReportGroup = asyncHandler(async (req: Request, res: Response) => {
  const { universityId, userId } = getAdminContext(req)
  const targetType = req.params.targetType as string
  const targetId = req.params.targetId as string
  const { action } = req.body as ResolveReportGroupInput
  sendSuccess(res, await adminService.resolveReportGroup(universityId, userId, targetType, targetId, action))
})
```

- [ ] **Step 6: Wire the routes**

In `apps/api/src/modules/admin/router.ts`, add imports for `listReportedContentGroups`, `resolveReportGroup`, `ResolveReportGroupSchema`, then below the existing report routes (~line 75):

```ts
adminRouter.get('/reports/grouped', validateRequest({ query: PaginationQuerySchema }), listReportedContentGroups)
adminRouter.patch(
  '/reports/target/:targetType/:targetId',
  validate(ResolveReportGroupSchema),
  resolveReportGroup,
)
```

Note: this must be registered **before** `adminRouter.patch('/reports/:reportId', ...)` would only matter if paths collided — they don't (`/reports/grouped` and `/reports/target/...` are distinct literal segments from `/reports/:reportId`), so order relative to it doesn't matter, but keep it grouped with the other `/reports` routes for readability.

- [ ] **Step 7: Run test to verify it passes**

Run: `DATABASE_URL="postgresql://$(whoami)@localhost:5432/uniconnect_test" GEMINI_API_KEY=test-key npx pnpm --filter api test admin-reported-content-groups`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/admin/service.ts apps/api/src/modules/admin/schema.ts apps/api/src/modules/admin/controller.ts apps/api/src/modules/admin/router.ts apps/api/src/__tests__/admin-reported-content-groups.test.ts
git commit -m "feat(admin): group reported content by target with severity and bulk remove/dismiss

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017JRVZzfLB9LALRcnS9f2p2"
```

---

### Task 3: Mark-user-verified endpoint

**Files:**
- Modify: `apps/api/src/modules/admin/schema.ts` (add `UpdateUserVerificationSchema`)
- Modify: `apps/api/src/modules/admin/service.ts` (add `updateUserVerification`)
- Modify: `apps/api/src/modules/admin/controller.ts` (add `updateUserVerification`)
- Modify: `apps/api/src/modules/admin/router.ts` (add route)
- Test: `apps/api/src/__tests__/admin-user-verification.test.ts`

**Interfaces:**
- Produces: `PATCH /admin/users/:userId/verify` body `{ is_verified: boolean }` → `{ data: { userId, isVerified } }`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/__tests__/admin-user-verification.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { app, loginAs, DOMAIN, TEST_UNIVERSITY_ID, CREDENTIALS } from './setup'
import { db } from '../config/db'

const api = supertest(app)
const UNI = { 'x-university-domain': DOMAIN }

let adminToken: string
let targetUserId: string

beforeAll(async () => {
  const admin = await loginAs(CREDENTIALS.admin.email, CREDENTIALS.admin.password)
  adminToken = admin.accessToken

  const [id] = await db('users')
    .insert({
      university_id: TEST_UNIVERSITY_ID,
      email: `unverified.test.${Date.now()}@bscse.uiu.ac.bd`,
      password_hash: 'x',
      role: 'student',
      is_verified: false,
    })
    .returning('id')
  targetUserId = id.id ?? id
  await db('profiles').insert({ user_id: targetUserId, university_id: TEST_UNIVERSITY_ID, full_name: 'Unverified Test User' })
})

afterAll(async () => {
  await db('profiles').where({ user_id: targetUserId }).delete()
  await db('users').where({ id: targetUserId }).delete()
})

describe('PATCH /api/v1/admin/users/:userId/verify', () => {
  it('marks a user verified', async () => {
    const res = await api
      .patch(`/api/v1/admin/users/${targetUserId}/verify`)
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ is_verified: true })

    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({ userId: targetUserId, isVerified: true })

    const row = await db('users').where({ id: targetUserId }).first('is_verified')
    expect(row.is_verified).toBe(true)
  })

  it('returns 404 for an unknown user', async () => {
    const res = await api
      .patch('/api/v1/admin/users/00000000-0000-4000-8000-000000000999/verify')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ is_verified: true })

    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `DATABASE_URL="postgresql://$(whoami)@localhost:5432/uniconnect_test" GEMINI_API_KEY=test-key npx pnpm --filter api test admin-user-verification`
Expected: FAIL — 404 route not found (Express default, not the service's `notFound()`).

- [ ] **Step 3: Add the schema**

```ts
// apps/api/src/modules/admin/schema.ts, near UpdateUserStatusSchema
export const UpdateUserVerificationSchema = z.object({
  is_verified: z.boolean(),
})
export type UpdateUserVerificationInput = z.infer<typeof UpdateUserVerificationSchema>
```

- [ ] **Step 4: Add the service method**

In `apps/api/src/modules/admin/service.ts`, near `updateUserStatus`:

```ts
async updateUserVerification(universityId: string, userId: string, input: UpdateUserVerificationInput) {
  const updated = await db('users')
    .where({ id: userId, university_id: universityId, is_deleted: false })
    .update({ is_verified: input.is_verified })

  if (updated === 0) throw notFound('User not found')
  return { userId, isVerified: input.is_verified }
}
```

- [ ] **Step 5: Add controller + route**

`controller.ts`:

```ts
export const updateUserVerification = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getAdminContext(req)
  const userId = req.params.userId as string
  sendSuccess(res, await adminService.updateUserVerification(universityId, userId, req.body as UpdateUserVerificationInput))
})
```

`router.ts`, next to the `:userId/status` route:

```ts
adminRouter.patch(
  '/users/:userId/verify',
  requireRole('admin'),
  validate(UpdateUserVerificationSchema),
  updateUserVerification,
)
```

- [ ] **Step 6: Run test to verify it passes**

Run: `DATABASE_URL="postgresql://$(whoami)@localhost:5432/uniconnect_test" GEMINI_API_KEY=test-key npx pnpm --filter api test admin-user-verification`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/admin/schema.ts apps/api/src/modules/admin/service.ts apps/api/src/modules/admin/controller.ts apps/api/src/modules/admin/router.ts apps/api/src/__tests__/admin-user-verification.test.ts
git commit -m "feat(admin): add endpoint to mark a user verified

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017JRVZzfLB9LALRcnS9f2p2"
```

---

### Task 4: Insights tab — 4-tile strip, content mix, needs attention

**Files:**
- Modify: `apps/web/src/pages/AdminPage.tsx` (`Stats` interface ~line 28, `InsightsTab` ~line 423-445)
- Test: `apps/web/src/pages/AdminPage.insights.test.tsx`

**Interfaces:**
- Consumes: the extended `Stats` shape from Task 1 (`escalatedReports`, `verificationRequests`, `deletionRequests`, `resolvedPct7d`, `pendingInviteBatches`, `moderationHealth`).
- Produces: `InsightsTab` renders a `MetricStrip` (4 tiles), reuses `ContentMetricsStrip` as "Content mix" with a "Review all" button that calls `onOpenModeration` (passed down from `AdminPage`, sets `activeTab('moderation')`), and a `NeedsAttentionList` with 3 rows.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/pages/AdminPage.insights.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/msw/server'
import AdminPage from './AdminPage'
import { useAuthStore } from '@/stores/authStore'

const STATS = {
  users: 4821, posts: 132, jobs: 4, events: 6, groups: 12, news: 3,
  reports: 5, activeUsers: 3200,
  usersByRole: [{ role: 'student', count: 3560 }],
  postsByDay: Array.from({ length: 7 }, (_, i) => ({ date: `2026-09-0${i + 1}`, count: i })),
  escalatedReports: 4, verificationRequests: 17, deletionRequests: 3,
  resolvedPct7d: 94, pendingInviteBatches: 3,
  moderationHealth: { reportsOpen: 4, resolvedPct7d: 94, medianResponseHours: 3.2, repeatOffenders: 4 },
}

function renderInsights() {
  useAuthStore.setState({ user: { id: 'admin-1', role: 'admin' } as never })
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/admin?tab=insights']}>
        <AdminPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  server.use(
    http.get('*/admin/stats', () => HttpResponse.json({ data: STATS })),
    http.get('*/admin/university/domains', () => HttpResponse.json({ data: { allowedEmailDomains: [] } })),
  )
})

describe('AdminPage Insights tab', () => {
  it('shows the resolved-% and pending-invite-batches tiles', async () => {
    renderInsights()
    expect(await screen.findByText('94%')).toBeInTheDocument()
    expect(screen.getByText('3 batches')).toBeInTheDocument()
  })

  it('shows a needs-attention row for escalated reports and jumps to Moderation on click', async () => {
    renderInsights()
    const row = await screen.findByRole('button', { name: /escalated reports/i })
    await userEvent.click(row)
    expect(await screen.findByRole('heading', { name: /reported content/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx pnpm --filter web test src/pages/AdminPage.insights.test.tsx`
Expected: FAIL — `screen.findByText('94%')` times out (tile doesn't exist).

- [ ] **Step 3: Extend the `Stats` interface and rewrite `InsightsTab`**

In `apps/web/src/pages/AdminPage.tsx`, extend the `Stats` interface (~line 28):

```ts
interface Stats {
  users: number
  posts: number
  jobs: number
  events: number
  groups: number
  news: number
  reports: number
  activeUsers: number
  usersByRole: { role: string; count: number }[]
  postsByDay: { date: string; count: number }[]
  escalatedReports: number
  verificationRequests: number
  deletionRequests: number
  resolvedPct7d: number
  pendingInviteBatches: number
  moderationHealth: { reportsOpen: number; resolvedPct7d: number; medianResponseHours: number; repeatOffenders: number }
}
```

Replace `InsightsTab` (~line 423-445) with a version that takes an `onNavigate` callback and adds the two missing tiles plus the needs-attention list:

```tsx
function MetricTile({ label, value, hint, hot }: { label: string; value: string; hint: string; hot?: boolean }) {
  return (
    <div style={{
      background: hot ? 'var(--uc-orange-bg)' : 'var(--surface-card)',
      border: `0.5px solid ${hot ? 'var(--uc-orange-bdr)' : 'var(--border-default)'}`,
      borderRadius: 'var(--r-lg)',
      padding: '16px 20px',
    }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-label)', letterSpacing: '0.04em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
      <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-tertiary)' }}>{hint}</div>
    </div>
  )
}

function NeedsAttentionList({ stats, onNavigate }: { stats: Stats; onNavigate: (tab: Tab) => void }) {
  const rows = [
    { label: 'Escalated reports', value: stats.escalatedReports, tab: 'moderation' as Tab },
    { label: 'Verification requests', value: stats.verificationRequests, tab: 'members' as Tab },
    { label: 'Invite batches expiring', value: stats.pendingInviteBatches, tab: 'members' as Tab },
  ]
  return (
    <div style={{ background: 'var(--surface-card)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-lg)', padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 12 }}>Needs attention</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map((r) => (
          <button
            key={r.label}
            type="button"
            onClick={() => onNavigate(r.tab)}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '9px 10px', borderRadius: 'var(--r-md)', border: 'none',
              background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)',
              transition: 'background 150ms',
            }}
          >
            <span>{r.label}</span>
            <Badge variant={r.value > 0 ? 'neutral' : 'alumni'}>{r.value}</Badge>
          </button>
        ))}
      </div>
    </div>
  )
}

function InsightsTab({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const { data } = useQuery<Stats>({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.get<{ data: Stats }>('/admin/stats').then((r) => r.data.data),
  })

  if (!data) return <Spinner />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <MetricTile label="Active members" value={data.activeUsers.toLocaleString()} hint={`of ${data.users.toLocaleString()} total`} />
        <MetricTile label="Posts today" value={String(data.postsByDay.at(-1)?.count ?? 0)} hint="vs. last 7-day avg" />
        <MetricTile label="Reports resolved" value={`${data.resolvedPct7d}%`} hint="last 7 days" />
        <MetricTile
          label="Pending invites"
          value={`${data.pendingInviteBatches} batch${data.pendingInviteBatches === 1 ? '' : 'es'}`}
          hint="expiring soon"
          hot={data.pendingInviteBatches > 0}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
        <ActivityChart postsByDay={data.postsByDay} />
        <RoleBreakdown usersByRole={data.usersByRole} total={data.users} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Content mix</span>
            <GhostBtn onClick={() => onNavigate('moderation')} style={{ fontSize: 12, padding: '4px 10px' }}>
              Review all
            </GhostBtn>
          </div>
          <ContentMetricsStrip stats={data} />
        </div>
        <NeedsAttentionList stats={data} onNavigate={onNavigate} />
      </div>
      <AllowedDomainsPanel />
    </div>
  )
}
```

- [ ] **Step 4: Wire `onNavigate` from `AdminPage`**

In the `AdminPage` component body (~line 1756), change:

```tsx
{activeTab === 'insights' && <InsightsTab />}
```

to:

```tsx
{activeTab === 'insights' && <InsightsTab onNavigate={setActiveTab} />}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx pnpm --filter web test src/pages/AdminPage.insights.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/AdminPage.tsx apps/web/src/pages/AdminPage.insights.test.tsx
git commit -m "feat(admin): add resolved-%, pending-invites, content-mix and needs-attention to Insights

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017JRVZzfLB9LALRcnS9f2p2"
```

---

### Task 5: Moderation tab — stat tiles, grouped reported-content list, health panel

**Files:**
- Modify: `apps/web/src/pages/AdminPage.tsx` (replace `ModerationTab`, add `ReportedContentTab` in place of the old `ReportsTab`'s role in Moderation — `ReportsTab` itself is untouched since nothing else references it)
- Test: `apps/web/src/pages/AdminPage.moderation.test.tsx`

**Interfaces:**
- Consumes: `GET /admin/reports/grouped` and `PATCH /admin/reports/target/:targetType/:targetId` from Task 2; `stats.moderationHealth`/`escalatedReports`/`verificationRequests`/`deletionRequests` from Task 1.
- Produces: `ModerationTab` = 3 stat tiles + `ReportedContentTab` (new) + `ModerationHealthPanel` (new) + existing `ContentTab` below, unchanged.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/pages/AdminPage.moderation.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/msw/server'
import AdminPage from './AdminPage'
import { useAuthStore } from '@/stores/authStore'

const GROUPED_ITEM = {
  targetId: 'post-1', targetType: 'post', title: 'Spam links in an "Internship offer" post',
  severity: 'high', reason: 'spam', reportCount: 3, lastReportedAt: new Date().toISOString(), removable: true,
}

beforeEach(() => {
  useAuthStore.setState({ user: { id: 'admin-1', role: 'admin' } as never })
  server.use(
    http.get('*/admin/stats', () => HttpResponse.json({
      data: {
        users: 4821, posts: 132, jobs: 4, events: 6, groups: 12, news: 3, reports: 5, activeUsers: 3200,
        usersByRole: [], postsByDay: [],
        escalatedReports: 5, verificationRequests: 17, deletionRequests: 3, resolvedPct7d: 94, pendingInviteBatches: 3,
        moderationHealth: { reportsOpen: 4, resolvedPct7d: 94, medianResponseHours: 3.2, repeatOffenders: 4 },
      },
    })),
    http.get('*/admin/reports/grouped', () => HttpResponse.json({ data: { items: [GROUPED_ITEM], total: 1, page: 1, limit: 20 } })),
    http.get('*/admin/content/:kind', () => HttpResponse.json({ data: { items: [], total: 0, page: 1, limit: 20 } })),
    http.patch('*/admin/reports/target/:targetType/:targetId', () => HttpResponse.json({ data: { targetId: 'post-1', targetType: 'post', status: 'dismissed' } })),
  )
})

function renderModeration() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/admin?tab=moderation']}>
        <AdminPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AdminPage Moderation tab', () => {
  it('shows the severity badge and report count on a grouped row', async () => {
    renderModeration()
    expect(await screen.findByText('Spam links in an "Internship offer" post')).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.getByText('3 reports')).toBeInTheDocument()
  })

  it('dismisses a reported target', async () => {
    renderModeration()
    await screen.findByText('Spam links in an "Internship offer" post')
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    await waitFor(() => expect(screen.queryByText('Spam links in an "Internship offer" post')).not.toBeInTheDocument())
  })

  it('shows the moderation health panel', async () => {
    renderModeration()
    expect(await screen.findByText('Moderation health')).toBeInTheDocument()
    expect(screen.getByText('3.2h')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx pnpm --filter web test src/pages/AdminPage.moderation.test.tsx`
Expected: FAIL — none of the new text exists yet.

- [ ] **Step 3: Implement `ReportedContentTab` and `ModerationHealthPanel`, rewrite `ModerationTab`**

Add near the existing `ReportsTab` in `apps/web/src/pages/AdminPage.tsx`:

```tsx
interface ReportGroup {
  targetId: string
  targetType: string
  title: string
  severity: 'high' | 'medium' | 'low'
  reason: string
  reportCount: number
  lastReportedAt: string
  removable: boolean
}

const SEVERITY_STYLE: Record<ReportGroup['severity'], { bg: string; bdr: string; text: string; label: string }> = {
  high: { bg: 'var(--uc-red-bg)', bdr: 'var(--uc-red-bdr)', text: 'var(--uc-red)', label: 'High' },
  medium: { bg: 'var(--uc-amber-bg)', bdr: 'var(--uc-amber-bdr)', text: 'var(--uc-amber-l)', label: 'Medium' },
  low: { bg: 'var(--surface-raised)', bdr: 'var(--border-default)', text: 'var(--text-tertiary)', label: 'Low' },
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

function ReportedContentTab() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery<{ items: ReportGroup[]; total: number }>({
    queryKey: ['admin', 'reports', 'grouped'],
    queryFn: () => api.get<{ data: { items: ReportGroup[]; total: number } }>('/admin/reports/grouped?limit=50').then((r) => r.data.data),
  })

  const actionMutation = useMutation({
    mutationFn: ({ targetType, targetId, action }: { targetType: string; targetId: string; action: 'remove' | 'dismiss' }) =>
      api.patch(`/admin/reports/target/${targetType}/${targetId}`, { action }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'reports', 'grouped'] })
      void qc.invalidateQueries({ queryKey: ['admin', 'stats'] })
    },
  })

  if (isLoading || !data) return <Spinner />

  return (
    <div style={{ background: 'var(--surface-card)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-lg)', padding: 4 }}>
      <div style={{ padding: '14px 16px 8px', fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Reported content</div>
      {data.items.length === 0 ? (
        <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>Nothing reported right now</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {data.items.map((item) => {
            const sev = SEVERITY_STYLE[item.severity]
            return (
              <div
                key={`${item.targetType}:${item.targetId}`}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: '0.5px solid var(--border-default)' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.title}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 12, color: 'var(--text-tertiary)' }}>
                    <span style={{ background: sev.bg, border: `0.5px solid ${sev.bdr}`, color: sev.text, borderRadius: 'var(--r-pill)', padding: '1px 8px', fontWeight: 500 }}>
                      {sev.label}
                    </span>
                    <span>{item.reason}</span>
                    <span>·</span>
                    <span>{item.reportCount} report{item.reportCount === 1 ? '' : 's'}</span>
                    <span>·</span>
                    <span>{relativeTime(item.lastReportedAt)}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {item.removable && (
                    <GhostBtn
                      onClick={() => actionMutation.mutate({ targetType: item.targetType, targetId: item.targetId, action: 'remove' })}
                      disabled={actionMutation.isPending}
                      style={{ fontSize: 12, padding: '4px 10px', color: 'var(--uc-red)' }}
                    >
                      Remove
                    </GhostBtn>
                  )}
                  <GhostBtn
                    onClick={() => actionMutation.mutate({ targetType: item.targetType, targetId: item.targetId, action: 'dismiss' })}
                    disabled={actionMutation.isPending}
                    style={{ fontSize: 12, padding: '4px 10px' }}
                  >
                    Dismiss
                  </GhostBtn>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ModerationHealthTile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div style={{ background: 'var(--surface-raised)', borderRadius: 'var(--r-md)', padding: '12px 14px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-label)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 500, color: 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{hint}</div>
    </div>
  )
}

function ModerationHealthPanel({ health }: { health: Stats['moderationHealth'] }) {
  return (
    <div style={{ background: 'var(--surface-card)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-lg)', padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 12 }}>Moderation health</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <ModerationHealthTile label="Reports open" value={String(health.reportsOpen)} hint="awaiting action" />
        <ModerationHealthTile label="Resolved" value={`${health.resolvedPct7d}%`} hint="last 7 days" />
        <ModerationHealthTile label="Median response" value={`${health.medianResponseHours}h`} hint="target 6h" />
        <ModerationHealthTile label="Repeat offenders" value={String(health.repeatOffenders)} hint="flagged twice+" />
      </div>
    </div>
  )
}

function ModerationTab() {
  const { data: stats } = useQuery<Stats>({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.get<{ data: Stats }>('/admin/stats').then((r) => r.data.data),
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <MetricTile label="Escalated reports" value={String(stats.escalatedReports)} hint="high severity, open" hot={stats.escalatedReports > 0} />
          <MetricTile label="Verification requests" value={String(stats.verificationRequests)} hint="unverified accounts" />
          <MetricTile label="Deletion requests" value={String(stats.deletionRequests)} hint="awaiting review" />
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 12, alignItems: 'start' }}>
        <ReportedContentTab />
        {stats && <ModerationHealthPanel health={stats.moderationHealth} />}
      </div>
      <div style={{ borderTop: '0.5px solid var(--border-default)', paddingTop: 20 }}>
        <ContentTab />
      </div>
    </div>
  )
}
```

Remove the old `ModerationTab` definition (~line 1485-1494) — the one above replaces it. Leave `ReportsTab` (~1375-1481) in the file even though `ModerationTab` no longer renders it: nothing else uses it, so if it becomes fully dead after this task, delete it and its now-unused `Report`/`Paginated<Report>` usages — check for other references first with a repo-wide grep for `ReportsTab` before deleting.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx pnpm --filter web test src/pages/AdminPage.moderation.test.tsx`
Expected: PASS

- [ ] **Step 5: Full verification**

Run: `npx pnpm typecheck && npx pnpm lint && npx pnpm --filter web test src/pages/AdminPage.moderation.test.tsx src/pages/AdminPage.insights.test.tsx`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/AdminPage.tsx apps/web/src/pages/AdminPage.moderation.test.tsx
git commit -m "feat(admin): rebuild Moderation tab with severity stat tiles and health panel

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017JRVZzfLB9LALRcnS9f2p2"
```

---

## Self-Review

- **Spec coverage:** 4-tile Insights strip ✅ (Task 4), content-mix + needs-attention ✅ (Task 4), 3 moderation stat tiles ✅ (Task 5), severity + aggregated report count ✅ (Task 2, 5), moderation health panel ✅ (Task 1, 5), verification-requests-as-unverified-count ✅ (Task 1, 3), pending-invite-batches metric wired defensively pending the Members plan ✅ (Task 1).
- **Placeholder scan:** no TBD/TODO markers; every step has runnable code.
- **Type consistency:** `Stats` interface (Task 4) matches the object shape returned by `getStats` (Task 1) field-for-field; `ReportGroup` (Task 5, frontend) matches the `items` shape returned by `listReportedContentGroups` (Task 2, backend) field-for-field (`targetId`/`targetType`/`title`/`severity`/`reason`/`reportCount`/`lastReportedAt`/`removable`); `ResolveReportGroupInput`/`action` enum (`'remove' | 'dismiss'`) matches on both sides.
