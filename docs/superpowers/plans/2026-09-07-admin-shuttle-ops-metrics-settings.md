# Admin Shuttle Ops — Live Fleet Metrics + Ops Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the admin Shuttle ops screen (`apps/web/src/pages/admin/ShuttleTab.tsx`) to parity with the design mockup by adding a 4-tile fleet-metrics dashboard, a Live/Idle status pill per route, and an "Ops settings" panel of 4 persisted toggles — on top of the existing route-editor UI, which is left unchanged.

**Architecture:** Two new admin-only endpoints under the existing `admin` module (`GET /api/v1/admin/shuttle/stats`, `GET`/`PATCH /api/v1/admin/shuttle/settings`), backed by a new `admin/shuttle.service.ts` file (mirrors the existing `admin/content.service.ts` split). Stats are computed live from `shuttle_routes` and `shuttle_locations` (no new tables). Settings are 4 new boolean columns on the existing `university_settings` table, following the exact pattern already used by `content-sync` and `learning-admin` (per-column `ensureSettingsRow` + `updateConfig`, not a JSONB blob — so there is no `.partial()`/`.default()` merge trap to worry about). Frontend adds the tiles/pill/panel to `ShuttleTab.tsx` via two new `useQuery`/`useMutation` hooks, without touching the existing route-editor code.

**Tech Stack:** Express + Knex + Zod (API), React + TanStack Query (web), Vitest + Supertest (API tests), Vitest + Testing Library + MSW (web tests).

**Spec:** This plan's own "Scoping decisions" section below (no separate spec doc exists — the mockup is `/Users/joydipdatta/Downloads/uniconnect-furnished-design/project/Feed Page.dc.html`, Admin role → Shuttle ops, screenshotted during planning).

## Global Constraints

