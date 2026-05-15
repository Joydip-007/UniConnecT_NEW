# Staff → Faculty Rename, Profile Data Fix, Department at Registration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the `staff` role to `faculty`, fix profile fields being null after login, and add an optional Department field to the registration form for student/alumni/faculty roles.

**Architecture:** DB migration renames the role constraint and backfills existing rows. The auth service is fixed to select all profile columns and map them to real values. A new `GET /auth/invitation/:token` peek endpoint lets the registration form know the role before rendering, allowing conditional display of the department field. All remaining `'staff'` string literals in backend and frontend are replaced with `'faculty'`.

**Tech Stack:** Node.js / Express / Knex / Zod (API), React 18 / Vite / Zustand / TanStack Query (web), Vitest / Supertest (tests), pnpm workspaces.

---

## File Map

**Create:**
- `apps/api/src/database/migrations/025_rename_staff_to_faculty.ts` — migration

**Modify (backend):**
- `apps/api/src/database/seeds/dev.ts` — role: 'staff' → 'faculty' for Eve
- `packages/shared/src/types/user.ts` — UserRole type
- `apps/api/src/modules/auth/schema.ts` — AuthRoleSchema + add department to RegisterSchema
- `apps/api/src/modules/auth/service.ts` — fix findUserWithProfile, toAuthUser, register; add peekInvitation
- `apps/api/src/modules/auth/controller.ts` — add checkInvitation handler
- `apps/api/src/modules/auth/auth.router.ts` — add GET /invitation/:token route
- `apps/api/src/modules/admin/router.ts` — role string
- `apps/api/src/modules/admin/schema.ts` — role enum
- `apps/api/src/modules/news/router.ts` — role string
- `apps/api/src/modules/campus/router.ts` — role strings
- `apps/api/src/modules/jobs/router.ts` — role strings
- `apps/api/src/modules/events/router.ts` — role strings
- `apps/api/src/modules/feed/service.ts` — role string
- `apps/api/src/modules/users/schema.ts` — role enum
- `apps/api/src/services/token.service.ts` — isValidRole guard
- `apps/api/src/__tests__/setup.ts` — CREDENTIALS.staff → CREDENTIALS.faculty
- `apps/api/src/config/env.ts` — DEV_INVITE_ROLE enum

**Modify (frontend):**
- `apps/web/src/pages/RegisterPage.tsx` — fetch invite, conditional dept field
- `apps/web/src/components/LeftSidebar.tsx` — always-render dept row
- `apps/web/src/pages/ProfilePage.tsx` — role type + roleLabel
- `apps/web/src/router/AdminRoute.tsx` — role guard
- `apps/web/src/pages/AdminPage.tsx` — UserRole type + role arrays
- `apps/web/src/pages/EventsPage.tsx` — canCreate check
- `apps/web/src/pages/JobsPage.tsx` — canPostJob check
- `apps/web/src/pages/MentorshipPage.tsx` — role check
- `apps/web/src/features/feed/components/PostCard.tsx` — role type + label
- `apps/web/src/features/events/components/CreateEventForm.tsx` — role check + label
- `apps/web/src/features/messages/components/ConversationList.tsx` — role type
- `apps/web/src/features/messages/components/NewConversationModal.tsx` — role type + badge map
- `apps/web/src/features/profile/components/FollowModal.tsx` — role type
- `apps/web/src/components/RightSidebar.tsx` — roleLabel

---

## Task 1: DB migration — rename staff → faculty

**Files:**
- Create: `apps/api/src/database/migrations/025_rename_staff_to_faculty.ts`
- Modify: `apps/api/src/database/seeds/dev.ts:153`

- [ ] **Step 1: Create the migration file**

```ts
// apps/api/src/database/migrations/025_rename_staff_to_faculty.ts
import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.raw('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check')
  await knex.raw(
    "ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'alumni', 'faculty', 'admin'))",
  )
  await knex('users').where({ role: 'staff' }).update({ role: 'faculty' })
  await knex('invitations').where({ role: 'staff' }).update({ role: 'faculty' })
}

export async function down(knex: Knex) {
  await knex('invitations').where({ role: 'faculty' }).update({ role: 'staff' })
  await knex('users').where({ role: 'faculty' }).update({ role: 'staff' })
  await knex.raw('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check')
  await knex.raw(
    "ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'alumni', 'staff', 'admin'))",
  )
}
```

- [ ] **Step 2: Update dev seed — Eve's role**

