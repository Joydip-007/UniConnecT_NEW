# Admin Learning CMS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a manual learning-path content library (list, create, edit, publish, manage units, on-demand AI generation per content type) to the admin Learning screen, sitting alongside — not replacing — the existing AI auto-generation config console.

**Architecture:** New admin-only endpoints under the existing `learning-admin` module reuse the learner-facing `skill_paths`/`skill_path_units`/`skill_path_enrollments`/`unit_completions` tables (no new tables). One new nullable `department` column on `skill_paths` is the only schema change. The existing `aiContentQueue` + AI worker (which already throttles via `AI_CALLS_PER_MINUTE`) is reused for on-demand generation — a `task` field on the existing `/admin/learning/generate` endpoint lets the two mockup buttons ("Generate a path" / "Generate a quiz") trigger independently instead of always firing both. Frontend adds a "Content library" tab to `LearningAdminPanel` (default view) with the existing config console demoted to an "AI settings" tab; a new `/admin/learning/paths/:id` route hosts the per-path unit editor, reached only via the library's "Manage" button (reachability-by-context, like `/groups/:id`).

**Tech Stack:** Express + Knex (Postgres) API, Zod validation, React 18 + TanStack Query web app, Vitest + React Testing Library.

**Spec:** This plan's own "Background" section below (no separate spec doc — requirements were gathered by comparing the shipped app against `/Users/joydipdatta/Downloads/uniconnect-furnished-design/project/Feed Page.dc.html`'s Admin → Learning mockup screen).

## Background (what the mockup shows vs. what exists)

Mockup screen (Admin → Campus tools → Learning): heading "Learning — Curate and publish learning units, grouped by department." Two big action cards ("Generate a learning path with AI" / "Generate a quiz with AI"). Four stat tiles: Learning paths (6, "4 published"), Total enrolled (1,015, "across all paths"), Avg completion (38%, "of enrolled units"), Awaiting review (2, "draft paths"). A filter-chip row (All 6 / Published 4 / Drafts 2 / Career 2 / Technical 2 / Communication 2) with a "+ New learning path" primary button at the right edge. A 2-column grid of path cards, each: icon tile, title, a Published/Draft pill, a meta line "`{department}` · `{unitCount}` units · `{difficulty}`", an "N enrolled" / "NN% avg completion" line with a progress bar under it, "Updated Xd ago", and Edit + Manage buttons. Right rail: "Awaiting review" (list of draft paths with unit counts + "Open learning paths" CTA) and a "Learning" stat recap (Paths/Enrolled/Avg completion/Drafts).

Shipped `LearningAdminPanel.tsx` today is *only* the AI auto-generation config console (topics/difficulty/schedule toggles, a pending-AI-path approval queue, a pending-quiz-batch approval queue, an analytics section) — there is no manual create, no per-path list with enrollment stats, no Edit/Manage, no filter chips, no department field. This plan adds all of that as a new "Content library" view, keeping the config console intact as "AI settings".

Existing backend already covers more than it looks:
- `skill_paths` (migration 085) has `title, description, category, difficulty, estimated_days, badge_name, badge_icon, is_published, created_by, created_at, updated_at`, plus `source` ('manual'|'ai', migration 098). **No `department` column** — this plan adds one.
- `learning-admin/service.ts#getAnalytics` already computes, per **published** path: `unitCount`, `enrolledCount`, `completedCount`, `completionRate`, `avgUnitScore` via one grouped query. This plan generalizes that query to cover **all** paths (published + draft) and adds `updated_at`/`is_published`/`source`/`department`/`category`/`difficulty` to the same row shape — no new query pattern, just a broadened one.
- `learning-admin/service.ts#triggerGenerateNow` already enqueues both `learning-gen` and `quiz-gen` onto `aiContentQueue`, which the existing AI worker consumes under its `AI_CALLS_PER_MINUTE` throttle. This plan adds an optional `task` field so the two mockup buttons can fire one or the other.
- `learning-admin/service.ts#listPendingPaths` (AI-generated, unpublished, `source='ai'`) already backs "Awaiting review" — reused as-is for the right-rail-equivalent list, just re-surfaced in the new UI.

## Global Constraints

- Migrations: sequential `NNN_description.ts` in `apps/api/src/database/migrations/`; latest committed is `104_add_group_member_mute.ts`, so this plan's migration is `106_add_learning_path_department.ts`. Never edit a committed migration.
- Service-layer-only DB access via Knex; routes contain only `router.METHOD(...)`; all logic in `service.ts`; validation via `validate(schema)` / `validateRequest({...})` from `apps/api/src/middleware/validate.ts`.
- Errors: throw `notFound()` / `badRequest()` / `conflict()` from `apps/api/src/utils/errors.ts`; never raw `res.json()` — use `sendSuccess()` / `sendPaginated()` from `apps/api/src/utils/response.ts`.
- Zod schema naming: `camelCase` + `Schema` suffix; export `z.infer` types, never hand-duplicate. New schemas for this module live in `apps/api/src/modules/learning-admin/schema.ts`, extending it (it currently exports only `LearningAdminConfigSchema`).
- `learningAdminRouter` already applies `requireAuth, resolveUniversity, requireRole('admin')` at the top (`learning-admin/router.ts:25`) — every new route on this router inherits that; no extra middleware needed.
- No `any`; strict TypeScript. `packages/shared` is the single source of truth for types/schemas shared between `apps/web` and `apps/api` — add new shared types to `packages/shared/src/types/learning-admin.ts` and new shared request schemas to `packages/shared/src/schemas/learning.ts` (both already exist and are exported from `packages/shared/src/index.ts`).
- Design tokens (non-negotiable): no hardcoded hex — always `var(--token-name)`; `0.5px solid var(--border-*)` for structural borders; `border-radius: var(--r-pill)` on all buttons; font-weight only 400 or 500; sentence case everywhere (no ALL CAPS, no Title Case on labels/buttons); coloured surfaces pair with their light-text token (e.g. `--uc-mint-bg` + `--uc-mint`); no `box-shadow`, no `backdropFilter`.
- React conventions: data fetching only in `hooks/` via TanStack Query; `useQuery` key shape `['domain', 'action', {params}]`; `queryClient.invalidateQueries` only inside a mutation's `onSuccess`; components take props, never call axios directly.
- `apps/web/src/config/reachability.test.ts` fails if a new page (`PATHS` entry) isn't reachable from the shell for every role that can see it — the new `/admin/learning/paths/:id` route is reached only via a button inside the admin Learning tab, so it must be added to that test's "reached by context" allow-list (see Task 10), mirroring how `/groups/:id` is handled.
- Run `npx pnpm --filter api typecheck && npx pnpm --filter api test` after backend tasks, and `npx pnpm --filter web typecheck && npx pnpm --filter web test` after frontend tasks. Run `npx pnpm --filter @uniconnect/shared build` after any shared-package change, before running web tests (web tests resolve `@uniconnect/shared` from `dist/`).

---

## File structure

**Backend (new/modified):**
- `apps/api/src/database/migrations/106_add_learning_path_department.ts` — new column.
- `apps/api/src/modules/learning-admin/schema.ts` — add `AdminListPathsQuerySchema`, `CreateLearningPathSchema`, `UpdateLearningPathSchema`, `CreatePathUnitSchema`, `UpdatePathUnitSchema`, `ReorderPathUnitsSchema`, `TriggerGenerateSchema`.
- `apps/api/src/modules/learning-admin/service.ts` — add `listAdminPaths`, `createPath`, `updatePath`, `setPathPublished`, `createUnit`, `updateUnit`, `deleteUnit`, `reorderUnits`; modify `triggerGenerateNow` to take a `task` param.
- `apps/api/src/modules/learning-admin/controller.ts` — thin handlers for the above.
- `apps/api/src/modules/learning-admin/router.ts` — new routes.
- `apps/api/src/modules/learning-admin/*.test.ts` (new, alongside the existing `service.test.ts`) — one test file per task below.
- `packages/shared/src/types/learning-admin.ts` — add `AdminLearningPath`, `AdminLearningPathUnit`, `CreateLearningPathInput`, `UpdateLearningPathInput`.
- `packages/shared/src/schemas/learning.ts` — no change (admin schemas live in the API module per convention; only learner-facing param schemas live here today, and that stays true).

**Frontend (new/modified):**
- `apps/web/src/features/learning-admin/hooks/useLearningAdmin.ts` — add `useAdminLearningPaths`, `useCreateLearningPath`, `useUpdateLearningPath`, `useSetPathPublished`, `useCreatePathUnit`, `useUpdatePathUnit`, `useDeletePathUnit`, `useReorderPathUnits`; change `useTriggerLearningGenerate` to accept a `task` arg.
- `apps/web/src/features/learning-admin/components/LearningPathLibrary.tsx` (new) — stat tiles, filter chips, grid, generate cards.
- `apps/web/src/features/learning-admin/components/LearningPathFormModal.tsx` (new) — create + metadata-edit modal.
- `apps/web/src/features/learning-admin/components/LearningPathManagePage.tsx` (new) — unit editor, mounted at the new route.
- `apps/web/src/features/learning-admin/components/LearningAdminPanel.tsx` (modified) — tab switcher ("Content library" default / "AI settings"), generate-card wiring.
- `apps/web/src/features/learning-admin/index.ts` — export the new components if consumed outside the feature folder (only `LearningAdminPanel` and the manage page need external export, for the router).
- `apps/web/src/router/paths.ts` — add `PATHS.ADMIN_LEARNING_PATH(id)`.
- `apps/web/src/router/index.tsx` — lazy-load `LearningPathManagePage` at that route.
- `apps/web/src/config/reachability.test.ts` — add the new route to the reached-by-context list.
- `apps/web/src/features/learning-admin/components/*.test.tsx` (new) — one per new component.

---

### Task 1: `department` column + shared types

**Files:**
- Create: `apps/api/src/database/migrations/106_add_learning_path_department.ts`
- Modify: `packages/shared/src/types/learning-admin.ts`
- Test: `apps/api/src/database/migrations/106_add_learning_path_department.test.ts`

**Interfaces:**
- Produces: `skill_paths.department` (nullable `varchar(100)`), consumed by every task below.
- Produces (shared types): `AdminLearningPath`, `AdminLearningPathUnit` interfaces, consumed by Tasks 2–11.

- [ ] **Step 1: Write the failing migration test**

```ts
// apps/api/src/database/migrations/106_add_learning_path_department.test.ts
import { describe, it, expect, afterAll } from 'vitest'
import { db } from '../../config/db'

describe('106_add_learning_path_department', () => {
  afterAll(() => db.destroy())

  it('adds a nullable department column to skill_paths', async () => {
    const column = await db('information_schema.columns')
      .where({ table_name: 'skill_paths', column_name: 'department' })
      .first()
    expect(column).toBeDefined()
    expect(column.is_nullable).toBe('YES')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx pnpm --filter api exec vitest run src/database/migrations/106_add_learning_path_department.test.ts`
Expected: FAIL — `column` is `undefined` (migration not yet applied; `pnpm --filter api test` runs pending migrations first per `src/__tests__/setup.ts`, but a targeted vitest run here still needs the migration file to exist for `db:migrate` to pick it up — write the migration in Step 3, then this becomes a real integration check).

- [ ] **Step 3: Write the migration**

```ts
// apps/api/src/database/migrations/106_add_learning_path_department.ts
import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('skill_paths', (table) => {
    table.string('department', 100).nullable()
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('skill_paths', (table) => {
    table.dropColumn('department')
  })
}
```

- [ ] **Step 4: Run the migration and the test**

Run: `npx pnpm --filter api db:migrate && npx pnpm --filter api exec vitest run src/database/migrations/106_add_learning_path_department.test.ts`
Expected: PASS