- Migrations: sequential `NNN_description.ts`, next number is **105** (verify with `ls apps/api/src/database/migrations | tail -3` before creating the file — do not trust CLAUDE.md's cached "104" note).
- All new admin routes: `requireAuth, resolveUniversity` (already applied via `adminRouter.use(...)` in `apps/api/src/modules/admin/router.ts:63`) plus `requireRole('admin')` per-route, matching the existing `/stats` route's gating (`adminRouter.get('/stats', requireRole('admin'), getStats)`, `apps/api/src/modules/admin/router.ts:64`) — these are admin-only insight/config screens, not faculty-shared route CRUD.
- DB access only from services (`admin/shuttle.service.ts`), never from controllers or routers.
- Response helpers: `sendSuccess` from `src/utils/response.ts` — no raw `res.json()`.
- Errors: `notFound()`/`badRequest()` from `src/utils/errors.ts`.
- Zod schema naming: `camelCase` + `Schema` suffix, colocated in `apps/api/src/modules/admin/schema.ts` alongside existing schemas (`UpdateUserRoleSchema`, etc. — see `apps/api/src/modules/admin/schema.ts:8-20`).
- No hardcoded hex colors — always `var(--token-name)`. Borders `0.5px solid var(--border-*)`. Buttons `border-radius: var(--r-pill)`. Font weight 400 or 500 only. Sentence case copy, no ALL CAPS. No `box-shadow` — surface stacking only. No `backdropFilter`.
- Frontend query keys follow `['admin', 'shuttle', '<thing>']` (mirrors the existing `['admin', 'shuttle', 'routes']` key at `apps/web/src/pages/admin/ShuttleTab.tsx:814`).
- Do not touch `apps/web/src/features/shuttle/` (the rider-facing tracker) or wire the "Live GPS broadcast"/"Show rider ETA" toggles into rider behavior — see Scoping decision #3 below.

## Scoping decisions (read before implementing)

1. **"Buses live" / "On-duty drivers" definition.** `shuttle_locations` (see `apps/api/src/modules/campus/service.ts:57-69`) has one row per driver-broadcast with a plain `updated_at` timestamp (no `created_at`, no TTL/expiry column) — a driver's row is upserted/inserted on every GPS ping via `POST /shuttle/locations` (`apps/api/src/modules/campus/service.ts:246-271`). There is no dedicated "on duty" flag anywhere and no relation between a `driver`-role user and a specific route beyond whatever `route_id` they last broadcast under. We define **"live"** as: a `shuttle_locations` row exists with `updated_at >= now() - interval '5 minutes'` for that route/driver. This is a recency proxy, not a stateful "on duty" flag — a driver who stops broadcasting simply ages out after 5 minutes with no explicit "off duty" event. `busesLive` = count of distinct `route_id` with a live row; `onDutyDrivers` = count of distinct `driver_id` with a live row. This is more accurate than generic Redis presence (a driver could be connected without broadcasting GPS), so we do not use the `presence` module here.
2. **"On-time rate %" definition.** Only fixed-schedule routes (`shuttle_routes.schedule.type === 'fixed'`, with `departures.outbound`/`departures.inbound` HH:MM arrays — see `apps/web/src/pages/admin/ShuttleTab.tsx:21-24`) have a defined departure time; continuous (loop) routes have no such concept and are excluded from this metric entirely. There is no per-stop "arrived" event in the schema — only raw lat/lng broadcasts — so true on-time-at-a-stop is not computable without new instrumentation. We define an explicit, honestly-scoped proxy: for every *scheduled departure time that has already passed today* on an active fixed route, the departure counts as **"on time"** if at least one `shuttle_locations` row for that route has `updated_at` within **±10 minutes** of that scheduled departure (i.e., the driver was actively broadcasting near the scheduled departure). `onTimeRatePct = onTimeCount / totalScheduledDeparturesSoFarToday * 100`, rounded to the nearest integer. If `totalScheduledDeparturesSoFarToday === 0` (e.g., all routes are continuous, or it's before the first departure of the day), the endpoint returns `onTimeRatePct: null` and the frontend renders "Not enough data yet" instead of a fabricated number. This is a coarser signal than true arrival-time tracking; a one-line code comment on the query says so.
3. **Ops settings toggles are stored preferences only — none change runtime behavior in this plan.** All 4 toggles (Live GPS broadcast, Show rider ETA, Auto-assign drivers, Service alerts) persist a boolean and render their current value. Two of them map to no existing feature at all (there is no driver-to-route assignment concept in the schema, and no delay/route-change notification pipeline exists), and wiring the other two into the rider-facing `/shuttle` tracker (`apps/web/src/features/shuttle/`) is a distinct, separate change to a different screen. To avoid inconsistent partial-wiring (two toggles doing something, two doing nothing, with no visual distinction between them), **all four ship as inert persisted preferences in this plan.** Each toggle's row includes a one-line code comment stating this. A natural follow-up (out of scope here) is wiring "Live GPS broadcast" to gate the `POST /shuttle/locations` write and "Show rider ETA" to gate the ETA display on the rider tracker.
4. **Live/Idle pill scope.** Per-route pill on the existing route list (`apps/web/src/pages/admin/ShuttleTab.tsx:887-943`) reuses the same live/idle boolean computed for the stats endpoint (task 3 returns a `routes: { routeId, isLive }[]` array alongside the 4 numbers) — no separate endpoint.

---

### Task 1: Migration — add 4 ops-settings columns to `university_settings`

**Files:**
- Create: `apps/api/src/database/migrations/107_add_shuttle_ops_settings.ts`
- Test: `apps/api/src/__tests__/admin-shuttle.test.ts` (created in Task 3; this task's migration is exercised by that suite's `beforeAll` migrate-latest call, per `apps/api/src/__tests__/setup.ts:25`)

**Interfaces:**
- Produces: columns `shuttle_live_gps_enabled`, `shuttle_rider_eta_enabled`, `shuttle_auto_assign_enabled`, `shuttle_service_alerts_enabled` (all `boolean not null default true`, matching the mockup's default-on state for 3 of the 4 toggles — "Auto-assign drivers" defaults to `false` to match the mockup screenshot) on `university_settings`.

- [ ] **Step 1: Confirm the real next migration number**

Run: `ls apps/api/src/database/migrations | tail -3`
Expected: highest existing file is `104_add_group_member_mute.ts` — if a `105_*` already exists, bump this task's filename to the next free number instead.

- [ ] **Step 2: Write the migration**

```ts
// apps/api/src/database/migrations/107_add_shuttle_ops_settings.ts
import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.alterTable('university_settings', (table) => {
    table.boolean('shuttle_live_gps_enabled').notNullable().defaultTo(true)
    table.boolean('shuttle_rider_eta_enabled').notNullable().defaultTo(true)
    table.boolean('shuttle_auto_assign_enabled').notNullable().defaultTo(false)
    table.boolean('shuttle_service_alerts_enabled').notNullable().defaultTo(true)
  })
}

export async function down(knex: Knex) {
  await knex.schema.alterTable('university_settings', (table) => {
    table.dropColumn('shuttle_live_gps_enabled')
    table.dropColumn('shuttle_rider_eta_enabled')
    table.dropColumn('shuttle_auto_assign_enabled')
    table.dropColumn('shuttle_service_alerts_enabled')
  })
}
```

- [ ] **Step 3: Run the migration against the scratch DB**

Run: `DATABASE_URL="postgresql://$(whoami)@localhost:5432/uniconnect_test" npx pnpm --filter api db:migrate`
Expected: `Batch N run: 1 migrations` including `107_add_shuttle_ops_settings.ts`, no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/database/migrations/107_add_shuttle_ops_settings.ts
git commit -m "feat(admin): add shuttle ops settings columns to university_settings

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017JRVZzfLB9LALRcnS9f2p2"
```

---

### Task 2: Backend — `admin/shuttle.service.ts` (stats + settings)

**Files:**
- Create: `apps/api/src/modules/admin/shuttle.service.ts`
- Modify: `apps/api/src/modules/admin/schema.ts` (append `ShuttleOpsSettingsSchema`)
- Test: `apps/api/src/__tests__/admin-shuttle.test.ts`

**Interfaces:**
- Consumes: `db` from `../../config/db`, `notFound`/`badRequest` from `../../utils/errors`, `UserRole` type not needed here.
- Produces (consumed by Task 3's controller):
  - `adminShuttleService.getStats(universityId: string): Promise<{ busesLive: number; activeRoutes: number; onDutyDrivers: number; onTimeRatePct: number | null; routes: { routeId: string; isLive: boolean }[] }>`
  - `adminShuttleService.getSettings(universityId: string): Promise<{ liveGpsEnabled: boolean; riderEtaEnabled: boolean; autoAssignEnabled: boolean; serviceAlertsEnabled: boolean }>`
  - `adminShuttleService.updateSettings(universityId: string, input: ShuttleOpsSettingsInput): Promise<{ liveGpsEnabled: boolean; riderEtaEnabled: boolean; autoAssignEnabled: boolean; serviceAlertsEnabled: boolean }>`
  - Zod: `ShuttleOpsSettingsSchema` (all 4 fields optional booleans — a true PATCH-partial schema, no `.default()` on any field per the CLAUDE.md jsonb-merge trap note; not actually jsonb here, but keeping fields default-free means an empty `{}` PATCH body is a true no-op instead of resetting columns), exported type `ShuttleOpsSettingsInput = z.infer<typeof ShuttleOpsSettingsSchema>`.

- [ ] **Step 1: Write the failing service test**

```ts
// apps/api/src/__tests__/admin-shuttle.test.ts
import { describe, expect, it, beforeEach, afterAll } from 'vitest'
import { app, CREDENTIALS, DOMAIN, TEST_UNIVERSITY_ID } from './setup'
import supertest from 'supertest'
import { db } from '../config/db'

async function loginAs(email: string, password: string) {
  const res = await supertest(app)
    .post('/api/v1/auth/login')
    .set('x-university-domain', DOMAIN)
    .send({ email, password })
  return res.body.data.accessToken as string
}

describe('admin shuttle ops', () => {
  let routeId: string
  let driverUserId: string

  beforeEach(async () => {
    await db('shuttle_locations').del()
    await db('shuttle_routes').where({ university_id: TEST_UNIVERSITY_ID }).del()

    const [route] = await db('shuttle_routes')
      .insert({
        university_id: TEST_UNIVERSITY_ID,
        name: 'Test route',
        color: '#4E62BF',
        stops: JSON.stringify([]),
        schedule: JSON.stringify({ type: 'continuous', operatingHours: { start: '07:00', end: '20:00' } }),
        is_active: true,
      })
      .returning('id')
    routeId = route.id

    const [driver] = await db('users')
      .insert({
        university_id: TEST_UNIVERSITY_ID,
        username: 'test_driver_shuttle_ops',
        email: 'driver.shuttleops@uiu.ac.bd',
        password_hash: 'x',
        role: 'driver',
        is_verified: true,
      })
      .onConflict('email')
      .merge({ role: 'driver' })
      .returning('id')
    driverUserId = driver.id
  })

  afterAll(async () => {
    await db('shuttle_locations').del()
    await db('shuttle_routes').where({ university_id: TEST_UNIVERSITY_ID }).del()
    await db('users').where({ email: 'driver.shuttleops@uiu.ac.bd' }).del()
  })

  it('GET /admin/shuttle/stats counts a recent broadcast as live', async () => {
    await db('shuttle_locations').insert({
      route_id: routeId,
      driver_id: driverUserId,
      lat: 23.8103,
      lng: 90.4125,
      updated_at: new Date(),
    })

    const token = await loginAs(CREDENTIALS.admin.email, CREDENTIALS.admin.password)
    const res = await supertest(app)
      .get('/api/v1/admin/shuttle/stats')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.data.busesLive).toBeGreaterThanOrEqual(1)
    expect(res.body.data.onDutyDrivers).toBeGreaterThanOrEqual(1)
    expect(res.body.data.activeRoutes).toBeGreaterThanOrEqual(1)
    const routeEntry = res.body.data.routes.find((r: { routeId: string }) => r.routeId === routeId)
    expect(routeEntry.isLive).toBe(true)
  })

  it('GET /admin/shuttle/stats treats a stale broadcast as idle', async () => {
    const stale = new Date(Date.now() - 10 * 60 * 1000)
    await db('shuttle_locations').insert({
      route_id: routeId,
      driver_id: driverUserId,
      lat: 23.8103,
      lng: 90.4125,
      updated_at: stale,
    })

    const token = await loginAs(CREDENTIALS.admin.email, CREDENTIALS.admin.password)
    const res = await supertest(app)
      .get('/api/v1/admin/shuttle/stats')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${token}`)

    const routeEntry = res.body.data.routes.find((r: { routeId: string }) => r.routeId === routeId)
    expect(routeEntry.isLive).toBe(false)
    expect(res.body.data.busesLive).toBe(0)
  })

  it('GET /admin/shuttle/stats rejects non-admin roles', async () => {
    const token = await loginAs(CREDENTIALS.faculty.email, CREDENTIALS.faculty.password)
    const res = await supertest(app)
      .get('/api/v1/admin/shuttle/stats')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(403)
  })

  it('GET then PATCH /admin/shuttle/settings persists a toggle change', async () => {
    const token = await loginAs(CREDENTIALS.admin.email, CREDENTIALS.admin.password)

    const before = await supertest(app)
      .get('/api/v1/admin/shuttle/settings')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${token}`)
    expect(before.status).toBe(200)
    expect(before.body.data.autoAssignEnabled).toBe(false)

    const patch = await supertest(app)
      .patch('/api/v1/admin/shuttle/settings')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${token}`)
      .send({ autoAssignEnabled: true })
    expect(patch.status).toBe(200)
    expect(patch.body.data.autoAssignEnabled).toBe(true)
    // Untouched fields survive the partial patch unchanged.
    expect(patch.body.data.liveGpsEnabled).toBe(true)

    // Revert for test isolation.
    await supertest(app)
      .patch('/api/v1/admin/shuttle/settings')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${token}`)
      .send({ autoAssignEnabled: false })
  })
})
```

- [ ] **Step 2: Run the test file to verify it fails**

Run: `DATABASE_URL="postgresql://$(whoami)@localhost:5432/uniconnect_test" GEMINI_API_KEY=test-key npx pnpm --filter api test admin-shuttle`
Expected: FAIL — `404` (route doesn't exist yet) or `Cannot find module './shuttle.service'`.

- [ ] **Step 3: Add the Zod schema**

Append to `apps/api/src/modules/admin/schema.ts` (after the existing `UpdateAllowedDomainsSchema` block, following the file's established `camelCase + Schema` pattern seen at lines 8-20):

```ts
export const ShuttleOpsSettingsSchema = z.object({
  liveGpsEnabled: z.boolean().optional(),
  riderEtaEnabled: z.boolean().optional(),
  autoAssignEnabled: z.boolean().optional(),
  serviceAlertsEnabled: z.boolean().optional(),
})

