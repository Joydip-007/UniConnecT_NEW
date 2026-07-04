# Phase 4a — Learning backend (skill paths, streaks, badges) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backend for the learning MVP — skill-path tables + seed content, a `learning` API module (enroll, today's unit, idempotent completion, streak stats, badges + showcase), a timezone-aware streak cron on a new `learning` Bull queue, and a real `badges` schema (with `category`) wired to the existing badge worker.

**Architecture:** Three sequential migrations (085–087) create learning tables, badges tables, and platform-seeded paths. A new `apps/api/src/modules/learning/` module follows the standard router/controller/service/schema shape; all streak day-math lives in a pure helper (`streak.ts`) unit-tested around timezone day boundaries and freeze consumption. A new `learning` Bull queue runs an hourly worker that acts only for universities where the local hour matches (midnight sweep → freeze/reset; 20:00 → at-most-one-per-day push reminder via the existing `push` queue). Badge awards are enqueued on the existing `badge` queue and deduplicated in the worker — never awarded inline.

**Tech Stack:** Express + Knex + Zod (`@uniconnect/shared`), Bull on Redis, Vitest + supertest.

**Branch:** `feature/learning-api` off `main` (PRs #20/#21 are merged).

## Global Constraints

- `pnpm` is not on PATH — always `npx pnpm …`.
- Migrations are sequential `NNN_description.ts`; **next free prefix is 085** (084 is the latest on main — the spec's "from 077" is stale). Never edit a committed migration.
- Services import `db` directly; `universityId` always from `req.university.id` / `req.user`, never the request body.
- Controllers: `asyncHandler` + `sendSuccess`/`sendPaginated`; services throw `notFound()`/`badRequest()`/`forbidden()`/`conflict()`.
- Zod schemas live in `packages/shared/src/schemas/learning.ts`, types via `z.infer` — no duplicated interfaces.
- No inline async side-work in HTTP handlers — enqueue on Bull queues. Badge awards go through the `badge` queue only.
- Strict TS, no `any`. `logger` from `src/utils/logger.ts`, never `console.log`.
- Soft deletes use `is_deleted boolean default false` (not needed on learning tables for MVP — completions/enrollments are hard state).
- Integration tests: every supertest request sets `.set('x-university-domain', DOMAIN)`; auth via `loginAs()` from `src/__tests__/setup.ts`.
- **Env:** Docker is not installed. API integration tests run against the Neon test branch (`TEST_DATABASE_URL`, project steep-tooth-47639878) + local `redis-server --daemonize yes`. Ask the user before deleting the Neon branch. The controller (not implementers) provisions/loads this env; implementers run tests with the env vars from `apps/api/.env.test` if present, otherwise report the exact command for the controller to run.
- Before finishing any task: `npx pnpm typecheck && npx pnpm lint`.
- Commit format `type(scope): description`.
- Pre-existing allowed failure: `ShuttleMap.test.tsx` (web) — irrelevant here; the API suite must be fully green.

## Domain decisions (locked in — implementers do not re-litigate)

- **Day boundary:** university-local timezone via new `universities.timezone` column (IANA string, default `'Asia/Dhaka'`), computed with `Intl.DateTimeFormat`.
- **Streak semantics:** streak = consecutive local days with ≥1 unit completion (any path). Completion on the same local day is a no-op; completion the day after `last_activity_date` increments; otherwise streak restarts at 1. Freeze bridging happens **only in the nightly sweep**: at local midnight, a user with `current_streak > 0` who missed exactly the previous day consumes a freeze (max 2/calendar month, tracked as `freezes_used_month` + `freezes_used_count`) which sets `last_activity_date` to that missed day; no freeze available → `current_streak = 0`. A gap of ≥2 days at sweep time always resets (a freeze covers exactly one day).
- **Pacing:** units unlock sequentially (next unit = lowest `display_order` without a completion), and at most **one unit per path per local day** may be completed.
- **Quiz completion rule:** unit `type='quiz'` requires body `score >= completion_rule.passScore` (JSONB); other types complete on request (manual confirm).
- **Badges are platform-global** (no `university_id` on `badges`). Rarity is derived at read time from holder counts: ≤10 holders `epic`, ≤100 `rare`, else `common`.
- **Showcase:** one showcased badge per user, stored as `user_badges.is_showcased` with a partial unique index.
- **Reminder push:** at local hour 20, users with an active enrollment, `current_streak > 0`, and no completion today get one push (`last_reminder_date` guard — hard max 1/day).
- **Badge queue actions** added: `unit_completed` (volume), `streak_milestone` (payload `{ streak }`), `path_completed` (payload `{ pathId }`, matched against `badges.skill_path_id`).

---

### Task 1: Migration 085 — learning tables + `universities.timezone`

**Files:**
- Create: `apps/api/src/database/migrations/085_create_learning_tables.ts`

**Interfaces:**
- Produces tables: `skill_paths`, `skill_path_units`, `skill_path_enrollments`, `unit_completions`, `learning_stats`; column `universities.timezone`.

- [ ] **Step 1: Write the migration**

```ts
import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.alterTable('universities', (table) => {
    table.string('timezone', 64).notNullable().defaultTo('Asia/Dhaka')
  })

  await knex.schema.createTable('skill_paths', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    // null = platform-wide path visible to all tenants
    table.uuid('university_id').nullable().references('id').inTable('universities').onDelete('CASCADE').index()
    table.string('title', 255).notNullable()
    table.text('description')
    table.string('category', 100).notNullable()
    table.string('difficulty', 20).notNullable().defaultTo('beginner')
    table.integer('estimated_days').notNullable().defaultTo(7)
    table.string('badge_name', 100)
    table.string('badge_icon', 100)
    table.boolean('is_published').notNullable().defaultTo(true)
    table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL')
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now())
  })

  await knex.schema.createTable('skill_path_units', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('path_id').notNullable().references('id').inTable('skill_paths').onDelete('CASCADE').index()
    table.integer('display_order').notNullable()
    table.string('title', 255).notNullable()
    table.string('type', 20).notNullable() // read | video | exercise | quiz
    table.jsonb('content').notNullable().defaultTo('{}')
    table.jsonb('completion_rule').notNullable().defaultTo('{}')
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now())
    table.unique(['path_id', 'display_order'])
  })

  await knex.schema.createTable('skill_path_enrollments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE').index()
    table.uuid('path_id').notNullable().references('id').inTable('skill_paths').onDelete('CASCADE').index()
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE').index()
    table.string('status', 20).notNullable().defaultTo('active') // active | completed | abandoned
    table.timestamp('started_at', { useTz: true }).defaultTo(knex.fn.now())
    table.timestamp('completed_at', { useTz: true }).nullable()
    table.unique(['user_id', 'path_id'])
  })

  await knex.schema.createTable('unit_completions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE').index()
    table.uuid('unit_id').notNullable().references('id').inTable('skill_path_units').onDelete('CASCADE').index()
    table.uuid('path_id').notNullable().references('id').inTable('skill_paths').onDelete('CASCADE').index()
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE').index()
    table.integer('score').nullable()
    table.timestamp('completed_at', { useTz: true }).defaultTo(knex.fn.now())
    table.unique(['user_id', 'unit_id']) // idempotent completion writes
  })

  await knex.schema.createTable('learning_stats', (table) => {
    table.uuid('user_id').primary().references('id').inTable('users').onDelete('CASCADE')
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE').index()
    table.integer('current_streak').notNullable().defaultTo(0)
    table.integer('longest_streak').notNullable().defaultTo(0)
    table.date('last_activity_date').nullable()
    table.string('freezes_used_month', 7).nullable() // 'YYYY-MM'
    table.integer('freezes_used_count').notNullable().defaultTo(0)
    table.date('last_reminder_date').nullable()
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now())
  })
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('learning_stats')
  await knex.schema.dropTableIfExists('unit_completions')
  await knex.schema.dropTableIfExists('skill_path_enrollments')
  await knex.schema.dropTableIfExists('skill_path_units')
  await knex.schema.dropTableIfExists('skill_paths')
  await knex.schema.alterTable('universities', (table) => {
    table.dropColumn('timezone')
  })
}
```

- [ ] **Step 2: Run migrate + rollback round-trip against the test DB**

Run (from `apps/api`, with test env loaded): `npx pnpm --filter api db:migrate` then `npx pnpm --filter api db:rollback` then `npx pnpm --filter api db:migrate`
Expected: `Batch N run: 1 migrations` each way, no errors.

- [ ] **Step 3: Typecheck + lint**

Run: `npx pnpm typecheck && npx pnpm lint` — Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/database/migrations/085_create_learning_tables.ts
git commit -m "feat(api): migration 085 — learning tables + university timezone"
```

---

### Task 2: Migration 086 — badges tables (with `category`) + platform badge seed

**Files:**
- Create: `apps/api/src/database/migrations/086_create_badges.ts`

**Interfaces:**
- Produces tables `badges`, `user_badges` compatible with the existing `apps/api/src/workers/badge.worker.ts` `BadgeRow` shape (`name`, `description`, `icon_url`, `trigger_type`, `trigger_count`, `points`) **plus** `category` and nullable `skill_path_id`.
- `user_badges.is_showcased` with partial unique index `user_badges_one_showcase_per_user`.

**Context:** the `badge` queue/worker already exist but no migration ever created these tables — this migration makes the worker real. Do not modify the worker in this task.

- [ ] **Step 1: Write the migration**

```ts
import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.createTable('badges', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.string('name', 100).notNullable().unique()
    table.text('description')
    table.string('icon_url', 255)
    table.string('category', 30).notNullable() // path | streak | volume | social
    table.string('trigger_type', 50).notNullable().index()
    table.integer('trigger_count').notNullable().defaultTo(1)
    table.integer('points').notNullable().defaultTo(0)
    table.uuid('skill_path_id').nullable().references('id').inTable('skill_paths').onDelete('CASCADE')
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
  })

  await knex.schema.createTable('user_badges', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE').index()
    table.uuid('badge_id').notNullable().references('id').inTable('badges').onDelete('CASCADE').index()
    table.boolean('is_showcased').notNullable().defaultTo(false)
    table.timestamp('awarded_at', { useTz: true }).defaultTo(knex.fn.now())
    table.unique(['user_id', 'badge_id'])
  })
  await knex.raw(
    `CREATE UNIQUE INDEX user_badges_one_showcase_per_user ON user_badges (user_id) WHERE is_showcased`,
  )

  await knex('badges').insert([
    { name: 'Week one',     description: 'Kept a 7-day learning streak',    icon_url: '🔥', category: 'streak', trigger_type: 'streak_milestone', trigger_count: 7,   points: 10 },
    { name: 'Scholar',      description: 'Kept a 30-day learning streak',   icon_url: '📚', category: 'streak', trigger_type: 'streak_milestone', trigger_count: 30,  points: 30 },
    { name: 'Centurion',    description: 'Kept a 100-day learning streak',  icon_url: '🏛️', category: 'streak', trigger_type: 'streak_milestone', trigger_count: 100, points: 100 },
    { name: 'Curious mind', description: 'Completed 10 learning units',     icon_url: '💡', category: 'volume', trigger_type: 'unit_completed',   trigger_count: 10,  points: 10 },
    { name: 'Deep diver',   description: 'Completed 50 learning units',     icon_url: '🤿', category: 'volume', trigger_type: 'unit_completed',   trigger_count: 50,  points: 50 },
  ])
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('user_badges')
  await knex.schema.dropTableIfExists('badges')
}
```

- [ ] **Step 2: Migrate + rollback round-trip** — same commands as Task 1 Step 2, expected clean.

- [ ] **Step 3: Typecheck + lint** — `npx pnpm typecheck && npx pnpm lint`, clean.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/database/migrations/086_create_badges.ts
git commit -m "feat(api): migration 086 — badges/user_badges tables with categories + platform seed"
```