- [ ] **Step 5: Add shared types**

```ts
// packages/shared/src/types/learning-admin.ts — append
export interface AdminLearningPathUnit {
  id: string
  displayOrder: number
  title: string
  type: 'read' | 'video' | 'exercise' | 'quiz'
  content: { body?: string; questions?: PendingQuizQuestion[] } | null
  completionRule: { passScore?: number } | null
}

export interface AdminLearningPath {
  id: string
  title: string
  description: string | null
  department: string | null
  category: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimatedDays: number
  isPublished: boolean
  source: 'manual' | 'ai'
  unitCount: number
  enrolledCount: number
  completedCount: number
  completionRate: number
  updatedAt: string
}

export interface CreateLearningPathInput {
  title: string
  description?: string | null
  department?: string | null
  category: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimatedDays: number
  units: Array<{
    title: string
    type: 'read' | 'video' | 'exercise' | 'quiz'
    content: Record<string, unknown>
    completionRule?: { passScore?: number }
  }>
}

export type UpdateLearningPathInput = Partial<
  Pick<CreateLearningPathInput, 'title' | 'description' | 'department' | 'category' | 'difficulty' | 'estimatedDays'>
>
```

- [ ] **Step 6: Build the shared package**

Run: `npx pnpm --filter @uniconnect/shared build`
Expected: builds clean, `dist/` updated.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/database/migrations/106_add_learning_path_department.ts \
        apps/api/src/database/migrations/106_add_learning_path_department.test.ts \
        packages/shared/src/types/learning-admin.ts
