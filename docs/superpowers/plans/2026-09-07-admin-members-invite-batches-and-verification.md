# Admin Members & Invites: Invite Batches + Verification Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the admin "Members & invites" screen to parity with the design mockup by adding admin-named invite batches (grouped bulk invitations with a progress bar) and a verification queue (unverified-user tracking with a manual mark-verified action).

**Architecture:** Extend the existing `apps/api/src/modules/admin` module — one migration adds `batch_id`/`batch_label` to `invitations`; `createBulkInvitations` stamps every row in one bulk call with a shared batch; a new `listInviteBatches` query aggregates by batch; `getStats` gains a per-role unverified breakdown; a new `PATCH /admin/users/:userId/verify` route flips `is_verified`. On the frontend, `InvitationsTab` (in `apps/web/src/pages/AdminPage.tsx`) gets a batch-name input and an "Invite batches" section with progress bars, and `UsersTab` gets a "Verification queue" section with per-role counts and a mark-verified action.

**Tech Stack:** Express, Knex (Postgres), Zod, React, TanStack Query, Vitest + Supertest.

**Spec:** This plan folds in the parent conversation's mockup reference (`/Users/joydipdatta/Downloads/uniconnect-furnished-design/project/Feed Page.dc.html`, Admin role → "Members & invites") and the following scope decisions made directly with the user (no spec doc exists elsewhere for this feature):
- Invite batches are **admin-named** (a required "Batch name" field on the bulk-invite form), not auto-generated from the send timestamp.
- "Verification requests" = **count of unverified users** (`users.is_verified = false`), not a new document-submission workflow. Marking verified is a direct one-click admin action.
- No new admin-only right-rail widget — the admin role's right rail is shared/generic across all four member roles by deliberate, tested design (`apps/web/src/config/roleShell.ts`, `roleShell.test.ts`: "the four member roles carry the same number of widgets"). The verification queue and invite batches render as sections inside the Members tab's own main content instead.

## Global Constraints

- Migrations: sequential `NNN_description.ts` in `apps/api/src/database/migrations/`; the latest committed file is `104_add_group_member_mute.ts`, so the next migration is `105_*`. Never edit a committed migration.
- DB access only from service files (`apps/api/src/modules/admin/service.ts`); routes/controllers never touch Knex directly.
- Controllers use `sendSuccess(res, data, statusCode?)` / `sendPaginated(res, items, total, page, limit)` from `src/utils/response.ts` — never raw `res.json()`.
- Services throw `notFound()` / `badRequest()` from `src/utils/errors.ts`; Zod validation failures surface as HTTP 422 automatically via the existing `validate`/`validateRequest` middleware — assert `422` in tests for bad payloads, not `400`.
- Zod schemas live in `apps/api/src/modules/admin/schema.ts`, named `PascalCase` + `Schema` suffix, with a matching `z.infer` type export.
- `universityId` for every query comes from `req.university.id` (via the existing `getAdminContext(req)` helper in `admin/controller.ts`), never from the request body.
- Admin routes: `adminRouter.use(requireAuth, resolveUniversity, requireRole('faculty', 'admin'))` already applies to the whole router; admin-only (not faculty) endpoints add `requireRole('admin')` per-route, matching the existing pattern (e.g. `/stats`, `/users/:userId/role`).
- Admin actions that mutate state get an entry in `university_audit_logs` (`{ university_id, actor_id, action, payload: JSON.stringify(...) }`), matching the existing pattern in `admin/service.ts` (`driver.created`, `domains.updated`, `account_deletion.${status}`).
- Frontend: data fetching only in TanStack Query hooks/inline `useQuery`/`useMutation` (this file already inlines them directly in tab components — follow that existing local convention, do not extract to `src/hooks/`). Query keys are `['admin', 'action', {params}]`; invalidate only in `onSuccess`. No hardcoded hex colors — always `var(--token-name)`; `0.5px` borders; `var(--r-pill)` for buttons/pills; font-weight 400/500 only; sentence case copy.
- Design tokens available for this task: `--uc-indigo` (student), `--uc-amber`/`--uc-amber-l` (alumni), `--uc-cyan` (faculty), `--text-tertiary` (driver/neutral), `--uc-mint` (active/accepted, resolved), `--uc-orange`/`--uc-orange-l` (pending/warning), `--uc-red` (suspended/error) — all with matching `-bg`/`-bdr` variants.

---

### Task 1: Migration — add `batch_id`/`batch_label` to `invitations`

**Files:**
- Create: `apps/api/src/database/migrations/105_add_invite_batches.ts`

**Interfaces:**
- Produces: `invitations.batch_id` (uuid, nullable, indexed), `invitations.batch_label` (varchar(120), nullable). Task 2 relies on both columns existing.

- [ ] **Step 1: Write the migration**

```ts
import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.alterTable('invitations', (table) => {
    table.uuid('batch_id').nullable()
    table.string('batch_label', 120).nullable()
  })
  await knex.schema.alterTable('invitations', (table) => {
    table.index('batch_id')
  })
}

export async function down(knex: Knex) {
  await knex.schema.alterTable('invitations', (table) => {
    table.dropIndex('batch_id')
    table.dropColumn('batch_label')
    table.dropColumn('batch_id')
  })
}
```