---

### Task 3: Shared package — learning schemas, types, constants

**Files:**
- Create: `packages/shared/src/schemas/learning.ts`
- Create: `packages/shared/src/constants/learning.ts`
- Modify: `packages/shared/src/index.ts` (add two `export *` lines)

**Interfaces:**
- Produces (consumed by Tasks 4–8): `completeUnitSchema`, `CompleteUnitInput`, `showcaseBadgeSchema`, `ShowcaseBadgeInput`, `pathIdParamsSchema`, `unitIdParamsSchema`, `userIdParamsSchema`, `LEARNING` constants (`STREAK_FREEZES_PER_MONTH: 2`, `STREAK_MILESTONES: [7, 30, 100]`, `REMINDER_LOCAL_HOUR: 20`, `RARITY_EPIC_MAX_HOLDERS: 10`, `RARITY_RARE_MAX_HOLDERS: 100`), `BadgeRarity`, and `LEARNING_EVENTS.UNIT_COMPLETED = 'learning:unit_completed'`.

- [ ] **Step 1: Write `packages/shared/src/schemas/learning.ts`**

```ts
import { z } from 'zod'

export const pathIdParamsSchema = z.object({ pathId: z.string().uuid() })
export const unitIdParamsSchema = z.object({ unitId: z.string().uuid() })
export const userIdParamsSchema = z.object({ userId: z.string().uuid() })

/** Body for POST /learning/units/:unitId/complete — score only required by quiz units. */
export const completeUnitSchema = z.object({
  score: z.number().int().min(0).max(100).optional(),
})
export type CompleteUnitInput = z.infer<typeof completeUnitSchema>

/** Body for PUT /learning/me/badges/showcase — null clears the showcase. */
export const showcaseBadgeSchema = z.object({
  badgeId: z.string().uuid().nullable(),
})
export type ShowcaseBadgeInput = z.infer<typeof showcaseBadgeSchema>

export type BadgeRarity = 'common' | 'rare' | 'epic'
```