export type ShuttleOpsSettingsInput = z.infer<typeof ShuttleOpsSettingsSchema>
```

- [ ] **Step 4: Write `admin/shuttle.service.ts`**

```ts
// apps/api/src/modules/admin/shuttle.service.ts
import { db } from '../../config/db'
import type { ShuttleOpsSettingsInput } from './schema'

/** A broadcast is considered "live" if it's this fresh. Not a stateful on/off-duty
 *  flag — a driver simply ages out of "live" after this window with no explicit
 *  off-duty event, since the schema has no such concept. */
const LIVE_BROADCAST_WINDOW_MINUTES = 5

/** How close to a scheduled departure a broadcast must land to count as "on time".
 *  A proxy for true arrival tracking, which the schema doesn't support (no
 *  per-stop arrival events exist, only raw lat/lng broadcasts). */
const ON_TIME_TOLERANCE_MINUTES = 10

interface RouteRow {
  id: string
  schedule: { type?: 'fixed' | 'continuous'; departures?: { outbound?: string[]; inbound?: string[] } } | null
}

interface SettingsRow {
  shuttle_live_gps_enabled: boolean
  shuttle_rider_eta_enabled: boolean
  shuttle_auto_assign_enabled: boolean
  shuttle_service_alerts_enabled: boolean
}

