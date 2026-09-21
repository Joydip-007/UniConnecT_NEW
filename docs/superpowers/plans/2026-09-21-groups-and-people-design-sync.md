# Groups and People — design sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/groups` and `/groups/:id` (desktop + mobile, member + admin view, all six `GroupType`s) so they match `Groups and People.dc.html` exactly, adding the backend the design assumes.

**Architecture:** The detail page becomes a *page-scoped shell*: the left rail is replaced by "In this group" tabs + "Your groups", the right rail by an admin "Manage this group" card + "About this group" (+ member-only suggestions/tags). Tab state moves into the URL (`?tab=`) so the rail is pure data. New backend surfaces (post/event approval, announcements, ask-teacher, analytics, moderation log, suggestions, join-request history, group settings) are added as new routes on the existing `groups` module with one migration (`109_`). Every design overlay (Invite / Analytics / Moderation log / Members / Share / Book slot / Create group / Outline import) is a `Modal`.

**Tech Stack:** React 18 + Vite, TanStack Query, react-router, framer-motion, lucide-react, Express + Knex + Zod, Vitest + RTL + MSW, supertest.

**Spec:** `/Users/joydipdatta/Downloads/Uniconnect Furnished Design (2)/Groups and People.dc.html` (read the `<script data-dc-script>` block for state/logic; markup ids `#2a` detail, `#1a` directory). Companion: `Groups Mobile Refinements.dc.html`.

## Global Constraints

- Design tokens only: `var(--token)`; no hex. Borders `0.5px solid var(--border-*)`. No `box-shadow`, no `backdrop-filter`. Buttons `border-radius: var(--r-pill)`. Font weight 400/500 only. Sentence case.
- `--uc-orange*` = your own state (Joined, applied filter, admin card eyebrow); `--uc-indigo*` = interactive/other people's.
- Backend: services import `db`; `universityId` from `req.university.id`; `asyncHandler`; `sendSuccess`/`sendPaginated`; Zod 422; errors via `src/utils/errors.ts`. Next migration prefix is **`109_`** (then 110, 111…). Group role checks use `assertGroupAdminAccess` / `canModerate` in `groups/service.ts`.
- Frontend: data only in `hooks/` via TanStack Query; query keys `['groups', <action>, {…}]`; invalidate only in `onSuccess`. Pages are thin. `@/` alias.
- Tests: API via supertest + `loginAs` + `.set('x-university-domain', DOMAIN)`; web via RTL + MSW handlers starting with `*` (`*/groups/:id`), `vi.stubGlobal('IntersectionObserver', NoopObserver)` for infinite lists.
- Run before finishing every task: `npx pnpm typecheck && npx pnpm lint`. After UI tasks: `node scripts/screenshot.cjs groups` (and add `group-detail`, `group-detail-admin` routes in Task 22).
- Commit format `type(groups): …`; end body with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Deviations from the design (agreed, because no such data exists): "Invite by section" matches on **department + batch year** (profiles have no section); "Full directory" links to `/groups?section=people`; the group chat button links to the group's conversation (created on demand); share link is the real `/groups/:id` URL; Analytics "Reports open" counts `reports` rows whose target is a post in this group.

---

## File map

**API (`apps/api/src/`)**
- `database/migrations/109_add_group_moderation.ts` — groups settings columns, post/event `group_review_status`, `group_announcements`, `group_moderation_log`, `group_consultation_slots`, `group_consultation_bookings`.
- `modules/groups/schema.ts` — new Zod schemas (settings, announcements, review, slots, join-request status, suggestions).
- `modules/groups/service.ts` — new methods; moderation log writes.
- `modules/groups/controller.ts`, `modules/groups/router.ts` — new routes.
- `modules/feed/service.ts`, `modules/events/service.ts` — honour `require_post_approval` / `require_event_approval`.
- `modules/drafts/service.ts` — exclude pending-review posts/events from drafts.
- `modules/messages/service.ts` — `getOrCreateGroupConversation`, `getOrCreateDirect`.
- `__tests__/groups/moderation.test.ts`, `__tests__/groups/announcements.test.ts`, `__tests__/groups/ask-teacher.test.ts`, `__tests__/groups/analytics.test.ts`.

**Shared (`packages/shared/src/`)**
- `constants/socket.ts` — `GROUP_EVENTS.REVIEW_QUEUE_CHANGED`.

**Web (`apps/web/src/`)**
- `stores/pageRailStore.ts` — page-scoped left-rail override.
- `components/LeftSidebar.tsx` — renders override when set.
- `components/RightSidebar.tsx` — renders override when set.
- `features/groups/hooks/useGroupExtended.ts` — new hooks.
- `features/groups/types.ts` — new types.
- `features/groups/components/GroupHeader.tsx` — footer row (faces, +n others, Invite, Share, Chat), my-role tag.
- `features/groups/components/GroupLeftRail.tsx` — "In this group" + "Your groups".
- `features/groups/components/GroupRightRail.tsx` — Manage card, settings, About, suggestions, tags.
- `features/groups/components/GroupPanel.tsx` — the shared overlay frame; `InvitePanel.tsx`, `AnalyticsPanel.tsx`, `ModLogPanel.tsx`, `MembersPanel.tsx`.
- `features/groups/components/ShareGroupModal.tsx`.
- `features/groups/components/MobileTabStrip.tsx`, `MobileManageCard.tsx`.
- `features/groups/components/FeedTab.tsx` — pending posts queue + admin/member post menus.
- `features/groups/components/EventsTab.tsx` — Create event + pending events queue.
- `features/groups/components/ResourcesTab.tsx` — chip set per design.
- `features/groups/components/StudyToolsTab.tsx`, `StudySessionsTab.tsx` — Sessions/Decks, Upcoming/Past, notes disclosure.
- `features/groups/components/JoinRequestsTab.tsx` — filters, approve all, undo.
- `features/groups/components/AdminStatsTab.tsx` — five design cards.
- `features/groups/academic/AcademicLMSTab.tsx` — sub-tab order; `AnnouncementsPanel.tsx`; `AskTeacherPanel.tsx`; `BookSlotModal.tsx`.
- `features/groups/components/CreateGroupModal.tsx` — group kind + member picker; `OutlineImportWizard.tsx`.
- `pages/GroupDetailPage.tsx`, `pages/GroupsPage.tsx`.
- `styles/index.css` — `.group-detail-*` rules.
- `scripts/screenshot.cjs` — `group-detail`, `group-detail-admin`, `groups-mobile`.

---

## Phase 0 — Backend

### Task 1: Migration 109 — moderation, announcements, consultation tables

**Files:**
- Create: `apps/api/src/database/migrations/109_add_group_moderation.ts`

**Interfaces:**
- Produces columns `groups.require_post_approval`, `groups.require_event_approval` (bool, default false); `posts.group_review_status`, `events.group_review_status` (`varchar(10) NULL CHECK IN ('pending','approved','declined')`); tables `group_announcements`, `group_moderation_log`, `group_consultation_slots`, `group_consultation_bookings`.

- [ ] **Step 1: Write the migration**

```ts
import type { Knex } from 'knex'

/**
 * Group-level moderation (109).
 *  - Two admin toggles on `groups`.
 *  - A review status on posts/events. NULL = never needed review (the common case).
 *    A 'pending' row is stored with is_published=false so every existing public
 *    filter hides it; approving flips both.
 *  - Announcements (academic LMS), a moderation log, and consultation slots/bookings.
 */
export async function up(knex: Knex) {
  await knex.schema.alterTable('groups', (t) => {
    t.boolean('require_post_approval').notNullable().defaultTo(false)
    t.boolean('require_event_approval').notNullable().defaultTo(false)
  })

  for (const table of ['posts', 'events'] as const) {
    await knex.schema.alterTable(table, (t) => {
      t.string('group_review_status', 10).nullable()
    })
    await knex.raw(
      `ALTER TABLE ${table} ADD CONSTRAINT ${table}_group_review_status_check
       CHECK (group_review_status IS NULL OR group_review_status IN ('pending','approved','declined'))`,
    )
    await knex.raw(
      `CREATE INDEX idx_${table}_group_review ON ${table} (group_id, group_review_status)
       WHERE group_review_status = 'pending'`,
    )
  }

  await knex.schema.createTable('group_announcements', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    t.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    t.uuid('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE')
    t.uuid('author_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    t.string('title', 255).notNullable()
    t.text('body').notNullable()
    t.string('kind', 10).notNullable().defaultTo('notice')
    t.boolean('is_pinned').notNullable().defaultTo(false)
    t.boolean('notify_members').notNullable().defaultTo(false)
    t.jsonb('attachments').notNullable().defaultTo('[]')
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })
  await knex.raw(`ALTER TABLE group_announcements ADD CONSTRAINT group_announcements_kind_check
                  CHECK (kind IN ('urgent','schedule','notice'))`)
  await knex.raw(`CREATE INDEX idx_group_announcements_group ON group_announcements (group_id, is_pinned DESC, created_at DESC)`)

  await knex.schema.createTable('group_moderation_log', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    t.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    t.uuid('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE')
    t.uuid('actor_id').nullable().references('id').inTable('users').onDelete('SET NULL')
    t.string('kind', 10).notNullable() // post | member | settings
    t.string('action', 80).notNullable() // "Post removed"
    t.text('target').notNullable() // "Mahin Khan · repeated sponsor link"
    t.uuid('target_user_id').nullable().references('id').inTable('users').onDelete('SET NULL')
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })
  await knex.raw(`ALTER TABLE group_moderation_log ADD CONSTRAINT group_moderation_log_kind_check
                  CHECK (kind IN ('post','member','settings'))`)
  await knex.raw(`CREATE INDEX idx_group_moderation_log_group ON group_moderation_log (group_id, created_at DESC)`)

  await knex.schema.createTable('group_consultation_slots', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    t.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    t.uuid('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE')
    t.uuid('teacher_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    t.integer('weekday').notNullable() // 0..6, 0 = Sunday
    t.string('start_time', 5).notNullable() // "15:00"
    t.string('end_time', 5).notNullable()
    t.string('location', 255).notNullable()
    t.boolean('walk_in').notNullable().defaultTo(false)
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })
  await knex.raw(`CREATE INDEX idx_group_consultation_slots_group ON group_consultation_slots (group_id, weekday, start_time)`)

  await knex.schema.createTable('group_consultation_bookings', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    t.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    t.uuid('slot_id').notNullable().references('id').inTable('group_consultation_slots').onDelete('CASCADE')
    t.uuid('student_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    t.date('booked_for').notNullable()
    t.text('topic').notNullable()
    t.string('status', 10).notNullable().defaultTo('requested') // requested | confirmed | declined
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.unique(['slot_id', 'student_id', 'booked_for'])
  })
  await knex.raw(`ALTER TABLE group_consultation_bookings ADD CONSTRAINT group_consultation_bookings_status_check
                  CHECK (status IN ('requested','confirmed','declined'))`)
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('group_consultation_bookings')
  await knex.schema.dropTableIfExists('group_consultation_slots')
  await knex.schema.dropTableIfExists('group_moderation_log')
  await knex.schema.dropTableIfExists('group_announcements')
  for (const table of ['posts', 'events'] as const) {
    // Pending rows were unpublished on purpose; with the column gone they would become
    // ordinary drafts. Convert them back to published so nothing silently disappears.
    await knex(table).where({ group_review_status: 'pending' }).update({ is_published: true })
    await knex.raw(`DROP INDEX IF EXISTS idx_${table}_group_review`)
    await knex.raw(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${table}_group_review_status_check`)
    await knex.schema.alterTable(table, (t) => t.dropColumn('group_review_status'))
  }
  await knex.schema.alterTable('groups', (t) => {
    t.dropColumn('require_post_approval')
    t.dropColumn('require_event_approval')
  })
}
```

- [ ] **Step 2: Run migrate up then down then up against the scratch DB**

Run: `cd apps/api && DATABASE_URL=postgresql://$(whoami)@localhost:5432/uniconnect_db_test GEMINI_API_KEY=test-key npx knex migrate:latest --knexfile knexfile.ts && DATABASE_URL=… npx knex migrate:rollback --knexfile knexfile.ts && DATABASE_URL=… npx knex migrate:latest --knexfile knexfile.ts` (use the existing `db:migrate`/`db:rollback` scripts if they take the env — check `apps/api/package.json`).
Expected: three clean runs, `\d groups` shows the two new columns.