- [ ] **Step 2: Write `packages/shared/src/constants/learning.ts`**

```ts
export const LEARNING = {
  STREAK_FREEZES_PER_MONTH: 2,
  STREAK_MILESTONES: [7, 30, 100] as const,
  REMINDER_LOCAL_HOUR: 20,
  RARITY_EPIC_MAX_HOLDERS: 10,
  RARITY_RARE_MAX_HOLDERS: 100,
} as const

export const LEARNING_EVENTS = {
  UNIT_COMPLETED: 'learning:unit_completed',
} as const
```

- [ ] **Step 3: Export from `packages/shared/src/index.ts`** — append alongside the existing schema/constant exports:

```ts
export * from './schemas/learning'
export * from './constants/learning'
```

- [ ] **Step 4: Typecheck + lint** — `npx pnpm typecheck && npx pnpm lint`, clean.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/schemas/learning.ts packages/shared/src/constants/learning.ts packages/shared/src/index.ts
git commit -m "feat(shared): learning schemas and constants"
```

---

### Task 4: Streak helper — pure timezone/day-boundary logic (TDD)

**Files:**
- Create: `apps/api/src/modules/learning/streak.ts`
- Test: `apps/api/src/modules/learning/streak.test.ts` (pure unit tests — no DB/Redis)

**Interfaces:**
- Produces (consumed by Tasks 6 and 8):

```ts
export interface StreakStats {
  currentStreak: number
  longestStreak: number
  lastActivityDate: string | null // 'YYYY-MM-DD' (local)
  freezesUsedMonth: string | null // 'YYYY-MM'
  freezesUsedCount: number
}
export function localDateString(instant: Date, timeZone: string): string
export function localHour(instant: Date, timeZone: string): number
export function addDays(dateStr: string, days: number): string
export function applyCompletion(stats: StreakStats, todayLocal: string): { stats: StreakStats; changed: boolean }
export function applySweep(stats: StreakStats, todayLocal: string):
  { action: 'none' } | { action: 'freeze'; stats: StreakStats } | { action: 'reset'; stats: StreakStats }
```

- [ ] **Step 1: Write the failing tests** (`streak.test.ts`)

```ts
import { describe, expect, it } from 'vitest'
import { addDays, applyCompletion, applySweep, localDateString, localHour, type StreakStats } from './streak'

const base: StreakStats = {
  currentStreak: 3, longestStreak: 5, lastActivityDate: '2026-07-03',
  freezesUsedMonth: null, freezesUsedCount: 0,
}

describe('localDateString', () => {
  it('computes the local calendar date across the UTC day boundary', () => {
    // 2026-07-03 19:30 UTC = 2026-07-04 01:30 in Dhaka (UTC+6)
    expect(localDateString(new Date('2026-07-03T19:30:00Z'), 'Asia/Dhaka')).toBe('2026-07-04')
    expect(localDateString(new Date('2026-07-03T19:30:00Z'), 'America/New_York')).toBe('2026-07-03')
  })
})

describe('localHour', () => {
  it('returns the local hour 0-23', () => {
    expect(localHour(new Date('2026-07-03T18:10:00Z'), 'Asia/Dhaka')).toBe(0) // 00:10 local
    expect(localHour(new Date('2026-07-04T14:05:00Z'), 'Asia/Dhaka')).toBe(20)
  })
})

describe('addDays', () => {
  it('adds and subtracts across month boundaries', () => {
    expect(addDays('2026-07-01', -1)).toBe('2026-06-30')
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
  })
})

describe('applyCompletion', () => {
  it('is a no-op for a second completion on the same local day', () => {
    const r = applyCompletion({ ...base, lastActivityDate: '2026-07-04' }, '2026-07-04')
    expect(r.changed).toBe(false)
    expect(r.stats.currentStreak).toBe(3)
  })
  it('increments when yesterday was active', () => {
    const r = applyCompletion(base, '2026-07-04')
    expect(r.stats.currentStreak).toBe(4)
    expect(r.stats.lastActivityDate).toBe('2026-07-04')
    expect(r.stats.longestStreak).toBe(5)
  })
  it('updates longestStreak when passed', () => {
    const r = applyCompletion({ ...base, currentStreak: 5 }, '2026-07-04')
    expect(r.stats.longestStreak).toBe(6)
  })
  it('restarts at 1 after a gap', () => {
    const r = applyCompletion(base, '2026-07-06')
    expect(r.stats.currentStreak).toBe(1)
  })
  it('starts at 1 for a first-ever completion', () => {
    const r = applyCompletion({ ...base, currentStreak: 0, lastActivityDate: null }, '2026-07-04')
    expect(r.stats.currentStreak).toBe(1)
  })
})