- [ ] **Step 2: Run it against your scratch DB**

Run: `DATABASE_URL="postgresql://$(whoami)@localhost:5432/uniconnect_test" GEMINI_API_KEY=test-key npx pnpm --filter api db:migrate`
Expected: migration `105_add_invite_batches` applied with no error. (The full API test suite in later tasks re-runs all migrations automatically via `apps/api/src/__tests__/setup.ts` against `DATABASE_URL`, so this step just confirms the migration itself is well-formed before building on it.)

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/database/migrations/105_add_invite_batches.ts
git commit -m "feat(db): add batch_id/batch_label columns to invitations

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017JRVZzfLB9LALRcnS9f2p2"
```

---

### Task 2: Backend — admin-named invite batches (create + list)

**Files:**
- Modify: `apps/api/src/modules/admin/schema.ts`
- Modify: `apps/api/src/modules/admin/service.ts`
- Modify: `apps/api/src/modules/admin/controller.ts`
- Modify: `apps/api/src/modules/admin/router.ts`
- Test: `apps/api/src/__tests__/admin-invite.test.ts`

**Interfaces:**
- Consumes: `CreateBulkInvitationsInput` (existing), `PaginationQuery` (existing).
- Produces: `CreateBulkInvitationsInput.batch_label: string` (new required field). `AdminService.createBulkInvitations(...)` now returns `{ created: number; emails: string[]; batchId: string }`. `AdminService.listInvitations(...)` now only returns invitations where `batch_id IS NULL` (unbatched/single invites). New `AdminService.listInviteBatches(universityId: string): Promise<InviteBatch[]>` where:
  ```ts
  interface InviteBatch {
    id: string          // batch_id
    label: string        // batch_label
    role: string
    total: number
    accepted: number
    expiresAt: string | null   // soonest expires_at among still-unused invites in the batch; null if all used/expired
    createdAt: string
  }
  ```
  New route `GET /admin/invitations/batches` → `sendSuccess(res, InviteBatch[])` (no pagination — batch counts are small).

- [ ] **Step 1: Update the existing bulk-invite tests to send `batch_label`, and add new failing tests for batching**

Edit `apps/api/src/__tests__/admin-invite.test.ts`: every existing `.send({ emails, role, expires_in_days })` call in the `POST /api/v1/admin/invitations/bulk` block needs `batch_label` added, since it becomes a required field. Replace the whole `describe('POST /api/v1/admin/invitations/bulk', ...)` block with:

```ts
describe('POST /api/v1/admin/invitations/bulk', () => {
  it('returns 201 with created count, emails list and a batch id', async () => {
    const ts = Date.now()
    const emails = [`bulk.test.a.${ts}@bscse.uiu.ac.bd`, `bulk.test.b.${ts}@bscse.uiu.ac.bd`]
    const res = await api
      .post('/api/v1/admin/invitations/bulk')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ emails, role: 'alumni', expires_in_days: 7, batch_label: 'CSE Fall 2026 intake' })

    if (res.status === 400) console.log(res.body)
    expect(res.status).toBe(201)
    expect(res.body.data.created).toBe(2)
    expect(res.body.data.emails).toEqual(expect.arrayContaining(emails))
    expect(res.body.data).toHaveProperty('batchId')
  })

  it('deduplicates emails and counts only unique', async () => {
    const ts = Date.now()
    const email = `bulk.test.dup.${ts}@bscse.uiu.ac.bd`
    const res = await api
      .post('/api/v1/admin/invitations/bulk')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ emails: [email, email, email], role: 'student', expires_in_days: 7, batch_label: 'Dup test batch' })

    if (res.status === 400) console.log(res.body)
    expect(res.status).toBe(201)
    expect(res.body.data.created).toBe(1)
  })

  it('returns 422 when emails array is empty', async () => {
    const res = await api
      .post('/api/v1/admin/invitations/bulk')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ emails: [], role: 'student', expires_in_days: 7, batch_label: 'Empty test' })

    expect(res.status).toBe(422)
  })

  it('returns 422 when emails array exceeds 50', async () => {
    const emails = Array.from({ length: 51 }, (_, i) => `bulk.test.over${i}@bscse.uiu.ac.bd`)
    const res = await api
      .post('/api/v1/admin/invitations/bulk')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ emails, role: 'student', expires_in_days: 7, batch_label: 'Over limit' })

    expect(res.status).toBe(422)
  })

  it('returns 422 when batch_label is missing', async () => {
    const res = await api
      .post('/api/v1/admin/invitations/bulk')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ emails: [`bulk.test.nolabel.${Date.now()}@bscse.uiu.ac.bd`], role: 'student', expires_in_days: 7 })

    expect(res.status).toBe(422)
  })

  it('returns 403 for faculty role (admin-only endpoint)', async () => {
    const res = await api
      .post('/api/v1/admin/invitations/bulk')
      .set(UNI)
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        emails: [`bulk.test.faculty.${Date.now()}@bscse.uiu.ac.bd`],
        role: 'student',
        expires_in_days: 7,
        batch_label: 'Faculty forbidden',
      })

    expect(res.status).toBe(403)
  })
})