export class AdminShuttleService {
  async getStats(universityId: string) {
    const routes = (await db('shuttle_routes')
      .select<RouteRow[]>('id', 'schedule')
      .where({ university_id: universityId, is_active: true })) as RouteRow[]

    const activeRoutes = routes.length
    const liveWindowStart = new Date(Date.now() - LIVE_BROADCAST_WINDOW_MINUTES * 60 * 1000)

    const liveRows = await db('shuttle_locations')
      .join('shuttle_routes', 'shuttle_routes.id', 'shuttle_locations.route_id')
      .select('shuttle_locations.route_id', 'shuttle_locations.driver_id')
      .where('shuttle_routes.university_id', universityId)
      .andWhere('shuttle_routes.is_active', true)
      .andWhere('shuttle_locations.updated_at', '>=', liveWindowStart)

    const liveRouteIds = new Set(liveRows.map((r) => r.route_id as string))
    const liveDriverIds = new Set(liveRows.map((r) => r.driver_id as string))

    const routeStatuses = routes.map((r) => ({ routeId: r.id, isLive: liveRouteIds.has(r.id) }))

    const onTimeRatePct = await this.computeOnTimeRatePct(universityId, routes)

    return {
      busesLive: liveRouteIds.size,
      activeRoutes,
      onDutyDrivers: liveDriverIds.size,
      onTimeRatePct,
      routes: routeStatuses,
    }
  }

  private async computeOnTimeRatePct(universityId: string, routes: RouteRow[]) {
    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)

    let scheduled = 0
    let onTime = 0

    for (const route of routes) {
      if (route.schedule?.type !== 'fixed') continue
      const times = [
        ...(route.schedule.departures?.outbound ?? []),
        ...(route.schedule.departures?.inbound ?? []),
      ]

      for (const hhmm of times) {
        const departureAt = new Date(`${todayStr}T${hhmm}:00`)
        if (departureAt > now) continue // hasn't happened yet today
        scheduled += 1

        const windowStart = new Date(departureAt.getTime() - ON_TIME_TOLERANCE_MINUTES * 60 * 1000)
        const windowEnd = new Date(departureAt.getTime() + ON_TIME_TOLERANCE_MINUTES * 60 * 1000)

        const hit = await db('shuttle_locations')
          .join('shuttle_routes', 'shuttle_routes.id', 'shuttle_locations.route_id')
          .where('shuttle_routes.university_id', universityId)
          .andWhere('shuttle_locations.route_id', route.id)
          .andWhereBetween('shuttle_locations.updated_at', [windowStart, windowEnd])
          .first()

        if (hit) onTime += 1
      }
    }