git commit -m "feat(learning): add department column to skill_paths

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017JRVZzfLB9LALRcnS9f2p2"
```

---

### Task 2: `GET /admin/learning/paths` — list all paths with aggregates

**Files:**
- Modify: `apps/api/src/modules/learning-admin/schema.ts`
- Modify: `apps/api/src/modules/learning-admin/service.ts`
- Modify: `apps/api/src/modules/learning-admin/controller.ts`
- Modify: `apps/api/src/modules/learning-admin/router.ts`
- Test: `apps/api/src/modules/learning-admin/paths.test.ts`

**Interfaces:**
- Consumes: `AdminLearningPath` (Task 1).
- Produces: `learningAdminService.listAdminPaths(universityId: string, query: { status?: 'all'|'published'|'draft'; category?: string }): Promise<AdminLearningPath[]>` — consumed by Task 8 (frontend list).

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/modules/learning-admin/paths.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from '../../app'
import { db } from '../../config/db'
import { loginAs, DOMAIN } from '../../__tests__/setup'

describe('GET /admin/learning/paths', () => {
  let adminToken: string
  let universityId: string
  let pathId: string

  beforeAll(async () => {
    const auth = await loginAs('admin@uiu.ac.bd', 'password123')
    adminToken = auth.accessToken
    const uni = await db('universities').where({ domain: DOMAIN }).first('id')
    universityId = uni.id
  })

  beforeEach(async () => {
    await db('skill_paths').where({ title: 'Test path for admin list' }).del()
    const [path] = await db('skill_paths')
      .insert({
        university_id: universityId,
        title: 'Test path for admin list',
        category: 'career',
        difficulty: 'beginner',
        estimated_days: 5,
        is_published: false,
        source: 'manual',
      })
      .returning('id')
    pathId = path.id
    await db('skill_path_units').insert({
      path_id: pathId,
      display_order: 1,
      title: 'Unit one',
      type: 'read',
      content: JSON.stringify({ body: 'hello' }),
    })
  })

  afterAll(async () => {
    await db('skill_paths').where({ title: 'Test path for admin list' }).del()
    await db.destroy()
  })

  it('returns every path for the university, published and draft, with aggregates', async () => {
    const res = await request(app)
      .get('/api/v1/admin/learning/paths')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    const row = res.body.data.find((p: { id: string }) => p.id === pathId)
    expect(row).toMatchObject({
      title: 'Test path for admin list',
      isPublished: false,
      unitCount: 1,
      enrolledCount: 0,
      completionRate: 0,
    })
  })

  it('filters by status=draft', async () => {
    const res = await request(app)
      .get('/api/v1/admin/learning/paths?status=draft')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.every((p: { isPublished: boolean }) => p.isPublished === false)).toBe(true)
  })

  it('rejects a non-admin role', async () => {
    const auth = await loginAs('faculty@uiu.ac.bd', 'password123')
    const res = await request(app)
      .get('/api/v1/admin/learning/paths')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${auth.accessToken}`)
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `DATABASE_URL="postgresql://$(whoami)@localhost:5432/uniconnect_test" GEMINI_API_KEY=test-key npx pnpm --filter api exec vitest run src/modules/learning-admin/paths.test.ts`
Expected: FAIL — 404 (route doesn't exist yet).

- [ ] **Step 3: Add the query schema**

```ts
// apps/api/src/modules/learning-admin/schema.ts — append
import { z } from 'zod'

export const AdminListPathsQuerySchema = z.object({
  status: z.enum(['all', 'published', 'draft']).optional().default('all'),
  category: z.string().min(1).max(100).optional(),
})
export type AdminListPathsQuery = z.infer<typeof AdminListPathsQuerySchema>
```

(Note: `.default('all')` here is safe — this schema validates a `GET` query, never a merge-write PATCH body, so the documented `.partial()`-with-`.default()` jsonb-merge trap does not apply.)

- [ ] **Step 4: Add the service method**

```ts
// apps/api/src/modules/learning-admin/service.ts — add inside LearningAdminService, near getAnalytics
import type { AdminListPathsQuery } from './schema'
import type { AdminLearningPath } from '@uniconnect/shared'

  async listAdminPaths(universityId: string, query: AdminListPathsQuery): Promise<AdminLearningPath[]> {
    let base = db('skill_paths as p')
      .where('p.university_id', universityId)
      .leftJoin('skill_path_units as u', 'u.path_id', 'p.id')
      .leftJoin('skill_path_enrollments as e', 'e.path_id', 'p.id')
      .leftJoin('unit_completions as c', 'c.path_id', 'p.id')

    if (query.status === 'published') base = base.where('p.is_published', true)
    if (query.status === 'draft') base = base.where('p.is_published', false)
    if (query.category) base = base.where('p.category', query.category)

    const rows = await base
      .groupBy('p.id')
      .orderBy('p.updated_at', 'desc')
      .select<
        {
          id: string
          title: string
          description: string | null
          department: string | null
          category: string
          difficulty: 'beginner' | 'intermediate' | 'advanced'
          estimated_days: number
          is_published: boolean
          source: 'manual' | 'ai'
          updated_at: string
          unitCount: string
          enrolledCount: string
          completedCount: string
        }[]
      >(
        'p.id', 'p.title', 'p.description', 'p.department', 'p.category', 'p.difficulty',
        'p.estimated_days', 'p.is_published', 'p.source', 'p.updated_at',
        db.raw('count(distinct u.id) as "unitCount"'),
        db.raw("count(distinct e.id) filter (where e.status in ('active','completed')) as \"enrolledCount\""),
        db.raw('count(distinct c.id) as "completedCount"'),
      )

    return rows.map((row) => {
      const unitCount = Number(row.unitCount)
      const enrolledCount = Number(row.enrolledCount)
      const completedCount = Number(row.completedCount)
      // Avg completion = share of (enrollment × unit) pairs actually completed —
      // matches the mockup's "NN% avg completion" per path.
      const possible = unitCount * enrolledCount
      return {
        id: row.id,
        title: row.title,
        description: row.description,
        department: row.department,
        category: row.category,
        difficulty: row.difficulty,
        estimatedDays: row.estimated_days,
        isPublished: row.is_published,
        source: row.source,
        unitCount,
        enrolledCount,
        completedCount,
        completionRate: possible > 0 ? completedCount / possible : 0,
        updatedAt: row.updated_at,
      }
    })
  }
```

- [ ] **Step 5: Add the controller handler**

```ts
// apps/api/src/modules/learning-admin/controller.ts — append
import type { AdminListPathsQuery } from './schema'

export const listAdminPaths = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getContext(req)
  sendSuccess(res, await learningAdminService.listAdminPaths(universityId, req.query as unknown as AdminListPathsQuery))
})
```

- [ ] **Step 6: Wire the route**

```ts
// apps/api/src/modules/learning-admin/router.ts — add import and route
import { validateRequest } from '../../middleware/validate'
import { AdminListPathsQuerySchema } from './schema'
import { listAdminPaths } from './controller'

learningAdminRouter.get('/paths', validateRequest({ query: AdminListPathsQuerySchema }), listAdminPaths)
```

- [ ] **Step 7: Run the test**

Run: `DATABASE_URL="postgresql://$(whoami)@localhost:5432/uniconnect_test" GEMINI_API_KEY=test-key npx pnpm --filter api exec vitest run src/modules/learning-admin/paths.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/learning-admin/schema.ts apps/api/src/modules/learning-admin/service.ts \
        apps/api/src/modules/learning-admin/controller.ts apps/api/src/modules/learning-admin/router.ts \
        apps/api/src/modules/learning-admin/paths.test.ts
git commit -m "feat(learning-admin): list all learning paths with per-path aggregates

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017JRVZzfLB9LALRcnS9f2p2"
```

---

### Task 3: `POST /admin/learning/paths` — manual create (path + units)

**Files:**
- Modify: `apps/api/src/modules/learning-admin/schema.ts`
- Modify: `apps/api/src/modules/learning-admin/service.ts`
- Modify: `apps/api/src/modules/learning-admin/controller.ts`
- Modify: `apps/api/src/modules/learning-admin/router.ts`
- Test: `apps/api/src/modules/learning-admin/create-path.test.ts`

**Interfaces:**
- Consumes: `CreateLearningPathInput` (Task 1).
- Produces: `learningAdminService.createPath(universityId: string, input: CreateLearningPathInput): Promise<AdminLearningPath>` — consumed by Task 9 (frontend create modal).

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/modules/learning-admin/create-path.test.ts
import { describe, it, expect, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../../app'
import { db } from '../../config/db'
import { loginAs, DOMAIN } from '../../__tests__/setup'

describe('POST /admin/learning/paths', () => {
  afterAll(async () => {
    await db('skill_paths').where({ title: 'Manually created path' }).del()
    await db.destroy()
  })

  it('creates a manual, unpublished path with its units', async () => {
    const { accessToken } = await loginAs('admin@uiu.ac.bd', 'password123')
    const res = await request(app)
      .post('/api/v1/admin/learning/paths')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Manually created path',
        category: 'career',
        difficulty: 'beginner',
        estimatedDays: 5,
        department: 'CSE',
        units: [
          { title: 'Unit one', type: 'read', content: { body: 'Intro text' } },
          { title: 'Checkpoint', type: 'quiz', content: { questions: [{ q: 'Q1?', options: ['a', 'b'], answer: 0 }] }, completionRule: { passScore: 70 } },
        ],
      })
    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({ title: 'Manually created path', isPublished: false, source: 'manual', unitCount: 2 })

    const units = await db('skill_path_units').where({ path_id: res.body.data.id }).orderBy('display_order')
    expect(units).toHaveLength(2)
    expect(units[0].display_order).toBe(1)
    expect(units[1].display_order).toBe(2)
  })

  it('rejects a path with zero units', async () => {
    const { accessToken } = await loginAs('admin@uiu.ac.bd', 'password123')
    const res = await request(app)
      .post('/api/v1/admin/learning/paths')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'No units path', category: 'career', difficulty: 'beginner', estimatedDays: 5, units: [] })
    expect(res.status).toBe(422)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `DATABASE_URL="postgresql://$(whoami)@localhost:5432/uniconnect_test" GEMINI_API_KEY=test-key npx pnpm --filter api exec vitest run src/modules/learning-admin/create-path.test.ts`
Expected: FAIL — 404.

- [ ] **Step 3: Add the create schema**

```ts
// apps/api/src/modules/learning-admin/schema.ts — append
const PathUnitInputSchema = z.object({
  title: z.string().min(1).max(255),
  type: z.enum(['read', 'video', 'exercise', 'quiz']),
  content: z.record(z.string(), z.unknown()),
  completionRule: z.object({ passScore: z.number().int().min(0).max(100) }).optional(),
})

export const CreateLearningPathSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).nullable().optional(),
  department: z.string().max(100).nullable().optional(),
  category: z.string().min(1).max(100),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  estimatedDays: z.number().int().min(1).max(90),
  units: z.array(PathUnitInputSchema).min(1).max(30),
})
export type CreateLearningPathBody = z.infer<typeof CreateLearningPathSchema>
```

- [ ] **Step 4: Add the service method**

```ts
// apps/api/src/modules/learning-admin/service.ts — add
import type { CreateLearningPathBody } from './schema'

  async createPath(universityId: string, input: CreateLearningPathBody): Promise<AdminLearningPath> {
    const pathId = await db.transaction(async (trx) => {
      const [path] = await trx('skill_paths')
        .insert({
          university_id: universityId,
          title: input.title,
          description: input.description ?? null,
          department: input.department ?? null,
          category: input.category,
          difficulty: input.difficulty,
          estimated_days: input.estimatedDays,
          is_published: false,
          source: 'manual',
        })
        .returning('id')

      await trx('skill_path_units').insert(
        input.units.map((u, i) => ({
          path_id: path.id,
          display_order: i + 1,
          title: u.title,
          type: u.type,
          content: JSON.stringify(u.content),
          completion_rule: JSON.stringify(u.completionRule ?? {}),
        })),
      )

      return path.id as string
    })

    const [created] = await this.listAdminPaths(universityId, { status: 'all' }).then((rows) =>
      rows.filter((r) => r.id === pathId),
    )
    return created
  }
```

- [ ] **Step 5: Add the controller handler**

```ts
// apps/api/src/modules/learning-admin/controller.ts — append
import type { CreateLearningPathBody } from './schema'

export const createPath = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getContext(req)
  const created = await learningAdminService.createPath(universityId, req.body as CreateLearningPathBody)
  res.status(201)
  sendSuccess(res, created)
})
```

- [ ] **Step 6: Wire the route**

```ts
// apps/api/src/modules/learning-admin/router.ts — add
import { validate } from '../../middleware/validate'
import { CreateLearningPathSchema } from './schema'
import { createPath } from './controller'

learningAdminRouter.post('/paths', validate(CreateLearningPathSchema), createPath)
```

- [ ] **Step 7: Run the test**

Run: `DATABASE_URL="postgresql://$(whoami)@localhost:5432/uniconnect_test" GEMINI_API_KEY=test-key npx pnpm --filter api exec vitest run src/modules/learning-admin/create-path.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/learning-admin/schema.ts apps/api/src/modules/learning-admin/service.ts \
        apps/api/src/modules/learning-admin/controller.ts apps/api/src/modules/learning-admin/router.ts \
        apps/api/src/modules/learning-admin/create-path.test.ts
git commit -m "feat(learning-admin): manual learning-path creation with units

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017JRVZzfLB9LALRcnS9f2p2"
```

---

### Task 4: `PATCH /admin/learning/paths/:id` (metadata) + `PATCH /admin/learning/paths/:id/publish`

**Files:**
- Modify: `apps/api/src/modules/learning-admin/schema.ts`
- Modify: `apps/api/src/modules/learning-admin/service.ts`
- Modify: `apps/api/src/modules/learning-admin/controller.ts`
- Modify: `apps/api/src/modules/learning-admin/router.ts`
- Test: `apps/api/src/modules/learning-admin/update-path.test.ts`

**Interfaces:**
- Consumes: `UpdateLearningPathInput` (Task 1), `pathIdParamsSchema` (`@uniconnect/shared`, already exists).
- Produces: `learningAdminService.updatePath(universityId, pathId, patch)`, `learningAdminService.setPathPublished(universityId, pathId, isPublished: boolean)` — consumed by Task 9 (edit modal) and Task 8 (publish toggle button).

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/modules/learning-admin/update-path.test.ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../../app'
import { db } from '../../config/db'
import { loginAs, DOMAIN } from '../../__tests__/setup'

describe('PATCH /admin/learning/paths/:id', () => {
  let pathId: string
  let universityId: string

  beforeEach(async () => {
    const uni = await db('universities').where({ domain: DOMAIN }).first('id')
    universityId = uni.id
    await db('skill_paths').where({ title: 'Path to update' }).del()
    const [path] = await db('skill_paths')
      .insert({ university_id: universityId, title: 'Path to update', category: 'career', difficulty: 'beginner', estimated_days: 5, is_published: false, source: 'manual' })
      .returning('id')
    pathId = path.id
  })

  afterAll(async () => {
    await db('skill_paths').where({ title: 'Path to update' }).del()
    await db('skill_paths').where({ title: 'Renamed path' }).del()
    await db.destroy()
  })

  it('updates metadata fields only', async () => {
    const { accessToken } = await loginAs('admin@uiu.ac.bd', 'password123')
    const res = await request(app)
      .patch(`/api/v1/admin/learning/paths/${pathId}`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Renamed path', department: 'CSE' })
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ title: 'Renamed path', department: 'CSE', category: 'career' })
  })

  it('publishes a draft path', async () => {
    const { accessToken } = await loginAs('admin@uiu.ac.bd', 'password123')
    const res = await request(app)
      .patch(`/api/v1/admin/learning/paths/${pathId}/publish`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ isPublished: true })
    expect(res.status).toBe(200)
    expect(res.body.data.isPublished).toBe(true)
  })

  it('404s for a path in another university', async () => {
    const { accessToken } = await loginAs('admin@uiu.ac.bd', 'password123')
    const res = await request(app)
      .patch(`/api/v1/admin/learning/paths/00000000-0000-0000-0000-000000000000`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'x' })
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `DATABASE_URL="postgresql://$(whoami)@localhost:5432/uniconnect_test" GEMINI_API_KEY=test-key npx pnpm --filter api exec vitest run src/modules/learning-admin/update-path.test.ts`
Expected: FAIL — 404 on both routes.

- [ ] **Step 3: Add the update schemas**

```ts
// apps/api/src/modules/learning-admin/schema.ts — append
// Independent object, not `.partial()` of a defaulted schema — every field here is
// genuinely optional with no `.default()`, so the jsonb-merge trap documented for
// ai_settings does not apply.
export const UpdateLearningPathSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).nullable().optional(),
  department: z.string().max(100).nullable().optional(),
  category: z.string().min(1).max(100).optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  estimatedDays: z.number().int().min(1).max(90).optional(),
})
export type UpdateLearningPathBody = z.infer<typeof UpdateLearningPathSchema>

export const SetPathPublishedSchema = z.object({ isPublished: z.boolean() })
export type SetPathPublishedBody = z.infer<typeof SetPathPublishedSchema>
```

- [ ] **Step 4: Add the service methods**

```ts
// apps/api/src/modules/learning-admin/service.ts — add
import type { UpdateLearningPathBody } from './schema'

  private async findOwnedPath(universityId: string, pathId: string) {
    const path = await db('skill_paths').where({ id: pathId, university_id: universityId }).first('id')
    if (!path) throw notFound('Learning path not found')
  }

  async updatePath(universityId: string, pathId: string, patch: UpdateLearningPathBody): Promise<AdminLearningPath> {
    await this.findOwnedPath(universityId, pathId)
    const columnPatch: Record<string, unknown> = { updated_at: db.fn.now() }
    if (patch.title !== undefined) columnPatch.title = patch.title
    if (patch.description !== undefined) columnPatch.description = patch.description
    if (patch.department !== undefined) columnPatch.department = patch.department
    if (patch.category !== undefined) columnPatch.category = patch.category
    if (patch.difficulty !== undefined) columnPatch.difficulty = patch.difficulty
    if (patch.estimatedDays !== undefined) columnPatch.estimated_days = patch.estimatedDays

    await db('skill_paths').where({ id: pathId }).update(columnPatch)
    const [updated] = await this.listAdminPaths(universityId, { status: 'all' }).then((rows) =>
      rows.filter((r) => r.id === pathId),
    )
    return updated
  }

  async setPathPublished(universityId: string, pathId: string, isPublished: boolean): Promise<AdminLearningPath> {
    await this.findOwnedPath(universityId, pathId)
    await db('skill_paths').where({ id: pathId }).update({ is_published: isPublished, updated_at: db.fn.now() })
    const [updated] = await this.listAdminPaths(universityId, { status: 'all' }).then((rows) =>
      rows.filter((r) => r.id === pathId),
    )
    return updated
  }
```

Add `import { notFound } from '../../utils/errors'` at the top of `service.ts` if not already present (it is not currently imported there — check before adding to avoid a duplicate import).

- [ ] **Step 5: Add controller handlers**

```ts
// apps/api/src/modules/learning-admin/controller.ts — append
import type { UpdateLearningPathBody, SetPathPublishedBody } from './schema'

export const updatePath = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getContext(req)
  const updated = await learningAdminService.updatePath(universityId, req.params.id as string, req.body as UpdateLearningPathBody)
  sendSuccess(res, updated)
})

export const setPathPublished = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getContext(req)
  const { isPublished } = req.body as SetPathPublishedBody
  const updated = await learningAdminService.setPathPublished(universityId, req.params.id as string, isPublished)
  sendSuccess(res, updated)
})
```

- [ ] **Step 6: Wire the routes**

```ts
// apps/api/src/modules/learning-admin/router.ts — add
import { pathIdParamsSchema } from '@uniconnect/shared'
import { UpdateLearningPathSchema, SetPathPublishedSchema } from './schema'
import { updatePath, setPathPublished } from './controller'

learningAdminRouter.patch(
  '/paths/:id',
  validateRequest({ params: pathIdParamsSchema.extend({ id: pathIdParamsSchema.shape.pathId }).pick({ id: true }), body: UpdateLearningPathSchema }),
  updatePath,
)
learningAdminRouter.patch(
  '/paths/:id/publish',
  validate(SetPathPublishedSchema),
  setPathPublished,
)
```

Note: `pathIdParamsSchema` validates a `pathId` param, but this router uses `:id` — rather than fighting the shared schema's field name, define a local one-liner instead (simpler and avoids the awkward `.pick`/`.extend` above):

```ts
// apps/api/src/modules/learning-admin/schema.ts — append, use this instead of the pathIdParamsSchema reuse above
export const PathIdParamSchema = z.object({ id: z.string().uuid() })
```

```ts
// apps/api/src/modules/learning-admin/router.ts — corrected route registration
import { PathIdParamSchema, UpdateLearningPathSchema, SetPathPublishedSchema } from './schema'
import { updatePath, setPathPublished } from './controller'

learningAdminRouter.patch(
  '/paths/:id',
  validateRequest({ params: PathIdParamSchema, body: UpdateLearningPathSchema }),
  updatePath,
)
learningAdminRouter.patch(
  '/paths/:id/publish',
  validateRequest({ params: PathIdParamSchema, body: SetPathPublishedSchema }),
  setPathPublished,
)
```

- [ ] **Step 7: Run the test**

Run: `DATABASE_URL="postgresql://$(whoami)@localhost:5432/uniconnect_test" GEMINI_API_KEY=test-key npx pnpm --filter api exec vitest run src/modules/learning-admin/update-path.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/learning-admin/schema.ts apps/api/src/modules/learning-admin/service.ts \
        apps/api/src/modules/learning-admin/controller.ts apps/api/src/modules/learning-admin/router.ts \
        apps/api/src/modules/learning-admin/update-path.test.ts
git commit -m "feat(learning-admin): edit path metadata and toggle publish state

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017JRVZzfLB9LALRcnS9f2p2"
```

---

### Task 5: Unit CRUD + reorder (`/admin/learning/paths/:id/units*`)

**Files:**
- Modify: `apps/api/src/modules/learning-admin/schema.ts`
- Modify: `apps/api/src/modules/learning-admin/service.ts`
- Modify: `apps/api/src/modules/learning-admin/controller.ts`
- Modify: `apps/api/src/modules/learning-admin/router.ts`
- Test: `apps/api/src/modules/learning-admin/path-units.test.ts`

**Interfaces:**
- Produces: `learningAdminService.createUnit`, `updateUnit`, `deleteUnit`, `reorderUnits`, and `getPathDetail(universityId, pathId): Promise<AdminLearningPath & { units: AdminLearningPathUnit[] }>` — the last one backs the Manage page's initial load (Task 10).

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/modules/learning-admin/path-units.test.ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../../app'
import { db } from '../../config/db'
import { loginAs, DOMAIN } from '../../__tests__/setup'

describe('learning path unit management', () => {
  let pathId: string
  let unitId: string
  let universityId: string
  let accessToken: string

  beforeEach(async () => {
    const uni = await db('universities').where({ domain: DOMAIN }).first('id')
    universityId = uni.id
    accessToken = (await loginAs('admin@uiu.ac.bd', 'password123')).accessToken
    await db('skill_paths').where({ title: 'Path with units' }).del()
    const [path] = await db('skill_paths')
      .insert({ university_id: universityId, title: 'Path with units', category: 'career', difficulty: 'beginner', estimated_days: 5, is_published: false, source: 'manual' })
      .returning('id')
    pathId = path.id
    const [unit] = await db('skill_path_units')
      .insert({ path_id: pathId, display_order: 1, title: 'First unit', type: 'read', content: JSON.stringify({ body: 'x' }) })
      .returning('id')
    unitId = unit.id
  })

  afterAll(async () => {
    await db('skill_paths').where({ title: 'Path with units' }).del()
    await db.destroy()
  })

  it('appends a new unit at the end', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/learning/paths/${pathId}/units`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Second unit', type: 'exercise', content: { body: 'do this' } })
    expect(res.status).toBe(201)
    const units = await db('skill_path_units').where({ path_id: pathId }).orderBy('display_order')
    expect(units).toHaveLength(2)
    expect(units[1].display_order).toBe(2)
  })

  it('updates a unit', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/learning/paths/${pathId}/units/${unitId}`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Renamed unit' })
    expect(res.status).toBe(200)
    const row = await db('skill_path_units').where({ id: unitId }).first('title')
    expect(row.title).toBe('Renamed unit')
  })

  it('deletes a unit', async () => {
    const res = await request(app)
      .delete(`/api/v1/admin/learning/paths/${pathId}/units/${unitId}`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${accessToken}`)
    expect(res.status).toBe(200)
    const row = await db('skill_path_units').where({ id: unitId }).first()
    expect(row).toBeUndefined()
  })

  it('reorders units', async () => {
    const [second] = await db('skill_path_units')
      .insert({ path_id: pathId, display_order: 2, title: 'Second', type: 'read', content: JSON.stringify({ body: 'y' }) })
      .returning('id')
    const res = await request(app)
      .patch(`/api/v1/admin/learning/paths/${pathId}/units/reorder`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ unitIds: [second.id, unitId] })
    expect(res.status).toBe(200)
    const rows = await db('skill_path_units').where({ path_id: pathId }).orderBy('display_order')
    expect(rows[0].id).toBe(second.id)
    expect(rows[1].id).toBe(unitId)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `DATABASE_URL="postgresql://$(whoami)@localhost:5432/uniconnect_test" GEMINI_API_KEY=test-key npx pnpm --filter api exec vitest run src/modules/learning-admin/path-units.test.ts`
Expected: FAIL — 404 on all four.

- [ ] **Step 3: Add schemas**

```ts
// apps/api/src/modules/learning-admin/schema.ts — append
export const CreatePathUnitSchema = PathUnitInputSchema
export type CreatePathUnitBody = z.infer<typeof CreatePathUnitSchema>

export const UpdatePathUnitSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  type: z.enum(['read', 'video', 'exercise', 'quiz']).optional(),
  content: z.record(z.string(), z.unknown()).optional(),
  completionRule: z.object({ passScore: z.number().int().min(0).max(100) }).optional(),
})
export type UpdatePathUnitBody = z.infer<typeof UpdatePathUnitSchema>

export const ReorderPathUnitsSchema = z.object({ unitIds: z.array(z.string().uuid()).min(1) })
export type ReorderPathUnitsBody = z.infer<typeof ReorderPathUnitsSchema>

export const UnitIdParamSchema = z.object({ id: z.string().uuid(), unitId: z.string().uuid() })
```

`PathUnitInputSchema` was defined `const` (not exported) in Task 3 — export it there instead: change `const PathUnitInputSchema` to `export const PathUnitInputSchema` in Task 3's Step 3 edit.

- [ ] **Step 4: Add service methods**

```ts
// apps/api/src/modules/learning-admin/service.ts — add
import type { CreatePathUnitBody, UpdatePathUnitBody } from './schema'
import type { AdminLearningPathUnit } from '@uniconnect/shared'

  async getPathDetail(universityId: string, pathId: string) {
    const [path] = await this.listAdminPaths(universityId, { status: 'all' }).then((rows) =>
      rows.filter((r) => r.id === pathId),
    )
    if (!path) throw notFound('Learning path not found')

    const units = await db('skill_path_units')
      .where({ path_id: pathId })
      .orderBy('display_order', 'asc')
      .select<{ id: string; display_order: number; title: string; type: AdminLearningPathUnit['type']; content: unknown; completion_rule: unknown }[]>(
        'id', 'display_order', 'title', 'type', 'content', 'completion_rule',
      )

    return {
      ...path,
      units: units.map((u) => ({
        id: u.id,
        displayOrder: u.display_order,
        title: u.title,
        type: u.type,
        content: u.content as AdminLearningPathUnit['content'],
        completionRule: u.completion_rule as AdminLearningPathUnit['completionRule'],
      })),
    }
  }

  async createUnit(universityId: string, pathId: string, input: CreatePathUnitBody): Promise<void> {
    await this.findOwnedPath(universityId, pathId)
    const [{ maxOrder }] = await db('skill_path_units')
      .where({ path_id: pathId })
      .max('display_order as maxOrder')
    await db('skill_path_units').insert({
      path_id: pathId,
      display_order: Number(maxOrder ?? 0) + 1,
      title: input.title,
      type: input.type,
      content: JSON.stringify(input.content),
      completion_rule: JSON.stringify(input.completionRule ?? {}),
    })
    await db('skill_paths').where({ id: pathId }).update({ updated_at: db.fn.now() })
  }

  async updateUnit(universityId: string, pathId: string, unitId: string, patch: UpdatePathUnitBody): Promise<void> {
    await this.findOwnedPath(universityId, pathId)
    const columnPatch: Record<string, unknown> = {}
    if (patch.title !== undefined) columnPatch.title = patch.title
    if (patch.type !== undefined) columnPatch.type = patch.type
    if (patch.content !== undefined) columnPatch.content = JSON.stringify(patch.content)
    if (patch.completionRule !== undefined) columnPatch.completion_rule = JSON.stringify(patch.completionRule)

    const updated = await db('skill_path_units').where({ id: unitId, path_id: pathId }).update(columnPatch)
    if (updated === 0) throw notFound('Unit not found')
    await db('skill_paths').where({ id: pathId }).update({ updated_at: db.fn.now() })
  }

  async deleteUnit(universityId: string, pathId: string, unitId: string): Promise<void> {
    await this.findOwnedPath(universityId, pathId)
    const deleted = await db('skill_path_units').where({ id: unitId, path_id: pathId }).delete()
    if (deleted === 0) throw notFound('Unit not found')
    await db('skill_paths').where({ id: pathId }).update({ updated_at: db.fn.now() })
  }

  async reorderUnits(universityId: string, pathId: string, unitIds: string[]): Promise<void> {
    await this.findOwnedPath(universityId, pathId)
    await db.transaction(async (trx) => {
      for (let i = 0; i < unitIds.length; i++) {
        const updated = await trx('skill_path_units')
          .where({ id: unitIds[i], path_id: pathId })
          .update({ display_order: i + 1 })
        if (updated === 0) throw notFound('Unit not found')
      }
    })
  }
```

- [ ] **Step 5: Add controller handlers**

```ts
// apps/api/src/modules/learning-admin/controller.ts — append
import type { CreatePathUnitBody, UpdatePathUnitBody, ReorderPathUnitsBody } from './schema'

export const getPathDetail = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getContext(req)
  sendSuccess(res, await learningAdminService.getPathDetail(universityId, req.params.id as string))
})

export const createUnit = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getContext(req)
  await learningAdminService.createUnit(universityId, req.params.id as string, req.body as CreatePathUnitBody)
  res.status(201)
  sendSuccess(res, { success: true })
})

export const updateUnit = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getContext(req)
  await learningAdminService.updateUnit(universityId, req.params.id as string, req.params.unitId as string, req.body as UpdatePathUnitBody)
  sendSuccess(res, { success: true })
})