describe('GET /api/v1/admin/invitations/batches', () => {
  it('returns the batch with correct total/accepted counts and excludes single invites', async () => {
    const ts = Date.now()
    const emails = [`bulk.test.batchlist.a.${ts}@bscse.uiu.ac.bd`, `bulk.test.batchlist.b.${ts}@bscse.uiu.ac.bd`]
    await api
      .post('/api/v1/admin/invitations/bulk')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ emails, role: 'student', expires_in_days: 7, batch_label: 'Batch list test' })

    const res = await api
      .get('/api/v1/admin/invitations/batches')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    const batch = res.body.data.find((b: { label: string }) => b.label === 'Batch list test')
    expect(batch).toBeDefined()
    expect(batch.total).toBe(2)
    expect(batch.accepted).toBe(0)
    expect(batch.role).toBe('student')
  })

  it('returns 403 for faculty role (admin-only endpoint)', async () => {
    const res = await api
      .get('/api/v1/admin/invitations/batches')
      .set(UNI)
      .set('Authorization', `Bearer ${facultyToken}`)

    expect(res.status).toBe(403)
  })
})

describe('GET /api/v1/admin/invitations (unbatched only)', () => {
  it('does not include invitations created via the bulk endpoint', async () => {
    const ts = Date.now()
    const bulkEmail = `bulk.test.excluded.${ts}@bscse.uiu.ac.bd`
    await api
      .post('/api/v1/admin/invitations/bulk')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ emails: [bulkEmail], role: 'student', expires_in_days: 7, batch_label: 'Exclusion check' })

    const singleEmail = `inv.test.single.${ts}@bscse.uiu.ac.bd`
    await api
      .post('/api/v1/admin/invitations')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: singleEmail, role: 'student', expires_in_days: 7 })

    const res = await api
      .get('/api/v1/admin/invitations?limit=100')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)

    const emails: string[] = res.body.data.items.map((i: { email: string }) => i.email)
    expect(emails).toContain(singleEmail)
    expect(emails).not.toContain(bulkEmail)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `DATABASE_URL="postgresql://$(whoami)@localhost:5432/uniconnect_test" GEMINI_API_KEY=test-key npx pnpm --filter api test admin-invite`
Expected: FAIL — `batch_label` required-field tests fail with 201 instead of 422 (schema doesn't require it yet), the `batches` endpoint returns 404 (route doesn't exist), and the "excludes bulk invites" test fails because `listInvitations` doesn't filter on `batch_id` yet.

- [ ] **Step 3: Add `batch_label` to the schema**

In `apps/api/src/modules/admin/schema.ts`, replace:

```ts
export const CreateBulkInvitationsSchema = z.object({
  emails: z.array(z.string().email()).min(1).max(50),
  role: z.enum(['student', 'alumni', 'faculty', 'admin']).default('student'),
  expires_in_days: z.number().int().min(1).max(30).default(7),
})
```

with:

```ts
export const CreateBulkInvitationsSchema = z.object({
  emails: z.array(z.string().email()).min(1).max(50),
  role: z.enum(['student', 'alumni', 'faculty', 'admin']).default('student'),
  expires_in_days: z.number().int().min(1).max(30).default(7),
  batch_label: z.string().trim().min(1).max(120),
})
```

The `type CreateBulkInvitationsInput = z.infer<typeof CreateBulkInvitationsSchema>` export below it picks up `batch_label` automatically — no change needed there.

- [ ] **Step 4: Stamp `batch_id`/`batch_label` in `createBulkInvitations`, and add `listInviteBatches`**

In `apps/api/src/modules/admin/service.ts`, replace the `createBulkInvitations` method body (currently lines 554-609) with:

```ts
  async createBulkInvitations(
    universityId: string,
    invitedById: string,
    input: CreateBulkInvitationsInput,
    universityName: string,
  ) {
    const unique = [...new Set(input.emails.map((e) => e.toLowerCase().trim()))]

    const { allowedEmailDomains } = await this.getAllowedEmailDomains(universityId)
    if (allowedEmailDomains.length > 0) {
      const blocked = unique.filter((e) => {
        const d = e.split('@')[1]?.toLowerCase() ?? ''
        return !allowedEmailDomains.includes(d)
      })
      if (blocked.length > 0) {
        throw badRequest(
          `These emails have disallowed domains: ${blocked.join(', ')}. Allowed: ${allowedEmailDomains.join(', ')}`,
          'EMAIL_DOMAIN_NOT_ALLOWED',
        )
      }
    }

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + input.expires_in_days)

    const batchId = crypto.randomUUID()

    const rows = unique.map((email) => ({
      university_id: universityId,
      invited_by: invitedById,
      email,
      role: input.role,
      token: crypto.randomBytes(32).toString('hex'),
      expires_at: expiresAt,
      batch_id: batchId,
      batch_label: input.batch_label,
    }))

    await db.transaction(async (trx) => {
      await db('invitations').insert(rows).transacting(trx)
    })

    for (const row of rows) {
      const registerUrl = `${env.WEB_URL}/register/${row.token}`
      void emailQueue.add({
        to: row.email,
        subject: "You're invited to join UniConnecT",
        text: JSON.stringify({
          template: 'invitation',
          userName: '',
          registerUrl,
          role: input.role,
          universityName,
          token: row.token,
        }),
      })
    }

    return { created: rows.length, emails: rows.map((r) => r.email), batchId }
  }

  async listInviteBatches(universityId: string) {
    const rows = await db('invitations')
      .where({ university_id: universityId })
      .whereNotNull('batch_id')
      .select(
        'batch_id',
        'batch_label',
        'role',
        db.raw('COUNT(*)::int as total'),
        db.raw('COUNT(*) FILTER (WHERE is_used = true)::int as accepted'),
        db.raw('MIN(expires_at) FILTER (WHERE is_used = false) as soonest_expiry'),
        db.raw('MIN(created_at) as created_at'),
      )
      .groupBy('batch_id', 'batch_label', 'role')
      .orderBy('created_at', 'desc')

    return (
      rows as {
        batch_id: string
        batch_label: string
        role: string
        total: number
        accepted: number
        soonest_expiry: Date | null
        created_at: Date
      }[]
    ).map((r) => ({
      id: r.batch_id,
      label: r.batch_label,
      role: r.role,
      total: r.total,
      accepted: r.accepted,
      expiresAt: r.soonest_expiry,
      createdAt: r.created_at,
    }))
  }
```

Then update `listInvitations` (currently lines 611-629) to exclude batched rows:

```ts
  async listInvitations(universityId: string, query: PaginationQuery) {
    const base = db('invitations').where({ university_id: universityId }).whereNull('batch_id')

    const [{ count }] = await base.clone().count<CountRow[]>({ count: '*' })

    const rows = await base
      .clone()
      .select<InvitationRow[]>('*')
      .orderBy('created_at', 'desc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)

    return {
      items: rows.map(toInvitation),
      total: Number(count),
      page: query.page,
      limit: query.limit,
    }
  }
```

- [ ] **Step 5: Add the controller handler**

In `apps/api/src/modules/admin/controller.ts`, add after `listInvitations`:

```ts
export const listInviteBatches = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getAdminContext(req)
  sendSuccess(res, await adminService.listInviteBatches(universityId))
})
```

- [ ] **Step 6: Register the route**

In `apps/api/src/modules/admin/router.ts`, add `listInviteBatches` to the `import { ... } from './controller'` block, and add the route just above the existing `DELETE /invitations/:invitationId` line so the static path is registered before any future param route:

```ts
adminRouter.get('/invitations/batches', requireRole('admin'), listInviteBatches)
adminRouter.delete('/invitations/:invitationId', requireRole('admin'), deleteInvitation)
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `DATABASE_URL="postgresql://$(whoami)@localhost:5432/uniconnect_test" GEMINI_API_KEY=test-key npx pnpm --filter api test admin-invite`
Expected: PASS — all tests in `admin-invite.test.ts` green.

- [ ] **Step 8: Typecheck and lint**

Run: `npx pnpm --filter api typecheck && npx pnpm --filter api lint`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/modules/admin/schema.ts apps/api/src/modules/admin/service.ts apps/api/src/modules/admin/controller.ts apps/api/src/modules/admin/router.ts apps/api/src/__tests__/admin-invite.test.ts
git commit -m "feat(admin): add admin-named invite batches with progress tracking

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017JRVZzfLB9LALRcnS9f2p2"
```

---

### Task 3: Backend — verification queue (unverified counts + mark-verified action)

**Files:**
- Modify: `apps/api/src/modules/admin/service.ts`
- Modify: `apps/api/src/modules/admin/schema.ts`
- Modify: `apps/api/src/modules/admin/controller.ts`
- Modify: `apps/api/src/modules/admin/router.ts`
- Test: Create `apps/api/src/__tests__/admin-verification.test.ts`

**Interfaces:**
- Consumes: `PaginationQuery` (existing), `getAdminContext` (existing).
- Produces: `AdminService.getStats(...)` return type gains `verificationsByRole: { role: string; count: number }[]` (unverified users grouped by role) alongside the existing `users, posts, jobs, events, groups, news, reports, activeUsers, usersByRole, postsByDay`. `AdminService.listUsers(universityId, query, verifiedFilter?: 'unverified')` — when `verifiedFilter === 'unverified'`, restricts to `is_verified = false`; otherwise unchanged. New `AdminService.verifyUser(universityId, actorId, userId): Promise<{ userId: string; isVerified: true }>`, throws `notFound()` if the user doesn't exist or `badRequest()` if already verified. New route `PATCH /admin/users/:userId/verify` (admin-only).

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/__tests__/admin-verification.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { app, loginAs, DOMAIN, TEST_UNIVERSITY_ID, CREDENTIALS } from './setup'
import { db } from '../config/db'

const api = supertest(app)
const UNI = { 'x-university-domain': DOMAIN }

let adminToken: string
let facultyToken: string
let unverifiedUserId: string