- [ ] **Step 3: Update CLAUDE.md "Latest migration" line**

Change `Latest migration: 108_add_post_admin_removal … Start the next migration at 109_` to `109_add_group_moderation … Start the next migration at 110_`.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/database/migrations/109_add_group_moderation.ts CLAUDE.md
git commit -m "feat(groups): migration 109 — approval toggles, review status, announcements, mod log, consultation slots"
```

---

### Task 2: Group settings + moderation log + join-request history

**Files:**
- Modify: `apps/api/src/modules/groups/schema.ts`
- Modify: `apps/api/src/modules/groups/service.ts`
- Modify: `apps/api/src/modules/groups/controller.ts`, `router.ts`
- Test: `apps/api/src/__tests__/groups/moderation.test.ts`

**Interfaces:**
- Produces `PATCH /groups/:id/settings { require_post_approval?, require_event_approval?, is_private? }` → `Group`.
- `GET /groups/:id` now returns `requirePostApproval`, `requireEventApproval`.
- `GET /groups/:id/moderation-log?kind=all|post|member|settings&page&limit` → `{ items: ModLogEntry[] }` where `ModLogEntry = { id, kind, action, target, actor: { id, fullName } | null, createdAt }`.
- `GET /groups/:id/join-requests?status=pending|approved|declined` (default pending) — approved/declined limited to last 30 days.
- `PATCH /groups/:id/join-requests/:requestId { action: 'approve'|'decline'|'undo' }` — `undo` reverts a reviewed request to pending (only if the user is not already a member for approve→undo: remove membership added by approval).
- Internal: `logModeration(trx, { universityId, groupId, actorId, kind, action, target, targetUserId? })` exported from `service.ts`.

- [ ] **Step 1: Write failing API tests**

```ts
// apps/api/src/__tests__/groups/moderation.test.ts
import request from 'supertest'
import { describe, it, expect, beforeAll } from 'vitest'
import { app } from '../../app'
import { DOMAIN, loginAs, SEED } from '../setup'