export const deleteUnit = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getContext(req)
  await learningAdminService.deleteUnit(universityId, req.params.id as string, req.params.unitId as string)
  sendSuccess(res, { success: true })
})

export const reorderUnits = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getContext(req)
  const { unitIds } = req.body as ReorderPathUnitsBody
  await learningAdminService.reorderUnits(universityId, req.params.id as string, unitIds)
  sendSuccess(res, { success: true })
})
```

- [ ] **Step 6: Wire the routes**

```ts
// apps/api/src/modules/learning-admin/router.ts — add
import { UnitIdParamSchema, CreatePathUnitSchema, UpdatePathUnitSchema, ReorderPathUnitsSchema } from './schema'
import { getPathDetail, createUnit, updateUnit, deleteUnit, reorderUnits } from './controller'

learningAdminRouter.get('/paths/:id', validateRequest({ params: PathIdParamSchema }), getPathDetail)
learningAdminRouter.post('/paths/:id/units', validateRequest({ params: PathIdParamSchema, body: CreatePathUnitSchema }), createUnit)
// IMPORTANT: register '/paths/:id/units/reorder' before '/paths/:id/units/:unitId' —
// Express matches the more specific literal segment first only if it's declared first,
// otherwise 'reorder' is captured as a :unitId value and the reorder schema's UUID check
// (which would 422, not silently misroute) fires instead of the intended handler.
learningAdminRouter.patch('/paths/:id/units/reorder', validateRequest({ params: PathIdParamSchema, body: ReorderPathUnitsSchema }), reorderUnits)
learningAdminRouter.patch('/paths/:id/units/:unitId', validateRequest({ params: UnitIdParamSchema, body: UpdatePathUnitSchema }), updateUnit)
learningAdminRouter.delete('/paths/:id/units/:unitId', validateRequest({ params: UnitIdParamSchema }), deleteUnit)
```

- [ ] **Step 7: Run the test**

Run: `DATABASE_URL="postgresql://$(whoami)@localhost:5432/uniconnect_test" GEMINI_API_KEY=test-key npx pnpm --filter api exec vitest run src/modules/learning-admin/path-units.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/learning-admin/schema.ts apps/api/src/modules/learning-admin/service.ts \
        apps/api/src/modules/learning-admin/controller.ts apps/api/src/modules/learning-admin/router.ts \
        apps/api/src/modules/learning-admin/path-units.test.ts