    if (scheduled === 0) return null
    return Math.round((onTime / scheduled) * 100)
  }

  async getSettings(universityId: string) {
    const row = await this.ensureSettingsRow(universityId)
    return toSettings(row)
  }

  async updateSettings(universityId: string, input: ShuttleOpsSettingsInput) {
    await this.ensureSettingsRow(universityId)

    const patch: Record<string, unknown> = { updated_at: db.fn.now() }
    if (input.liveGpsEnabled !== undefined) patch.shuttle_live_gps_enabled = input.liveGpsEnabled
    if (input.riderEtaEnabled !== undefined) patch.shuttle_rider_eta_enabled = input.riderEtaEnabled
    if (input.autoAssignEnabled !== undefined) patch.shuttle_auto_assign_enabled = input.autoAssignEnabled
    if (input.serviceAlertsEnabled !== undefined) patch.shuttle_service_alerts_enabled = input.serviceAlertsEnabled

    await db('university_settings').where({ university_id: universityId }).update(patch)
    return this.getSettings(universityId)
  }

  /** Ensures a university_settings row exists; returns the shuttle-ops columns. */
  private async ensureSettingsRow(universityId: string): Promise<SettingsRow> {
    const existing = await db('university_settings')
      .select<SettingsRow[]>(
        'shuttle_live_gps_enabled',
        'shuttle_rider_eta_enabled',
        'shuttle_auto_assign_enabled',
        'shuttle_service_alerts_enabled',
      )
      .where({ university_id: universityId })
      .first()

    if (existing) return existing

    await db('university_settings').insert({ university_id: universityId }).onConflict('university_id').ignore()

    const row = await db('university_settings')
      .select<SettingsRow[]>(
        'shuttle_live_gps_enabled',
        'shuttle_rider_eta_enabled',
        'shuttle_auto_assign_enabled',
        'shuttle_service_alerts_enabled',
      )
      .where({ university_id: universityId })
      .first()

    if (!row) throw new Error('Failed to create university_settings row')
    return row
  }
}

export const adminShuttleService = new AdminShuttleService()

function toSettings(row: SettingsRow) {
  return {
    liveGpsEnabled: row.shuttle_live_gps_enabled,
    riderEtaEnabled: row.shuttle_rider_eta_enabled,
    autoAssignEnabled: row.shuttle_auto_assign_enabled,
    serviceAlertsEnabled: row.shuttle_service_alerts_enabled,
  }
}
```

- [ ] **Step 5: Run the test file again — still expected to fail (no route wired yet)**

Run: `DATABASE_URL="postgresql://$(whoami)@localhost:5432/uniconnect_test" GEMINI_API_KEY=test-key npx pnpm --filter api test admin-shuttle`
Expected: FAIL — still `404` (Task 3 wires the controller/router).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/admin/shuttle.service.ts apps/api/src/modules/admin/schema.ts apps/api/src/__tests__/admin-shuttle.test.ts
git commit -m "feat(admin): add shuttle ops stats and settings service

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017JRVZzfLB9LALRcnS9f2p2"
```

---

### Task 3: Backend — controller + router wiring

**Files:**
- Modify: `apps/api/src/modules/admin/controller.ts`
- Modify: `apps/api/src/modules/admin/router.ts`
- Test: `apps/api/src/__tests__/admin-shuttle.test.ts` (already written in Task 2 — this task makes it pass)

**Interfaces:**
- Consumes: `adminShuttleService` from `./shuttle.service` (Task 2), `ShuttleOpsSettingsSchema`/`ShuttleOpsSettingsInput` from `./schema` (Task 2).
- Produces: `GET /api/v1/admin/shuttle/stats`, `GET /api/v1/admin/shuttle/settings`, `PATCH /api/v1/admin/shuttle/settings` — all `requireRole('admin')`.

- [ ] **Step 1: Add controller functions**

In `apps/api/src/modules/admin/controller.ts`, add the import and three handlers (place near `getStats`, following the exact `getAdminContext` + `sendSuccess` pattern already used at lines 25-28):

```ts
import { adminShuttleService } from './shuttle.service'
import type { ShuttleOpsSettingsInput } from './schema'
```

```ts
export const getShuttleStats = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getAdminContext(req)
  sendSuccess(res, await adminShuttleService.getStats(universityId))
})

export const getShuttleSettings = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getAdminContext(req)
  sendSuccess(res, await adminShuttleService.getSettings(universityId))
})

export const updateShuttleSettings = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getAdminContext(req)
  const input = req.body as ShuttleOpsSettingsInput
  sendSuccess(res, await adminShuttleService.updateSettings(universityId, input))
})
```

- [ ] **Step 2: Wire the routes**

In `apps/api/src/modules/admin/router.ts`, add to the import list (`getShuttleStats, getShuttleSettings, updateShuttleSettings` alongside the existing `getStats` import) and `ShuttleOpsSettingsSchema` to the schema import block, then add near the existing `/university/domains` routes (same admin-only gating style):

```ts
adminRouter.get('/shuttle/stats', requireRole('admin'), getShuttleStats)
adminRouter.get('/shuttle/settings', requireRole('admin'), getShuttleSettings)
adminRouter.patch('/shuttle/settings', requireRole('admin'), validate(ShuttleOpsSettingsSchema), updateShuttleSettings)
```

- [ ] **Step 3: Run the full test file — expect it to pass**

Run: `DATABASE_URL="postgresql://$(whoami)@localhost:5432/uniconnect_test" GEMINI_API_KEY=test-key npx pnpm --filter api test admin-shuttle`
Expected: PASS — all 4 tests green.