describe('applySweep', () => {
  it('does nothing when yesterday (or today) was active', () => {
    expect(applySweep(base, '2026-07-04').action).toBe('none')
    expect(applySweep({ ...base, lastActivityDate: '2026-07-04' }, '2026-07-04').action).toBe('none')
  })
  it('does nothing for streakless users', () => {
    expect(applySweep({ ...base, currentStreak: 0 }, '2026-07-06').action).toBe('none')
  })
  it('consumes a freeze for exactly one missed day', () => {
    const r = applySweep(base, '2026-07-05') // missed 07-04
    expect(r.action).toBe('freeze')
    if (r.action === 'freeze') {
      expect(r.stats.lastActivityDate).toBe('2026-07-04')
      expect(r.stats.freezesUsedMonth).toBe('2026-07')
      expect(r.stats.freezesUsedCount).toBe(1)
      expect(r.stats.currentStreak).toBe(3)
    }
  })
  it('resets the monthly freeze counter in a new month', () => {
    const r = applySweep({ ...base, freezesUsedMonth: '2026-06', freezesUsedCount: 2 }, '2026-07-05')
    expect(r.action).toBe('freeze')
    if (r.action === 'freeze') expect(r.stats.freezesUsedCount).toBe(1)
  })
  it('resets the streak when both monthly freezes are spent', () => {
    const r = applySweep({ ...base, freezesUsedMonth: '2026-07', freezesUsedCount: 2 }, '2026-07-05')
    expect(r.action).toBe('reset')
    if (r.action === 'reset') expect(r.stats.currentStreak).toBe(0)
  })
  it('resets on a gap of 2+ missed days — a freeze covers exactly one day', () => {
    const r = applySweep(base, '2026-07-06')
    expect(r.action).toBe('reset')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx pnpm --filter api test src/modules/learning/streak.test.ts`
Expected: FAIL — module `./streak` not found.

- [ ] **Step 3: Implement `streak.ts`**

```ts
import { LEARNING } from '@uniconnect/shared'

export interface StreakStats {
  currentStreak: number
  longestStreak: number
  lastActivityDate: string | null
  freezesUsedMonth: string | null
  freezesUsedCount: number
}

/** Local calendar date 'YYYY-MM-DD' for an instant in an IANA timezone. */
export function localDateString(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(instant)
}

export function localHour(instant: Date, timeZone: string): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(instant),
  )
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function applyCompletion(stats: StreakStats, todayLocal: string): { stats: StreakStats; changed: boolean } {
  if (stats.lastActivityDate === todayLocal) return { stats, changed: false }
  const continues = stats.lastActivityDate === addDays(todayLocal, -1)
  const currentStreak = continues ? stats.currentStreak + 1 : 1
  return {
    changed: true,
    stats: {
      ...stats,
      currentStreak,
      longestStreak: Math.max(stats.longestStreak, currentStreak),
      lastActivityDate: todayLocal,
    },
  }
}

export function applySweep(
  stats: StreakStats,
  todayLocal: string,
): { action: 'none' } | { action: 'freeze'; stats: StreakStats } | { action: 'reset'; stats: StreakStats } {
  const yesterday = addDays(todayLocal, -1)
  if (stats.currentStreak === 0 || !stats.lastActivityDate || stats.lastActivityDate >= yesterday) {
    return { action: 'none' }
  }
  // A freeze bridges exactly one missed day; larger gaps always reset.
  const missedExactlyOneDay = stats.lastActivityDate === addDays(todayLocal, -2)
  const month = todayLocal.slice(0, 7)
  const used = stats.freezesUsedMonth === month ? stats.freezesUsedCount : 0
  if (missedExactlyOneDay && used < LEARNING.STREAK_FREEZES_PER_MONTH) {
    return {
      action: 'freeze',
      stats: { ...stats, lastActivityDate: yesterday, freezesUsedMonth: month, freezesUsedCount: used + 1 },
    }
  }
  return { action: 'reset', stats: { ...stats, currentStreak: 0 } }
}
```

- [ ] **Step 4: Run tests** — same command, Expected: all PASS.

- [ ] **Step 5: Typecheck + lint, then commit**

```bash
git add apps/api/src/modules/learning/streak.ts apps/api/src/modules/learning/streak.test.ts
git commit -m "feat(api): pure streak day-boundary and freeze logic with unit tests"
```

---

### Task 5: Learning module — paths, enroll/abandon (router/controller/service, mounted)

**Files:**
- Create: `apps/api/src/modules/learning/router.ts`, `controller.ts`, `service.ts`, `index.ts`
- Modify: `apps/api/src/app.ts` (import + mount `learningRouter` at `/api/v1/learning`, mirroring the presence lines)
- Test: `apps/api/src/__tests__/learning.test.ts` (extended in Tasks 6–7 — create it here)

**Interfaces:**
- Consumes: Task 3 schemas, tables from Tasks 1–2.
- Produces service functions (extended later): `listPaths(universityId)`, `getPath(pathId, userId, universityId)`, `enroll(pathId, userId, universityId)`, `abandon(pathId, userId)`.
- Routes this task: `GET /paths`, `GET /paths/:pathId`, `POST /paths/:pathId/enroll`, `POST /paths/:pathId/abandon`.

Behavior:
- `listPaths` — published paths where `university_id IS NULL OR university_id = :universityId`, each with `unitCount`, `enrolledCount`, and the caller's enrollment status if any; ordered by `created_at`.
- `getPath` — path + ordered units (id, display_order, title, type — content only for unlocked units: units with `display_order <=` next incomplete order for enrolled callers, none when not enrolled) + caller enrollment + per-unit `completed` flags. Not found → `notFound('Path not found')`.
- `enroll` — path must be visible to the tenant and published, else `notFound`. Re-enroll on an `abandoned` enrollment flips it back to `active`; an existing `active`/`completed` enrollment → `conflict('Already enrolled')`. Inserts `learning_stats` row on first enrollment (`onConflict('user_id').ignore()`).
- `abandon` — active enrollment required else `notFound('Enrollment not found')`; sets status `abandoned`.

Router shape (follow `modules/presence/router.ts` exactly):

```ts
import { Router } from 'express'
import { completeUnitSchema, pathIdParamsSchema, showcaseBadgeSchema, unitIdParamsSchema, userIdParamsSchema } from '@uniconnect/shared'
import { requireAuth } from '../../middleware/auth'
import { resolveUniversity } from '../../middleware/university'
import { validateRequest } from '../../middleware/validate'
import * as c from './controller'

export const learningRouter = Router()
learningRouter.use(requireAuth, resolveUniversity)

learningRouter.get('/paths', c.listPaths)
learningRouter.get('/paths/:pathId', validateRequest({ params: pathIdParamsSchema }), c.getPath)
learningRouter.post('/paths/:pathId/enroll', validateRequest({ params: pathIdParamsSchema }), c.enroll)
learningRouter.post('/paths/:pathId/abandon', validateRequest({ params: pathIdParamsSchema }), c.abandon)
// Tasks 6–7 add: GET /me/today, POST /units/:unitId/complete, GET /me/stats,
// GET /me/badges, PUT /me/badges/showcase, GET /users/:userId/badges
```

Controllers follow `modules/presence/controller.ts` (asyncHandler + `getAuthContext` + sendSuccess). `index.ts` re-exports `learningRouter`.

- [ ] **Step 1: Write failing integration tests** in `apps/api/src/__tests__/learning.test.ts`

```ts
import { beforeAll, describe, expect, it } from 'vitest'
import supertest from 'supertest'
import { app, DOMAIN, TEST_UNIVERSITY_ID, loginAs, CREDENTIALS } from './setup'
import { db } from '../config/db'

let student: { accessToken: string }
let pathId: string
let unitIds: string[]

beforeAll(async () => {
  student = await loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password)
  // Isolated fixture path (platform-wide) with 3 units, incl. a quiz
  const [path] = await db('skill_paths')
    .insert({ title: 'Test path', category: 'testing', difficulty: 'beginner', estimated_days: 3 })
    .returning('id')
  pathId = path.id
  const units = await db('skill_path_units')
    .insert([
      { path_id: pathId, display_order: 1, title: 'Unit 1', type: 'read', content: JSON.stringify({ body: 'a' }) },
      { path_id: pathId, display_order: 2, title: 'Unit 2', type: 'exercise', content: JSON.stringify({ body: 'b' }) },
      { path_id: pathId, display_order: 3, title: 'Unit 3', type: 'quiz', content: JSON.stringify({ questions: [] }), completion_rule: JSON.stringify({ passScore: 70 }) },
    ])
    .returning('id')
  unitIds = units.map((u: { id: string }) => u.id)
})

const get = (url: string) =>
  supertest(app).get(url).set('x-university-domain', DOMAIN).set('Authorization', `Bearer ${student.accessToken}`)
const post = (url: string) =>
  supertest(app).post(url).set('x-university-domain', DOMAIN).set('Authorization', `Bearer ${student.accessToken}`)

describe('learning paths', () => {
  it('lists visible published paths with unit counts', async () => {
    const res = await get('/api/v1/learning/paths')
    expect(res.status).toBe(200)
    const mine = res.body.data.find((p: { id: string }) => p.id === pathId)
    expect(mine).toBeDefined()
    expect(Number(mine.unitCount)).toBe(3)
  })

  it('enrolls, then rejects double enrollment', async () => {
    expect((await post(`/api/v1/learning/paths/${pathId}/enroll`)).status).toBe(200)
    expect((await post(`/api/v1/learning/paths/${pathId}/enroll`)).status).toBe(409)
  })

  it('returns path detail with ordered units and my enrollment', async () => {
    const res = await get(`/api/v1/learning/paths/${pathId}`)
    expect(res.status).toBe(200)
    expect(res.body.data.units.map((u: { display_order: number }) => u.display_order)).toEqual([1, 2, 3])
    expect(res.body.data.enrollment.status).toBe('active')
  })

  it('abandons and allows re-enroll', async () => {
    expect((await post(`/api/v1/learning/paths/${pathId}/abandon`)).status).toBe(200)
    const re = await post(`/api/v1/learning/paths/${pathId}/enroll`)
    expect(re.status).toBe(200)
  })

  it('404s a path from another tenant', async () => {
    const [other] = await db('universities')
      .insert({ name: 'Other U', domain: `other-${Date.now()}.edu` })
      .returning('id')
    const [foreign] = await db('skill_paths')
      .insert({ university_id: other.id, title: 'Foreign', category: 'x' })
      .returning('id')
    expect((await get(`/api/v1/learning/paths/${foreign.id}`)).status).toBe(404)
  })
})
```

(Adjust `loginAs` import to the actual export in `setup.ts` — check its signature before writing.)

- [ ] **Step 2: Run to verify failure** — `npx pnpm --filter api test src/__tests__/learning.test.ts` — Expected: 404s (router not mounted).

- [ ] **Step 3: Implement service, controller, router, index; mount in `app.ts`.** Service uses plain Knex; enrollment insert wraps in a transaction with the `learning_stats` upsert. Tenant visibility clause everywhere: `.where((qb) => qb.whereNull('university_id').orWhere('university_id', universityId))`.

- [ ] **Step 4: Run tests** — Expected: PASS.

- [ ] **Step 5: Typecheck + lint + commit**

```bash
git add apps/api/src/modules/learning apps/api/src/app.ts apps/api/src/__tests__/learning.test.ts
git commit -m "feat(api): learning module — paths listing, detail, enroll/abandon"
```

---

### Task 6: Unit completion, today's unit, streak stats + badge enqueues

**Files:**
- Modify: `apps/api/src/modules/learning/service.ts`, `controller.ts`, `router.ts`
- Test: extend `apps/api/src/__tests__/learning.test.ts`

**Interfaces:**
- Consumes: `applyCompletion`, `localDateString` from `./streak`; `badgeQueue` from `../../queues/badge.queue`; `completeUnitSchema`.
- Produces: `completeUnit(unitId, userId, universityId, input)`, `getToday(userId, universityId)`, `getStats(userId)`.
- Routes: `POST /units/:unitId/complete` (`validateRequest({ params: unitIdParamsSchema, body: completeUnitSchema })`), `GET /me/today`, `GET /me/stats`.

Behavior of `completeUnit` (single transaction for the DB writes):
1. Load unit + its path; verify tenant visibility and an `active` enrollment, else `notFound`/`forbidden('Not enrolled')`.
2. Sequential unlock: the unit must be the lowest `display_order` in the path without a completion by this user, else `badRequest('Unit is locked — complete earlier units first')`.
3. Quiz rule: `type === 'quiz'` → require `input.score >= (completion_rule.passScore ?? 100)`, else `badRequest('Score below pass mark')`.
4. Pacing: load university `timezone`, `todayLocal = localDateString(new Date(), timezone)`; if any completion for this user+path has `completed_at` on `todayLocal` (compare with `to_char(completed_at AT TIME ZONE :tz, 'YYYY-MM-DD')`), → `tooManyRequests('One unit per day — come back tomorrow')`.
5. Insert into `unit_completions` with `.onConflict(['user_id', 'unit_id']).ignore()`; if no row inserted (already completed) return current state idempotently (200, `alreadyCompleted: true`) without touching stats.
6. Update `learning_stats` via `applyCompletion` (select row `FOR UPDATE`, upsert result).
7. If it was the path's last unit → set enrollment `status='completed'`, `completed_at=now()`.
8. **After commit**, enqueue badge jobs (never inline awards): always `{ userId, universityId, action: 'unit_completed' }`; if `stats.changed && LEARNING.STREAK_MILESTONES.includes(currentStreak)` → `{ action: 'streak_milestone', payload: { streak: currentStreak } }`; if path completed → `{ action: 'path_completed', payload: { pathId } }`.
9. Return `{ completed: true, pathCompleted, streak: { currentStreak, longestStreak } }`.

`getToday`: for each `active` enrollment, the next incomplete unit (full content) + a `completedToday` boolean per path (same local-day comparison) + streak summary. `getStats`: the `learning_stats` row (zeros if absent) + freezes remaining this month.

- [ ] **Step 1: Write failing tests** — append to `learning.test.ts`:

```ts
describe('unit completion & streaks', () => {
  it('rejects completing a locked (out-of-order) unit', async () => {
    const res = await post(`/api/v1/learning/units/${unitIds[1]}/complete`).send({})
    expect(res.status).toBe(400)
  })

  it('completes the first unit and starts a streak', async () => {
    const res = await post(`/api/v1/learning/units/${unitIds[0]}/complete`).send({})
    expect(res.status).toBe(200)
    expect(res.body.data.streak.currentStreak).toBe(1)
  })

  it('is idempotent on repeat completion', async () => {
    const res = await post(`/api/v1/learning/units/${unitIds[0]}/complete`).send({})
    expect(res.status).toBe(200)
    expect(res.body.data.alreadyCompleted).toBe(true)
  })

  it('enforces one unit per path per day', async () => {
    const res = await post(`/api/v1/learning/units/${unitIds[1]}/complete`).send({})
    expect(res.status).toBe(429)
  })

  it('surfaces the next unit in /me/today', async () => {
    const res = await get('/api/v1/learning/me/today')
    expect(res.status).toBe(200)
    const entry = res.body.data.find((e: { pathId: string }) => e.pathId === pathId)
    expect(entry.unit.id).toBe(unitIds[1])
    expect(entry.completedToday).toBe(true)
  })

  it('requires a passing score on quiz units', async () => {
    // Fast-forward: mark unit 2 complete yesterday directly in the DB to unlock unit 3 and clear the daily cap
    await db('unit_completions').insert({
      user_id: (await db('users').where({ email: CREDENTIALS.student.email }).first('id')).id,
      unit_id: unitIds[1], path_id: pathId, university_id: TEST_UNIVERSITY_ID,
      completed_at: db.raw(`now() - interval '1 day'`),
    })
    expect((await post(`/api/v1/learning/units/${unitIds[2]}/complete`).send({ score: 40 })).status).toBe(400)
    const pass = await post(`/api/v1/learning/units/${unitIds[2]}/complete`).send({ score: 85 })
    expect(pass.status).toBe(200)
    expect(pass.body.data.pathCompleted).toBe(true)
  })

  it('marks the enrollment completed and enqueued no inline badge writes', async () => {
    const enr = await db('skill_path_enrollments')
      .where({ path_id: pathId })
      .first('status')
    expect(enr.status).toBe('completed')
  })

  it('returns stats', async () => {
    const res = await get('/api/v1/learning/me/stats')
    expect(res.status).toBe(200)
    expect(res.body.data.currentStreak).toBeGreaterThanOrEqual(1)
    expect(res.body.data.freezesRemaining).toBeDefined()
  })
})
```

Note for the quiz test: completing unit 2 via raw insert dated yesterday means the streak/daily-cap sees no completion "today" for that path; unit 3 then completes normally today. The one-per-day check must compare **calendar local dates**, not a 24 h window — this test locks that in.

- [ ] **Step 2: Run to verify failure** — routes 404.

- [ ] **Step 3: Implement** service/controller/router changes per behavior above.

- [ ] **Step 4: Run tests** — full `learning.test.ts` PASS.

- [ ] **Step 5: Typecheck + lint + commit**

```bash
git add apps/api/src/modules/learning apps/api/src/__tests__/learning.test.ts
git commit -m "feat(api): unit completion with sequential unlock, daily pacing, streak updates, badge enqueues"
```

---

### Task 7: Badges endpoints + badge worker learning actions

**Files:**
- Modify: `apps/api/src/modules/learning/service.ts`, `controller.ts`, `router.ts`
- Modify: `apps/api/src/workers/badge.worker.ts`
- Test: extend `apps/api/src/__tests__/learning.test.ts`; create `apps/api/src/workers/badge.worker.test.ts` only if the worker's award loop is extracted — otherwise cover via integration below.

**Interfaces:**
- Consumes: `showcaseBadgeSchema`, `LEARNING` rarity thresholds, tables from Task 2.
- Produces routes: `GET /me/badges`, `PUT /me/badges/showcase`, `GET /users/:userId/badges`.

Service behavior:
- `listUserBadges(userId)` — join `user_badges`×`badges`, plus per-badge holder count → rarity (`epic ≤ 10`, `rare ≤ 100`, else `common`), `isShowcased`, ordered `awarded_at DESC`.
- `setShowcase(userId, badgeId | null)` — transaction: clear `is_showcased` for the user, then if `badgeId` set it `true` on the owned `user_badges` row (`notFound('Badge not owned')` if missing).
- Public `GET /users/:userId/badges` — same list; the target user must be in the caller's university (`notFound` otherwise).

Badge worker changes (keep the existing generic loop; two edits):
1. Per-path matching — after loading `badges` by `trigger_type`, filter: `badge.skill_path_id === null || badge.skill_path_id === payload?.pathId`. Add `skill_path_id: string | null` to `BadgeRow`.
2. New `getActivityCount` cases:

```ts
case 'unit_completed':
  return countRows('unit_completions', { user_id: userId })
case 'streak_milestone':
  return typeof payload?.streak === 'number' ? payload.streak : 0
case 'path_completed':
  return typeof payload?.pathId === 'string'
    ? countRows('skill_path_enrollments', { user_id: userId, path_id: payload.pathId, status: 'completed' })
    : 0
```

- [ ] **Step 1: Write failing tests** — append to `learning.test.ts`:

```ts
describe('badges', () => {
  let badgeId: string
  beforeAll(async () => {
    const studentId = (await db('users').where({ email: CREDENTIALS.student.email }).first('id')).id
    const badge = await db('badges').where({ name: 'Week one' }).first('id')
    badgeId = badge.id
    await db('user_badges').insert({ user_id: studentId, badge_id: badgeId }).onConflict(['user_id', 'badge_id']).ignore()
  })

  it('lists my badges with rarity', async () => {
    const res = await get('/api/v1/learning/me/badges')
    expect(res.status).toBe(200)
    const b = res.body.data.find((x: { id: string }) => x.id === badgeId)
    expect(b.rarity).toBe('epic') // sole holder in the test DB tier
  })

  it('showcases an owned badge and swaps atomically', async () => {
    const put = await supertest(app).put('/api/v1/learning/me/badges/showcase')
      .set('x-university-domain', DOMAIN).set('Authorization', `Bearer ${student.accessToken}`)
      .send({ badgeId })
    expect(put.status).toBe(200)
    const res = await get('/api/v1/learning/me/badges')
    expect(res.body.data.find((x: { id: string }) => x.id === badgeId).isShowcased).toBe(true)
  })

  it('rejects showcasing an unowned badge', async () => {
    const other = await db('badges').where({ name: 'Centurion' }).first('id')
    const put = await supertest(app).put('/api/v1/learning/me/badges/showcase')
      .set('x-university-domain', DOMAIN).set('Authorization', `Bearer ${student.accessToken}`)
      .send({ badgeId: other.id })
    expect(put.status).toBe(404)
  })

  it('exposes another user’s badges within the university', async () => {
    const faculty = await loginAs(CREDENTIALS.faculty.email, CREDENTIALS.faculty.password)
    const studentId = (await db('users').where({ email: CREDENTIALS.student.email }).first('id')).id
    const res = await supertest(app).get(`/api/v1/learning/users/${studentId}/badges`)
      .set('x-university-domain', DOMAIN).set('Authorization', `Bearer ${faculty.accessToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.some((x: { id: string }) => x.id === badgeId)).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify failure**, **Step 3: implement** (service/controller/router + worker edits), **Step 4: run tests to green**.

- [ ] **Step 5: Typecheck + lint + commit**

```bash
git add apps/api/src/modules/learning apps/api/src/workers/badge.worker.ts apps/api/src/__tests__/learning.test.ts
git commit -m "feat(api): badge listing/showcase endpoints and learning badge triggers in the badge worker"
```

---

### Task 8: `learning` Bull queue + hourly worker (streak sweep + reminder push)

**Files:**
- Create: `apps/api/src/queues/learning.queue.ts`
- Create: `apps/api/src/workers/learning.worker.ts`
- Modify: `apps/api/src/workers/index.ts` (add `import './learning.worker'`)
- Test: `apps/api/src/workers/learning.worker.test.ts` — unit-test the exported pure orchestration where possible; DB paths covered by calling the exported `runLearningSweep(now: Date)` directly against the test DB (no Bull needed).

**Interfaces:**
- Consumes: `applySweep`, `localDateString`, `localHour`, `addDays` from `../modules/learning/streak`; `pushQueue` (`{ userId, notification: { title, body, url } }`); `LEARNING.REMINDER_LOCAL_HOUR`.
- Produces: `learningQueue` and exported `runLearningSweep(now: Date): Promise<void>` (worker registers the repeat job and delegates to it).

Queue (mirror `feed-ranking`):

```ts
import Queue from 'bull'
import { bullQueueOptions } from '../config/bull'

export type LearningQueueJob = Record<string, never>
export const learningQueue = new Queue<LearningQueueJob>('learning', bullQueueOptions)
```

Worker (`learning.worker.ts`):

```ts
import { LEARNING } from '@uniconnect/shared'
import { db } from '../config/db'
import { logger } from '../utils/logger'
import { learningQueue } from '../queues/learning.queue'
import { pushQueue } from '../queues/push.queue'
import { addDays, applySweep, localDateString, localHour, type StreakStats } from '../modules/learning/streak'

// Hourly at :10 — each run only acts on universities whose local hour matches.
// Stable jobId prevents duplicate registration on restart.
learningQueue.add({}, { repeat: { cron: '10 * * * *' }, jobId: 'learning-hourly' })

interface StatsRow {
  user_id: string
  university_id: string
  current_streak: number
  longest_streak: number
  last_activity_date: string | null
  freezes_used_month: string | null
  freezes_used_count: number
  last_reminder_date: string | null
}

function toStats(row: StatsRow): StreakStats {
  return {
    currentStreak: row.current_streak,
    longestStreak: row.longest_streak,
    lastActivityDate: row.last_activity_date,
    freezesUsedMonth: row.freezes_used_month,
    freezesUsedCount: row.freezes_used_count,
  }
}

export async function runLearningSweep(now: Date): Promise<void> {
  const universities = await db('universities').where({ is_active: true }).select('id', 'timezone')

  for (const uni of universities) {
    const hour = localHour(now, uni.timezone)
    const today = localDateString(now, uni.timezone)

    if (hour === 0) {
      // Midnight sweep: consume freezes / reset streaks for users who missed yesterday.
      const rows: StatsRow[] = await db('learning_stats')
        .where({ university_id: uni.id })
        .where('current_streak', '>', 0)
        .where('last_activity_date', '<', addDays(today, -1))
      for (const row of rows) {
        const result = applySweep(toStats(row), today)
        if (result.action === 'none') continue
        await db('learning_stats')
          .where({ user_id: row.user_id })
          .update({
            current_streak: result.stats.currentStreak,
            last_activity_date: result.stats.lastActivityDate,
            freezes_used_month: result.stats.freezesUsedMonth,
            freezes_used_count: result.stats.freezesUsedCount,
            updated_at: db.fn.now(),
          })
        logger.info('Streak sweep applied', { userId: row.user_id, action: result.action })
      }
    }

    if (hour === LEARNING.REMINDER_LOCAL_HOUR) {
      // Gentle reminder: active enrollment, live streak, nothing completed today, max one per day.
      const rows: StatsRow[] = await db('learning_stats')
        .where({ 'learning_stats.university_id': uni.id })
        .where('current_streak', '>', 0)
        .where((qb) => qb.whereNull('last_activity_date').orWhere('last_activity_date', '<', today))
        .where((qb) => qb.whereNull('last_reminder_date').orWhere('last_reminder_date', '<', today))
        .whereExists(
          db('skill_path_enrollments')
            .whereRaw('skill_path_enrollments.user_id = learning_stats.user_id')
            .where('status', 'active'),
        )
      for (const row of rows) {
        await pushQueue.add({
          userId: row.user_id,
          notification: {
            title: 'Keep your streak going',
            body: `You're on a ${row.current_streak}-day streak — one unit keeps it alive.`,
            url: '/learn',
          },
        })
        await db('learning_stats')
          .where({ user_id: row.user_id })
          .update({ last_reminder_date: today, updated_at: db.fn.now() })
      }
      if (rows.length > 0) logger.info('Streak reminders enqueued', { universityId: uni.id, count: rows.length })
    }
  }
}

learningQueue.process(async () => {
  await runLearningSweep(new Date())
})

learningQueue.on('failed', (job, error) => {
  logger.error('Learning queue job failed', { jobId: job?.id, error })
})
```

- [ ] **Step 1: Write failing tests** (`learning.worker.test.ts`) — call `runLearningSweep` with fabricated `Date`s against the test DB (setup.ts gives migrations + seed university; set the seed university's timezone in the test):

```ts
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { db } from '../config/db'
import { TEST_UNIVERSITY_ID, CREDENTIALS } from '../__tests__/setup'

vi.mock('../queues/learning.queue', () => ({
  learningQueue: { add: vi.fn(), process: vi.fn(), on: vi.fn() },
}))
vi.mock('../queues/push.queue', () => ({
  pushQueue: { add: vi.fn() },
}))

import { runLearningSweep } from './learning.worker'
import { pushQueue } from '../queues/push.queue'

// Dhaka is UTC+6: 18:10Z = 00:10 local (sweep hour); 14:10Z = 20:10 local (reminder hour).
const SWEEP_INSTANT = new Date('2026-07-05T18:10:00Z')    // local date 2026-07-06
const REMINDER_INSTANT = new Date('2026-07-05T14:10:00Z') // local date 2026-07-05

let studentId: string

beforeAll(async () => {
  await db('universities').where({ id: TEST_UNIVERSITY_ID }).update({ timezone: 'Asia/Dhaka' })
  studentId = (await db('users').where({ email: CREDENTIALS.student.email }).first('id')).id
})

describe('runLearningSweep — midnight', () => {
  it('consumes a freeze for one missed day and is idempotent on rerun', async () => {
    await db('learning_stats')
      .insert({
        user_id: studentId, university_id: TEST_UNIVERSITY_ID,
        current_streak: 5, longest_streak: 5, last_activity_date: '2026-07-04',
        freezes_used_month: null, freezes_used_count: 0,
      })
      .onConflict('user_id')
      .merge()
    await runLearningSweep(SWEEP_INSTANT) // missed 2026-07-05
    let row = await db('learning_stats').where({ user_id: studentId }).first()
    expect(row.current_streak).toBe(5)
    expect(row.last_activity_date.toISOString().slice(0, 10)).toBe('2026-07-05')
    expect(row.freezes_used_count).toBe(1)
    await runLearningSweep(SWEEP_INSTANT) // rerun in the same hour must not double-consume
    row = await db('learning_stats').where({ user_id: studentId }).first()
    expect(row.freezes_used_count).toBe(1)
  })

  it('resets when monthly freezes are exhausted', async () => {
    await db('learning_stats').where({ user_id: studentId }).update({
      current_streak: 5, last_activity_date: '2026-07-04', freezes_used_month: '2026-07', freezes_used_count: 2,
    })
    await runLearningSweep(SWEEP_INSTANT)
    const row = await db('learning_stats').where({ user_id: studentId }).first()
    expect(row.current_streak).toBe(0)
  })
})

describe('runLearningSweep — reminder', () => {
  it('enqueues at most one push per day for streaked users with active enrollments', async () => {
    const [path] = await db('skill_paths').insert({ title: 'Reminder path', category: 'x' }).returning('id')
    await db('skill_path_enrollments')
      .insert({ user_id: studentId, path_id: path.id, university_id: TEST_UNIVERSITY_ID, status: 'active' })
      .onConflict(['user_id', 'path_id']).merge({ status: 'active' })
    await db('learning_stats').where({ user_id: studentId }).update({
      current_streak: 3, last_activity_date: '2026-07-04', last_reminder_date: null,
    })
    await runLearningSweep(REMINDER_INSTANT)
    expect(pushQueue.add).toHaveBeenCalledTimes(1)
    await runLearningSweep(REMINDER_INSTANT) // second run same day → no new push
    expect(pushQueue.add).toHaveBeenCalledTimes(1)
  })
})
```

(Note: `last_activity_date` comes back from pg as a `Date`; if the driver returns strings adjust the assertion. The mocks must be declared before importing the worker — `vi.mock` hoisting handles this.)

- [ ] **Step 2: Run to verify failure** — `npx pnpm --filter api test src/workers/learning.worker.test.ts` — FAIL (module missing).

- [ ] **Step 3: Implement queue + worker + `workers/index.ts` import.** One subtlety: `learning_stats.last_activity_date` is a pg `date` — normalize to `'YYYY-MM-DD'` strings when building `StreakStats` (`row.last_activity_date instanceof Date ? row.last_activity_date.toISOString().slice(0,10) : row.last_activity_date`).

- [ ] **Step 4: Run tests** — PASS, and re-run `learning.test.ts` + `streak.test.ts` to confirm no regressions.

- [ ] **Step 5: Typecheck + lint + commit**

```bash
git add apps/api/src/queues/learning.queue.ts apps/api/src/workers/learning.worker.ts apps/api/src/workers/index.ts apps/api/src/workers/learning.worker.test.ts
git commit -m "feat(api): learning queue + hourly worker — timezone-aware streak sweep and daily reminder push"
```

---

### Task 9: Migration 087 — platform-seeded skill paths + per-path badges; final verification

**Files:**
- Create: `apps/api/src/database/migrations/087_seed_platform_skill_paths.ts`

**Interfaces:**
- Produces two platform paths (`university_id: null`): "Interview prep 101" and "Git basics", 5 units each, plus one `path_completed` badge per path (`skill_path_id` set, category `'path'`).

- [ ] **Step 1: Write the migration**

```ts
import type { Knex } from 'knex'

const PATHS = [
  {
    title: 'Interview prep 101',
    description: 'A one-week crash course on acing your first technical and behavioural interviews.',
    category: 'career', difficulty: 'beginner', estimated_days: 5,
    badge_name: 'Interview ready', badge_icon: '🎤',
    units: [
      { title: 'How interviews actually work', type: 'read', content: { body: 'Formats, what screeners look for, and how to prepare a one-page story sheet.' } },
      { title: 'Telling your story (STAR method)', type: 'read', content: { body: 'Structure behavioural answers: Situation, Task, Action, Result — with two worked examples.' } },
      { title: 'Practice: write your STAR answers', type: 'exercise', content: { body: 'Draft STAR answers for “a conflict you resolved” and “a project you led”.' } },
      { title: 'Technical interview warm-up', type: 'read', content: { body: 'Thinking aloud, clarifying questions, and complexity trade-offs.' } },
      { title: 'Checkpoint quiz', type: 'quiz', content: { questions: [
        { q: 'What does the A in STAR stand for?', options: ['Answer', 'Action', 'Attitude', 'Analysis'], answer: 1 },
        { q: 'Best first move on an unclear problem?', options: ['Start coding', 'Ask clarifying questions', 'Guess', 'Skip it'], answer: 1 },
      ] }, completion_rule: { passScore: 70 } },
    ],
  },
  {
    title: 'Git basics',
    description: 'From init to your first merged pull request in five short days.',
    category: 'tools', difficulty: 'beginner', estimated_days: 5,
    badge_name: 'Git graduate', badge_icon: '🌿',
    units: [
      { title: 'Repositories, commits and the log', type: 'read', content: { body: 'git init, add, commit, log — what a commit really is.' } },
      { title: 'Branching without fear', type: 'read', content: { body: 'Branches as movable pointers; create, switch, delete.' } },
      { title: 'Practice: branch and commit', type: 'exercise', content: { body: 'Create a branch, make two commits, inspect with git log --graph.' } },
      { title: 'Merging and resolving conflicts', type: 'read', content: { body: 'Fast-forward vs merge commits; anatomy of a conflict marker.' } },
      { title: 'Checkpoint quiz', type: 'quiz', content: { questions: [
        { q: 'A branch is…', options: ['A copy of all files', 'A movable pointer to a commit', 'A remote server', 'A tag'], answer: 1 },
        { q: 'Which command shows commit history?', options: ['git status', 'git log', 'git show-all', 'git list'], answer: 1 },
      ] }, completion_rule: { passScore: 70 } },
    ],
  },
]

export async function up(knex: Knex) {
  for (const path of PATHS) {
    const { units, badge_name, badge_icon, ...pathRow } = path
    const [inserted] = await knex('skill_paths')
      .insert({ ...pathRow, badge_name, badge_icon, university_id: null })
      .returning('id')
    await knex('skill_path_units').insert(
      units.map((u, i) => ({
        path_id: inserted.id,
        display_order: i + 1,
        title: u.title,
        type: u.type,
        content: JSON.stringify(u.content),
        completion_rule: JSON.stringify('completion_rule' in u ? u.completion_rule : {}),
      })),
    )
    await knex('badges').insert({
      name: badge_name,
      description: `Completed the ${path.title} path`,
      icon_url: badge_icon,
      category: 'path',
      trigger_type: 'path_completed',
      trigger_count: 1,
      points: 25,
      skill_path_id: inserted.id,
    })
  }
}

export async function down(knex: Knex) {
  const titles = PATHS.map((p) => p.title)
  const ids = (await knex('skill_paths').whereIn('title', titles).whereNull('university_id').select('id')).map(
    (r: { id: string }) => r.id,
  )
  await knex('badges').whereIn('skill_path_id', ids).delete()
  await knex('skill_paths').whereIn('id', ids).delete() // units cascade
}
```

- [ ] **Step 2: Migrate + rollback round-trip** — as Task 1 Step 2; also verify `SELECT count(*) FROM skill_path_units` = 10 after migrate.

- [ ] **Step 3: Full verification**

Run: `npx pnpm typecheck && npx pnpm lint && npx pnpm --filter api test`
Expected: all green (web suite untouched; only the known ShuttleMap web failure exists elsewhere).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/database/migrations/087_seed_platform_skill_paths.ts
git commit -m "feat(api): migration 087 — seed platform skill paths with units and completion badges"
```

---

## Post-plan (controller responsibilities, not a task)

- Fable whole-branch final review, fix-wave, then push `feature/learning-api` and open a PR to `main` (note in the body: badges tables newly created — the pre-existing badge worker was referencing tables that never existed; migration numbering starts at 085, superseding the spec's "077").
- Update `.superpowers/sdd/progress.md` per task and the memory note at the end.
- Neon test branch teardown requires user approval.