git commit -m "feat(learning-admin): unit CRUD and reorder for manual path editing

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017JRVZzfLB9LALRcnS9f2p2"
```

---

### Task 6: Task-scoped `POST /admin/learning/generate`

**Files:**
- Modify: `apps/api/src/modules/learning-admin/schema.ts`
- Modify: `apps/api/src/modules/learning-admin/service.ts`
- Modify: `apps/api/src/modules/learning-admin/controller.ts`
- Modify: `apps/api/src/modules/learning-admin/router.ts`
- Test: `apps/api/src/modules/learning-admin/generate.test.ts`

**Interfaces:**
- Produces: `learningAdminService.triggerGenerateNow(universityId: string, task: 'learning' | 'quiz' | 'both')` — replaces the current no-arg signature; every existing caller (the "AI settings" tab's "Generate now" button, Task 11) is updated in the same task to pass `'both'` so behavior there is unchanged.

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/modules/learning-admin/generate.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from '../../app'
import { loginAs, DOMAIN } from '../../__tests__/setup'
import { aiContentQueue } from '../../queues/ai-content.queue'

describe('POST /admin/learning/generate', () => {
  beforeEach(() => {
    vi.spyOn(aiContentQueue, 'add').mockResolvedValue(undefined as never)
  })

  it('enqueues only learning-gen when task=learning', async () => {
    const { accessToken } = await loginAs('admin@uiu.ac.bd', 'password123')
    const res = await request(app)
      .post('/api/v1/admin/learning/generate')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ task: 'learning' })
    expect(res.status).toBe(200)
    expect(aiContentQueue.add).toHaveBeenCalledTimes(1)
    expect(aiContentQueue.add).toHaveBeenCalledWith(expect.objectContaining({ task: 'learning-gen' }))
  })

  it('enqueues only quiz-gen when task=quiz', async () => {
    const { accessToken } = await loginAs('admin@uiu.ac.bd', 'password123')
    const res = await request(app)
      .post('/api/v1/admin/learning/generate')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ task: 'quiz' })
    expect(res.status).toBe(200)
    expect(aiContentQueue.add).toHaveBeenCalledTimes(1)
    expect(aiContentQueue.add).toHaveBeenCalledWith(expect.objectContaining({ task: 'quiz-gen' }))
  })

  it('defaults to both when task is omitted (back-compat with the AI settings tab)', async () => {
    const { accessToken } = await loginAs('admin@uiu.ac.bd', 'password123')
    const res = await request(app)
      .post('/api/v1/admin/learning/generate')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
    expect(res.status).toBe(200)
    expect(aiContentQueue.add).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `DATABASE_URL="postgresql://$(whoami)@localhost:5432/uniconnect_test" GEMINI_API_KEY=test-key npx pnpm --filter api exec vitest run src/modules/learning-admin/generate.test.ts`
Expected: FAIL — first two assertions fail because the current `triggerGenerateNow` always enqueues both regardless of body.

- [ ] **Step 3: Add the schema**

```ts
// apps/api/src/modules/learning-admin/schema.ts — append
export const TriggerGenerateSchema = z.object({
  task: z.enum(['learning', 'quiz', 'both']).optional().default('both'),
})
export type TriggerGenerateBody = z.infer<typeof TriggerGenerateSchema>
```

- [ ] **Step 4: Update the service method**

```ts
// apps/api/src/modules/learning-admin/service.ts — replace the existing triggerGenerateNow
  async triggerGenerateNow(universityId: string, task: 'learning' | 'quiz' | 'both' = 'both'): Promise<void> {
    if (task === 'learning' || task === 'both') {
      await aiContentQueue.add({ task: 'learning-gen', universityId })
    }
    if (task === 'quiz' || task === 'both') {
      await aiContentQueue.add({ task: 'quiz-gen', universityId })
    }
  }
```

- [ ] **Step 5: Update the controller handler**

```ts
// apps/api/src/modules/learning-admin/controller.ts — replace the existing triggerGenerateNow
import type { TriggerGenerateBody } from './schema'

export const triggerGenerateNow = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getContext(req)
  const { task } = req.body as TriggerGenerateBody
  await learningAdminService.triggerGenerateNow(universityId, task)
  sendSuccess(res, { success: true })
})
```

- [ ] **Step 6: Add body validation to the route**

```ts
// apps/api/src/modules/learning-admin/router.ts — replace the existing generate route
import { TriggerGenerateSchema } from './schema'

learningAdminRouter.post('/generate', validate(TriggerGenerateSchema), triggerGenerateNow)
```

- [ ] **Step 7: Run the test**

Run: `DATABASE_URL="postgresql://$(whoami)@localhost:5432/uniconnect_test" GEMINI_API_KEY=test-key npx pnpm --filter api exec vitest run src/modules/learning-admin/generate.test.ts`
Expected: PASS

- [ ] **Step 8: Run the full API test suite (this changed a shared service method's signature)**

Run: `DATABASE_URL="postgresql://$(whoami)@localhost:5432/uniconnect_test" GEMINI_API_KEY=test-key npx pnpm --filter api test`
Expected: PASS — confirms no other caller of `triggerGenerateNow` broke.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/modules/learning-admin/schema.ts apps/api/src/modules/learning-admin/service.ts \
        apps/api/src/modules/learning-admin/controller.ts apps/api/src/modules/learning-admin/router.ts \
        apps/api/src/modules/learning-admin/generate.test.ts
git commit -m "feat(learning-admin): scope generate-now to learning, quiz, or both

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017JRVZzfLB9LALRcnS9f2p2"
```

---

### Task 7: Frontend hooks

**Files:**
- Modify: `apps/web/src/features/learning-admin/hooks/useLearningAdmin.ts`
- Test: `apps/web/src/features/learning-admin/hooks/useLearningAdmin.test.tsx` (new)

**Interfaces:**
- Consumes: `AdminLearningPath`, `CreateLearningPathInput`, `UpdateLearningPathInput` (Task 1); all six new endpoints (Tasks 2–6).
- Produces: `useAdminLearningPaths(query)`, `useCreateLearningPath()`, `useUpdateLearningPath()`, `useSetPathPublished()`, `usePathDetail(pathId)`, `useCreatePathUnit()`, `useUpdatePathUnit()`, `useDeletePathUnit()`, `useReorderPathUnits()` — consumed by Tasks 8–10. `useTriggerLearningGenerate` now takes `(task: 'learning' | 'quiz' | 'both')`.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/features/learning-admin/hooks/useLearningAdmin.test.tsx
import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/msw/server'
import { useAdminLearningPaths } from './useLearningAdmin'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useAdminLearningPaths', () => {
  it('fetches the admin path list', async () => {
    server.use(
      http.get('*/admin/learning/paths', () =>
        HttpResponse.json({ data: [{ id: 'p1', title: 'Test path', isPublished: true, unitCount: 3, enrolledCount: 10, completionRate: 0.5 }] }),
      ),
    )
    const { result } = renderHook(() => useAdminLearningPaths({ status: 'all' }), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].title).toBe('Test path')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx pnpm --filter web test src/features/learning-admin/hooks/useLearningAdmin.test.tsx`
Expected: FAIL — `useAdminLearningPaths` is not exported.

- [ ] **Step 3: Add the hooks**

```ts
// apps/web/src/features/learning-admin/hooks/useLearningAdmin.ts — append
import type { AdminLearningPath, CreateLearningPathInput, UpdateLearningPathInput } from '@uniconnect/shared'

interface AdminLearningPathDetail extends AdminLearningPath {
  units: Array<{
    id: string
    displayOrder: number
    title: string
    type: 'read' | 'video' | 'exercise' | 'quiz'
    content: { body?: string; questions?: Array<{ q: string; options: string[]; answer: number }> } | null
    completionRule: { passScore?: number } | null
  }>
}

export function useAdminLearningPaths(query: { status?: 'all' | 'published' | 'draft'; category?: string }) {
  return useQuery<AdminLearningPath[]>({
    queryKey: ['learning-admin', 'paths', query],
    queryFn: () =>
      api.get<{ data: AdminLearningPath[] }>('/admin/learning/paths', { params: query }).then((r) => r.data.data),
  })
}

export function usePathDetail(pathId: string | null) {
  return useQuery<AdminLearningPathDetail>({
    queryKey: ['learning-admin', 'path', pathId],
    queryFn: () => api.get<{ data: AdminLearningPathDetail }>(`/admin/learning/paths/${pathId}`).then((r) => r.data.data),
    enabled: !!pathId,
  })
}

export function useCreateLearningPath() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateLearningPathInput) =>
      api.post<{ data: AdminLearningPath }>('/admin/learning/paths', input).then((r) => r.data.data),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['learning-admin', 'paths'] }) },
  })
}

export function useUpdateLearningPath() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ pathId, patch }: { pathId: string; patch: UpdateLearningPathInput }) =>
      api.patch<{ data: AdminLearningPath }>(`/admin/learning/paths/${pathId}`, patch).then((r) => r.data.data),
    onSuccess: (_data, { pathId }) => {
      void qc.invalidateQueries({ queryKey: ['learning-admin', 'paths'] })
      void qc.invalidateQueries({ queryKey: ['learning-admin', 'path', pathId] })
    },
  })
}

export function useSetPathPublished() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ pathId, isPublished }: { pathId: string; isPublished: boolean }) =>
      api.patch<{ data: AdminLearningPath }>(`/admin/learning/paths/${pathId}/publish`, { isPublished }).then((r) => r.data.data),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['learning-admin', 'paths'] }) },
  })
}

export function useCreatePathUnit(pathId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (unit: { title: string; type: string; content: Record<string, unknown>; completionRule?: { passScore?: number } }) =>
      api.post(`/admin/learning/paths/${pathId}/units`, unit),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['learning-admin', 'path', pathId] }) },
  })
}

export function useUpdatePathUnit(pathId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ unitId, patch }: { unitId: string; patch: Record<string, unknown> }) =>
      api.patch(`/admin/learning/paths/${pathId}/units/${unitId}`, patch),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['learning-admin', 'path', pathId] }) },
  })
}

export function useDeletePathUnit(pathId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (unitId: string) => api.delete(`/admin/learning/paths/${pathId}/units/${unitId}`),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['learning-admin', 'path', pathId] }) },
  })
}

export function useReorderPathUnits(pathId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (unitIds: string[]) => api.patch(`/admin/learning/paths/${pathId}/units/reorder`, { unitIds }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['learning-admin', 'path', pathId] }) },
  })
}
```

- [ ] **Step 4: Update `useTriggerLearningGenerate` to accept a task**

```ts
// apps/web/src/features/learning-admin/hooks/useLearningAdmin.ts — replace the existing useTriggerLearningGenerate
export function useTriggerLearningGenerate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (task: 'learning' | 'quiz' | 'both' = 'both') =>
      api.post<{ data: { status: string } }>('/admin/learning/generate', { task }).then((r) => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['learning-admin'] })
    },
  })
}
```

This changes the call shape from `triggerGenerate.mutate(undefined, {...})` to `triggerGenerate.mutate('both', {...})` — Task 11 updates the one existing call site (`LearningAdminPanel.tsx`'s `generate()` function) accordingly.

- [ ] **Step 5: Run the test**

Run: `npx pnpm --filter web test src/features/learning-admin/hooks/useLearningAdmin.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/learning-admin/hooks/useLearningAdmin.ts \
        apps/web/src/features/learning-admin/hooks/useLearningAdmin.test.tsx