In `apps/api/src/database/seeds/dev.ts` line 153, change:
```ts
{ id: U_EVE,    email: 'eve.islam@bscse.uiu.ac.bd',       role: 'staff'   },
```
to:
```ts
{ id: U_EVE,    email: 'eve.islam@bscse.uiu.ac.bd',       role: 'faculty' },
```

- [ ] **Step 3: Run migration against dev DB**

```bash
npx pnpm --filter api db:migrate
```
Expected: `Batch 1 run: 1 migrations` (or similar — no error).

- [ ] **Step 4: Verify migration applied**

```bash
docker exec -it $(docker ps -qf name=postgres) psql -U postgres -d uniconnect_dev -c "\d users" | grep check
```
Expected output contains: `users_role_check` with `faculty` in the list.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/database/migrations/025_rename_staff_to_faculty.ts apps/api/src/database/seeds/dev.ts
git commit -m "feat(db): rename staff role to faculty"
```

---

## Task 2: Shared types + backend role rename sweep

**Files:**
- Modify: `packages/shared/src/types/user.ts`
- Modify: `apps/api/src/modules/auth/schema.ts`
- Modify: `apps/api/src/modules/admin/router.ts`
- Modify: `apps/api/src/modules/admin/schema.ts`
- Modify: `apps/api/src/modules/news/router.ts`
- Modify: `apps/api/src/modules/campus/router.ts`
- Modify: `apps/api/src/modules/jobs/router.ts`
- Modify: `apps/api/src/modules/events/router.ts`
- Modify: `apps/api/src/modules/feed/service.ts`
- Modify: `apps/api/src/modules/users/schema.ts`
- Modify: `apps/api/src/services/token.service.ts`
- Modify: `apps/api/src/__tests__/setup.ts`
- Modify: `apps/api/src/config/env.ts`

- [ ] **Step 1: Update shared UserRole type**

In `packages/shared/src/types/user.ts` line 1:
```ts
export type UserRole = 'student' | 'alumni' | 'faculty' | 'admin'
```

- [ ] **Step 2: Update AuthRoleSchema in auth/schema.ts**

In `apps/api/src/modules/auth/schema.ts` line 3:
```ts
export const AuthRoleSchema = z.enum(['student', 'alumni', 'faculty', 'admin'])
```

- [ ] **Step 3: Update admin/router.ts**

Line 31 — change `requireRole('staff', 'admin')` to:
```ts
adminRouter.use(requireAuth, resolveUniversity, requireRole('faculty', 'admin'))
```

- [ ] **Step 4: Update admin/schema.ts**

Three occurrences of `z.enum(['student', 'alumni', 'staff', 'admin'])` — change all to:
```ts
z.enum(['student', 'alumni', 'faculty', 'admin'])
```

- [ ] **Step 5: Update news/router.ts**

Three lines with `requireRole('staff', 'admin')` — change all three to:
```ts
requireRole('faculty', 'admin')
```

- [ ] **Step 6: Update campus/router.ts**

Multiple `requireRole(...)` calls with `'staff'` — change each:
- `requireRole('student', 'alumni', 'staff', 'admin')` → `requireRole('student', 'alumni', 'faculty', 'admin')`
- `requireRole('staff', 'admin')` → `requireRole('faculty', 'admin')`

- [ ] **Step 7: Update jobs/router.ts**

Multiple lines — change every `'staff'` to `'faculty'`:
- `requireRole('alumni', 'staff', 'admin')` → `requireRole('alumni', 'faculty', 'admin')`

- [ ] **Step 8: Update events/router.ts**

Four lines — change every `requireRole('staff', 'admin')` to:
```ts
requireRole('faculty', 'admin')
```

- [ ] **Step 9: Update feed/service.ts**

Lines 578–579:
```ts
if (role === 'faculty' || role === 'admin') return
throw forbidden('Only faculty and admins can create announcements', 'ANNOUNCEMENT_FORBIDDEN')
```

- [ ] **Step 10: Update users/schema.ts**

Line 20:
```ts
role: z.enum(['student', 'alumni', 'faculty', 'admin']).optional(),
```

- [ ] **Step 11: Update token.service.ts**

Line 212:
```ts
return value === 'student' || value === 'alumni' || value === 'faculty' || value === 'admin'
```

- [ ] **Step 12: Update __tests__/setup.ts**

Lines 13–18 — rename the `staff` key to `faculty`:
```ts
export const CREDENTIALS = {
  admin:   { email: 'admin@uiu.ac.bd',   password: 'Admin@1234',   role: 'admin'   },
  faculty: { email: 'faculty@uiu.ac.bd', password: 'Faculty@1234', role: 'faculty' },
  alumni:  { email: 'alumni@uiu.ac.bd',  password: 'Alumni@1234',  role: 'alumni'  },
  student: { email: 'student@uiu.ac.bd', password: 'Student@1234', role: 'student' },
}
```

- [ ] **Step 13: Update config/env.ts**

The `DEV_INVITE_ROLE` enum:
```ts
DEV_INVITE_ROLE: z.enum(['student', 'alumni', 'faculty', 'admin']).default('student'),
```

- [ ] **Step 14: Run typecheck to confirm no errors**

```bash
npx pnpm --filter api typecheck
```
Expected: no errors.

- [ ] **Step 15: Commit**

```bash
git add packages/shared/src/types/user.ts \
  apps/api/src/modules/auth/schema.ts \
  apps/api/src/modules/admin/router.ts \
  apps/api/src/modules/admin/schema.ts \
  apps/api/src/modules/news/router.ts \
  apps/api/src/modules/campus/router.ts \
  apps/api/src/modules/jobs/router.ts \
  apps/api/src/modules/events/router.ts \
  apps/api/src/modules/feed/service.ts \
  apps/api/src/modules/users/schema.ts \
  apps/api/src/services/token.service.ts \
  apps/api/src/__tests__/setup.ts \
  apps/api/src/config/env.ts