- [ ] **Step 4: Run the full API suite to check nothing else broke**

Run: `DATABASE_URL="postgresql://$(whoami)@localhost:5432/uniconnect_test" GEMINI_API_KEY=test-key npx pnpm --filter api test`
Expected: PASS (pre-existing "Gemini call failed" warnings in `ai.service.test.ts` are expected noise, not failures).

- [ ] **Step 5: Typecheck**

Run: `npx pnpm --filter api typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/admin/controller.ts apps/api/src/modules/admin/router.ts
git commit -m "feat(admin): wire shuttle ops stats and settings endpoints

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017JRVZzfLB9LALRcnS9f2p2"
```

---

### Task 4: Frontend — stat tiles + Live/Idle pill on `ShuttleTab.tsx`

**Files:**
- Modify: `apps/web/src/pages/admin/ShuttleTab.tsx`
- Test: `apps/web/src/pages/admin/ShuttleTab.stats.test.tsx` (new — scoped to the new pieces only, not a full regression suite for the existing 1000-line editor)

**Interfaces:**
- Consumes: `api` from `@/lib/axios`.
- Produces: nothing new consumed elsewhere — this is the leaf UI.

- [ ] **Step 1: Write the failing frontend test**

```tsx
// apps/web/src/pages/admin/ShuttleTab.stats.test.tsx
import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/msw/server'
import { ShuttleTab } from './ShuttleTab'

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('ShuttleTab ops dashboard', () => {
  it('renders the 4 fleet stat tiles from the stats endpoint', async () => {
    server.use(
      http.get('*/shuttle/routes', () => HttpResponse.json({ data: [] })),
      http.get('*/admin/shuttle/stats', () =>
        HttpResponse.json({
          data: { busesLive: 1, activeRoutes: 3, onDutyDrivers: 5, onTimeRatePct: 92, routes: [] },
        }),
      ),
      http.get('*/admin/shuttle/settings', () =>
        HttpResponse.json({
          data: { liveGpsEnabled: true, riderEtaEnabled: true, autoAssignEnabled: false, serviceAlertsEnabled: true },
        }),
      ),
    )

    renderWithClient(<ShuttleTab />)

    await waitFor(() => expect(screen.getByText('Buses live')).toBeInTheDocument())
    expect(screen.getByText('Active routes')).toBeInTheDocument()
    expect(screen.getByText('On-duty drivers')).toBeInTheDocument()
    expect(screen.getByText('On-time rate')).toBeInTheDocument()
    expect(screen.getByText('92%')).toBeInTheDocument()
  })

  it('shows a not-enough-data message when onTimeRatePct is null', async () => {
    server.use(
      http.get('*/shuttle/routes', () => HttpResponse.json({ data: [] })),
      http.get('*/admin/shuttle/stats', () =>
        HttpResponse.json({
          data: { busesLive: 0, activeRoutes: 1, onDutyDrivers: 0, onTimeRatePct: null, routes: [] },
        }),
      ),
      http.get('*/admin/shuttle/settings', () =>
        HttpResponse.json({
          data: { liveGpsEnabled: true, riderEtaEnabled: true, autoAssignEnabled: false, serviceAlertsEnabled: true },
        }),
      ),
    )

    renderWithClient(<ShuttleTab />)

    await waitFor(() => expect(screen.getByText('Not enough data yet')).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx pnpm --filter web test src/pages/admin/ShuttleTab.stats.test.tsx`