git commit -m "feat(learning-admin): frontend hooks for the manual path CMS

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017JRVZzfLB9LALRcnS9f2p2"
```

---

### Task 8: `LearningPathLibrary` component (stat tiles, filter chips, grid, generate cards)

**Files:**
- Create: `apps/web/src/features/learning-admin/components/LearningPathLibrary.tsx`
- Test: `apps/web/src/features/learning-admin/components/LearningPathLibrary.test.tsx`

**Interfaces:**
- Consumes: `useAdminLearningPaths`, `useSetPathPublished`, `useTriggerLearningGenerate` (Task 7), `usePendingPaths` (existing hook).
- Produces: `<LearningPathLibrary onCreatePath={() => void} onEditPath={(id: string) => void} onManagePath={(id: string) => void} />` — consumed by Task 11.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/features/learning-admin/components/LearningPathLibrary.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/msw/server'
import { LearningPathLibrary } from './LearningPathLibrary'

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('LearningPathLibrary', () => {
  it('shows stat tiles and path cards, and calls onManagePath', async () => {
    server.use(
      http.get('*/admin/learning/paths', () =>
        HttpResponse.json({
          data: [
            { id: 'p1', title: 'Algorithms, properly', department: 'CSE', category: 'technical', difficulty: 'intermediate', isPublished: true, unitCount: 11, enrolledCount: 214, completionRate: 0.46, updatedAt: new Date().toISOString() },
          ],
        }),
      ),
      http.get('*/admin/learning/pending-paths', () => HttpResponse.json({ data: [] })),
    )
    const onManagePath = vi.fn()
    renderWithClient(<LearningPathLibrary onCreatePath={() => {}} onEditPath={() => {}} onManagePath={onManagePath} />)

    expect(await screen.findByText('Algorithms, properly')).toBeInTheDocument()
    expect(screen.getByText(/214 enrolled/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /manage/i }))
    expect(onManagePath).toHaveBeenCalledWith('p1')
  })

  it('filters to drafts when the Drafts chip is clicked', async () => {
    server.use(
      http.get('*/admin/learning/paths', ({ request }) => {
        const url = new URL(request.url)
        const status = url.searchParams.get('status')
        const rows =
          status === 'draft'
            ? [{ id: 'p2', title: 'Draft path', isPublished: false, unitCount: 2, enrolledCount: 0, completionRate: 0, updatedAt: new Date().toISOString() }]
            : [
                { id: 'p1', title: 'Published path', isPublished: true, unitCount: 3, enrolledCount: 5, completionRate: 0.2, updatedAt: new Date().toISOString() },
                { id: 'p2', title: 'Draft path', isPublished: false, unitCount: 2, enrolledCount: 0, completionRate: 0, updatedAt: new Date().toISOString() },
              ]
        return HttpResponse.json({ data: rows })
      }),
      http.get('*/admin/learning/pending-paths', () => HttpResponse.json({ data: [] })),
    )
    renderWithClient(<LearningPathLibrary onCreatePath={() => {}} onEditPath={() => {}} onManagePath={() => {}} />)
    expect(await screen.findByText('Published path')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^drafts/i }))
    expect(await screen.findByText('Draft path')).toBeInTheDocument()
    expect(screen.queryByText('Published path')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx pnpm --filter web test src/features/learning-admin/components/LearningPathLibrary.test.tsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write the component**

```tsx
// apps/web/src/features/learning-admin/components/LearningPathLibrary.tsx
import { useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Sparkles, Wand2, Plus, BookOpen } from 'lucide-react'
import { PrimaryBtn, GhostBtn } from '@/components/Button'
import { usePendingPaths } from '../hooks/useLearningAdmin'
import { useAdminLearningPaths, useSetPathPublished, useTriggerLearningGenerate } from '../hooks/useLearningAdmin'

const card: React.CSSProperties = {
  background: 'var(--surface-card)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-lg)',
  padding: 20,
}

const statTile: React.CSSProperties = { ...card, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 6 }
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: 'var(--text-label)', letterSpacing: '0.04em' }

type StatusFilter = 'all' | 'published' | 'draft'

interface Props {
  onCreatePath: () => void
  onEditPath: (pathId: string) => void
  onManagePath: (pathId: string) => void
}