git commit -m "refactor(api): rename staff → faculty in all role references"
```

---

## Task 3: Fix profile fields always returning null

**Files:**
- Modify: `apps/api/src/modules/auth/service.ts`
- Test: `apps/api/src/__tests__/auth.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `apps/api/src/__tests__/auth.test.ts` (after the existing `describe` blocks):

```ts
describe('GET /api/v1/auth/me', () => {
  it('returns real profile data including department', async () => {
    const { accessToken } = await loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password)

    // Set department directly in DB so we can verify the field comes back
    await db('profiles')
      .join('users', 'users.id', 'profiles.user_id')
      .where('users.email', CREDENTIALS.student.email)
      .update({ 'profiles.department': 'CSE', 'profiles.batch_year': '2025' })

    const res = await api.get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .set(UNI)

    expect(res.status).toBe(200)
    expect(res.body.data.profile.department).toBe('CSE')
    expect(res.body.data.profile.batchYear).toBe('2025')

    // Clean up
    await db('profiles')
      .join('users', 'users.id', 'profiles.user_id')
      .where('users.email', CREDENTIALS.student.email)
      .update({ 'profiles.department': null, 'profiles.batch_year': null })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx pnpm --filter api test src/__tests__/auth.test.ts
```
Expected: the new test FAILS with `expected null to be 'CSE'`.

- [ ] **Step 3: Update UserWithProfileRow interface in auth/service.ts**

In `apps/api/src/modules/auth/service.ts`, expand the `UserWithProfileRow` interface (currently after line 19):

```ts
interface UserWithProfileRow extends UserRow {
  full_name: string
  avatar_url: string | null
  cover_url: string | null
  bio: string | null
  headline: string | null
  department: string | null
  batch_year: string | null
  linkedin_url: string | null
  phone: string | null
  skills: string[] | null
  is_open_to_work: boolean
}
```

- [ ] **Step 4: Fix findUserWithProfile to select all profile columns**

Replace the `.select(...)` call inside `findUserWithProfile` (currently lines 313–326):

```ts
async function findUserWithProfile(userId: string) {
  return db<UserRow>('users')
    .join('profiles', 'profiles.user_id', 'users.id')
    .select(
      'users.id',
      'users.university_id',
      'users.email',
      'users.password_hash',
      'users.role',
      'users.is_verified',
      'users.is_active',
      'profiles.full_name',
      'profiles.avatar_url',
      'profiles.cover_url',
      'profiles.bio',
      'profiles.headline',
      'profiles.department',
      'profiles.batch_year',
      'profiles.linkedin_url',
      'profiles.phone',
      'profiles.skills',
      'profiles.is_open_to_work',
    )
    .where('users.id', userId)
    .first<UserWithProfileRow>()
}
```

- [ ] **Step 5: Fix findUserWithProfileByEmail to select all profile columns**

Replace the `.select(...)` call inside `findUserWithProfileByEmail` (currently lines 330–349) with the same expanded column list:

```ts
async function findUserWithProfileByEmail(email: string, universityId: string) {
  return db<UserRow>('users')
    .join('profiles', 'profiles.user_id', 'users.id')
    .select(
      'users.id',
      'users.university_id',
      'users.email',
      'users.password_hash',
      'users.role',
      'users.is_verified',
      'users.is_active',
      'profiles.full_name',
      'profiles.avatar_url',
      'profiles.cover_url',
      'profiles.bio',
      'profiles.headline',
      'profiles.department',
      'profiles.batch_year',
      'profiles.linkedin_url',
      'profiles.phone',
      'profiles.skills',
      'profiles.is_open_to_work',
    )
    .where({
      'users.email': email.toLowerCase(),
      'users.university_id': universityId,
    })
    .first<UserWithProfileRow>()
}
```

- [ ] **Step 6: Fix toAuthUser to map real values**

Replace the `toAuthUser` function body (currently lines 351–372):

```ts
function toAuthUser(user: UserWithProfileRow) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    universityId: user.university_id,
    isVerified: user.is_verified,
    profile: {
      fullName: user.full_name,
      bio: user.bio ?? null,
      avatarUrl: user.avatar_url ?? null,
      coverUrl: user.cover_url ?? null,
      headline: user.headline ?? null,
      department: user.department ?? null,
      batchYear: user.batch_year ?? null,
      linkedinUrl: user.linkedin_url ?? null,
      phone: user.phone ?? null,
      skills: user.skills ?? [],
      isOpenToWork: user.is_open_to_work ?? false,
    },
  }
}
```

- [ ] **Step 7: Run test to verify it passes**

```bash
npx pnpm --filter api test src/__tests__/auth.test.ts
```
Expected: all tests PASS including the new `GET /api/v1/auth/me` test.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/auth/service.ts apps/api/src/__tests__/auth.test.ts
git commit -m "fix(auth): select all profile columns and map real values in toAuthUser"
```

---

## Task 4: Department field saved at registration

**Files:**
- Modify: `apps/api/src/modules/auth/schema.ts`
- Modify: `apps/api/src/modules/auth/service.ts`
- Test: `apps/api/src/__tests__/auth.test.ts`

- [ ] **Step 1: Write the failing test**

Add inside the existing `describe('POST /api/v1/auth/register', ...)` block in `apps/api/src/__tests__/auth.test.ts`:

```ts
  it('stores department in profile when provided at registration', async () => {
    const email = `dept.${Date.now()}@bscse.uiu.ac.bd`
    createdUserEmails.push(email)

    const res = await api.post('/api/v1/auth/register').set(UNI).send({
      email,
      password: 'TestPass@1234',
      full_name: 'Dept Tester',
      role: 'student',
      department: 'EEE',
    })

    expect(res.status).toBe(201)

    // Verify department persisted
    const profile = await db('profiles')
      .join('users', 'users.id', 'profiles.user_id')
      .where('users.email', email)
      .select('profiles.department')
      .first<{ department: string | null }>()

    expect(profile?.department).toBe('EEE')
  })
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx pnpm --filter api test src/__tests__/auth.test.ts
```
Expected: the new test FAILS — `department` is `null` in the DB.

- [ ] **Step 3: Add department to RegisterSchema**

In `apps/api/src/modules/auth/schema.ts`, add `department` inside the `.object({...})` block and include it in the `.transform(...)` output:

```ts
export const RegisterSchema = z
  .object({
    email: z.string().trim().email('Valid email is required').transform((value) => value.toLowerCase()).optional(),
    password: z.string().min(8, 'Password must be at least 8 characters').optional(),
    full_name: z.string().trim().min(1, 'Full name is required').optional(),
    fullName: z.string().trim().min(1, 'Full name is required').optional(),
    role: AuthRoleSchema.optional(),
    invitation_token: z.string().trim().min(1).optional(),
    token: z.string().trim().min(1).optional(),
    department: z.string().trim().min(1).max(100).optional().nullable(),
  })
  .transform((value) => ({
    email: value.email,
    password: value.password,
    full_name: value.full_name ?? value.fullName,
    role: value.role,
    invitation_token: value.invitation_token ?? value.token,
    department: value.department ?? null,
  }))
  .refine((value) => Boolean(value.full_name), {
    message: 'Full name is required',
  })
```

Update the `RegisterInput` type alias at the bottom — no change needed (it's inferred from the schema).

- [ ] **Step 4: Pass department to profile insert in register service**

In `apps/api/src/modules/auth/service.ts`, update the profile insert inside the `db.transaction` block (currently around line 97):

```ts
await trx('profiles').insert({
  user_id: createdUser.id,
  full_name: data.full_name,
  department: data.department ?? null,
})
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx pnpm --filter api test src/__tests__/auth.test.ts
```
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/auth/schema.ts apps/api/src/modules/auth/service.ts apps/api/src/__tests__/auth.test.ts
git commit -m "feat(auth): accept department at registration and persist to profile"
```