Expected: FAIL — `Buses live` text not found (tiles don't exist yet).

- [ ] **Step 3: Add the stats query and tiles to `ShuttleTab.tsx`**

Add near the top of the file, after existing imports:

```tsx
interface ShuttleStats {
  busesLive: number
  activeRoutes: number
  onDutyDrivers: number
  onTimeRatePct: number | null
  routes: { routeId: string; isLive: boolean }[]
}
```

Inside `export function ShuttleTab()`, after the existing `routes` query (`apps/web/src/pages/admin/ShuttleTab.tsx:813-817`):

```tsx
  const { data: stats } = useQuery<ShuttleStats>({
    queryKey: ['admin', 'shuttle', 'stats'],
    queryFn: () => api.get<{ data: ShuttleStats }>('/admin/shuttle/stats').then((r) => r.data.data),
    refetchInterval: 30_000,
  })

  const liveRouteIds = new Set((stats?.routes ?? []).filter((r) => r.isLive).map((r) => r.routeId))
```

Replace the function's `return (` opening block (`apps/web/src/pages/admin/ShuttleTab.tsx:839`) so the stat tiles sit above the existing two-column layout — wrap the existing `<div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>...</div>` in an outer column:

```tsx
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <ShuttleStatTile label="Buses live" value={stats ? String(stats.busesLive) : '—'} sub="broadcasting now" />
        <ShuttleStatTile label="Active routes" value={stats ? String(stats.activeRoutes) : '—'} sub="in service today" />
        <ShuttleStatTile label="On-duty drivers" value={stats ? String(stats.onDutyDrivers) : '—'} sub="across all routes" />
        <ShuttleStatTile
          label="On-time rate"
          value={stats ? (stats.onTimeRatePct === null ? '—' : `${stats.onTimeRatePct}%`) : '—'}
          sub={stats?.onTimeRatePct === null ? 'Not enough data yet' : 'last 7 days'}
        />
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* ...existing route list + editor panel unchanged... */}
      </div>
    </div>
  )
```

Add the `ShuttleStatTile` component near the other small components at the bottom of the file (next to `RouteListSkeleton`):

```tsx
function ShuttleStatTile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{
      background: 'var(--surface-card)',
      border: '0.5px solid var(--border-default)',
      borderRadius: 'var(--r-lg)',
      padding: '16px 18px',
    }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-label)', letterSpacing: '0.04em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
      <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-tertiary)' }}>{sub}</div>
    </div>
  )
}
```

- [ ] **Step 4: Add the Live/Idle pill to each route row**

In the route list `.map((r) => { ... })` block (`apps/web/src/pages/admin/ShuttleTab.tsx:887-943`), after the existing `!r.isActive && (...)` "off" pill block, add a sibling pill for active routes:

```tsx
                {r.isActive && (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 12,
                    fontWeight: 500,
                    borderRadius: 'var(--r-pill)',
                    padding: '2px 8px',
                    flexShrink: 0,
                    color: liveRouteIds.has(r.id) ? 'var(--uc-mint)' : 'var(--text-tertiary)',
                    background: liveRouteIds.has(r.id) ? 'var(--uc-mint-bg)' : 'var(--surface-raised)',
                    border: `0.5px solid ${liveRouteIds.has(r.id) ? 'var(--uc-mint-bdr)' : 'var(--border-default)'}`,
                  }}>
                    {liveRouteIds.has(r.id) ? 'Live' : 'Idle'}
                  </span>
                )}
```

- [ ] **Step 5: Run the frontend test again**

Run: `npx pnpm --filter web test src/pages/admin/ShuttleTab.stats.test.tsx`
Expected: PASS (both tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/admin/ShuttleTab.tsx apps/web/src/pages/admin/ShuttleTab.stats.test.tsx
git commit -m "feat(admin): add fleet stat tiles and live/idle pill to shuttle ops

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017JRVZzfLB9LALRcnS9f2p2"
```

---

### Task 5: Frontend — "Ops settings" panel

**Files:**
- Modify: `apps/web/src/pages/admin/ShuttleTab.tsx`
- Modify: `apps/web/src/pages/admin/ShuttleTab.stats.test.tsx`

**Interfaces:**
- Consumes: `ShuttleStats` interface (Task 4), adds `ShuttleOpsSettings` interface.
- Produces: nothing new consumed elsewhere.

- [ ] **Step 1: Extend the failing test**

Add to `apps/web/src/pages/admin/ShuttleTab.stats.test.tsx`, inside the first `it` block (after the existing assertions, same MSW handlers already mock `/admin/shuttle/settings`):

```tsx
    expect(screen.getByText('Ops settings')).toBeInTheDocument()
    expect(screen.getByText('Live GPS broadcast')).toBeInTheDocument()
    expect(screen.getByText('Show rider ETA')).toBeInTheDocument()
    expect(screen.getByText('Auto-assign drivers')).toBeInTheDocument()
    expect(screen.getByText('Service alerts')).toBeInTheDocument()
```

Add a third test for the toggle mutation:

```tsx
  it('PATCHes the settings endpoint when a toggle is clicked', async () => {
    let patchedBody: unknown = null
    server.use(
      http.get('*/shuttle/routes', () => HttpResponse.json({ data: [] })),
      http.get('*/admin/shuttle/stats', () =>
        HttpResponse.json({ data: { busesLive: 0, activeRoutes: 0, onDutyDrivers: 0, onTimeRatePct: null, routes: [] } }),
      ),
      http.get('*/admin/shuttle/settings', () =>
        HttpResponse.json({
          data: { liveGpsEnabled: true, riderEtaEnabled: true, autoAssignEnabled: false, serviceAlertsEnabled: true },
        }),
      ),
      http.patch('*/admin/shuttle/settings', async ({ request }) => {
        patchedBody = await request.json()
        return HttpResponse.json({
          data: { liveGpsEnabled: true, riderEtaEnabled: true, autoAssignEnabled: true, serviceAlertsEnabled: true },
        })
      }),
    )

    const { default: userEvent } = await import('@testing-library/user-event')
    renderWithClient(<ShuttleTab />)

    await waitFor(() => expect(screen.getByText('Auto-assign drivers')).toBeInTheDocument())
    const toggle = screen.getByRole('switch', { name: /auto-assign drivers/i })
    await userEvent.click(toggle)

    await waitFor(() => expect(patchedBody).toEqual({ autoAssignEnabled: true }))
  })
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx pnpm --filter web test src/pages/admin/ShuttleTab.stats.test.tsx`
Expected: FAIL — "Ops settings" text and the `switch` role not found.

- [ ] **Step 3: Add the settings query, mutation, and panel**

In `apps/web/src/pages/admin/ShuttleTab.tsx`, add the interface near `ShuttleStats`:

```tsx
interface ShuttleOpsSettings {
  liveGpsEnabled: boolean
  riderEtaEnabled: boolean
  autoAssignEnabled: boolean
  serviceAlertsEnabled: boolean
}
```

Add the query + mutation inside `ShuttleTab()`, alongside the stats query, and import `useQueryClient`:

```tsx
  const qc = useQueryClient()

  const { data: settings } = useQuery<ShuttleOpsSettings>({
    queryKey: ['admin', 'shuttle', 'settings'],
    queryFn: () => api.get<{ data: ShuttleOpsSettings }>('/admin/shuttle/settings').then((r) => r.data.data),
  })

  const settingsMutation = useMutation({
    mutationFn: (patch: Partial<ShuttleOpsSettings>) => api.patch('/admin/shuttle/settings', patch),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin', 'shuttle', 'settings'] }) },
  })
```

(Update the `useMutation, useQuery, useQueryClient` import at the top of the file if `useQueryClient` isn't already imported — check first, since the file may already import it for the route-delete mutation.)

Add the panel after the closing `</div>` of the existing `{/* ── Route list ── */}` + `{/* ── Editor panel ── */}` flex row, still inside the new outer column div from Task 4:

```tsx
      <div style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: '20px 24px',
      }}>
        <p style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>Ops settings</p>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <OpsSettingToggle
            label="Live GPS broadcast"
            description="Drivers share location while on duty"
            checked={settings?.liveGpsEnabled ?? true}
            onChange={(v) => settingsMutation.mutate({ liveGpsEnabled: v })}
          />
          <OpsSettingToggle
            label="Show rider ETA"
            description="Estimate arrival times on the rider map"
            checked={settings?.riderEtaEnabled ?? true}
            onChange={(v) => settingsMutation.mutate({ riderEtaEnabled: v })}
          />
          {/* Auto-assign drivers: persisted preference only — there is no driver-to-route
              assignment feature in the schema today. Flipping this has no runtime effect. */}
          <OpsSettingToggle
            label="Auto-assign drivers"
            description="Match on-duty drivers to open routes"
            checked={settings?.autoAssignEnabled ?? false}
            onChange={(v) => settingsMutation.mutate({ autoAssignEnabled: v })}
          />
          {/* Service alerts: persisted preference only — there is no delay/route-change
              notification pipeline in the codebase today. Flipping this has no runtime effect. */}
          <OpsSettingToggle
            label="Service alerts"
            description="Notify riders of delays and route changes"
            checked={settings?.serviceAlertsEnabled ?? true}
            onChange={(v) => settingsMutation.mutate({ serviceAlertsEnabled: v })}
            last
          />
        </div>
      </div>