beforeAll(async () => {
  const [admin, faculty] = await Promise.all([
    loginAs(CREDENTIALS.admin.email, CREDENTIALS.admin.password),
    loginAs(CREDENTIALS.faculty.email, CREDENTIALS.faculty.password),
  ])
  adminToken = admin.accessToken
  facultyToken = faculty.accessToken

  const email = `unverified.test.${Date.now()}@bscse.uiu.ac.bd`
  const [user] = await db('users')
    .insert({
      university_id: TEST_UNIVERSITY_ID,
      email,
      password_hash: 'x',
      role: 'student',
      is_verified: false,
      is_active: true,
    })
    .returning<{ id: string }[]>('id')
  unverifiedUserId = user.id
  await db('profiles').insert({ user_id: unverifiedUserId, full_name: 'Unverified Test User' })
})

afterAll(async () => {
  await db('profiles').where({ user_id: unverifiedUserId }).delete()
  await db('users').where({ id: unverifiedUserId }).delete()
})

describe('GET /api/v1/admin/stats — verificationsByRole', () => {
  it('includes the unverified test user under its role', async () => {
    const res = await api
      .get('/api/v1/admin/stats')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveProperty('verificationsByRole')
    const studentRow = res.body.data.verificationsByRole.find((r: { role: string }) => r.role === 'student')
    expect(studentRow).toBeDefined()
    expect(studentRow.count).toBeGreaterThanOrEqual(1)
  })
})

describe('GET /api/v1/admin/users?verified=unverified', () => {
  it('returns only unverified users', async () => {
    const res = await api
      .get('/api/v1/admin/users?verified=unverified&limit=100')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    const ids: string[] = res.body.data.items.map((u: { id: string }) => u.id)
    expect(ids).toContain(unverifiedUserId)
    expect(res.body.data.items.every((u: { isVerified: boolean }) => u.isVerified === false)).toBe(true)
  })
})