---

## Task 5: Peek invitation endpoint

**Files:**
- Modify: `apps/api/src/modules/auth/service.ts`
- Modify: `apps/api/src/modules/auth/controller.ts`
- Modify: `apps/api/src/modules/auth/auth.router.ts`
- Test: `apps/api/src/__tests__/auth.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `apps/api/src/__tests__/auth.test.ts`:

```ts
describe('GET /api/v1/auth/invitation/:token', () => {
  const testToken = `peek-test-${Date.now()}`
  const testEmail = `peek.${Date.now()}@bscse.uiu.ac.bd`

  beforeAll(async () => {
    await db('invitations').insert({
      university_id: TEST_UNIVERSITY_ID,
      email: testEmail,
      role: 'student',
      token: testToken,
      is_used: false,
      expires_at: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    })
  })

  afterAll(async () => {
    await db('invitations').where({ token: testToken }).delete()
  })

  it('returns 200 with role and email for a valid token', async () => {
    const res = await api
      .get(`/api/v1/auth/invitation/${testToken}`)
      .set(UNI)

    expect(res.status).toBe(200)
    expect(res.body.data.role).toBe('student')
    expect(res.body.data.email).toBe(testEmail)
  })

  it('returns 404 for an unknown token', async () => {
    const res = await api
      .get('/api/v1/auth/invitation/does-not-exist')
      .set(UNI)

    expect(res.status).toBe(404)
  })
})
```

Note: `beforeAll`/`afterAll` need to be imported at the top of the test file if not already. They are already imported from `vitest`.

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx pnpm --filter api test src/__tests__/auth.test.ts
```
Expected: both new tests FAIL with 404 (route doesn't exist yet).

- [ ] **Step 3: Add peekInvitation method to AuthService**

In `apps/api/src/modules/auth/service.ts`, add this method to the `AuthService` class (after the `resendOtp` method, before the closing brace of the class):

```ts
  async peekInvitation(token: string, universityId: string) {
    const inv = await db('invitations')
      .where({ token, university_id: universityId, is_used: false })
      .where('expires_at', '>', db.fn.now())
      .select('role', 'email')
      .first<{ role: string; email: string } | undefined>()

    if (!inv) throw new AppError('Invitation not found', 404, 'NOT_FOUND')
    return { role: inv.role as UserRole, email: inv.email }
  }
```

Add the `UserRole` import at the top of the file — it's already available via `@uniconnect/shared`.

At the top of `apps/api/src/modules/auth/service.ts`, ensure UserRole is imported:
```ts
import type { UserRole } from '@uniconnect/shared'
```
(It's already imported on line 3 — no change needed.)

- [ ] **Step 4: Add checkInvitation controller handler**

In `apps/api/src/modules/auth/controller.ts`, add after the `me` handler (after line 109):

```ts
export const checkInvitation = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.params as { token: string }
  const data = await authService.peekInvitation(token, getUniversityId(req))
  res.json({ data })
})
```

- [ ] **Step 5: Register the route**

In `apps/api/src/modules/auth/auth.router.ts`, add after the existing `authRouter.get('/me', ...)` line:

```ts
authRouter.get('/invitation/:token', checkInvitation)
```

Also add `checkInvitation` to the import list at the top of the file:

```ts
import {
  checkInvitation,
  forgotPassword,
  login,
  logout,
  me,
  refresh,
  register,
  resendOtp,
  resetPassword,
  verifyLoginOtp,
  verifyOtp,
} from './controller'
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx pnpm --filter api test src/__tests__/auth.test.ts
```
Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/auth/service.ts apps/api/src/modules/auth/controller.ts apps/api/src/modules/auth/auth.router.ts apps/api/src/__tests__/auth.test.ts
git commit -m "feat(auth): add GET /auth/invitation/:token peek endpoint"
```

---

## Task 6: Frontend role rename sweep

**Files:**
- Modify: `apps/web/src/pages/ProfilePage.tsx`
- Modify: `apps/web/src/router/AdminRoute.tsx`
- Modify: `apps/web/src/pages/AdminPage.tsx`
- Modify: `apps/web/src/pages/EventsPage.tsx`
- Modify: `apps/web/src/pages/JobsPage.tsx`
- Modify: `apps/web/src/pages/MentorshipPage.tsx`
- Modify: `apps/web/src/features/feed/components/PostCard.tsx`
- Modify: `apps/web/src/features/events/components/CreateEventForm.tsx`
- Modify: `apps/web/src/features/messages/components/ConversationList.tsx`
- Modify: `apps/web/src/features/messages/components/NewConversationModal.tsx`
- Modify: `apps/web/src/features/profile/components/FollowModal.tsx`
- Modify: `apps/web/src/components/RightSidebar.tsx`
- Modify: `apps/web/src/components/LeftSidebar.tsx` (just the admin guard line)

- [ ] **Step 1: ProfilePage.tsx**

Line 17 — role type:
```ts
role: 'student' | 'alumni' | 'faculty' | 'admin'
```
Line 63 — label:
```ts
if (role === 'faculty') return 'Faculty'
```

- [ ] **Step 2: AdminRoute.tsx**

Line 11:
```ts
if (user.role !== 'admin' && user.role !== 'faculty') return <Navigate to={PATHS.FEED} replace />
```

- [ ] **Step 3: AdminPage.tsx**

Line 18 — local type:
```ts
type UserRole = 'student' | 'alumni' | 'faculty' | 'admin'
```
Lines 471, 644, 682 — role arrays (3 occurrences):
```ts
{(['student', 'alumni', 'faculty', 'admin'] as UserRole[]).map((r) => (
```

- [ ] **Step 4: EventsPage.tsx**

Line 43:
```ts
const canCreate = role === 'faculty' || role === 'admin'
```
Line 242 — comment only:
```tsx
{/* ── Floating create button — faculty / admin only ─────────────────── */}
```

- [ ] **Step 5: JobsPage.tsx**

Line 48:
```ts
const canPostJob = role === 'alumni' || role === 'faculty' || role === 'admin'
```
Line 255 — comment only:
```tsx
{/* Floating post a job button — alumni / faculty / admin only */}
```

- [ ] **Step 6: MentorshipPage.tsx**

Line 1210:
```ts
if (role === 'faculty' || role === 'admin') {
```

- [ ] **Step 7: PostCard.tsx**

Line 32 — interface:
```ts
role: 'student' | 'alumni' | 'faculty' | 'admin'
```
Line 134 — label:
```ts
if (role === 'faculty') return 'Faculty'
```

- [ ] **Step 8: CreateEventForm.tsx**

Line 190:
```ts
if (role !== 'faculty' && role !== 'admin') {
```
Line 219 — error message:
```tsx
Only faculty and admins can create events.
```

- [ ] **Step 9: ConversationList.tsx**

Line 15 — interface:
```ts
role: 'student' | 'alumni' | 'faculty' | 'admin'
```

- [ ] **Step 10: NewConversationModal.tsx**

Line 15 — interface:
```ts
role: 'student' | 'alumni' | 'faculty' | 'admin'
```
Line 67 — badge variant map (rename the key):
```ts
faculty: 'neutral',
```

- [ ] **Step 11: FollowModal.tsx**

Line 25 — interface:
```ts
role: 'student' | 'alumni' | 'faculty' | 'admin'
```

- [ ] **Step 12: RightSidebar.tsx**

Line 75 — label function:
```ts
if (role === 'faculty') return 'Faculty'
```

- [ ] **Step 13: LeftSidebar.tsx — admin panel guard**

Line 205:
```ts
...(user?.role === 'admin' || user?.role === 'faculty'
  ? [{ icon: ShieldCheck, label: 'Admin panel', path: PATHS.ADMIN }]
  : []),
```

- [ ] **Step 14: Run typecheck**

```bash
npx pnpm --filter web typecheck
```
Expected: no errors. Fix any that appear before continuing.

- [ ] **Step 15: Commit**

```bash
git add apps/web/src/pages/ProfilePage.tsx \
  apps/web/src/router/AdminRoute.tsx \
  apps/web/src/pages/AdminPage.tsx \
  apps/web/src/pages/EventsPage.tsx \
  apps/web/src/pages/JobsPage.tsx \
  apps/web/src/pages/MentorshipPage.tsx \
  apps/web/src/features/feed/components/PostCard.tsx \
  apps/web/src/features/events/components/CreateEventForm.tsx \
  apps/web/src/features/messages/components/ConversationList.tsx \
  apps/web/src/features/messages/components/NewConversationModal.tsx \
  apps/web/src/features/profile/components/FollowModal.tsx \
  apps/web/src/components/RightSidebar.tsx \
  apps/web/src/components/LeftSidebar.tsx
git commit -m "refactor(web): rename staff → faculty in all frontend role references"
```

---

## Task 7: Registration form — fetch invite + conditional department field

**Files:**
- Modify: `apps/web/src/pages/RegisterPage.tsx`

- [ ] **Step 1: Replace the registration form component**

Replace the entire `RegisterPage.tsx` with the following. Read the current file first to confirm line numbers, then apply this complete replacement:

```tsx
import { FormEvent, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { api } from '@/lib/axios'
import { PrimaryBtn } from '@/components/Button'
import { BrandLogo } from '@/components/BrandLogo'
import { PATHS } from '@/router/paths'
import type { User, UserRole } from '@uniconnect/shared/types'

interface RegisterResponse {
  data: {
    message: string
    user: User
    accessToken: string
  }
}

interface InvitePreview {
  role: UserRole
  email: string
}

const ROLES_WITH_DEPT: UserRole[] = ['student', 'alumni', 'faculty']

function validate(fullName: string, password: string, confirmPassword: string) {
  const errs: Record<string, string> = {}
  if (!fullName.trim()) errs.fullName = 'Full name is required'
  if (!/^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/.test(password))
    errs.password = 'Must be 8+ chars with a number, uppercase, and symbol.'
  if (password !== confirmPassword) errs.confirmPassword = 'Passwords do not match'
  return errs
}

export default function RegisterPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()

  const [fullName, setFullName]               = useState('')
  const [password, setPassword]               = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [department, setDepartment]           = useState('')
  const [inviteToken, setInviteToken]         = useState('')
  const [fieldErrors, setFieldErrors]         = useState<Record<string, string>>({})
  const [serverError, setServerError]         = useState<string | null>(null)
  const [loading, setLoading]                 = useState(false)

  // Invite preview state (only used when token is present)
  const [invite, setInvite]         = useState<InvitePreview | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError]   = useState<string | null>(null)

  const isTokenRoute = token && token !== 'invite'

  useEffect(() => {
    if (!isTokenRoute) return
    setInviteLoading(true)
    api
      .get<{ data: InvitePreview }>(`/auth/invitation/${token}`)
      .then((r) => setInvite(r.data.data))
      .catch(() => setInviteError('This invitation is invalid or has already been used.'))
      .finally(() => setInviteLoading(false))
  }, [token, isTokenRoute])

  // ── Invite-code step (no token in URL yet) ──────────────────────────────────
  if (!isTokenRoute) {
    return (
      <RegisterShell>
        <div style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-xl)',
          padding: '32px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.3 }}>
              Create your account
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Enter your invitation code to continue registration.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              const nextToken = inviteToken.trim()
              if (nextToken) navigate(PATHS.REGISTER.replace(':token', nextToken))
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <Field label="Invite code">
              <input
                type="text"
                autoComplete="off"
                required
                value={inviteToken}
                onChange={(e) => setInviteToken(e.target.value)}
                placeholder="dev-invite"
                style={inputStyle}
              />
            </Field>

            <PrimaryBtn
              type="submit"
              disabled={!inviteToken.trim()}
              style={{ width: '100%', marginTop: 4, justifyContent: 'center' }}
            >
              Continue
            </PrimaryBtn>
          </form>
        </div>

        <p style={{ margin: 0, textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <a href={PATHS.LOGIN} style={{ color: 'var(--uc-indigo-l)', textDecoration: 'none' }}>
            Sign in
          </a>
        </p>
      </RegisterShell>
    )
  }

  // ── Loading invite preview ──────────────────────────────────────────────────
  if (inviteLoading) {
    return (
      <RegisterShell>
        <div style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-xl)',
          padding: '32px 28px',
          textAlign: 'center',
          color: 'var(--text-secondary)',
          fontSize: 14,
        }}>
          Validating invitation…
        </div>
      </RegisterShell>
    )
  }

  // ── Invalid invite ──────────────────────────────────────────────────────────
  if (inviteError) {
    return (
      <RegisterShell>
        <div style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-xl)',
          padding: '32px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>
          <p style={{
            margin: 0,
            fontSize: 13,
            color: 'var(--uc-orange-l)',
            background: 'var(--uc-orange-bg)',
            border: '0.5px solid var(--uc-orange-bdr)',
            borderRadius: 'var(--r-sm)',
            padding: '10px 14px',
          }}>
            {inviteError}
          </p>
          <a href={PATHS.LOGIN} style={{ fontSize: 13, color: 'var(--uc-indigo-l)', textDecoration: 'none' }}>
            Back to sign in
          </a>
        </div>
      </RegisterShell>
    )
  }

  // ── Main registration form ──────────────────────────────────────────────────
  const showDept = invite ? ROLES_WITH_DEPT.includes(invite.role) : false

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    setServerError(null)

    const errs = validate(fullName, password, confirmPassword)
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      return
    }

    setLoading(true)
    try {
      const { data } = await api.post<RegisterResponse>('/auth/register', {
        token,
        password,
        fullName: fullName.trim(),
        ...(showDept && department.trim() ? { department: department.trim() } : {}),
      })
      navigate(`${PATHS.VERIFY_OTP}?purpose=verify`, {
        state: { email: data.data.user.email },
        replace: true,
      })
    } catch (err) {
      if (isAxiosError(err)) {
        const status = err.response?.status
        const code: string = err.response?.data?.code ?? ''
        if (status === 409 || code === 'CONFLICT') {
          setServerError('An account already exists for this invitation.')
        } else if (status === 404 || code === 'NOT_FOUND') {
          setServerError('Invitation token is invalid or expired.')
        } else if (status === 422) {
          setServerError('Please check your details and try again.')
        } else {
          setServerError('Something went wrong. Please try again.')
        }
      } else {
        setServerError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <RegisterShell>
      <div style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-xl)',
        padding: '32px 28px',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.3 }}>
            Create your account
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            You're registering with invitation code{' '}
            <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{token}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Full name" error={fieldErrors.fullName}>
            <input
              type="text"
              autoComplete="name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Joydip Datta"
              style={inputStyle}
            />
          </Field>

          {showDept && (
            <Field label="Department">
              <input
                type="text"
                autoComplete="off"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. CSE"
                maxLength={100}
                style={inputStyle}
              />
            </Field>
          )}

          <Field label="Password" error={fieldErrors.password}>
            <input
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 characters"
              style={inputStyle}
            />
          </Field>

          <Field label="Confirm password" error={fieldErrors.confirmPassword}>
            <input
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              style={inputStyle}
            />
          </Field>

          {serverError && (
            <p style={{
              margin: 0,
              fontSize: 13,
              color: 'var(--uc-orange-l)',
              background: 'var(--uc-orange-bg)',
              border: '0.5px solid var(--uc-orange-bdr)',
              borderRadius: 'var(--r-sm)',
              padding: '8px 12px',
            }}>
              {serverError}
            </p>
          )}

          <PrimaryBtn
            type="submit"
            disabled={loading}
            style={{ width: '100%', marginTop: 4, justifyContent: 'center' }}
          >
            {loading ? 'Creating account…' : 'Create account'}
          </PrimaryBtn>
        </form>
      </div>

      <p style={{ margin: 0, textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
        Already have an account?{' '}
        <a href={PATHS.LOGIN} style={{ color: 'var(--uc-indigo-l)', textDecoration: 'none' }}>
          Sign in
        </a>
      </p>
    </RegisterShell>
  )
}

function RegisterShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--surface-page)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        display: 'flex',
        flexDirection: 'column',
        gap: 32,
      }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <BrandLogo height={40} />
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
        {label}
      </span>
      {children}
      {error && (
        <span style={{ fontSize: 12, color: 'var(--uc-orange-l)' }}>{error}</span>
      )}
    </label>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-raised)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-sm)',
  padding: '10px 14px',
  fontSize: 14,
  color: 'var(--text-primary)',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  transition: 'border-color 0.15s',
}
```

- [ ] **Step 2: Run typecheck**

```bash
npx pnpm --filter web typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/RegisterPage.tsx
git commit -m "feat(web): registration page fetches invite and shows dept field for student/alumni/faculty"
```

---

## Task 8: Fix sidebar card height + final checks

**Files:**
- Modify: `apps/web/src/components/LeftSidebar.tsx`

- [ ] **Step 1: Fix the dept row in LeftSidebar to always render**

In `apps/web/src/components/LeftSidebar.tsx`, replace the conditional dept row (around lines 273–278):

```tsx
{deptLabel && (
  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
    {deptLabel}
  </div>
)}
```

with:

```tsx
<div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2, minHeight: 16 }}>
  {deptLabel}
</div>
```

- [ ] **Step 2: Run full typecheck and lint**

```bash
npx pnpm typecheck && npx pnpm lint
```
Expected: no errors, no warnings that weren't already present.

- [ ] **Step 3: Run full test suite**

```bash
npx pnpm --filter api test
```
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/LeftSidebar.tsx
git commit -m "fix(web): always render sidebar dept row to prevent height jitter"
```

---

## Done

After Task 8 all changes are complete:
- `staff` role no longer exists anywhere — DB, API, shared types, or frontend.
- `GET /auth/me` and login/register responses return real profile fields (department, batchYear, bio, etc.).
- The sidebar card has stable height regardless of whether department is set.
- The registration form shows a Department field for student/alumni/faculty, hidden for admin.