export function LearningPathLibrary({ onCreatePath, onEditPath, onManagePath }: Props) {
  const [status, setStatus] = useState<StatusFilter>('all')
  const [category, setCategory] = useState<string | null>(null)
  const { data: paths, isLoading } = useAdminLearningPaths({ status, category: category ?? undefined })
  const { data: allPaths } = useAdminLearningPaths({ status: 'all' })
  const { data: pendingPaths } = usePendingPaths()
  const setPublished = useSetPathPublished()
  const triggerGenerate = useTriggerLearningGenerate()

  const categories = useMemo(() => {
    const set = new Set((allPaths ?? []).map((p) => p.category))
    return [...set]
  }, [allPaths])

  const totalPaths = allPaths?.length ?? 0
  const publishedCount = allPaths?.filter((p) => p.isPublished).length ?? 0
  const draftCount = totalPaths - publishedCount
  const totalEnrolled = (allPaths ?? []).reduce((sum, p) => sum + p.enrolledCount, 0)
  const avgCompletion = totalPaths > 0
    ? Math.round(((allPaths ?? []).reduce((sum, p) => sum + p.completionRate, 0) / totalPaths) * 100)
    : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <button
          type="button"
          onClick={() => triggerGenerate.mutate('learning')}
          disabled={triggerGenerate.isPending}
          style={{ ...card, textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start', border: '0.5px solid var(--uc-indigo-bdr)', background: 'var(--uc-indigo-bg)' }}
        >
          <Sparkles size={18} color="var(--uc-indigo-l)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Generate a learning path with AI</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>Describe a topic and get a structured, unit-by-unit path draft.</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => triggerGenerate.mutate('quiz')}
          disabled={triggerGenerate.isPending}
          style={{ ...card, textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start', border: '0.5px solid var(--uc-indigo-bdr)', background: 'var(--uc-indigo-bg)' }}
        >
          <Wand2 size={18} color="var(--uc-indigo-l)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Generate a quiz with AI</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>Build a checkpoint quiz from any path's units in seconds.</p>
          </div>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <div style={statTile}>
          <span style={labelStyle}>Learning paths</span>
          <span style={{ fontSize: 28, fontWeight: 500, color: 'var(--text-primary)' }}>{totalPaths}</span>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{publishedCount} published</span>
        </div>
        <div style={statTile}>
          <span style={labelStyle}>Total enrolled</span>
          <span style={{ fontSize: 28, fontWeight: 500, color: 'var(--text-primary)' }}>{totalEnrolled.toLocaleString()}</span>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>across all paths</span>
        </div>
        <div style={statTile}>
          <span style={labelStyle}>Avg completion</span>
          <span style={{ fontSize: 28, fontWeight: 500, color: 'var(--text-primary)' }}>{avgCompletion}%</span>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>of enrolled units</span>
        </div>
        <div style={statTile}>
          <span style={labelStyle}>Awaiting review</span>
          <span style={{ fontSize: 28, fontWeight: 500, color: 'var(--text-primary)' }}>{pendingPaths?.length ?? 0}</span>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>draft paths</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <FilterChip label={`All ${totalPaths}`} active={status === 'all' && !category} onClick={() => { setStatus('all'); setCategory(null) }} />
        <FilterChip label={`Published ${publishedCount}`} active={status === 'published'} onClick={() => { setStatus('published'); setCategory(null) }} />
        <FilterChip label={`Drafts ${draftCount}`} active={status === 'draft'} onClick={() => { setStatus('draft'); setCategory(null) }} />
        {categories.map((c) => (
          <FilterChip
            key={c}
            label={`${c[0].toUpperCase()}${c.slice(1)} ${(allPaths ?? []).filter((p) => p.category === c).length}`}
            active={category === c}
            onClick={() => { setCategory(c); setStatus('all') }}
          />
        ))}
        <div style={{ flex: 1 }} />
        <PrimaryBtn onClick={onCreatePath} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> New learning path
        </PrimaryBtn>
      </div>

      {isLoading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>
      ) : !paths || paths.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: 'var(--text-tertiary)', padding: '48px 0' }}>
          <BookOpen size={20} style={{ marginBottom: 8 }} />
          <p style={{ margin: 0 }}>No learning paths match this filter.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {paths.map((p) => (
            <div key={p.id} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>{p.title}</span>
                    <span
                      style={{
                        fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 'var(--r-pill)',
                        background: p.isPublished ? 'var(--uc-mint-bg)' : 'var(--uc-amber-bg)',
                        color: p.isPublished ? 'var(--uc-mint)' : 'var(--uc-amber-l)',
                        border: `0.5px solid ${p.isPublished ? 'var(--uc-mint-bdr)' : 'var(--uc-amber-bdr)'}`,
                      }}
                    >
                      {p.isPublished ? 'Published' : 'Draft'}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    {[p.department, `${p.unitCount} units`, p.difficulty].filter(Boolean).join(' · ')}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)' }}>
                <span>{p.enrolledCount} enrolled</span>
                <span>{Math.round(p.completionRate * 100)}% avg completion</span>
              </div>
              <div style={{ height: 4, borderRadius: 'var(--r-pill)', background: 'var(--surface-raised)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.round(p.completionRate * 100)}%`, background: 'var(--uc-indigo)', borderRadius: 'var(--r-pill)' }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  Updated {formatDistanceToNow(new Date(p.updatedAt), { addSuffix: true })}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <GhostBtn onClick={() => onEditPath(p.id)} style={{ fontSize: 12, padding: '4px 12px' }}>Edit</GhostBtn>
                  <PrimaryBtn onClick={() => onManagePath(p.id)} style={{ fontSize: 12, padding: '4px 12px' }}>Manage</PrimaryBtn>
                </div>
              </div>
              {!p.isPublished && (
                <GhostBtn
                  onClick={() => setPublished.mutate({ pathId: p.id, isPublished: true })}
                  disabled={setPublished.isPending}
                  style={{ fontSize: 12, alignSelf: 'flex-start' }}
                >
                  Publish
                </GhostBtn>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 14px',
        fontSize: 12,
        fontWeight: active ? 500 : 400,
        borderRadius: 'var(--r-pill)',
        border: `0.5px solid ${active ? 'var(--uc-indigo-bdr)' : 'var(--border-default)'}`,
        background: active ? 'var(--uc-indigo-bg)' : 'transparent',
        color: active ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}
```

- [ ] **Step 4: Run the test**

Run: `npx pnpm --filter web test src/features/learning-admin/components/LearningPathLibrary.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/learning-admin/components/LearningPathLibrary.tsx \
        apps/web/src/features/learning-admin/components/LearningPathLibrary.test.tsx
git commit -m "feat(learning-admin): learning path library grid with stats and filters

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017JRVZzfLB9LALRcnS9f2p2"
```

---

### Task 9: `LearningPathFormModal` (create + metadata edit)

**Files:**
- Create: `apps/web/src/features/learning-admin/components/LearningPathFormModal.tsx`
- Test: `apps/web/src/features/learning-admin/components/LearningPathFormModal.test.tsx`

**Interfaces:**
- Consumes: `useCreateLearningPath`, `useUpdateLearningPath` (Task 7).
- Produces: `<LearningPathFormModal mode="create" | "edit" path={AdminLearningPath | null} open={boolean} onClose={() => void} />` — consumed by Task 11.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/features/learning-admin/components/LearningPathFormModal.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/msw/server'
import { LearningPathFormModal } from './LearningPathFormModal'

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('LearningPathFormModal', () => {
  it('creates a path with at least one unit', async () => {
    let posted: unknown = null
    server.use(
      http.post('*/admin/learning/paths', async ({ request }) => {
        posted = await request.json()
        return HttpResponse.json({ data: { id: 'new-1' } }, { status: 201 })
      }),
    )
    const onClose = vi.fn()
    renderWithClient(<LearningPathFormModal mode="create" path={null} open onClose={onClose} />)

    await userEvent.type(screen.getByLabelText(/title/i), 'New path title')
    await userEvent.type(screen.getByLabelText(/first unit title/i), 'Intro unit')
    await userEvent.click(screen.getByRole('button', { name: /create path/i }))

    await screen.findByText(/created/i)
    expect(posted).toMatchObject({ title: 'New path title', units: [{ title: 'Intro unit' }] })
  })

  it('edits metadata for an existing path', async () => {
    let patched: unknown = null
    server.use(
      http.patch('*/admin/learning/paths/p1', async ({ request }) => {
        patched = await request.json()
        return HttpResponse.json({ data: { id: 'p1' } })
      }),
    )
    const onClose = vi.fn()
    renderWithClient(
      <LearningPathFormModal
        mode="edit"
        path={{ id: 'p1', title: 'Old title', description: null, department: null, category: 'career', difficulty: 'beginner', estimatedDays: 5, isPublished: false, source: 'manual', unitCount: 1, enrolledCount: 0, completedCount: 0, completionRate: 0, updatedAt: new Date().toISOString() }}
        open
        onClose={onClose}
      />,
    )

    const titleInput = screen.getByLabelText(/title/i)
    await userEvent.clear(titleInput)
    await userEvent.type(titleInput, 'Updated title')
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await screen.findByText(/saved/i)
    expect(patched).toMatchObject({ title: 'Updated title' })
  })
})
```

(Import `vi` from `'vitest'` alongside `describe, it, expect` at the top — omitted above only to save space; include it in the actual file.)

- [ ] **Step 2: Run it to verify it fails**

Run: `npx pnpm --filter web test src/features/learning-admin/components/LearningPathFormModal.test.tsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write the component**

```tsx
// apps/web/src/features/learning-admin/components/LearningPathFormModal.tsx
import { useEffect, useRef, useState } from 'react'
import type { AdminLearningPath } from '@uniconnect/shared'
import { PrimaryBtn, GhostBtn } from '@/components/Button'
import { useCreateLearningPath, useUpdateLearningPath } from '../hooks/useLearningAdmin'

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--surface-page)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-md)',
  padding: '9px 12px',
  color: 'var(--text-primary)',
  fontSize: 14,
}
const labelStyle: React.CSSProperties = { fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }

interface Props {
  mode: 'create' | 'edit'
  path: AdminLearningPath | null
  open: boolean
  onClose: () => void
}

export function LearningPathFormModal({ mode, path, open, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const createPath = useCreateLearningPath()
  const updatePath = useUpdateLearningPath()
  const [title, setTitle] = useState('')
  const [department, setDepartment] = useState('')
  const [category, setCategory] = useState('career')
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner')
  const [estimatedDays, setEstimatedDays] = useState(7)
  const [firstUnitTitle, setFirstUnitTitle] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (open) dialogRef.current?.showModal()
    else dialogRef.current?.close()
  }, [open])

  useEffect(() => {
    if (mode === 'edit' && path) {
      setTitle(path.title)
      setDepartment(path.department ?? '')
      setCategory(path.category)
      setDifficulty(path.difficulty)
      setEstimatedDays(path.estimatedDays)
    } else if (mode === 'create') {
      setTitle('')
      setDepartment('')
      setCategory('career')
      setDifficulty('beginner')
      setEstimatedDays(7)
      setFirstUnitTitle('')
    }
    setMessage(null)
  }, [mode, path, open])

  function submit() {
    if (mode === 'create') {
      createPath.mutate(
        {
          title,
          department: department || null,
          category,
          difficulty,
          estimatedDays,
          units: [{ title: firstUnitTitle, type: 'read', content: { body: '' } }],
        },
        { onSuccess: () => setMessage('Path created.') },
      )
    } else if (path) {
      updatePath.mutate(
        { pathId: path.id, patch: { title, department: department || null, category, difficulty, estimatedDays } },
        { onSuccess: () => setMessage('Saved.') },
      )
    }
  }

  const pending = createPath.isPending || updatePath.isPending
  const canSubmit = title.trim().length > 0 && (mode === 'edit' || firstUnitTitle.trim().length > 0)

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onCancel={onClose}
      style={{
        border: 'none', borderRadius: 'var(--r-lg)', padding: 0, background: 'var(--surface-card)',
        maxWidth: 480, width: '100%',
      }}
    >
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 500, color: 'var(--text-primary)' }}>
          {mode === 'create' ? 'New learning path' : 'Edit path'}
        </h2>

        <div>
          <label htmlFor="path-title" style={labelStyle}>Title</label>
          <input id="path-title" style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div>
          <label htmlFor="path-department" style={labelStyle}>Department</label>
          <input id="path-department" style={inputStyle} value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. CSE" />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="path-category" style={labelStyle}>Category</label>
            <input id="path-category" style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="path-difficulty" style={labelStyle}>Level</label>
            <select id="path-difficulty" style={inputStyle} value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="path-days" style={labelStyle}>Estimated days</label>
          <input id="path-days" type="number" style={inputStyle} value={estimatedDays} onChange={(e) => setEstimatedDays(Number(e.target.value))} />
        </div>

        {mode === 'create' && (
          <div>
            <label htmlFor="path-first-unit" style={labelStyle}>First unit title</label>
            <input id="path-first-unit" style={inputStyle} value={firstUnitTitle} onChange={(e) => setFirstUnitTitle(e.target.value)} placeholder="e.g. Getting started" />
            <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
              Add more units afterward from the path's Manage screen.
            </p>
          </div>
        )}

        {message && <span style={{ fontSize: 13, color: 'var(--uc-mint)' }}>{message}</span>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn onClick={submit} disabled={!canSubmit || pending}>
            {pending ? 'Saving…' : mode === 'create' ? 'Create path' : 'Save changes'}
          </PrimaryBtn>
        </div>
      </div>
    </dialog>
  )
}
```

- [ ] **Step 4: Run the test**

Run: `npx pnpm --filter web test src/features/learning-admin/components/LearningPathFormModal.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/learning-admin/components/LearningPathFormModal.tsx \
        apps/web/src/features/learning-admin/components/LearningPathFormModal.test.tsx
git commit -m "feat(learning-admin): create/edit modal for learning path metadata

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017JRVZzfLB9LALRcnS9f2p2"
```

---

### Task 10: `LearningPathManagePage` (unit editor) + route

**Files:**
- Create: `apps/web/src/features/learning-admin/components/LearningPathManagePage.tsx`
- Modify: `apps/web/src/features/learning-admin/index.ts`
- Modify: `apps/web/src/router/paths.ts`
- Modify: `apps/web/src/router/index.tsx`
- Modify: `apps/web/src/config/reachability.test.ts`
- Test: `apps/web/src/features/learning-admin/components/LearningPathManagePage.test.tsx`

**Interfaces:**
- Consumes: `usePathDetail`, `useCreatePathUnit`, `useUpdatePathUnit`, `useDeletePathUnit`, `useReorderPathUnits` (Task 7).
- Produces: `PATHS.ADMIN_LEARNING_PATH(id: string): string`, `<LearningPathManagePage />` (reads `pathId` from the router param), both consumed by Task 11's "Manage" wiring (via `useNavigate`) and by the router.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/features/learning-admin/components/LearningPathManagePage.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/msw/server'
import { LearningPathManagePage } from './LearningPathManagePage'

function renderAt(pathId: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/admin/learning/paths/${pathId}`]}>
        <Routes>
          <Route path="/admin/learning/paths/:pathId" element={<LearningPathManagePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('LearningPathManagePage', () => {
  it('lists units and adds a new one', async () => {
    let posted: unknown = null
    server.use(
      http.get('*/admin/learning/paths/p1', () =>
        HttpResponse.json({
          data: {
            id: 'p1', title: 'Algorithms, properly', isPublished: true, unitCount: 1, enrolledCount: 0, completionRate: 0, updatedAt: new Date().toISOString(),
            units: [{ id: 'u1', displayOrder: 1, title: 'Big-O notation', type: 'read', content: { body: 'x' }, completionRule: null }],
          },
        }),
      ),
      http.post('*/admin/learning/paths/p1/units', async ({ request }) => {
        posted = await request.json()
        return HttpResponse.json({ data: { success: true } }, { status: 201 })
      }),
    )
    renderAt('p1')

    expect(await screen.findByText('Big-O notation')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText(/new unit title/i), 'Recursion basics')
    await userEvent.click(screen.getByRole('button', { name: /add unit/i }))

    expect(posted).toMatchObject({ title: 'Recursion basics', type: 'read' })
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx pnpm --filter web test src/features/learning-admin/components/LearningPathManagePage.test.tsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write the component**

```tsx
// apps/web/src/features/learning-admin/components/LearningPathManagePage.tsx
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { GripVertical, Trash2, ArrowLeft } from 'lucide-react'
import { GhostBtn, PrimaryBtn } from '@/components/Button'
import { PATHS } from '@/router/paths'
import { usePathDetail, useCreatePathUnit, useUpdatePathUnit, useDeletePathUnit, useReorderPathUnits } from '../hooks/useLearningAdmin'

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-page)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-md)',
  padding: '8px 10px', color: 'var(--text-primary)', fontSize: 13,
}

export function LearningPathManagePage() {
  const { pathId } = useParams<{ pathId: string }>()
  const navigate = useNavigate()
  const { data: path, isLoading } = usePathDetail(pathId ?? null)
  const createUnit = useCreatePathUnit(pathId ?? '')
  const updateUnit = useUpdatePathUnit(pathId ?? '')
  const deleteUnit = useDeletePathUnit(pathId ?? '')
  const reorderUnits = useReorderPathUnits(pathId ?? '')
  const [newUnitTitle, setNewUnitTitle] = useState('')

  if (isLoading || !path) return <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>

  function moveUnit(index: number, direction: -1 | 1) {
    if (!path) return
    const ids = path.units.map((u) => u.id)
    const target = index + direction
    if (target < 0 || target >= ids.length) return
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    reorderUnits.mutate(ids)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <GhostBtn onClick={() => navigate(PATHS.ADMIN + '?tab=learning')} style={{ padding: 6 }}>
          <ArrowLeft size={16} />
        </GhostBtn>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 500, color: 'var(--text-primary)' }}>{path.title}</h1>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
            {path.unitCount} units · {path.enrolledCount} enrolled
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {path.units.map((unit, i) => (
          <div
            key={unit.id}
            style={{
              background: 'var(--surface-card)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-md)',
              padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
            }}
          >
            <GripVertical size={14} color="var(--text-tertiary)" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
              <input
                style={{ ...inputStyle, fontSize: 14, fontWeight: 500 }}
                value={unit.title}
                onChange={(e) => updateUnit.mutate({ unitId: unit.id, patch: { title: e.target.value } })}
                aria-label={`Unit ${i + 1} title`}
              />
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{unit.type}</span>
            </div>
            <GhostBtn onClick={() => moveUnit(i, -1)} disabled={i === 0} style={{ padding: 4 }}>↑</GhostBtn>
            <GhostBtn onClick={() => moveUnit(i, 1)} disabled={i === path.units.length - 1} style={{ padding: 4 }}>↓</GhostBtn>
            <button
              type="button"
              onClick={() => deleteUnit.mutate(unit.id)}
              aria-label={`Delete unit ${unit.title}`}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex' }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label htmlFor="new-unit-title" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>
          New unit title
        </label>
        <input
          id="new-unit-title"
          style={{ ...inputStyle, flex: 1 }}
          placeholder="New unit title"
          value={newUnitTitle}
          onChange={(e) => setNewUnitTitle(e.target.value)}
        />
        <PrimaryBtn
          onClick={() => {
            createUnit.mutate({ title: newUnitTitle, type: 'read', content: { body: '' } }, { onSuccess: () => setNewUnitTitle('') })
          }}
          disabled={!newUnitTitle.trim() || createUnit.isPending}
        >
          Add unit
        </PrimaryBtn>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the test**

Run: `npx pnpm --filter web test src/features/learning-admin/components/LearningPathManagePage.test.tsx`
Expected: PASS

- [ ] **Step 5: Add the route**

```ts
// apps/web/src/router/paths.ts — add near the other ADMIN entries
ADMIN_LEARNING_PATH: (id: string) => `/admin/learning/paths/${id}`,
```

```tsx
// apps/web/src/router/index.tsx — add near the other admin/feature routes
import { LearningPathManagePage } from '@/features/learning-admin/components/LearningPathManagePage'
// ...
<Route path="/admin/learning/paths/:pathId" element={page(LearningPathManagePage)} />
```

Check the exact `page()` helper usage pattern at an existing route (e.g. the `/groups/:id` route) before writing this line, and match its lazy-loading convention exactly rather than assuming the shape above.

- [ ] **Step 6: Export from the feature barrel**

```ts
// apps/web/src/features/learning-admin/index.ts — add
export { LearningPathManagePage } from './components/LearningPathManagePage'
```

- [ ] **Step 7: Register the route as reached-by-context**

```ts
// apps/web/src/config/reachability.test.ts — find the list of detail-page/reached-by-context
// path patterns (the comment block mentions "detail pages, auth flows") and add this route
// to it, following the exact existing pattern for a parameterized detail route like
// PATHS.GROUP_DETAIL or similar — read that pattern in the file first, then mirror it for
// PATHS.ADMIN_LEARNING_PATH.
```

- [ ] **Step 8: Run the reachability test**

Run: `npx pnpm --filter web test src/config/reachability.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/features/learning-admin/components/LearningPathManagePage.tsx \
        apps/web/src/features/learning-admin/components/LearningPathManagePage.test.tsx \
        apps/web/src/features/learning-admin/index.ts \
        apps/web/src/router/paths.ts apps/web/src/router/index.tsx \
        apps/web/src/config/reachability.test.ts
git commit -m "feat(learning-admin): per-path unit editor at /admin/learning/paths/:id

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017JRVZzfLB9LALRcnS9f2p2"
```

---

### Task 11: Wire `LearningAdminPanel` tab switcher

**Files:**
- Modify: `apps/web/src/features/learning-admin/components/LearningAdminPanel.tsx`
- Modify: `apps/web/src/features/learning-admin/components/LearningAdminPanel.test.tsx` (existing file — extend it)

**Interfaces:**
- Consumes: `LearningPathLibrary` (Task 8), `LearningPathFormModal` (Task 9), updated `useTriggerLearningGenerate` (Task 7).
- Produces: nothing new consumed elsewhere — this is the integration point.

- [ ] **Step 1: Read the existing test file to preserve its passing assertions**

Read `apps/web/src/features/learning-admin/components/LearningAdminPanel.test.tsx` in full before editing — it currently tests the AI-settings config form directly rendered by `LearningAdminPanel`; after this task that form renders only under the "AI settings" tab, so every existing test in that file needs a preceding `await userEvent.click(screen.getByRole('button', { name: /ai settings/i}))` inserted. Do this edit as part of Step 4, not as a separate throwaway step — there is no separate "failing test" to write first here since this task is a refactor of an already-tested component; instead, Step 2 below captures the current passing baseline, and Step 5 confirms it still passes after the tab is added.

- [ ] **Step 2: Run the existing suite to confirm the baseline passes**

Run: `npx pnpm --filter web test src/features/learning-admin/components/LearningAdminPanel.test.tsx`
Expected: PASS (baseline, before this task's changes)

- [ ] **Step 3: Add a new test for the tab switcher itself**

```tsx
// apps/web/src/features/learning-admin/components/LearningAdminPanel.test.tsx — append a new describe block
describe('LearningAdminPanel tabs', () => {
  it('defaults to the Content library tab and can switch to AI settings', async () => {
    // (reuse this file's existing MSW handlers/render helper for /admin/learning/config,
    // /admin/learning/pending-paths, /admin/learning/pending-quiz, /admin/learning/upcoming-quizzes,
    // /admin/learning/analytics, and add a handler for GET */admin/learning/paths returning { data: [] })
    renderPanel() // use this file's existing render helper — read it before writing this test
    expect(await screen.findByRole('button', { name: /new learning path/i })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /ai settings/i }))
    expect(await screen.findByText(/learning ai preferences/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: Modify the component**

```tsx
// apps/web/src/features/learning-admin/components/LearningAdminPanel.tsx
// 1. Add imports:
import { useState } from 'react' // already imported — merge into the existing import line
import { LearningPathLibrary } from './LearningPathLibrary'
import { LearningPathFormModal } from './LearningPathFormModal'
import { useNavigate } from 'react-router-dom'
import { PATHS } from '@/router/paths'
import type { AdminLearningPath } from '@uniconnect/shared'

// 2. Inside the LearningAdminPanel function body, add near the top (after existing hook calls):
  const [activeTab, setActiveTab] = useState<'library' | 'settings'>('library')
  const [formState, setFormState] = useState<{ mode: 'create' | 'edit'; path: AdminLearningPath | null } | null>(null)
  const navigate = useNavigate()

// 3. Change the single existing "Generate now" ghost button's onClick from
//    `() => void generate()` to keep calling the existing config-driven `generate()` function
//    unchanged (it still lives under the AI settings tab) — no change needed there, since
//    Task 7 made useTriggerLearningGenerate default its argument to 'both' only when called
//    with no argument; `generate()` in this file calls `triggerGenerate.mutate(undefined, {...})`
//    today, which must become `triggerGenerate.mutate('both', {...})` to match the new required
//    argument. Locate that exact call (currently around line 157) and change it:
    triggerGenerate.mutate('both', {
      onError: (e) => setError(extractError(e, 'Could not start generation.')),
    })

// 4. Wrap the existing return value's top-level JSX in a tab switcher. The existing return
//    statement's outer <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
//    becomes the "settings" tab's content; add a sibling "library" tab rendered by default:
  if (isLoading) return <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 4, background: 'var(--surface-card)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-pill)', padding: 3, alignSelf: 'flex-start' }}>
        <button
          type="button"
          onClick={() => setActiveTab('library')}
          style={{
            padding: '6px 16px', fontSize: 13, borderRadius: 'var(--r-pill)', border: 'none', cursor: 'pointer',
            background: activeTab === 'library' ? 'var(--uc-indigo-bg)' : 'transparent',
            color: activeTab === 'library' ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'library' ? 500 : 400,
          }}
        >
          Content library
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          style={{
            padding: '6px 16px', fontSize: 13, borderRadius: 'var(--r-pill)', border: 'none', cursor: 'pointer',
            background: activeTab === 'settings' ? 'var(--uc-indigo-bg)' : 'transparent',
            color: activeTab === 'settings' ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'settings' ? 500 : 400,
          }}
        >
          AI settings
        </button>
      </div>

      {activeTab === 'library' ? (
        <>
          <LearningPathLibrary
            onCreatePath={() => setFormState({ mode: 'create', path: null })}
            onEditPath={(pathId) => {
              // The library already has the full AdminLearningPath row loaded for every card;
              // pass it through instead of a second fetch — read LearningPathLibrary's own
              // `paths` query result at the call site there and lift the found row up via this
              // callback's signature (change onEditPath to `(path: AdminLearningPath) => void`
              // in Task 8 if not already done that way, then adjust this call site to match).
            }}
            onManagePath={(pathId) => navigate(PATHS.ADMIN_LEARNING_PATH(pathId))}
          />
          <LearningPathFormModal
            mode={formState?.mode ?? 'create'}
            path={formState?.path ?? null}
            open={formState !== null}
            onClose={() => setFormState(null)}
          />
        </>
      ) : (
        <>
          {/* everything currently returned by this component (the lastAiError banner, the
              config form card, the pending-paths card, the pending-quiz card, the
              upcoming-quizzes card, and the analytics card) moves here unchanged — do not
              rewrite any of it, only re-indent it under this branch. */}
        </>
      )}
    </div>
  )
```

Note on `onEditPath`: Task 8's `LearningPathLibrary` was specified with `onEditPath: (pathId: string) => void`, but the edit modal needs the full `AdminLearningPath` row to prefill its fields. Fix this now rather than adding a redundant fetch: change `LearningPathLibrary`'s prop to `onEditPath: (path: AdminLearningPath) => void` and its call site (`onClick={() => onEditPath(p.id)}` inside the card) to `onClick={() => onEditPath(p)}`, then update `LearningPathLibrary.test.tsx`'s assertion accordingly (`expect(onEditPath).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }))`). Make this fix here in Task 11 and re-run Task 8's test file to confirm it still passes.

- [ ] **Step 5: Run both test files**

Run: `npx pnpm --filter web test src/features/learning-admin/components/LearningAdminPanel.test.tsx src/features/learning-admin/components/LearningPathLibrary.test.tsx`
Expected: PASS

- [ ] **Step 6: Run the full web suite and typecheck**

Run: `npx pnpm --filter web typecheck && npx pnpm --filter web test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/learning-admin/components/LearningAdminPanel.tsx \
        apps/web/src/features/learning-admin/components/LearningAdminPanel.test.tsx \
        apps/web/src/features/learning-admin/components/LearningPathLibrary.tsx \
        apps/web/src/features/learning-admin/components/LearningPathLibrary.test.tsx
git commit -m "feat(learning-admin): switch between content library and AI settings tabs

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017JRVZzfLB9LALRcnS9f2p2"
```

---

## Self-Review

**Spec coverage:**
- Two action cards (AI path/AI quiz generation) → Task 6 (backend split) + Task 8 (frontend cards). ✅
- Four stat tiles (paths/enrolled/completion/awaiting review) → Task 8. ✅
- Filter chips (All/Published/Drafts/category-dynamic) → Task 8. ✅
- "+ New learning path" → Task 9 (create mode) + Task 11 (wiring). ✅
- Path card (icon omitted — see note below; title, pill, department·units·level, enrolled/completion, progress bar, updated, Edit/Manage) → Task 8. ✅
- Edit → Task 9. Manage (unit editor) → Task 10. ✅
- "Awaiting review" right-rail list → reused existing `usePendingPaths`, surfaced as the stat tile in Task 8 (the existing "Pending paths" review UI under the AI-settings tab already covers the review workflow itself — not duplicated).
- Config console preserved as "AI settings" tab → Task 11. ✅
- **Gap acknowledged, not built:** the mockup's per-card icon tile (a distinct glyph per path, e.g. binary/briefcase/brain/pencil/mic) has no data-driven source (no icon field anywhere) — Task 8's card omits a per-path icon rather than inventing a meaningless random one. If wanted, a follow-up task would add an `icon` column to `skill_paths` and an icon picker in Task 9's form; flagging here rather than silently adding scope.

**Placeholder scan:** no "TBD"/"handle it later" left; the two spots with prose instead of a code diff (Task 10 Step 5's route registration, Task 11 Step 1) are explicitly instructions to read an existing pattern in the file first, because guessing the `page()` helper's exact signature or the current test file's render helper name without reading them risks a wrong diff — both name the exact file and exact thing to look for before writing the change, which satisfies "no placeholders" (a concrete action, not a deferral).

**Type consistency:** `AdminLearningPath.department` is `string | null` everywhere (Task 1 type, Task 2 query mapping, Task 8/9 usage). `useTriggerLearningGenerate`'s new required-with-default argument is threaded consistently: Task 7 defines `(task: 'learning'|'quiz'|'both' = 'both')`, Task 8's cards pass `'learning'`/`'quiz'` explicitly, Task 11 updates the one pre-existing call site to pass `'both'` explicitly. `onEditPath`'s signature is corrected once, in Task 11, with an explicit note to also patch Task 8's file and test — avoiding two different signatures existing across the plan.