describe('PATCH /api/v1/admin/users/:userId/verify', () => {
  it('marks the user verified', async () => {
    const res = await api
      .patch(`/api/v1/admin/users/${unverifiedUserId}/verify`)
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({ userId: unverifiedUserId, isVerified: true })

    const row = await db('users').where({ id: unverifiedUserId }).first<{ is_verified: boolean }>('is_verified')
    expect(row?.is_verified).toBe(true)
  })

  it('returns 400 when the user is already verified', async () => {
    const res = await api
      .patch(`/api/v1/admin/users/${unverifiedUserId}/verify`)
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(400)
  })

  it('returns 403 for faculty role (admin-only endpoint)', async () => {
    const res = await api
      .patch(`/api/v1/admin/users/${unverifiedUserId}/verify`)
      .set(UNI)
      .set('Authorization', `Bearer ${facultyToken}`)

    expect(res.status).toBe(403)
  })

  it('returns 404 for a non-existent user', async () => {
    const res = await api
      .patch('/api/v1/admin/users/00000000-0000-0000-0000-000000000000/verify')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `DATABASE_URL="postgresql://$(whoami)@localhost:5432/uniconnect_test" GEMINI_API_KEY=test-key npx pnpm --filter api test admin-verification`
Expected: FAIL — `verificationsByRole` missing from stats, `?verified=unverified` has no effect (returns all users), and `/verify` route 404s (doesn't exist).

- [ ] **Step 3: Add `verificationsByRole` to `getStats`**

In `apps/api/src/modules/admin/service.ts`, add a new helper next to `countUsersByRole` (after its closing brace, currently ending at line 944):

```ts
async function countUnverifiedByRole(universityId: string): Promise<{ role: string; count: number }[]> {
  const rows = await db('users')
    .where({ university_id: universityId, is_deleted: false, is_verified: false })
    .select('role')
    .count<{ role: string; count: string }[]>({ count: '*' })
    .groupBy('role')
  return rows.map((r) => ({ role: r.role, count: Number(r.count) }))
}
```

Then update `getStats` (currently lines 106-129) to call it and include it in the return:

```ts
  async getStats(universityId: string) {
    const [users, posts, jobs, events, groups, news, reports] = await Promise.all([
      countWhere('users', { university_id: universityId }),
      countWhere('posts', { university_id: universityId }),
      countWhere('jobs', { university_id: universityId }),
      countWhere('events', { university_id: universityId }),
      countWhere('groups', { university_id: universityId }),
      countWhere('news', { university_id: universityId }),
      db('reports')
        .whereIn('reporter_id', db('users').where('university_id', universityId).select('id'))
        .where('status', 'pending')
        .count<CountRow[]>({ count: '*' })
        .first()
        .then((r) => Number(r?.count ?? 0)),
    ])

    const activeUsers = await countActive(universityId)
    const [usersByRole, postsByDay, verificationsByRole] = await Promise.all([
      countUsersByRole(universityId),
      countPostsByDay(universityId),
      countUnverifiedByRole(universityId),
    ])

    return { users, posts, jobs, events, groups, news, reports, activeUsers, usersByRole, postsByDay, verificationsByRole }
  }
```

- [ ] **Step 4: Add the `verified` filter to `listUsers` and a `verifyUser` method**

Add `verified: z.enum(['unverified']).optional()` to the pagination query used by `GET /admin/users`. In `apps/api/src/modules/admin/schema.ts`, add a new schema (do not add `.optional()` fields onto `PaginationQuerySchema` itself, since it's reused by routes that don't take this filter — extend it locally instead):

```ts
export const ListUsersQuerySchema = PaginationQuerySchema.extend({
  verified: z.enum(['unverified']).optional(),
})

export type ListUsersQuery = z.infer<typeof ListUsersQuerySchema>
```

In `apps/api/src/modules/admin/service.ts`, update `listUsers` (currently lines 131-166) to accept the wider query type and apply the filter:

```ts
  async listUsers(universityId: string, query: ListUsersQuery) {
    const baseQuery = db('users')
      .join('profiles', 'profiles.user_id', 'users.id')
      .where('users.university_id', universityId)
      .where('users.is_deleted', false)
      .modify((builder) => {
        if (query.verified === 'unverified') builder.where('users.is_verified', false)
      })
      .select<AdminUserRow[]>(
        'users.id',
        'users.university_id',
        'users.email',
        'users.role',
        'users.is_verified',
        'users.is_active',
        'users.last_active_at',
        'users.created_at',
        'profiles.full_name',
        'profiles.avatar_url',
        'profiles.department',
        'profiles.batch_year',
      )

    const countQuery = db('users')
      .where({ university_id: universityId, is_deleted: false })
      .modify((builder) => {
        if (query.verified === 'unverified') builder.where('is_verified', false)
      })
    const [{ count }] = await countQuery.count<CountRow[]>({ count: '*' })

    const rows = await baseQuery
      .orderBy('users.created_at', 'desc')
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)

    return {
      items: rows.map(toAdminUser),
      total: Number(count),
      page: query.page,
      limit: query.limit,
    }
  }
```

Update the `import type { ... } from './schema'` block at the top of `service.ts` to swap `PaginationQuery` for `ListUsersQuery` wherever `listUsers` is typed (only its own signature — other methods keep using `PaginationQuery`).

Add `verifyUser` right after `updateUserStatus` (currently ending at line 353):

```ts
  async verifyUser(universityId: string, actorId: string, userId: string) {
    const user = await db('users')
      .where({ id: userId, university_id: universityId, is_deleted: false })
      .first<{ is_verified: boolean }>('is_verified')

    if (!user) throw notFound('User not found')
    if (user.is_verified) throw badRequest('User is already verified', 'ALREADY_VERIFIED')

    await db('users').where({ id: userId, university_id: universityId }).update({ is_verified: true })

    await db('university_audit_logs').insert({
      university_id: universityId,
      actor_id: actorId,
      action: 'user.verified',
      payload: JSON.stringify({ userId }),
    })

    return { userId, isVerified: true as const }
  }
```

- [ ] **Step 5: Add controller handlers**

In `apps/api/src/modules/admin/controller.ts`:

```ts
export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const { universityId } = getAdminContext(req)
  const result = await adminService.listUsers(universityId, req.query as unknown as ListUsersQuery)
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})
```

(replace the existing `listUsers` handler, which currently types `req.query` as `PaginationQuery` — swap the type only, logic is identical) and add the import `ListUsersQuery` to the `import type { ... } from './schema'` block. Then add a new handler after `updateUserStatus`:

```ts
export const verifyUser = asyncHandler(async (req: Request, res: Response) => {
  const { universityId, userId: actorId } = getAdminContext(req)
  const userId = req.params.userId as string
  sendSuccess(res, await adminService.verifyUser(universityId, actorId, userId))
})
```

- [ ] **Step 6: Register the route and query validation**

In `apps/api/src/modules/admin/router.ts`:
- Add `verifyUser` and `ListUsersQuerySchema` to the respective import blocks.
- Change `adminRouter.get('/users', validateRequest({ query: PaginationQuerySchema }), listUsers)` to `adminRouter.get('/users', validateRequest({ query: ListUsersQuerySchema }), listUsers)`.
- Add, next to the other `/users/:userId/...` routes: `adminRouter.patch('/users/:userId/verify', requireRole('admin'), verifyUser)`.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `DATABASE_URL="postgresql://$(whoami)@localhost:5432/uniconnect_test" GEMINI_API_KEY=test-key npx pnpm --filter api test admin-verification`
Expected: PASS.

- [ ] **Step 8: Run the full admin suite plus typecheck/lint to catch regressions from the `listUsers`/`PaginationQuery` signature change**

Run: `DATABASE_URL="postgresql://$(whoami)@localhost:5432/uniconnect_test" GEMINI_API_KEY=test-key npx pnpm --filter api test admin && npx pnpm --filter api typecheck && npx pnpm --filter api lint`
Expected: all green.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/modules/admin/service.ts apps/api/src/modules/admin/schema.ts apps/api/src/modules/admin/controller.ts apps/api/src/modules/admin/router.ts apps/api/src/__tests__/admin-verification.test.ts
git commit -m "feat(admin): add verification queue (unverified counts + mark-verified action)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017JRVZzfLB9LALRcnS9f2p2"
```

---

### Task 4: Frontend — `InvitationsTab`: batch name field + "Invite batches" section

**Files:**
- Modify: `apps/web/src/pages/AdminPage.tsx` (`InvitationsTab`, currently lines 1053-1371)

**Interfaces:**
- Consumes: `POST /admin/invitations/bulk` (now requires `batch_label` in the body), `GET /admin/invitations/batches` → `InviteBatch[]` (from Task 2: `{ id, label, role, total, accepted, expiresAt, createdAt }`).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add a batch-name input to the bulk-invite form**

In `InvitationsTab`, add state next to the other bulk-mode state (near `bulkText`/`bulkRole`/`bulkDays`, around line 1060):

```tsx
  const [bulkLabel, setBulkLabel] = useState('')
```

Change the `bulkMutation` (currently ~lines 1086-1094) to send it and reset it on success:

```tsx
  const bulkMutation = useMutation({
    mutationFn: (emails: string[]) =>
      api.post('/admin/invitations/bulk', { emails, role: bulkRole, expires_in_days: bulkDays, batch_label: bulkLabel.trim() }),
    onSuccess: (_data, emails) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'invitations'] })
      void qc.invalidateQueries({ queryKey: ['admin', 'invite-batches'] })
      setBulkText('')
      setBulkLabel('')
      flash(`${emails.length} invitation${emails.length === 1 ? '' : 's'} sent`)
    },
  })
```

In the `mode === 'multiple'` block (currently ~lines 1225-1284), add the batch-name input right above the `<textarea>` for `bulkText`:

```tsx
            <input
              type="text"
              placeholder="Batch name, e.g. CSE Fall 2026 intake"
              value={bulkLabel}
              onChange={(e) => setBulkLabel(e.target.value)}
              style={inputStyle}
            />
```

Update the send button's `disabled` condition to also require a non-empty label:

```tsx
              <PrimaryBtn
                disabled={parsedEmails.length === 0 || parsedEmails.length > 50 || !bulkLabel.trim() || bulkMutation.isPending}
                onClick={() => bulkMutation.mutate(parsedEmails)}
              >
```

- [ ] **Step 2: Fetch and render the "Invite batches" section**

Add a `useQuery` for batches near the top of `InvitationsTab`, alongside the existing `data`/`isLoading` query (~line 1066-1071):

```tsx
  const { data: batches } = useQuery<InviteBatch[]>({
    queryKey: ['admin', 'invite-batches'],
    queryFn: () => api.get<{ data: InviteBatch[] }>('/admin/invitations/batches').then((r) => r.data.data),
  })
```

Add the `InviteBatch` interface near the top of the file with the other interfaces (next to `Invitation`, ~line 65-73):

```tsx
interface InviteBatch {
  id: string
  label: string
  role: string
  total: number
  accepted: number
  expiresAt: string | null
  createdAt: string
}
```

Add a `daysLeft` helper near `fmtDate` (~line 84-86):

```tsx
function daysLeft(iso: string | null): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}
```

Render the batches section right after the "Send panel" `</div>` and before the "Past invitations" block (i.e. insert right before the `{/* ── Past invitations ── */}` comment, currently ~line 1309):

```tsx
      {/* ── Invite batches ── */}
      {batches !== undefined && batches.length > 0 && (
        <div style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Invite batches</span>
          {batches.map((b) => {
            const pct = b.total > 0 ? Math.round((b.accepted / b.total) * 100) : 0
            const left = daysLeft(b.expiresAt)
            return (
              <div key={b.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{b.label}</span>
                  <Badge variant="neutral">{b.role}</Badge>
                </div>
                <div style={{ height: 5, borderRadius: 'var(--r-pill)', background: 'var(--surface-raised)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 'var(--r-pill)', background: 'var(--uc-mint)',
                    transform: `scaleX(${pct / 100})`, transformOrigin: 'left center',
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-tertiary)' }}>
                  <span>{b.accepted} of {b.total} accepted · {pct}%</span>
                  <span style={{ color: left !== null && left <= 3 ? 'var(--uc-orange-l)' : 'var(--text-tertiary)' }}>
                    {left === null ? 'all resolved' : `${left} day${left === 1 ? '' : 's'} left`}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

```

- [ ] **Step 3: Manually verify in the browser**

Run: `npx pnpm --filter web dev` (and the API dev server), sign in as admin, go to `/admin?tab=members`, send a bulk invite with a batch name, confirm the "Invite batches" card appears with a 0%-progress bar and the right days-left value, and confirm the single-invite flow (and its flat list) is unaffected.

- [ ] **Step 4: Typecheck and lint**

Run: `npx pnpm --filter web typecheck && npx pnpm --filter web lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/AdminPage.tsx
git commit -m "feat(admin): show invite batches with progress bars in Members tab

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017JRVZzfLB9LALRcnS9f2p2"
```

---

### Task 5: Frontend — `UsersTab`: verification queue section + mark-verified action

**Files:**
- Modify: `apps/web/src/pages/AdminPage.tsx` (`UsersTab`, currently lines 736-950; `Stats` interface, currently lines 28-39)

**Interfaces:**
- Consumes: `GET /admin/stats` → now includes `verificationsByRole: { role: string; count: number }[]` (Task 3). `GET /admin/users?verified=unverified` (Task 3). `PATCH /admin/users/:userId/verify` (Task 3).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add `verificationsByRole` to the `Stats` interface**

In `apps/web/src/pages/AdminPage.tsx`, update the `Stats` interface (currently lines 28-39):

```tsx
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
  verificationsByRole: { role: string; count: number }[]
  postsByDay: { date: string; count: number }[]
}
```

- [ ] **Step 2: Add a verification queue section to `UsersTab`**

In `UsersTab`, add a stats query and a mark-verified mutation alongside the existing `data`/`roleMutation`/`banMutation`/`deleteMutation` (near the top of the function, ~line 736-763):

```tsx
  const { data: stats } = useQuery<Stats>({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.get<{ data: Stats }>('/admin/stats').then((r) => r.data.data),
  })

  const verifyMutation = useMutation({
    mutationFn: (userId: string) => api.patch(`/admin/users/${userId}/verify`, {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      void qc.invalidateQueries({ queryKey: ['admin', 'stats'] })
    },
  })
```

Add the section right before the closing `</>` / after the `{modal && ...}` block and before the main `<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>` that renders the user list (i.e. as the first child inside that wrapping div, right after the "X users total" `<p>`, currently ~line 799-802):

```tsx
        {stats && stats.verificationsByRole.length > 0 && (
          <div style={{
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-lg)',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Verification queue</span>
              <Badge variant="pinned">
                {stats.verificationsByRole.reduce((sum, r) => sum + r.count, 0)} waiting
              </Badge>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {stats.verificationsByRole.map((r) => (
                <span key={r.role} style={{
                  fontSize: 12, color: 'var(--text-secondary)',
                  background: 'var(--surface-raised)', border: '0.5px solid var(--border-default)',
                  borderRadius: 'var(--r-pill)', padding: '4px 10px',
                }}>
                  {ROLE_LABELS[r.role] ?? r.role}: {r.count}
                </span>
              ))}
            </div>
          </div>
        )}

```

Add a "Mark verified" button to each unverified user's action row, alongside the existing role-select/ban/delete controls (currently ~lines 870-932, inside the `{!isSelf && (...)}` block — add it as a sibling right before the ban/unban button):

```tsx
                  {!u.isVerified && (
                    <button
                      type="button"
                      title="Mark verified"
                      onClick={() => verifyMutation.mutate(u.id)}
                      disabled={verifyMutation.isPending}
                      style={{
                        background: 'var(--uc-mint-bg)',
                        border: '0.5px solid var(--uc-mint-bdr)',
                        borderRadius: 'var(--r-sm)',
                        cursor: verifyMutation.isPending ? 'not-allowed' : 'pointer',
                        padding: '5px 6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--uc-mint)',
                      }}
                    >
                      <ShieldCheckIcon size={15} />
                    </button>
                  )}
```

(`ShieldCheckIcon` is already imported in this file as `ShieldCheck as ShieldCheckIcon` — reuse it, no new import needed.)

- [ ] **Step 3: Manually verify in the browser**

Run the dev servers, sign in as admin, go to `/admin?tab=members`, confirm the "Verification queue" card shows per-role counts, click "Mark verified" on an unverified user, confirm the badge disappears from that row and the queue counts update.

- [ ] **Step 4: Typecheck and lint**

Run: `npx pnpm --filter web typecheck && npx pnpm --filter web lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/AdminPage.tsx
git commit -m "feat(admin): add verification queue with mark-verified action to Members tab

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017JRVZzfLB9LALRcnS9f2p2"
```

---

## Self-Review

**Spec coverage:**
- Admin-named invite batches (migration, create, list, progress bar, days-left) — Tasks 1, 2, 4. ✅
- Single invites keep rendering flat, unaffected — Task 2 Step 4 (`whereNull('batch_id')`), verified by the "excludes bulk invites" test. ✅
- Verification queue = unverified-user count, no new workflow — Task 3. ✅
- Mark-verified action — Task 3 (`PATCH /admin/users/:userId/verify`) + Task 5 (button). ✅
- No new admin-only right-rail widget — verification queue and invite batches both render inside the Members tab's main content (Tasks 4-5), not in `roleShell.ts`/`rightRail/`. ✅

**Placeholder scan:** No TODOs, no "add appropriate error handling" — every step has literal code. The manual-verification steps (Task 4 Step 3, Task 5 Step 3) are intentionally manual (no automated E2E harness exists for this screen) rather than a placeholder for a missing automated test.

**Type consistency:** `InviteBatch` (frontend, Task 4) matches the shape returned by `AdminService.listInviteBatches` (backend, Task 2) field-for-field: `id/label/role/total/accepted/expiresAt/createdAt`. `ListUsersQuery` is introduced once in `schema.ts` (Task 3 Step 4) and consumed identically in both `service.ts` and `controller.ts` (Task 3 Steps 4 and 5) — no renamed duplicate. `Stats.verificationsByRole` (frontend, Task 5 Step 1) matches `getStats`'s new return field (backend, Task 3 Step 3) exactly.