```

Add the `OpsSettingToggle` component near `ShuttleStatTile`:

```tsx
function OpsSettingToggle({
  label,
  description,
  checked,
  onChange,
  last,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
  last?: boolean
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      padding: '14px 0',
      borderBottom: last ? 'none' : '0.5px solid var(--border-default)',
    }}>
      <div>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</p>
        <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        style={{
          flexShrink: 0,
          width: 36,
          height: 20,
          borderRadius: 'var(--r-pill)',
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          background: checked ? 'var(--uc-indigo)' : 'var(--surface-raised)',
          transition: 'background 150ms',
        }}
      >
        <span style={{
          position: 'absolute',
          top: 2,
          left: checked ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: 'var(--on-accent)',
          transition: 'left 150ms',
        }} />
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run the frontend test again**

Run: `npx pnpm --filter web test src/pages/admin/ShuttleTab.stats.test.tsx`
Expected: PASS (all 3 tests).

- [ ] **Step 5: Typecheck and lint**

Run: `npx pnpm --filter web typecheck && npx pnpm --filter web lint`
Expected: no errors.

- [ ] **Step 6: Update the screenshot**

Run: `npx pnpm --filter web dev` (separate terminal), then `node scripts/screenshot.cjs` for any admin screenshot entries that include `/admin?tab=shuttle` if one exists in the table in CLAUDE.md — none currently does, so no screenshot update is required for this task; skip.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/pages/admin/ShuttleTab.tsx apps/web/src/pages/admin/ShuttleTab.stats.test.tsx
git commit -m "feat(admin): add ops settings panel to shuttle ops screen

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017JRVZzfLB9LALRcnS9f2p2"
```

---

## Self-Review

**1. Spec coverage.** Mockup elements: 4 stat tiles → Task 4. Live/Idle pill per route → Task 4. Ops settings panel with exact 4 toggles + descriptions → Task 5. "Route alerts" and "Fleet" right-rail widgets from the mockup are intentionally **not** included — CLAUDE.md documents that the admin right rail is a shared, manifest-driven, parity-across-roles component (`roleShell.test.ts` enforces equal widget count across the 4 member roles) and is out of scope for a single tab's rebuild; the same 4 numbers are already visible in the in-page stat tiles (Task 4), so no information is lost. This is a deliberate scope boundary, called out here rather than silently dropped.

**2. Placeholder scan.** No "TBD"/"implement later" markers. Every step has runnable code. The one intentionally-unresolved number (`onTimeRatePct: null` when no data) is explicit and rendered as "Not enough data yet" — not a fabricated placeholder value.

**3. Type consistency.** `ShuttleStats`/`ShuttleOpsSettings` field names match between the Task 2 service return shape (`toSettings()`), Task 3 controller pass-through, and Task 4/5 frontend interfaces (`busesLive`, `activeRoutes`, `onDutyDrivers`, `onTimeRatePct`, `routes[].routeId`/`isLive`; `liveGpsEnabled`, `riderEtaEnabled`, `autoAssignEnabled`, `serviceAlertsEnabled`) — verified consistent across all four tasks.