describe('group settings + moderation log', () => {
  let admin: { accessToken: string }
  let student: { accessToken: string }
  let groupId: string

  beforeAll(async () => {
    admin = await loginAs(SEED.faculty.email, SEED.faculty.password)
    student = await loginAs(SEED.student.email, SEED.student.password)
    const res = await request(app)
      .post('/api/v1/groups')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ name: 'Mod test', description: 'x', type: 'club', is_private: true })
    groupId = res.body.data.id
  })

  it('exposes approval toggles and logs a settings change', async () => {
    const res = await request(app)
      .patch(`/api/v1/groups/${groupId}/settings`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ require_post_approval: true })
    expect(res.status).toBe(200)
    expect(res.body.data.requirePostApproval).toBe(true)

    const log = await request(app)
      .get(`/api/v1/groups/${groupId}/moderation-log?kind=settings`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${admin.accessToken}`)
    expect(log.status).toBe(200)
    expect(log.body.data.items[0].action).toBe('Post approval turned on')
  })

  it('non-admins get 403 on settings and the log', async () => {
    const res = await request(app)
      .patch(`/api/v1/groups/${groupId}/settings`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${student.accessToken}`)
      .send({ require_post_approval: false })
    expect(res.status).toBe(403)
  })

  it('lists declined join requests and can undo', async () => {
    await request(app)
      .post(`/api/v1/groups/${groupId}/members`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${student.accessToken}`)
      .send({ message: 'let me in' })
    const pending = await request(app)
      .get(`/api/v1/groups/${groupId}/join-requests`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${admin.accessToken}`)
    const reqId = pending.body.data.items[0].id

    await request(app)
      .patch(`/api/v1/groups/${groupId}/join-requests/${reqId}`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ action: 'decline' })

    const declined = await request(app)
      .get(`/api/v1/groups/${groupId}/join-requests?status=declined`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${admin.accessToken}`)
    expect(declined.body.data.items.map((r: { id: string }) => r.id)).toContain(reqId)

    const undo = await request(app)
      .patch(`/api/v1/groups/${groupId}/join-requests/${reqId}`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ action: 'undo' })
    expect(undo.status).toBe(200)
    expect(undo.body.data.status).toBe('pending')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `DATABASE_URL="postgresql://$(whoami)@localhost:5432/uniconnect_db_test" GEMINI_API_KEY=test-key npx pnpm --filter api test src/__tests__/groups/moderation.test.ts`
Expected: FAIL (404 on `/settings`, `/moderation-log`).

- [ ] **Step 3: Schemas**

Add to `groups/schema.ts`:

```ts
export const UpdateGroupSettingsSchema = z
  .object({
    is_private: z.boolean().optional(),
    require_post_approval: z.boolean().optional(),
    require_event_approval: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' })
export type UpdateGroupSettingsInput = z.infer<typeof UpdateGroupSettingsSchema>

export const ModLogQuerySchema = PaginationQuerySchema.extend({
  kind: z.enum(['all', 'post', 'member', 'settings']).default('all'),
})
export type ModLogQuery = z.infer<typeof ModLogQuerySchema>

export const JoinRequestsQuerySchema = PaginationQuerySchema.extend({
  status: z.enum(['pending', 'approved', 'declined']).default('pending'),
})
export type JoinRequestsQuery = z.infer<typeof JoinRequestsQuerySchema>

export const ReviewJoinRequestSchema = z.object({
  action: z.enum(['approve', 'decline', 'undo']),
})
```

(If a `ReviewJoinRequestSchema` already exists with `approve|decline`, extend it in place.)

- [ ] **Step 4: Service**

In `groups/service.ts`:

1. Add `require_post_approval`, `require_event_approval` to the `GroupRow` select in `getGroup` / `toGroup` and emit `requirePostApproval`, `requireEventApproval` on the API shape.
2. Add module-level export:

```ts
export interface ModLogWrite {
  universityId: string
  groupId: string
  actorId: string | null
  kind: 'post' | 'member' | 'settings'
  action: string
  target: string
  targetUserId?: string | null
}

export async function logModeration(trx: Knex | Knex.Transaction, entry: ModLogWrite) {
  await trx('group_moderation_log').insert({
    university_id: entry.universityId,
    group_id: entry.groupId,
    actor_id: entry.actorId,
    kind: entry.kind,
    action: entry.action,
    target: entry.target,
    target_user_id: entry.targetUserId ?? null,
  })
}
```

3. Class methods:

```ts
  async updateSettings(context: AuthContext, groupId: string, input: UpdateGroupSettingsInput) {
    const access = await assertGroupAdminAccess(context, groupId)
    if (access.is_system) throw forbidden('System groups have no settings', 'GROUP_SYSTEM')
    const before = await db('groups')
      .select<{ is_private: boolean; require_post_approval: boolean; require_event_approval: boolean }[]>(
        'is_private', 'require_post_approval', 'require_event_approval')
      .where({ id: groupId }).first()
    if (!before) throw notFound('Group not found', 'GROUP_NOT_FOUND')

    await db.transaction(async (trx) => {
      await trx('groups').where({ id: groupId }).update({ ...input, updated_at: trx.fn.now() })
      const labels: [keyof UpdateGroupSettingsInput, string][] = [
        ['is_private', 'Private group'],
        ['require_post_approval', 'Post approval'],
        ['require_event_approval', 'Event approval'],
      ]
      for (const [key, label] of labels) {
        if (input[key] !== undefined && input[key] !== before[key]) {
          await logModeration(trx, {
            universityId: context.universityId, groupId, actorId: context.userId, kind: 'settings',
            action: `${label} turned ${input[key] ? 'on' : 'off'}`, target: 'Group settings',
          })
        }
      }
    })
    return this.getGroup(context, groupId)
  }

  async listModerationLog(context: AuthContext, groupId: string, query: ModLogQuery) {
    await assertGroupAdminAccess(context, groupId)
    const q = db('group_moderation_log as l')
      .leftJoin('profiles as p', 'p.user_id', 'l.actor_id')
      .where('l.group_id', groupId)
      .modify((qb) => { if (query.kind !== 'all') qb.where('l.kind', query.kind) })
    const [{ count }] = await q.clone().count<{ count: string }[]>({ count: '*' })
    const rows = await q
      .select('l.id', 'l.kind', 'l.action', 'l.target', 'l.actor_id', 'l.created_at', 'p.full_name as actor_name')
      .orderBy('l.created_at', 'desc')
      .limit(query.limit).offset((query.page - 1) * query.limit)
    return {
      items: rows.map((r) => ({
        id: r.id, kind: r.kind, action: r.action, target: r.target, createdAt: r.created_at,
        actor: r.actor_id ? { id: r.actor_id, fullName: r.actor_name ?? null } : null,
      })),
      total: Number(count), page: query.page, limit: query.limit,
    }
  }
```

4. Change `listJoinRequests(context, groupId, query: JoinRequestsQuery)`: replace both `status: 'pending'` filters with `status: query.status`, and when `query.status !== 'pending'` add `.where('group_join_requests.reviewed_at', '>=', db.raw("now() - interval '30 days'"))`; order `desc` for reviewed.
5. Change `reviewJoinRequest(…, action: 'approve'|'decline'|'undo')`: on `undo`, load the request; if `status === 'approved'` delete the `group_members` row for that user (and decrement `member_count`); set `status='pending', reviewed_by=null, reviewed_at=null`. On approve/decline, after the update call `logModeration(trx, { kind:'member', action: action==='approve' ? 'Join request approved' : 'Join request declined', target: `${requesterName}${message ? ' · ' + message : ''}`, targetUserId })`.
6. In `updateMember` (role change) log `kind:'member'`, action `Moderator added` / `Admin added` / `Role removed`; in `removeMember` log `Member removed`.

- [ ] **Step 5: Controller + router**

```ts
// controller.ts
export const updateSettings = asyncHandler(async (req, res) => {
  const context = getAuthContext(req)
  sendSuccess(res, await groupsService.updateSettings(context, req.params.groupId, req.body))
})
export const listModerationLog = asyncHandler(async (req, res) => {
  const context = getAuthContext(req)
  const r = await groupsService.listModerationLog(context, req.params.groupId, req.query as unknown as ModLogQuery)
  sendPaginated(res, r.items, r.total, r.page, r.limit)
})
```

```ts
// router.ts (before '/:groupId/join-requests/:requestId')
groupsRouter.patch('/:groupId/settings', requireAuth, validate(UpdateGroupSettingsSchema), updateSettings)
groupsRouter.get('/:groupId/moderation-log', requireAuth, validateRequest({ query: ModLogQuerySchema }), listModerationLog)
```

Swap the join-requests list validator to `JoinRequestsQuerySchema` and the review validator to `ReviewJoinRequestSchema`.

- [ ] **Step 6: Run tests → PASS; typecheck + lint**

Run the same vitest command; then `npx pnpm typecheck && npx pnpm lint`.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/groups apps/api/src/__tests__/groups/moderation.test.ts
git commit -m "feat(groups): settings toggles, moderation log, join-request history + undo"
```

---

### Task 3: Post & event approval queues

**Files:**
- Modify: `apps/api/src/modules/feed/service.ts:255-275` (createPost insert), `listGroupPosts`
- Modify: `apps/api/src/modules/events/service.ts:93-110` (createEvent)
- Modify: `apps/api/src/modules/drafts/service.ts` (exclude `group_review_status = 'pending'`)
- Modify: `apps/api/src/modules/groups/{schema,service,controller,router}.ts`
- Modify: `packages/shared/src/constants/socket.ts`
- Test: `apps/api/src/__tests__/groups/review-queue.test.ts`

**Interfaces:**
- `GET /groups/:id/review/posts` → `{ items: FeedPost[] }` (pending, admin/mod only).
- `GET /groups/:id/review/events` → `{ items: Event[] }`.
- `PATCH /groups/:id/review/posts/:postId { action: 'approve'|'decline' }`; same for `/review/events/:eventId`.
- `GET /groups/:id/review/summary` → `{ pendingPosts: number, pendingEvents: number, pendingJoinRequests: number, reportsOpen: number }` (admin/mod). This feeds the right-rail "Manage this group" card and the mobile card.
- Socket: `GROUP_EVENTS.REVIEW_QUEUE_CHANGED = 'group:review-queue-changed'` emitted to `user:{adminId}` rooms of every owner/admin/mod after a pending insert.

- [ ] **Step 1: Failing test**

```ts
// apps/api/src/__tests__/groups/review-queue.test.ts
it('holds a member post when require_post_approval is on, and approving publishes it', async () => {
  // faculty creates club with approval on; student joins (public); student posts; admin sees it in queue;
  // GET /groups/:id/posts does NOT include it; PATCH approve; now it does.
})
```
Write the full flow using the same supertest pattern as Task 2 (`POST /groups`, `PATCH /settings { require_post_approval: true }`, `POST /groups/:id/members` as student, `POST /posts { type:'post', content:'hi', group_id }` as student → 201 with `data.groupReviewStatus === 'pending'`, `GET /groups/:id/review/posts` as faculty has 1 item, `GET /groups/:id/posts` has 0, `PATCH …/review/posts/:postId {action:'approve'}` → 200, `GET /groups/:id/posts` has 1).

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Feed + events service**

In `feed/service.ts` `createPost`, before the transaction:

```ts
let reviewPending = false
if (input.group_id) {
  const g = await db('groups')
    .leftJoin('group_members as m', function () {
      this.on('m.group_id', '=', 'groups.id').andOn('m.user_id', '=', db.raw('?', [context.userId]))
    })
    .select<{ require_post_approval: boolean; role: string | null }[]>('groups.require_post_approval', 'm.role')
    .where('groups.id', input.group_id).first()
  const moderator = g?.role === 'owner' || g?.role === 'admin' || g?.role === 'moderator'
  reviewPending = !!g?.require_post_approval && !moderator && !isScheduled
}
```
and in the insert: `is_published: reviewPending ? false : isPublished, group_review_status: reviewPending ? 'pending' : null`. Add `groupReviewStatus: row.group_review_status ?? null` to the post mapper and `posts.group_review_status` to the select lists. After commit, if `reviewPending`, call `notifyGroupReviewers(input.group_id)` (below). Do the same in `events/service.ts` with `require_event_approval` (events' `is_published` defaults false already — set `group_review_status:'pending'` and keep `is_published:false`; approval sets `is_published:true`).

In `drafts/service.ts`, add `.whereNull('group_review_status')` (or `.where((qb) => qb.whereNull(...).orWhereNot(...,'pending'))`) to the posts and events draft queries.

- [ ] **Step 4: Groups service**

```ts
  async listPendingPosts(context: AuthContext, groupId: string) {
    const access = await assertGroupAccess(context, groupId)
    if (!canModerate(access.user_role)) throw forbidden('Moderator required', 'GROUP_MOD_REQUIRED')
    return feedService.listPostsByIds(
      context.universityId, context.userId,
      await db('posts').where({ group_id: groupId, group_review_status: 'pending' }).orderBy('created_at').pluck('id'),
    )
  }
```
(`feedService.listPostsByIds(universityId, userId, ids)` — add to feed service if missing; it reuses the existing `FeedPost` mapper. The `listPostsForAdmin` machinery from the admin module is the pattern to copy.)

```ts
  async reviewPost(context: AuthContext, groupId: string, postId: string, action: 'approve' | 'decline') {
    const access = await assertGroupAccess(context, groupId)
    if (!canModerate(access.user_role)) throw forbidden('Moderator required', 'GROUP_MOD_REQUIRED')
    const post = await db('posts').leftJoin('profiles as p', 'p.user_id', 'posts.author_id')
      .select('posts.id', 'posts.author_id', 'posts.content', 'p.full_name')
      .where({ 'posts.id': postId, 'posts.group_id': groupId, 'posts.group_review_status': 'pending' }).first()
    if (!post) throw notFound('Post not found', 'POST_NOT_FOUND')
    await db.transaction(async (trx) => {
      await trx('posts').where({ id: postId }).update(
        action === 'approve' ? { is_published: true, group_review_status: 'approved' } : { group_review_status: 'declined', archived_at: trx.fn.now() })
      await logModeration(trx, {
        universityId: context.universityId, groupId, actorId: context.userId, kind: 'post',
        action: action === 'approve' ? 'Queued post approved' : 'Queued post declined',
        target: `${post.full_name ?? 'Member'} · ${post.content.slice(0, 60)}`, targetUserId: post.author_id,
      })
    })
    if (action === 'approve') getIo().to(`uni:${context.universityId}`).emit(UNIVERSITY_EVENTS.POST_CREATED, { postId })
  }

  async reviewSummary(context: AuthContext, groupId: string) {
    const access = await assertGroupAccess(context, groupId)
    if (!canModerate(access.user_role)) throw forbidden('Moderator required', 'GROUP_MOD_REQUIRED')
    const [posts, events, joins, reports] = await Promise.all([
      db('posts').where({ group_id: groupId, group_review_status: 'pending' }).count({ c: '*' }).first(),
      db('events').where({ group_id: groupId, group_review_status: 'pending' }).count({ c: '*' }).first(),
      db('group_join_requests').where({ group_id: groupId, status: 'pending' }).count({ c: '*' }).first(),
      db('reports').where({ target_type: 'post', status: 'pending' })
        .whereIn('target_id', db('posts').select('id').where({ group_id: groupId })).count({ c: '*' }).first(),
    ])
    return { pendingPosts: Number(posts?.c ?? 0), pendingEvents: Number(events?.c ?? 0),
      pendingJoinRequests: Number(joins?.c ?? 0), reportsOpen: Number(reports?.c ?? 0) }
  }
```
Mirror `listPendingEvents` / `reviewEvent` using `eventsService` mapper. Add `notifyGroupReviewers(groupId)` that selects owner/admin/moderator user ids and emits `GROUP_EVENTS.REVIEW_QUEUE_CHANGED` `{ groupId }` to each `user:{id}` room; export it and call from feed/events services (import from `../groups/service` — feed already imports groups helpers? if it would create a cycle, put `notifyGroupReviewers` in `apps/api/src/modules/groups/review-notify.ts` with only `db` + `getIo` imports).

- [ ] **Step 5: Routes**

```ts
groupsRouter.get('/:groupId/review/summary', requireAuth, reviewSummary)
groupsRouter.get('/:groupId/review/posts', requireAuth, listPendingPosts)
groupsRouter.patch('/:groupId/review/posts/:postId', requireAuth, validate(ReviewActionSchema), reviewPost)
groupsRouter.get('/:groupId/review/events', requireAuth, listPendingEvents)
groupsRouter.patch('/:groupId/review/events/:eventId', requireAuth, validate(ReviewActionSchema), reviewEvent)
```
`ReviewActionSchema = z.object({ action: z.enum(['approve','decline']) })`.

Add to `packages/shared/src/constants/socket.ts`: `export const GROUP_EVENTS = { REVIEW_QUEUE_CHANGED: 'group:review-queue-changed' } as const` and export from the barrel; rebuild shared (`npx pnpm --filter @uniconnect/shared build`).

- [ ] **Step 6: Tests PASS, typecheck, lint, commit**

```bash
git commit -am "feat(groups): post and event approval queues with review summary"
```

---

### Task 4: Analytics, suggestions, group chat, direct chat with teacher

**Files:**
- Modify: `apps/api/src/modules/groups/{service,controller,router,schema}.ts`
- Modify: `apps/api/src/modules/messages/service.ts` (expose `getOrCreateDirect(context, otherUserId)` and `getOrCreateGroupConversationForGroup(context, groupId)`).
- Test: `apps/api/src/__tests__/groups/analytics.test.ts`

**Interfaces:**
- `GET /groups/:id/analytics` (admin/mod) → `{ members: number, membersDelta7d: number, posts30d: number, postsDeltaPct: number|null, activePct: number, reportsOpen: number, postsPerWeek: { label: string, count: number }[] (5 entries, oldest first, label "Week 1".."This week"), topMembers: { id, fullName, avatarUrl, posts: number, replies: number }[] (3) }`.
- `GET /groups/suggestions?limit=4` → `{ items: Group[] }` (non-member, public or private, ordered by `knownMemberCount desc, member_count desc`). **Declared before `/:groupId`.**
- `GET /groups/:id/stats` now returns `{ members, postsThisWeek, active30d, resources, upcomingEvents }` (the design's five) — keep the old keys too so the contextual rail keeps working.
- `POST /groups/:id/chat` (member, academic only) → `{ conversationId }`. Creates a `conversations` row `type:'group', is_group:true, name: group.name` with all current members as participants the first time; stored via new nullable column? **No new column** — look it up by `conversation_participants` is not reliable, so add `groups.chat_conversation_id uuid NULL REFERENCES conversations(id) ON DELETE SET NULL` in a **migration `110_add_group_chat_conversation.ts`**. Subsequent member joins/leaves add/remove participants (hook into `joinGroup`/`leaveGroup`/`removeMember`/`reviewJoinRequest approve`).
- `POST /groups/:id/ask-teacher` (member, academic) → `{ conversationId, teacher: { id, fullName, avatarUrl, department } }` — direct conversation with the group **owner**.
- `GET /groups/:id/ask-teacher/queue` (owner/admin, academic) → `{ items: { conversationId, student: {id, fullName, avatarUrl}, lastMessage: string, lastAt: string, unread: number }[] }` — direct conversations between the owner and any member of the group, ordered by `lastAt desc`.

- [ ] **Step 1: Failing tests** — analytics returns 5 `postsPerWeek` buckets and 403 for a member; suggestions excludes joined groups; `POST /chat` on a non-academic group → 400 `GROUP_NOT_ACADEMIC`; `ask-teacher` returns the same conversation id twice.

- [ ] **Step 2: Migration 110**

```ts
export async function up(knex: Knex) {
  await knex.schema.alterTable('groups', (t) => {
    t.uuid('chat_conversation_id').nullable().references('id').inTable('conversations').onDelete('SET NULL')
  })
}
export async function down(knex: Knex) {
  await knex.schema.alterTable('groups', (t) => t.dropColumn('chat_conversation_id'))
}
```
Bump CLAUDE.md latest migration to `110_…`, next `111_`.

- [ ] **Step 3: Service — analytics**

```ts
  async getAnalytics(context: AuthContext, groupId: string) {
    const access = await assertGroupAccess(context, groupId)
    if (!canModerate(access.user_role)) throw forbidden('Moderator required', 'GROUP_MOD_REQUIRED')
    const base = db('posts').where({ group_id: groupId, is_published: true }).whereNull('archived_at')
    const [members, newMembers, posts30, postsPrev30, active, reports, weeks, top] = await Promise.all([
      db('group_members').where({ group_id: groupId }).count({ c: '*' }).first(),
      db('group_members').where({ group_id: groupId }).where('joined_at', '>=', db.raw("now() - interval '7 days'")).count({ c: '*' }).first(),
      base.clone().where('created_at', '>=', db.raw("now() - interval '30 days'")).count({ c: '*' }).first(),
      base.clone().whereBetween('created_at', [db.raw("now() - interval '60 days'"), db.raw("now() - interval '30 days'")]).count({ c: '*' }).first(),
      base.clone().where('created_at', '>=', db.raw("now() - interval '30 days'")).countDistinct({ c: 'author_id' }).first(),
      db('reports').where({ target_type: 'post', status: 'pending' }).whereIn('target_id', db('posts').select('id').where({ group_id: groupId })).count({ c: '*' }).first(),
      db.raw(
        `SELECT g.week_start, COUNT(p.id)::int AS count
           FROM generate_series(date_trunc('week', now()) - interval '4 weeks', date_trunc('week', now()), interval '1 week') AS g(week_start)
           LEFT JOIN posts p ON p.group_id = ? AND p.is_published AND p.archived_at IS NULL
             AND p.created_at >= g.week_start AND p.created_at < g.week_start + interval '1 week'
          GROUP BY g.week_start ORDER BY g.week_start`, [groupId]),
      db.raw(
        `SELECT u.id, pr.full_name, pr.avatar_url,
                COUNT(DISTINCT p.id)::int AS posts, COUNT(DISTINCT c.id)::int AS replies
           FROM users u JOIN profiles pr ON pr.user_id = u.id
           LEFT JOIN posts p ON p.author_id = u.id AND p.group_id = ? AND p.created_at >= now() - interval '30 days'
           LEFT JOIN comments c ON c.author_id = u.id AND c.post_id IN (SELECT id FROM posts WHERE group_id = ?)
             AND c.created_at >= now() - interval '30 days'
          WHERE u.id IN (SELECT user_id FROM group_members WHERE group_id = ?)
          GROUP BY u.id, pr.full_name, pr.avatar_url
          HAVING COUNT(DISTINCT p.id) + COUNT(DISTINCT c.id) > 0
          ORDER BY posts DESC, replies DESC LIMIT 3`, [groupId, groupId, groupId]),
    ])
    const memberCount = Number(members?.c ?? 0)
    const p30 = Number(posts30?.c ?? 0), pPrev = Number(postsPrev30?.c ?? 0)
    const labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'This week']
    return {
      members: memberCount,
      membersDelta7d: Number(newMembers?.c ?? 0),
      posts30d: p30,
      postsDeltaPct: pPrev === 0 ? null : Math.round(((p30 - pPrev) / pPrev) * 100),
      activePct: memberCount === 0 ? 0 : Math.round((Number(active?.c ?? 0) / memberCount) * 100),
      reportsOpen: Number(reports?.c ?? 0),
      postsPerWeek: (weeks.rows as { count: number }[]).map((r, i) => ({ label: labels[i] ?? `Week ${i + 1}`, count: r.count })),
      topMembers: (top.rows as { id: string; full_name: string; avatar_url: string | null; posts: number; replies: number }[])
        .map((r) => ({ id: r.id, fullName: r.full_name, avatarUrl: r.avatar_url, posts: r.posts, replies: r.replies })),
    }
  }
```
(Check the real column names first: `group_members.joined_at` vs `created_at`; `comments.author_id` vs `user_id` — `psql -d uniconnect_db -c '\d comments'`.)

- [ ] **Step 4: Service — suggestions, stats, chat, ask-teacher**

`listSuggestions(context, limit)`: reuse `listGroups` internals filtered `whereNotIn('groups.id', memberGroupIds)`, then `loadGroupSocialProof`, sort by `knownMemberCount desc, member_count desc`, slice `limit`.

`getGroupStats` — add `resources` (`count group_resources`), `upcomingEvents` (`events where group_id and start_date >= now()`), `members` and `active30d` (distinct post authors 30d) while keeping the existing keys.

`openGroupChat(context, groupId)`:
```ts
const group = await assertMemberAccess(context, groupId)
const row = await db('groups').select('type','name','chat_conversation_id').where({ id: groupId }).first()
if (row.type !== 'academic') throw badRequest('Only class groups have a group chat', 'GROUP_NOT_ACADEMIC')
if (row.chat_conversation_id) return { conversationId: row.chat_conversation_id }
const memberIds = await db('group_members').where({ group_id: groupId }).pluck('user_id')
const conversationId = await messagesService.createGroupConversationForGroup(context, { name: row.name, participantIds: memberIds })
await db('groups').where({ id: groupId }).update({ chat_conversation_id: conversationId })
return { conversationId }
```
Add `messagesService.createGroupConversationForGroup` (thin wrapper around the private `createGroupConversation` that skips the "creator must be included" check and returns the id) and `messagesService.getOrCreateDirect(context, otherUserId)` (reuse the direct-conversation lookup at `messages/service.ts:128-180`). In `addMember`/`removeMember`/`leaveGroup`/approve paths: if `chat_conversation_id` set, insert/delete `conversation_participants`.

`askTeacher(context, groupId)`: `assertMemberAccess`; require `type==='academic'`; teacher = `group_members where role='owner'` first row (fallback `groups.created_by`); `conversationId = await messagesService.getOrCreateDirect(context, teacherId)`; return with teacher profile.

`askTeacherQueue(context, groupId)`: `assertGroupAdminAccess`; owner id as above; query direct conversations where participants = {owner, memberOfGroup}; join last message; unread = messages after the owner's `last_read_at` (check `conversation_participants` columns).

- [ ] **Step 5: Routes**

```ts
groupsRouter.get('/suggestions', requireAuth, listSuggestions) // BEFORE '/:groupId'
groupsRouter.get('/:groupId/analytics', requireAuth, getAnalytics)
groupsRouter.post('/:groupId/chat', requireAuth, openGroupChat)
groupsRouter.post('/:groupId/ask-teacher', requireAuth, askTeacher)
groupsRouter.get('/:groupId/ask-teacher/queue', requireAuth, askTeacherQueue)
```

- [ ] **Step 6: Tests PASS, typecheck, lint, commit** `feat(groups): analytics, suggestions, group chat, ask-teacher`

---

### Task 5: Announcements + consultation slots/bookings

**Files:**
- Modify: `apps/api/src/modules/groups/{schema,service,controller,router}.ts`
- Test: `apps/api/src/__tests__/groups/announcements.test.ts`

**Interfaces:**
- `GET /groups/:id/announcements` (member) → `{ items: Announcement[] }` pinned first. `Announcement = { id, title, body, kind: 'urgent'|'schedule'|'notice', isPinned, attachments, author: {id, fullName}, createdAt }`.
- `POST /groups/:id/announcements { title, body, kind, notify_members, attachments? }` (admin, academic) → `Announcement`; when `notify_members` enqueue `notification` queue job `{ type: 'group_announcement', userIds: memberIds, referenceId: groupId }` (follow how `group_invite` notifications are enqueued in this service).
- `PATCH /groups/:id/announcements/:announcementId { is_pinned? , title?, body?, kind? }`; `DELETE …`.
- `GET /groups/:id/consultation-slots` (member) → `{ items: Slot[] }` with `Slot = { id, weekday, startTime, endTime, location, walkIn, nextOccurrence: string (ISO date), myBooking: { id, status } | null, bookings?: Booking[] (admin only) }`.
- `POST /groups/:id/consultation-slots { weekday, start_time, end_time, location, walk_in }` (owner/admin) ; `DELETE …/:slotId`.
- `POST /groups/:id/consultation-slots/:slotId/book { topic }` (member) → `Booking { id, slotId, bookedFor, topic, status }` for the next occurrence; 409 if already booked.
- `PATCH /groups/:id/consultation-slots/:slotId/bookings/:bookingId { status: 'confirmed'|'declined' }` (owner/admin).

- [ ] **Step 1: Failing tests** — create announcement as owner (201, `kind:'urgent'`), member cannot (403), list returns pinned first; create slot, student books (201), second booking → 409, owner confirms → `status:'confirmed'`.

- [ ] **Step 2: Schemas**

```ts
export const CreateAnnouncementSchema = z.object({
  title: z.string().trim().min(1).max(255),
  body: z.string().trim().min(1).max(5000),
  kind: z.enum(['urgent', 'schedule', 'notice']).default('notice'),
  notify_members: z.boolean().default(false),
  attachments: z.array(z.object({ name: z.string(), url: z.string().url(), contentType: z.string(), size: z.number() })).max(5).default([]),
})
export const UpdateAnnouncementSchema = CreateAnnouncementSchema.omit({ notify_members: true, attachments: true })
  .partial().extend({ is_pinned: z.boolean().optional() })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' })
export const CreateSlotSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  location: z.string().trim().min(1).max(255),
  walk_in: z.boolean().default(false),
})
export const BookSlotSchema = z.object({ topic: z.string().trim().min(1).max(500) })
export const ReviewBookingSchema = z.object({ status: z.enum(['confirmed', 'declined']) })
```

- [ ] **Step 3: Service** — straightforward CRUD with `assertMemberAccess` for reads/booking and `assertGroupAdminAccess` for writes; announcements require `type==='academic'` (`badRequest('Announcements are for class groups','GROUP_NOT_ACADEMIC')`). `nextOccurrence`: compute in SQL `(current_date + ((weekday - extract(dow from current_date)::int + 7) % 7))::date`. Booking insert catches unique violation (`code === '23505'`) → `conflict('Already booked','SLOT_ALREADY_BOOKED')`. Booking status change enqueues a `notification` to the student (`type:'consultation_booking'`).

- [ ] **Step 4: Routes** (all under `/:groupId/announcements…`, `/:groupId/consultation-slots…` with `validate`).

- [ ] **Step 5: Tests PASS, typecheck, lint, commit** `feat(groups): announcements and consultation slot bookings`

---

### Task 6: Course-outline import + bulk invite

**Files:**
- Modify: `apps/api/src/modules/academic/{schema,service,controller,router}.ts`
- Modify: `apps/api/src/modules/groups/{schema,service,controller,router}.ts`
- Modify: `apps/api/src/services/ai.service.ts`
- Test: `apps/api/src/__tests__/academic/outline-import.test.ts`, `apps/api/src/__tests__/groups/bulk-invite.test.ts`

**Interfaces:**
- `POST /groups/course-outline/draft { file_url, roster_url? }` (faculty/admin) → `{ draft: CourseOutlineInput & { courseCode, courseTitle, section?: string, assignments: { title, dueDate: string|null, topic: string|null, kind: 'assignment'|'class_test' }[] }, rosterEmails: string[] }`. Fetches the file (S3 URL must be under `AWS_PUBLIC_URL`), extracts text (pdf via `pdf-parse`, docx via `mammoth` — check `packages`/`apps/api/package.json` before adding; add to `pnpm-workspace.yaml allowBuilds` if prompted), calls `ai.service.extractCourseOutline(text)` which prompts Gemini for strict JSON `{ courseCode, courseTitle, section, topics:[{weekNumber,title,dateRange}], assessments:[{categoryName, weightPercent, fullMarks, totalGiven}], assignments:[{title,dueDate,topic,kind}] }` with the existing `callGemini` retry path. Roster CSV: parse emails column.
- `POST /groups/from-outline { name, section, draft, is_private }` (faculty/admin) → creates the academic group (`type:'academic'`, `allowed_role:'student'`) **and** saves the outline in one transaction (reuse `academicService.saveCourseOutline` with `mode:'create'`, and create `assignments` rows from `draft.assignments` with `is_published:false`). Returns `Group`.
- `POST /groups/:id/invitations/bulk { department?: string, batch_year?: number, emails?: string[] }` (admin) → `{ invited: number, skipped: number, mailed: number }`. Matches `profiles` on department/batch within the university, skips existing members and already-invited, invites via the existing single-invite path; unknown emails get an `email` queue job with the `/groups/:id` link.
- `GET /groups/invite-match?department=&batch_year=` (faculty/admin) → `{ count: number }` for the "N students match" line.

- [ ] **Step 1: Failing tests** — `POST /groups/from-outline` with a hand-written draft creates group + outline (GET `/groups/:id/course-outline` returns topics); bulk invite with the seed student's department returns `invited >= 1` and a second call `skipped >= 1`; `draft` endpoint is unit-tested by mocking `callGemini` (see `ai.service.test.ts` for the mock pattern) with a small text fixture.

- [ ] **Step 2–4: Implement schemas, service, routes.** `from-outline` and `course-outline/draft` and `invite-match` are declared **before `/:groupId`** in `groups/router.ts`.

- [ ] **Step 5: Tests PASS, typecheck, lint, commit** `feat(groups): course-outline import draft, create-from-outline, bulk invites`

---

## Phase 1 — Page-scoped shell

### Task 7: `pageRailStore` + LeftSidebar/RightSidebar overrides

**Files:**
- Create: `apps/web/src/stores/pageRailStore.ts`
- Modify: `apps/web/src/components/LeftSidebar.tsx`, `apps/web/src/components/RightSidebar.tsx`
- Test: `apps/web/src/components/LeftSidebar.test.tsx` (add a case), `apps/web/src/stores/pageRailStore.test.ts`

**Interfaces:**
```ts
// pageRailStore.ts
import { create } from 'zustand'
import type { ReactNode } from 'react'

interface PageRailState {
  /** Replaces the fixed nav + contextual zone + tools; the profile card stays. */
  leftOverride: ReactNode | null
  /** Replaces the manifest widgets entirely. */
  rightOverride: ReactNode | null
  setLeftOverride: (node: ReactNode | null) => void
  setRightOverride: (node: ReactNode | null) => void
}
export const usePageRailStore = create<PageRailState>((set) => ({
  leftOverride: null, rightOverride: null,
  setLeftOverride: (node) => set({ leftOverride: node }),
  setRightOverride: (node) => set({ rightOverride: node }),
}))

/** Mount-scoped: sets the override on mount, clears it on unmount. */
export function usePageRails(left: ReactNode | null, right: ReactNode | null) {
  const setLeft = usePageRailStore((s) => s.setLeftOverride)
  const setRight = usePageRailStore((s) => s.setRightOverride)
  useEffect(() => { setLeft(left); setRight(right) }, [left, right, setLeft, setRight])
  useEffect(() => () => { setLeft(null); setRight(null) }, [setLeft, setRight])
}
```

- [ ] **Step 1: Failing test** — render `LeftSidebar` inside a MemoryRouter + QueryClient with `usePageRailStore.setState({ leftOverride: <div>In this group</div> })`; assert `screen.getByText('In this group')` and `screen.queryByText('Campus tools')` is null, while the profile card name is still rendered.

- [ ] **Step 2: Implement store + wire**

In `LeftSidebar.tsx` after the profile card: `const leftOverride = usePageRailStore((s) => s.leftOverride)`; `if (leftOverride) return <aside …same aside styles…>{toggle}{profileCard}{collapsed ? null : leftOverride}</aside>`. Extract the profile card JSX into a local `ProfileMiniCard` function so it's not duplicated. In `RightSidebar.tsx`: `const rightOverride = usePageRailStore((s) => s.rightOverride); if (rightOverride) return <aside …same styles…>{rightOverride}</aside>` (before the empty-manifest `return null`). `FeedLayout`'s `wide` must stay driven by the manifest (driver only).

- [ ] **Step 3: Tests PASS, typecheck, lint, commit** `feat(shell): page-scoped left/right rail overrides`

---

### Task 8: Detail page URL tab state + `GroupLeftRail`

**Files:**
- Create: `apps/web/src/features/groups/components/GroupLeftRail.tsx`
- Modify: `apps/web/src/pages/GroupDetailPage.tsx`, `apps/web/src/features/groups/index.ts`, `apps/web/src/features/groups/hooks/useGroupExtended.ts` (add `useMyGroups`), `apps/web/src/styles/index.css` (delete `.group-detail-body` / `.group-tab-rail` rules).
- Delete: `apps/web/src/features/groups/components/GroupTabRail.tsx` + its test (superseded).
- Test: `apps/web/src/features/groups/components/GroupLeftRail.test.tsx`

**Interfaces:**
- Tab value union `GroupTab = 'feed'|'resources'|'study-sessions'|'academic'|'events'|'stats'|'join-requests'`; URL `?tab=` (absent = default tab below).
- `groupTabsFor(group: Group, opts: { pendingCount: number }): GroupTabDef[]` exported from `GroupLeftRail.tsx` — order `Feed, Resources, Study sessions, [Academic LMS if academic], Events, [Stats if owner/admin/moderator], [Join requests if owner/admin, badge]`.
- `defaultTabFor(group)`: `academic → 'academic'`, else `'feed'`.
- `GroupLeftRail({ group, activeTab, pendingCount })` renders `In this group` nav (rows = 44px min-height, icon 16, orange 2px marker on active, `var(--surface-hover)` bg on active, badge pill orange) then a divider and `Your groups` list from `useMyGroups()` (32px rounded-square initials tile in `TYPE_LOOK` tone, name 12px/500, navigates to `/groups/:id`). Rows navigate with `navigate({ search })` keeping other params.
- `useMyGroups()` → `useQuery({ queryKey: ['groups','my'], queryFn: GET /groups/my?limit=20, staleTime: 60_000 })`.

- [ ] **Step 1: Failing test** — for an academic admin group, rows are exactly `Feed, Resources, Study sessions, Academic LMS, Events, Stats, Join requests` and `Join requests` shows badge `3`; for a non-member club member view: no Stats/Join requests; clicking `Events` calls navigate with `?tab=events`.

- [ ] **Step 2: Implement**

```tsx
// GroupLeftRail.tsx (core of the nav row)
<button type="button" role="tab" aria-selected={on} onClick={() => go(t.value)} style={{
  position: 'relative', display: 'flex', alignItems: 'center', gap: 9, width: '100%', minHeight: 44,
  padding: '8px 10px', fontSize: 13, fontWeight: on ? 500 : 400, fontFamily: 'inherit',
  color: on ? 'var(--text-primary)' : 'var(--text-secondary)', background: on ? 'var(--surface-hover)' : 'transparent',
  border: 'none', borderRadius: 'var(--r-sm)', cursor: 'pointer', textAlign: 'left' }}>
  {on && <span aria-hidden style={{ position:'absolute', left:0, top:6, bottom:6, width:2, borderRadius:'var(--r-pill)', background:'var(--uc-orange)' }} />}
  <Icon size={16} strokeWidth={1.5} /><span style={{ flex:1, minWidth:0 }}>{t.label}</span>
  {t.badge ? <span style={{ padding:'1px 6px', fontSize:11, fontWeight:500, borderRadius:'var(--r-pill)', background:'var(--uc-orange-bg)', color:'var(--uc-orange-l)' }}>{t.badge}</span> : null}
</button>
```
Section label style: `fontSize 11, fontWeight 500, letterSpacing '0.04em', color 'var(--text-label)', padding '0 10px 6px'`.

`GroupDetailPage`: read `tab` from `useSearchParams`, fall back to `defaultTabFor(group)`, and call `usePageRails(<GroupLeftRail …/>, null)` (right rail comes in Task 10). The centre column no longer renders a tab rail; remove `.group-detail-body` wrapper. `Members` and `About` are no longer tabs (panels arrive in Tasks 9/10) — for this task keep them reachable via `?tab=members|about` temporarily so nothing regresses; Task 9/10 removes that.

- [ ] **Step 3: Tests PASS, typecheck, lint, commit** `feat(groups): tab state in URL, In-this-group left rail`

---

### Task 9: GroupHeader footer + Members panel + Share modal + Invite panel

**Files:**
- Modify: `apps/web/src/features/groups/components/GroupHeader.tsx`
- Create: `GroupPanel.tsx`, `MembersPanel.tsx`, `InvitePanel.tsx`, `ShareGroupModal.tsx` under `features/groups/components/`
- Modify: `InviteMemberModal.tsx` → replaced by `InvitePanel` (delete the old file, update `index.ts` and `MembersTab` callers).
- Modify: `features/groups/hooks/useGroupExtended.ts` — `useGroupMembers(groupId, { search, role })`, `useUpdateMemberRole`, `useRemoveMember`, `useOpenGroupChat`, `useGroupConnectionsInGroup`.
- Modify: `features/groups/types.ts` — `Group.requirePostApproval`, `requireEventApproval`, `chatUnread?`.
- Test: `GroupHeader.test.tsx`, `MembersPanel.test.tsx`

**Interfaces:**
- `GroupPanel({ icon, title, subtitle, onClose, footer, children })` — the overlay frame from the design: centred, `width: min(560px, 100%)`, `max-height: 80vh`, `var(--surface-card)`, `0.5px solid var(--border-hover)`, `var(--r-xl)`; header row (orange icon 16, title 15/500, subtitle 12 secondary, X 28px), scroll body `padding 16px 18px, gap 14`, footer `padding 12px 18px` with a top border. Built on `Modal`'s portal + focus handling (extend `Modal` with an optional `hideTitle`/`frame="panel"` prop rather than reimplementing).
- `GroupHeader` footer row (`marginTop 12, paddingTop 12, borderTop`): left = face stack (last 5 members via `useGroupMembers` page 1, 26px circles, `-9px` overlap, `2px solid var(--surface-card)` border) + `+{memberCount-5} others` ghost pill button → opens `MembersPanel`; spacer; right = `Invite` (visible when `isMember || isAdmin`; icon `user-plus` 13; ghost pill) + share icon button (`forward` 15, 32px round, `0.5px` border) → `ShareGroupModal` + (academic & member) group-chat link button (`messages-square` 15, indigo-bg pill with unread badge from `group.chatUnread`) → `useOpenGroupChat().mutate()` then `navigate('/messages/:conversationId')`.
- Badges row gains the **my-role tag** (`MemberRoleTag role={group.userRole}` with `hideOwner={group.isSystem}`) after `AllowedRoleBadge`. Remove the `Users` member-count span from the badge row (the design puts the count in the Members panel footer). Remove the italic "This is an official auto-managed group…" paragraph (not in design).
- `MembersPanel({ group, onClose, onInvite })`: search pill (`var(--surface-raised)`, 38px, pill), list of member rows (32px avatar, name 13/500, headline 12 tertiary, `MemberRoleTag`, `⋯` menu when admin && target not owner with items `View profile, Message, Make moderator, Make admin, Remove role, Remove from group` — danger last with divider). Footer: `{memberCount} members` · `Invite` (indigo-bg pill) · `Close`.
- `ShareGroupModal({ group, onClose })`: title `Share this group`, eyebrow `Group link`, link box `${window.location.origin}/groups/${group.id}`, `Copy link` button (indigo → mint `Link copied` after `navigator.clipboard.writeText`), then 4 target rows `Share to your feed / Send in a message / Share to a group / Share by email` with chevrons — each calls the existing `ShareMenu` actions (`@/components/ShareMenu` exposes `shareToFeed`, `shareViaMessage`… check; if only the popover exists, extract its handlers into `features/share/hooks/useShareActions.ts` and use them here).
- `InvitePanel({ group, onClose })`: search (`Search people by name, department or batch`), `Invite as` chips `Member / Moderator / Admin` (Admin hidden for academic), multi-select rows (36px avatar, name, meta, note `In N of your groups` / `N mutual connections`), mint `N invites sent · they appear under Members once accepted` banner, footer `N people selected` · `Full directory` link (`/groups?section=people`) · `Send N invites` (indigo when >0 else raised/disabled). Uses `POST /groups/:id/invitations` per selected user (`Promise.all`), then role via `PATCH /groups/:id/members/:userId` is **not** possible before accept — so store the intended role client-side is wrong; instead extend `InviteToGroupSchema` with optional `role` and persist it on the invite notification `data.role`, applied at accept (backend change in `groups/service.ts acceptInvite`). Candidates come from `GET /users/suggestions?limit=20` plus `GET /explore/people?q=` when searching (check the `explore` router for the people search path).

- [ ] **Step 1: Failing tests** — header renders `+1,835 others` for `memberCount 1840` and opens the panel; share modal copies the URL; invite panel footer reads `2 people selected` and the send label `Send 2 invites` after two toggles.

- [ ] **Step 2: Implement.** Keep every measurement from the design (`GroupPanel` widths above; face 26px; invite avatar 36px; panel rows `padding 10px 8px`).

- [ ] **Step 3: Tests PASS, typecheck, lint, commit** `feat(groups): header footer row, members panel, share modal, invite panel`

---

### Task 10: `GroupRightRail` — Manage card, settings, About, suggestions, tags

**Files:**
- Create: `features/groups/components/GroupRightRail.tsx`, `AnalyticsPanel.tsx`, `ModLogPanel.tsx`
- Modify: `pages/GroupDetailPage.tsx` (pass right override), `hooks/useGroupExtended.ts` (`useReviewSummary`, `useUpdateGroupSettings`, `useDeleteGroup`, `useGroupAnalytics`, `useModerationLog`, `useGroupSuggestions`, `useUpdateGroupDescription`), `components/rightRail/TrendingTagsWidget.tsx` (export the inner list so it can be reused with `SectionHeader`).
- Delete: `features/groups/components/AboutTab.tsx` (rules editing moves into the About card).
- Test: `GroupRightRail.test.tsx`

**Interfaces:**
- `GroupRightRail({ group, activeTab })`.
- **Admin view** (`userRole` owner/admin) — card `padding 16, gap 12`, eyebrow `Manage this group` in `--uc-orange-l` + `shield-check`; three raised rows (`var(--surface-raised)`, `r-md`, `padding 10px 12px`): `Join requests` / `{n} requests waiting|No requests waiting` + `Review` → `?tab=join-requests`; `Queued posts` / `{n} waiting|All caught up` + `Review` → `?tab=feed`; `Moderation` / `{reportsOpen} reports open|Nothing flagged this week` (no button). Then divider + action rows `Invite members (user-plus) / Group settings (settings, hidden when isSystem) / Analytics (bar-chart-2) / Moderation log (shield-check)` each 40px with trailing chevron. Then divider + mini stats `New members, 7 days: +N`, `Posts, 7 days: N`, `Reports open: N` from `useGroupStats` + `useReviewSummary`. Counts refetch on `GROUP_EVENTS.REVIEW_QUEUE_CHANGED` (subscribe via `useSocket`).
- `Group settings` toggles a second card (`Group settings` eyebrow + X) with three switches (`Private group`, `Require post approval`, `Require event approval` — track 30×17, knob 11, indigo when on) wired to `useUpdateGroupSettings`, and a `Delete group` row (`--uc-red` label + red-outline `Delete` pill → confirm `Modal` → `useDeleteGroup` → navigate `/groups`).
- **Both views** — `About this group` card: eyebrow + (admin) `Edit` ghost; reading mode shows `group.description` (13 secondary, 1.65) then divider + `Group rules` eyebrow + `<pre>` of `rulesMd`; editing mode = textarea for description **and** a second textarea for rules, `Save`/`Cancel`, wired to `PATCH /groups/:id { description }` and `PATCH /groups/:id/rules`.
- **Member view only** — `Groups you may like` (4 rows from `useGroupSuggestions`, 32px tone tile, name/meta, `Join|Request` indigo-bg pill → same join mutation as `GroupCard`; after success shows `Joined|Requested` raised pill) and `Trending now` (reuse `TrendingTagsWidget` body).
- `AnalyticsPanel` (in `GroupPanel`): 2×2 cards (24px value, label, delta), `Posts per week` bars (72px label, 8px track, indigo fill, value right), `Most active members` (3 rows). Footer `Updated a few minutes ago` + `Close`.
- `ModLogPanel`: filters `All / Posts / Members / Settings`, entries (30px tone circle icon by kind: post→orange `trash-2`/`check-circle-2`, member→amber `volume-x`/`user-x`/indigo `shield-check`, settings→indigo `settings`), `by {actor} · {relative time}`; empty `No entries for this filter.`; footer `Entries are kept for 12 months` + `Close`.

- [ ] **Step 1: Failing test** — admin view renders `Manage this group` with `2 requests waiting` (MSW `*/groups/:id/review/summary` → `{pendingJoinRequests:2,…}`), clicking `Group settings` reveals `Require post approval`; member view renders `Groups you may like` and not `Manage this group`.

- [ ] **Step 2: Implement.** `GroupDetailPage` now calls `usePageRails(<GroupLeftRail/>, <GroupRightRail/>)`. Remove `about` from the tab union.

- [ ] **Step 3: Tests PASS, typecheck, lint, commit** `feat(groups): right rail manage card, settings, about, suggestions, analytics + mod-log panels`

---

## Phase 2 — Tab bodies

### Task 11: Feed tab — pending posts queue + role-aware post menu

**Files:**
- Modify: `features/groups/components/FeedTab.tsx`; `hooks/useGroupExtended.ts` (`usePendingPosts`, `useReviewPost`); `features/feed/components/PostCard.tsx` (add `variant="group-admin"` / `groupRole` prop for the menu set).
- Test: `FeedTab.test.tsx`

**Interfaces:**
- Admin/mod sees, under the composer, eyebrow `{n} post(s) awaiting approval` (`--uc-orange-l`, 11/500/0.04em) then each pending post in a card with `0.5px solid var(--uc-orange-bdr)` border, header (40px avatar, name 14/500, meta 12), content 14/1.6, footer `Approve` (indigo) / `Decline` (ghost).
- `PostCard` menu: when `groupRole` is owner/admin/moderator → `Save post / Copy link to post / Pin to group|Unpin from group / Edit post (author only) / Mute this member / Delete post (danger)`; otherwise `Save post / Copy link to post / Turn off notifications / Hide this post / Report to group admins (danger)`. `Pin to group` → `useSetPinned(groupId).mutate(post.content.slice(0,280))`. `Mute this member` → existing user-block/mute from `features/moderation` if present (`POST /moderation/mute`?) — check `moderation/router.ts`; if no mute exists, use block.
- Composer placeholder: `What's on your mind, {firstName}?` — verify `CreatePost` already does this.

- [ ] **Step 1: Failing test** — with MSW `*/groups/:id/review/posts` returning one pending post and `userRole:'admin'`, the eyebrow `1 post awaiting approval` and `Approve` render; as `member` nothing renders.
- [ ] **Step 2: Implement.** - [ ] **Step 3: Tests, typecheck, lint, commit** `feat(groups): feed approval queue and role-aware post menu`

---

### Task 12: Events tab — Create event + pending events

**Files:**
- Modify: `features/groups/components/EventsTab.tsx`; hooks `usePendingEvents`, `useReviewEvent`.
- Reuse: `features/events/components/CreateEventForm.tsx` (pass `groupId`).
- Test: `EventsTab.test.tsx`

**Interfaces:**
- Admin: right-aligned `Create event` ghost pill (`plus` 13) opening `CreateEventForm` in a `Modal` with `group_id` preset.
- Admin: eyebrow `{n} event(s) awaiting approval` + rows (date tile 18px day `--uc-orange-l` / month 12 with `0.05em`, title 14/500, `calendar` time + `map-pin` location, `Submitted by {organizer}`), `Approve`/`Decline`.
- Event rows: date tile in `--uc-indigo-xl`, `{n} going` right in tertiary.

- [ ] Steps: failing test (`1 event awaiting approval` for admin, absent for member) → implement → tests/typecheck/lint → commit `feat(groups): events approval queue and create-event entry`

---

### Task 13: Resources tab chips

**Files:** `features/groups/components/ResourcesTab.tsx`; `apps/api/src/modules/groups/schema.ts` (resource category enum).

- Category chips become `All · Researches · Projects · Assignments · Notes · Other` (active = `--uc-indigo-bg`/`--uc-indigo-l`, inactive `--surface-raised`/secondary, `padding 5px 12px`, 12px). Backend enum currently `notes | syllabus | past_papers | assignments | other`: add migration **`111_widen_resource_categories.ts`** that drops the CHECK, maps `syllabus → notes`, `past_papers → other`, and re-adds `CHECK (category IN ('researches','projects','assignments','notes','other'))` (down does the reverse — fold `researches → notes`, `projects → other`, drop, re-add old CHECK, in that order). Update `GroupResource.category` type and the upload `<select>`.
- Row: category pill (indigo-bg), title 13/500, uploader `· {clickCount} views`, `Open` ghost (`external-link` 11), admin trash icon (`trash-2` 13) with `Confirm / Cancel` inline pills on first click.
- `Upload` ghost pill with `plus` 12 at the end of the chip row.
- Empty: `Nothing filed under {category} yet.`

- [ ] Steps: failing test for chip set + empty copy → migration + API enum + UI → tests/typecheck/lint → commit `feat(groups): resource categories per design`

---

### Task 14: Study tab — Sessions/Decks, Upcoming/Past, notes disclosure

**Files:** `StudyToolsTab.tsx`, `StudySessionsTab.tsx`, `SessionNotesPanel.tsx`.

- Modes: `Sessions` / `Decks` only (drop `Notes` mode; shared notes are reachable from a `Notes` ghost chip inside Sessions header — keep `StudyNotesPanel` mounted behind that chip so nothing is lost). `New session` ghost pill (member/admin) on the same row.
- Sessions split under eyebrows `Upcoming` and `Past` (past = `startsAt < now`). Row: date tile (`AUG 22` 12 tertiary `0.04em` / `05:30 PM` 13/500, `min-width 62`), title 14/500, description 12, `globe|map-pin` place · `{going}/{capacity} going`; right column `RSVP|Going|Ended` pill (Going = indigo filled) + `Notes` ghost (`file-text` 12) toggling an inline block `Creator notes|Creator notes · empty` + text (`No shared notes for this session yet.`) using `useSessionCreatorNotes`.
- Decks: row with title 13/500, `{n} cards · {due} due today`, 4px mastery bar, `{pct}% mastered`, `Study` indigo pill. Non-academic groups show the locked card copy: `Flashcard decks are available in academic groups created by faculty.` / `Sessions still work here.` **only if** `useFlashcardDecks` 403s (the API decides).

- [ ] Steps: failing test (Upcoming/Past split, notes toggle text) → implement → commit `feat(groups): study sessions layout per design`

---

### Task 15: Join requests tab — filters, approve all, undo

**Files:** `JoinRequestsTab.tsx`; hooks `useJoinRequests(groupId, { status })`, `useReviewJoinRequest` (`action: 'approve'|'decline'|'undo'`).

- Filter chips `Pending N / Approved N / Declined N` (counts from three small queries `limit=1` reading `total`), `Approve all N` ghost when `pending > 1`.
- Row: 36px avatar, name 13/500, meta 11 (`{department} · {batch} · requested {relative}`), message italic 12; pending → `Approve` (indigo 4px/12px) `Decline` (ghost); resolved → `check-circle-2 Approved, now a member` (mint) or `x Declined` (tertiary) + `Undo` ghost.
- Empty: pending → `No requests waiting. Approved and declined requests stay listed for 30 days.`; else `Nothing {status} yet.`

- [ ] Steps: failing test (filter switch calls `?status=declined`; `Undo` sends `action:'undo'`) → implement → commit `feat(groups): join-request filters, approve all, undo`

---

### Task 16: Stats tab — five design cards

**Files:** `AdminStatsTab.tsx`, `useGroupStats` type.

- Cards: `Members`, `Posts this week`, `Active, 30 days`, `Resources`, `Upcoming events` (first card `var(--surface-raised)`, others card). `Refresh` ghost with `refresh-cw` 12. Values `toLocaleString()`.

- [x] Steps: test (labels) → implement → commit `feat(groups): stats cards per design`

---

### Task 17: Academic LMS — sub-tab order, Announcements, Ask teacher, Book slot, gradebook inline grid

**Files:**
- Modify: `features/groups/academic/AcademicLMSTab.tsx`, `GradebookPanel.tsx`, `ModulesPanel.tsx`, `AssignmentsPanel.tsx`
- Create: `AnnouncementsPanel.tsx`, `AskTeacherPanel.tsx`, `BookSlotModal.tsx`
- Hooks: `useAnnouncements`, `useCreateAnnouncement`, `useUpdateAnnouncement`, `useAskTeacher`, `useAskTeacherQueue`, `useConsultationSlots`, `useBookSlot`, `useReviewBooking`, `useCreateSlot`.
- Tests: `AnnouncementsPanel.test.tsx`, `AskTeacherPanel.test.tsx`

**Interfaces / design:**
- Sub-tabs (chips, indigo-bg active): `Course outline · Announcements · Gradebook · Modules · Assignments · Ask teacher · [AI settings admin]`. Course outline is visible to **everyone** (read-only for students: `CourseOutlineForm` gets a `readOnly` prop rendering the design's 4-row list `Week 1 to 4 / Week 5 to 8 / … / Grading`); AI settings admin only.
- **Announcements**: admin composer card — collapsed row `megaphone` + `Post a notice — make-up CT, postponed class, anything urgent`; expanded: `New announcement` + X, title input (`.fld` style: transparent bg, 0.5px border, `r-sm`, 7px 10px, 13px), textarea 3 rows, `Kind` chips `Urgent / Schedule / Notice`, `Attach a file` ghost (uses `AttachmentPicker`), `Notify all members` switch (32×18), `Post announcement` (indigo) / `Cancel`. List card rows: 32px kind icon circle (urgent `siren` red, schedule `calendar-clock` amber, notice `megaphone` cyan), title 13/500 + kind pill + `pin pinned` (orange) when pinned, body 13 secondary, `Posted {relative} · {author}, course teacher`.
- **Ask teacher (student)**: teacher card (44px avatar, name 14/500 + `Course teacher` pill, indigo dot `usually replies within a day`, `{department} · room` meta) + `Message the teacher` indigo pill that focuses the composer; chat card (`Direct chat, only you and the teacher` + lock; `Today` divider; bubbles — mine = orange-bg/bdr radius `14px 14px 4px 14px`, theirs raised radius `14px 14px 14px 4px`, 13px; ticks `check-check` indigo for read, `check` tertiary pending; composer `paperclip` / input `Write a message` / `send`), backed by the conversation from `useAskTeacher()` and the existing messages hooks (`features/messages`: `useMessages(conversationId)`, `useSendMessage`). Then `Consultation hours` card listing `useConsultationSlots` rows: `{Weekday}, {start} – {end}` 13 / `{location}[, walk in]` 12; CTA `Open now` (mint) if the slot is happening now else `Book a slot` (indigo-bg pill) → `BookSlotModal`.
- **Ask teacher (admin)**: `Student questions` card with `{n} waiting` orange pill and `You usually reply within a day`; rows from `useAskTeacherQueue` (32px avatar, name, preview, time, unread badge) → navigates `/messages/:conversationId`; then the same `Consultation hours` card with CTA `View bookings` → `BookSlotModal` in admin mode (`Bookings for this slot`, roster rows with `Confirmed` mint / `Requested` orange pills; admin can confirm/decline via `useReviewBooking`) plus an `Add slot` ghost (weekday select, start/end, location, walk-in) using `useCreateSlot`.
- **BookSlotModal** (student): when/where/host rows with `calendar`/`map-pin`/`user` icons, eyebrow `What do you want to discuss?`, textarea placeholder `One or two lines so the teacher can prepare.`, footer `Cancel` + `Request slot` (indigo); after success mint banner `Request sent. You will get a confirmation in notifications.` and the cancel label becomes `Done`.
- **Gradebook (admin)**: assessments header card (`ASSESSMENT / OUT OF / AVERAGE / GRADED / STATUS` eyebrows — sentence case in our build: `Assessment / Out of / Average / Graded / Status`), inline `.fld` inputs per assessment, status pill (`Released` mint / `Marking` orange / else raised), `Add CT` ghost, footnote `{n} assessments from the outline · marks save as you type`; student grid card: sticky first column (`Student` with 26px avatar + roll), `CT avg`, one 72px column per assessment (inline inputs, `fld-need` dashed indigo when blank), `Grade` pill; `Add CT column` ghost; footnote `{n} students · marks save as you type`. Saves debounce 600ms via `useUpsertGradebookEntries`. Student view keeps `StudentGradeCard`.
- **Modules**: rows with title 14/500, description 13, right column `Published|Draft` 12, `paperclip Class content` link, file name 11; admin actions `Move up / Move down / Publish|Unpublish` ghosts under a divider.
- **Assignments**: rows title 13/500, `Topic · {topic}` 12 tertiary, `Due {date}` 12 secondary, right `{n} submitted|Not open`; student `upload Submit work|Replace file|Not open yet` pill and, once submitted, a `file-check` line with `submitted just now` + X; admin `clipboard-check Review {n} submissions|unlock Open submissions` pill.

- [x] Steps per panel: failing test → implement → tests/typecheck/lint → commit (one commit per panel: `feat(groups): announcements panel`, `feat(groups): ask-teacher panel and slot booking`, `feat(groups): gradebook inline grid`, `feat(groups): LMS sub-tab order and module/assignment rows`).

---

## Phase 3 — Directory page

### Task 18: Directory view tabs + copy + card polish

**Files:** `pages/GroupsPage.tsx`, `features/groups/components/GroupCard.tsx`, `pages/groupFilters.test.tsx`.

- Keep `People` as a section (the codebase intentionally folded `/connections` here — `reachability.test.ts` depends on it), but the design's Groups tab shows a count: already done. Subtitle copy → `Departments, clubs and batches at UIU, plus the people in them.` — use the tenant name from `useAuthStore` university (`user.university?.name`) rather than hardcoding `UIU`; fall back to `on campus`.
- `GroupCard` mute switch gets the design's `.uc-badge` tooltip (`Notifications on|Notifications muted`) — implement as `title` + a CSS-only tooltip class `uc-tip` added to `index.css` (`position:absolute; bottom:calc(100% + 6px); … opacity 0 → 1 on :hover`). Private lock gets the same tooltip `Request to join`.
- Search placeholder `Search groups` / `Search people by name or department`.

- [ ] Steps: test (tooltip text present, placeholder) → implement → commit `feat(groups): directory copy and card tooltips per design`

---

### Task 19: Create group sheet — kind chooser + member picker

**Files:** `features/groups/components/CreateGroupModal.tsx` (+ test), hooks `useCreateGroup`.

- Header: `Create group` / `Pick the first members. You can name the group next.`; `Group kind` chips `Academic (graduation-cap) / Other (users)` with hint copy (`A course or section group. You can import a course outline to fill in topics and dates.` / `A club, project, study or interest group. No course fields.`); when Academic: `file-up Import a course outline instead` ghost → `OutlineImportWizard` (Task 20).
- Search pill `Search people by name or department`; multi-select rows (role glyph with tooltip label `Student, verified` etc. from `RoleBadge`), check square; footer `No one selected|N people selected` · `Full directory` (`/groups?section=people`) · `Create group|Create with N` (indigo when N>0).
- Two-step: after picking people, the existing name/description/type/privacy form appears (step 2, `Name the group`), `Create` posts `POST /groups` then invites each selected user (`POST /groups/:id/invitations`). Type select: Academic kind → `type:'academic', allowed_role:'student', is_private:true`; Other kind → existing type select minus `academic`.
- Success banner: `Group created. Members will show as pending until they accept.` then navigate to `/groups/:id`.
- Mobile: renders as a bottom sheet (drag handle 34×4, `r-xl r-xl 0 0`, `max-height 78%`) — implement via a `sheet` prop on `Modal` that switches to bottom-anchored layout under `max-width: 767px` (CSS class `.modal--sheet`).

- [ ] Steps: failing test (kind chips, count label, `Create with 2`) → implement → commit `feat(groups): create-group sheet with kind chooser and member picker`

---

### Task 20: Outline import wizard

**Files:** Create `features/groups/components/OutlineImportWizard.tsx`, hooks `useOutlineDraft`, `useCreateGroupFromOutline`, `useInviteMatch`, `useBulkInvite`, `usePresignUpload` (reuse `features/upload` or `AttachmentPicker`'s presign hook).

- Steps chips `Upload / Review / Created / Invite` (indigo active, tertiary future, secondary past). Titles/subtitles verbatim from the design (`Import a course outline` / `Upload the outline and we fill in topics, dates and weights for you to check.` etc.).
- **Upload**: `Course outline` (required pill orange) drop zone `Drop the outline here, or browse` / `pdf or docx, up to 10 mb` (`file-up` 21 indigo), file row with size + X; `Section roster` (optional pill) zone `Drop a roster, or browse` / `pdf, docx or csv`; `What happens next` card with `file-text Outline read › sparkles Draft built › pencil Your review` + `Nothing is created until you confirm the draft.`; footer `Upload and generate draft` (presign → PUT → `POST /groups/course-outline/draft`) / `Discard`.
- **Review**: grid `Course code / Course name / Section` inputs; `Topics` card (`one row per week`) rows `week | title | date range` with `fld-need` dashed for blanks; `Assessments` card with stacked weight bar (indigo/cyan/mint/amber/orange-l), 5 number inputs, `adds up to 100%|{sum}% of 100%` and an amber `triangle-alert` warning when ≠100 (`Weights are over 100%. Lower one by N points.` / `Weights are under 100%. N points left to assign.`); `Assignments and class tests` rows (`clipboard-list`/`file-check` icon, title, date, topic, X for added rows), `Add assignment` / `Add class test` ghosts, `{n} items`; note `Dashed fields need your input. You can also fill them in later from inside the group.`; footer `Confirm and create group` (disabled until weights = 100 and course name present) → `POST /groups/from-outline`.
- **Created**: mint check circle, `{code} · section {s} is live`, explanatory copy, group card row (`graduation-cap` orange tile, `you own this` orange pill, `Academic · students only · 1 member`); footer `user-plus Invite students by section`.
- **Invite**: `Course` locked field (`lock`), `Department` + `Batch year` selects (our deviation from "Section"), indigo info row `{n} students match this department and batch` from `useInviteMatch`; `Also invite by email` switch revealing a textarea + `{n} addresses added` / `A roster file fills this in for you` (pre-filled from `rosterEmails`); footer `Send invites` → `POST /groups/:id/invitations/bulk` → `Invite summary` card (`{invited} invited · just now`, `{skipped} skipped, already members`, `{mailed} mailed · by email`) and the button reads `Invites sent`; `Discard` → closes and navigates to the new group.

- [ ] Steps: failing tests (weights sum message; `Confirm and create group` disabled at 90%) → implement → commit `feat(groups): course-outline import wizard`

---

## Phase 4 — Mobile + screenshots + docs

### Task 21: Mobile detail — manage card, tab strip, bottom sheet panels

**Files:** Create `features/groups/components/MobileTabStrip.tsx`, `MobileManageCard.tsx`; modify `pages/GroupDetailPage.tsx`, `styles/index.css`.

- Under `max-width: 767px` the page rails are hidden by `FeedLayout` already, so the page itself renders (in order): back link, header card, pinned banner, **admin only** `MobileManageCard` (`shield-check` eyebrow row; `Join requests` + `Review`; `Queued posts` + `Review`; horizontally scrolling action chips `Invite members / Group settings / Analytics / Moderation log` using `.hide-bar`), the `Group settings` card when toggled, then `MobileTabStrip` (`role=tablist`, `.show-bar`, chips `padding 7px 12px`, active `--surface-hover` + 500, badge pill), then the tab body. On desktop these two components render `null` (`useMediaQuery('(max-width: 767px)')` — add `hooks/useMediaQuery.ts` if absent; check `hooks/`).
- `GroupPanel` and `ShareGroupModal` use the `sheet` mode from Task 19 on mobile.
- Header card footer must not wrap (`flex-wrap: nowrap`, faces `overflow: hidden`) — matches the design.

- [ ] Steps: test at 390px via `window.matchMedia` stub (`MobileTabStrip` renders tabs; desktop renders nothing) → implement → commit `feat(groups): mobile manage card and tab strip`

---

### Task 22: Screenshots, docs, graph

**Files:** `scripts/screenshot.cjs`, `screenshots/*.png`, `CLAUDE.md`, `docs/DESIGN.md` (if it lists groups).

- Add routes: `group-detail` (`/groups/:devGroupId?dev-auth=1`), `group-detail-admin` (`…&dev-role=faculty` with a dev group whose `userRole:'owner'` — extend the dev axios adapter fixtures in `lib/axios` dev mode: check how `profile` dev id is seeded), `groups-mobile` (390×844). Add rows to the CLAUDE.md screenshot table.
- Update CLAUDE.md module notes: groups module now has settings/review/announcements/consultation/analytics/moderation-log/chat/ask-teacher routes; `GET /groups/suggestions`, `/groups/from-outline`, `/groups/course-outline/draft`, `/groups/invite-match` are declared before `/:groupId`; detail page tabs live in `?tab=`; page-scoped rails via `pageRailStore`.
- Run `node scripts/screenshot.cjs groups && node scripts/screenshot.cjs group-detail && node scripts/screenshot.cjs group-detail-admin && node scripts/screenshot.cjs groups-mobile`, `npx pnpm typecheck && npx pnpm lint && npx pnpm test`, `graphify update .`.

- [ ] Commit `chore(groups): screenshots, docs and graph for the groups design sync`

---

## Self-review notes

- Spec coverage: directory (Task 18–20), detail shell (7–10), every tab body (11–17), all overlays (9, 10, 17, 19, 20), mobile (21), all six types (data-driven — badges/tabs/chat gate on `type`, `isSystem`, `allowedRole`, `userRole`), member vs admin (gated on `userRole`), routes (`?tab=`, `/groups/:id`, `/groups?section=people`, `/messages/:id`).
- Deviations are listed under Global Constraints.
- Types used across tasks: `GroupTab`, `GroupTabDef`, `groupTabsFor`, `defaultTabFor` (Task 8); `GroupPanel` (9) reused by 10 and 17; `useReviewSummary` (10) reused by 21; `ReviewActionSchema` (3); `logModeration` (2) reused by 3.
