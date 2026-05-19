# Theme Toggle (Light / Dark / System) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Light / Dark / System theme toggle to UniConnecT — exposed as a sun/moon icon on the landing page and as a three-option radio submenu in the authenticated profile dropdown — with per-account persistence and a global curtain transition animation.

**Architecture:** Themes are CSS variables scoped to `:root[data-theme='light' | 'dark']`. A pre-mount inline script writes `data-theme` from `localStorage` (or system preference) before React paints, eliminating flash. A Zustand `themeStore` owns `mode`, `resolved`, and a curtain phase machine; it persists locally and `PATCH`es to `/users/me/preferences` (debounced). Login hydration adopts the server's stored value. Two thin UI surfaces (`ThemeToggleButton`, the new `TopNav` submenu) both drive the same store; a single `GlobalCurtain` instance mounted at `App.tsx` plays the transition.

**Tech Stack:** React 18, Vite, Zustand, TypeScript, Tailwind (utility-only, theming is CSS-var based), Express, Knex/Postgres, Zod, Vitest.

**Reference spec:** `docs/superpowers/specs/2026-05-18-theme-toggle-design.md`

---

## Notes for the implementer

- Codebase migration naming is `NNN_description.ts`, **not** timestamped. The next number is `034` (last is `033_seed_gift_cards.ts`). Verify with `ls apps/api/src/database/migrations/ | tail -3` before creating.
- Backend integration tests live in `apps/api/src/__tests__/*.test.ts` and share `setup.ts` (which exposes `app`, `loginAs`, `CREDENTIALS`). There is no `apps/api/tests/routes/` directory — ignore the spec section that mentions that path.
- The `themePreference` field belongs on the `User` root type (alongside `email`, `role`), **not** under `user.profile`. The DB column lives on the `users` table (not `profiles`).
- Always prefix `pnpm` with `npx`: `npx pnpm typecheck` etc.
- After every task, run `npx pnpm --filter <workspace> typecheck` to surface type errors before committing.
- Commit at the end of every task using the existing commit-message format `type(scope): short description`.

---

## Task 1: Backend — migration to add `users.theme_preference`

**Files:**
- Create: `apps/api/src/database/migrations/034_add_theme_preference_to_users.ts`

- [ ] **Step 1: Confirm next migration number**

Run: `ls apps/api/src/database/migrations/ | tail -3`
Expected: last file is `033_seed_gift_cards.ts`. Next is `034`.

- [ ] **Step 2: Create the migration file**

```ts
// apps/api/src/database/migrations/034_add_theme_preference_to_users.ts
import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.alterTable('users', (table) => {
    table.text('theme_preference').notNullable().defaultTo('system')
  })

  await knex.raw(
    "ALTER TABLE users ADD CONSTRAINT users_theme_preference_check CHECK (theme_preference IN ('light', 'dark', 'system'))",
  )
}

export async function down(knex: Knex) {
  await knex.raw('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_theme_preference_check')
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('theme_preference')
  })
}
```

- [ ] **Step 3: Run the migration**

Run: `npx pnpm --filter api db:migrate`
Expected: migration `034_add_theme_preference_to_users.ts` applied successfully.

- [ ] **Step 4: Verify column exists**

Run:
```bash
docker compose exec -T postgres psql -U postgres -d uniconnect -c "\d users" | grep theme_preference
```
Expected: a row containing `theme_preference | text | not null default 'system'`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/database/migrations/034_add_theme_preference_to_users.ts
git commit -m "feat(users): add theme_preference column"
```

---

## Task 2: Shared package — `ThemePreference` schema + type, extend `User`

**Files:**
- Modify: `packages/shared/src/types/user.ts`
- Modify: `packages/shared/src/schemas/users.ts`

- [ ] **Step 1: Add `themePreference` to the `User` type**

Open `packages/shared/src/types/user.ts` and add the export and field:

```ts
export type UserRole = 'student' | 'alumni' | 'faculty' | 'admin'

export type ThemePreference = 'light' | 'dark' | 'system'

export interface UserProfile {
  // ... existing fields unchanged
  fullName: string
  bio: string | null
  avatarUrl: string | null
  coverUrl: string | null
  headline: string | null
  department: string | null
  batchYear: string | null
  linkedinUrl: string | null
  phone: string | null
  skills: string[]
  isOpenToWork: boolean
  isOpenToMentorship: boolean
  mentorshipPoints: number
}

export interface User {
  id: string
  email: string
  role: UserRole
  universityId: string
  isVerified: boolean
  themePreference: ThemePreference
  profile: UserProfile
}
```

- [ ] **Step 2: Add the Zod schema**

Append to `packages/shared/src/schemas/users.ts`:

```ts
import { z } from 'zod'

export const themePreferenceSchema = z.enum(['light', 'dark', 'system'])
export type ThemePreferenceInput = z.infer<typeof themePreferenceSchema>

export const updateUserPreferencesSchema = z
  .object({
    themePreference: themePreferenceSchema.optional(),
  })
  .strict()
export type UpdateUserPreferencesInput = z.infer<typeof updateUserPreferencesSchema>
```

If `packages/shared/src/schemas/users.ts` already exports `z`, re-use the existing import — don't double-import.

- [ ] **Step 3: Build the shared package**

Run: `npx pnpm --filter @uniconnect/shared build`
Expected: build succeeds with no type errors.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types/user.ts packages/shared/src/schemas/users.ts
git commit -m "feat(shared): add ThemePreference type and schema"
```

---

## Task 3: Backend — surface `themePreference` from `usersService`

**Files:**
- Modify: `apps/api/src/modules/users/service.ts`

- [ ] **Step 1: Extend `UserProfileRow` interface**

In `apps/api/src/modules/users/service.ts`, add the field:

```ts
interface UserProfileRow {
  id: string
  university_id: string
  email: string
  role: UserRole
  is_verified: boolean
  is_active: boolean
  last_active_at: Date | null
  created_at: Date
  theme_preference: 'light' | 'dark' | 'system'
  full_name: string
  // ... rest unchanged
  avatar_url: string | null
  cover_url: string | null
  bio: string | null
  department: string | null
  batch_year: string | null
  headline: string | null
  linkedin_url: string | null
  phone: string | null
  skills: string[] | null
  is_open_to_work: boolean
  is_open_to_mentorship: boolean
  mentorship_points: number
}
```

- [ ] **Step 2: Select the column in `getUserProfileQuery`**

Find the `getUserProfileQuery` helper at the bottom of the file and add `'users.theme_preference'` to the select list:

```ts
function getUserProfileQuery() {
  return db('users')
    .join('profiles', 'profiles.user_id', 'users.id')
    .select(
      'users.id',
      'users.university_id',
      'users.email',
      'users.role',
      'users.is_verified',
      'users.is_active',
      'users.last_active_at',
      'users.created_at',
      'users.theme_preference',
      'profiles.full_name',
      // ... rest unchanged
      'profiles.avatar_url',
      'profiles.cover_url',
      'profiles.bio',
      'profiles.department',
      'profiles.batch_year',
      'profiles.headline',
      'profiles.linkedin_url',
      'profiles.phone',
      'profiles.skills',
      'profiles.is_open_to_work',
      'profiles.is_open_to_mentorship',
      'profiles.mentorship_points',
    )
}
```

- [ ] **Step 3: Map it in `toUserProfile`**

Find `toUserProfile` and add the field to the returned object (at the user-account level, not inside `profile`):

```ts
function toUserProfile(row: UserProfileRow, options: { includePhone: boolean }) {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    universityId: row.university_id,
    isVerified: row.is_verified,
    isActive: row.is_active,
    lastActiveAt: row.last_active_at,
    createdAt: row.created_at,
    themePreference: row.theme_preference,
    profile: {
      fullName: row.full_name,
      avatarUrl: row.avatar_url,
      coverUrl: row.cover_url,
      bio: row.bio,
      department: row.department,
      batchYear: row.batch_year,
      headline: row.headline,
      linkedinUrl: row.linkedin_url,
      phone: options.includePhone ? row.phone : null,
      skills: row.skills ?? [],
      isOpenToWork: row.is_open_to_work,
      isOpenToMentorship: row.is_open_to_mentorship,
      mentorshipPoints: row.mentorship_points,
    },
  }
}
```

- [ ] **Step 4: Typecheck**

Run: `npx pnpm --filter api typecheck`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/users/service.ts
git commit -m "feat(users): include themePreference in /me payload"
```

---

## Task 4: Backend — `updatePreferences` service method

**Files:**
- Modify: `apps/api/src/modules/users/service.ts`

- [ ] **Step 1: Add the service method**

Inside `class UsersService`, add (place it after `updateCurrentUser`):

```ts
async updatePreferences(
  userId: string,
  universityId: string,
  input: { themePreference?: 'light' | 'dark' | 'system' },
) {
  const update: Record<string, unknown> = { updated_at: db.fn.now() }
  if (input.themePreference !== undefined) {
    update.theme_preference = input.themePreference
  }

  const affected = await db('users')
    .where({ id: userId, university_id: universityId })
    .update(update)

  if (affected === 0) throw notFound('User not found')

  return this.getCurrentUser(userId, universityId)
}
```

- [ ] **Step 2: Typecheck**

Run: `npx pnpm --filter api typecheck`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/users/service.ts
git commit -m "feat(users): add updatePreferences service method"
```

---

## Task 5: Backend — Zod schema for preferences endpoint

**Files:**
- Modify: `apps/api/src/modules/users/schema.ts`

- [ ] **Step 1: Add `UpdatePreferencesSchema`**

Append to `apps/api/src/modules/users/schema.ts`:

```ts
export const UpdatePreferencesSchema = z
  .object({
    themePreference: z.enum(['light', 'dark', 'system']).optional(),
  })
  .strict()

export type UpdatePreferencesInput = z.infer<typeof UpdatePreferencesSchema>
```

(The schema lives in the API module rather than only in `packages/shared` to keep the validation request-scoped and consistent with how `UpdateProfileSchema` is structured here.)

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/users/schema.ts
git commit -m "feat(users): add UpdatePreferencesSchema"
```

---

## Task 6: Backend — controller handler

**Files:**
- Modify: `apps/api/src/modules/users/controller.ts`

- [ ] **Step 1: Add the controller**

In `apps/api/src/modules/users/controller.ts`, add the new import and handler. Place the handler immediately after `updateMe`:

```ts
import type { PaginationQuery, UpdatePreferencesInput, UpdateProfileInput, UserListQuery } from './schema'
```

```ts
export const updateMyPreferences = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(
    res,
    await usersService.updatePreferences(
      context.userId,
      context.universityId,
      req.body as UpdatePreferencesInput,
    ),
  )
})
```

- [ ] **Step 2: Typecheck**

Run: `npx pnpm --filter api typecheck`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/users/controller.ts
git commit -m "feat(users): add updateMyPreferences controller"
```

---

## Task 7: Backend — register the route

**Files:**
- Modify: `apps/api/src/modules/users/router.ts`

- [ ] **Step 1: Wire the route**

Update imports and add the route just below `usersRouter.patch('/me', ...)`:

```ts
import {
  followUser,
  getMe,
  getProgress,
  getSuggestions,
  getUser,
  listFollowers,
  listFollowing,
  listUsers,
  unfollowUser,
  updateMe,
  updateMyPreferences,
} from './controller'
import {
  PaginationQuerySchema,
  UpdatePreferencesSchema,
  UpdateProfileSchema,
  UserListQuerySchema,
} from './schema'
```

```ts
usersRouter.patch('/me/preferences', validate(UpdatePreferencesSchema), updateMyPreferences)
```

The full updated section looks like:

```ts
usersRouter.get('/me', getMe)
usersRouter.patch('/me', validate(UpdateProfileSchema), updateMe)
usersRouter.patch('/me/preferences', validate(UpdatePreferencesSchema), updateMyPreferences)
usersRouter.get('/me/progress', getProgress)
```

- [ ] **Step 2: Typecheck**

Run: `npx pnpm --filter api typecheck`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/users/router.ts
git commit -m "feat(users): expose PATCH /me/preferences route"
```

---

## Task 8: Backend — integration test

**Files:**
- Create: `apps/api/src/__tests__/users-preferences.test.ts`

- [ ] **Step 1: Write the test**

```ts
// apps/api/src/__tests__/users-preferences.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import supertest from 'supertest'
import { app, loginAs, CREDENTIALS } from './setup'

const api = supertest(app)
let studentToken: string

beforeAll(async () => {
  const st = await loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password)
  studentToken = st.accessToken
})

function auth(token: string) {
  return { Authorization: `Bearer ${token}` }
}

describe('PATCH /api/v1/users/me/preferences', () => {
  it('persists a valid theme preference and returns it on GET /me', async () => {
    const patch = await api
      .patch('/api/v1/users/me/preferences')
      .set(auth(studentToken))
      .send({ themePreference: 'light' })

    expect(patch.status).toBe(200)
    expect(patch.body.data.themePreference).toBe('light')

    const me = await api.get('/api/v1/users/me').set(auth(studentToken))
    expect(me.status).toBe(200)
    expect(me.body.data.themePreference).toBe('light')
  })

  it('accepts dark and system', async () => {
    for (const value of ['dark', 'system'] as const) {
      const res = await api
        .patch('/api/v1/users/me/preferences')
        .set(auth(studentToken))
        .send({ themePreference: value })
      expect(res.status).toBe(200)
      expect(res.body.data.themePreference).toBe(value)
    }
  })

  it('rejects an invalid theme value with 400', async () => {
    const res = await api
      .patch('/api/v1/users/me/preferences')
      .set(auth(studentToken))
      .send({ themePreference: 'purple' })

    expect(res.status).toBe(400)
  })

  it('returns 401 without a token', async () => {
    const res = await api
      .patch('/api/v1/users/me/preferences')
      .send({ themePreference: 'dark' })
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run the test**

Run: `npx pnpm --filter api test users-preferences`
Expected: all 4 cases pass.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/__tests__/users-preferences.test.ts
git commit -m "test(users): cover PATCH /me/preferences endpoint"
```

---

## Task 9: Frontend — restructure `tokens.css` (dark + light + transitions)

**Files:**
- Modify: `apps/web/src/styles/tokens.css`

- [ ] **Step 1: Replace the file with the dual-theme version**

Open `apps/web/src/styles/tokens.css` and replace its contents with the following. The dark block is identical to today's `:root`, only the selector changes. The light block is new.

```css
/* Design tokens — Warm Futuristic Dark + Warm Neutral Light. */
/* Always use var(--token) in components, never raw hex. */
:root,
:root[data-theme='dark'] {
  /* ── Surfaces ─────────────────────────────────────── */
  --surface-page:     #060D1A;
  --surface-card:     #0A1628;
  --surface-raised:   #111D35;
  --surface-hover:    #1A2D4A;

  /* ── Brand — UC indigo ────────────────────────────── */
  --uc-indigo:        #5B5BD6;
  --uc-indigo-l:      #7C7CF0;
  --uc-indigo-xl:     #A5A5F8;
  --uc-indigo-bg:     rgba(91, 91, 214, 0.10);
  --uc-indigo-bdr:    rgba(91, 91, 214, 0.28);

  /* ── Brand — UIU orange ───────────────────────────── */
  --uc-orange:        #F05A28;
  --uc-orange-l:      #F5845A;
  --uc-orange-bg:     rgba(240, 90, 40, 0.10);
  --uc-orange-bdr:    rgba(240, 90, 40, 0.28);

  --uc-navy:          #1E3A70;

  /* ── Semantic ─────────────────────────────────────── */
  --uc-cyan:          #06B6D4;
  --uc-cyan-bg:       rgba(6, 182, 212, 0.10);
  --uc-cyan-bdr:      rgba(6, 182, 212, 0.28);
  --uc-mint:          #10B981;
  --uc-mint-bg:       rgba(16, 185, 129, 0.10);
  --uc-mint-bdr:      rgba(16, 185, 129, 0.28);
  --uc-red:           #E11D48;
  --uc-red-bg:        rgba(225, 29, 72, 0.08);
  --uc-red-bdr:       rgba(225, 29, 72, 0.25);

  /* ── Overlay ──────────────────────────────────────── */
  --overlay-bg:        rgba(6, 13, 26, 0.75);
  --overlay-bg-soft:   rgba(6, 13, 26, 0.56);
  --overlay-bg-strong: rgba(6, 13, 26, 0.86);
  --overlay-media:     rgba(6, 13, 26, 0.68);
  --uc-indigo-dot:     rgba(91, 91, 214, 0.30);
  --surface-glint:     rgba(255, 255, 255, 0.04);

  /* ── Text ─────────────────────────────────────────── */
  --text-primary:     #EEF2FF;
  --text-secondary:   rgba(238, 242, 255, 0.58);
  --text-tertiary:    rgba(238, 242, 255, 0.28);

  /* ── Borders ──────────────────────────────────────── */
  --border-default:   rgba(255, 255, 255, 0.07);
  --border-hover:     rgba(255, 255, 255, 0.13);
  --border-strong:    rgba(255, 255, 255, 0.22);

  /* ── Radius ───────────────────────────────────────── */
  --r-sm:   8px;
  --r-md:   12px;
  --r-lg:   16px;
  --r-xl:   20px;
  --r-pill: 999px;

  /* ── Easing ───────────────────────────────────────── */
  --ease-out-strong:    cubic-bezier(0.23, 1, 0.32, 1);
  --ease-out-expo:      cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out-strong: cubic-bezier(0.77, 0, 0.175, 1);
  --ease-drawer:        cubic-bezier(0.32, 0.72, 0, 1);

  /* ── Type ─────────────────────────────────────────── */
  --font-display: 'Satoshi', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-mono:    ui-monospace, 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace;
}

:root[data-theme='light'] {
  /* ── Surfaces — Warm Neutral Light ─────────────────── */
  --surface-page:     #FAF7F2;
  --surface-card:     #FFFFFF;
  --surface-raised:   #F4F0E8;
  --surface-hover:    #EDE7DA;

  /* ── Brand — darkened for AA contrast on white ─────── */
  --uc-indigo:        #4747C2;
  --uc-indigo-l:      #5B5BD6;
  --uc-indigo-xl:     #7C7CF0;
  --uc-indigo-bg:     rgba(71, 71, 194, 0.08);
  --uc-indigo-bdr:    rgba(71, 71, 194, 0.22);

  --uc-orange:        #D44A1F;
  --uc-orange-l:      #F05A28;
  --uc-orange-bg:     rgba(212, 74, 31, 0.10);
  --uc-orange-bdr:    rgba(212, 74, 31, 0.28);

  --uc-navy:          #1E3A70;

  --uc-cyan:          #0891B2;
  --uc-cyan-bg:       rgba(8, 145, 178, 0.08);
  --uc-cyan-bdr:      rgba(8, 145, 178, 0.25);
  --uc-mint:          #059669;
  --uc-mint-bg:       rgba(5, 150, 105, 0.08);
  --uc-mint-bdr:      rgba(5, 150, 105, 0.25);
  --uc-red:           #BE123C;
  --uc-red-bg:        rgba(190, 18, 60, 0.08);
  --uc-red-bdr:       rgba(190, 18, 60, 0.22);

  --overlay-bg:        rgba(250, 247, 242, 0.78);
  --overlay-bg-soft:   rgba(250, 247, 242, 0.56);
  --overlay-bg-strong: rgba(250, 247, 242, 0.90);
  --overlay-media:     rgba(20, 20, 20, 0.50);
  --uc-indigo-dot:     rgba(71, 71, 194, 0.28);
  --surface-glint:     rgba(0, 0, 0, 0.04);

  --text-primary:     #1A1F2E;
  --text-secondary:   rgba(26, 31, 46, 0.62);
  --text-tertiary:    rgba(26, 31, 46, 0.36);

  --border-default:   rgba(0, 0, 0, 0.08);
  --border-hover:     rgba(0, 0, 0, 0.14);
  --border-strong:    rgba(0, 0, 0, 0.22);

  /* Radius, easing, typography are theme-invariant and inherit
     from the :root block above by virtue of cascade order. */
}

html[data-theme] body {
  transition:
    background-color 280ms var(--ease-out-strong),
    color            280ms var(--ease-out-strong);
}

@media (prefers-reduced-motion: reduce) {
  html[data-theme] body {
    transition: none;
  }
}
```

- [ ] **Step 2: Visual smoke check**

Run: `npx pnpm --filter web dev`
- Open the app in a browser.
- In DevTools, set `<html data-theme="light">`. The page should render in warm cream / off-black text.
- Set `<html data-theme="dark">`. Should render exactly as today.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/styles/tokens.css
git commit -m "feat(theme): add light palette tokens and theme transitions"
```

---

## Task 10: Frontend — pre-mount bootstrap script + `color-scheme` meta

**Files:**
- Modify: `apps/web/index.html`

- [ ] **Step 1: Update `index.html`**

Replace the file with:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="dark light" />
    <title>UniConnecT — Your campus. One place.</title>
    <meta name="description" content="The private social network for universities — connecting students, alumni, and faculty in one place. Free for UIU students." />
    <meta property="og:title" content="UniConnecT — Your campus. One place." />
    <meta property="og:description" content="The private social network for universities — connecting students, alumni, and faculty in one place. Free for UIU students." />
    <script>
      (function () {
        try {
          var stored = localStorage.getItem('uc.theme')
          var mode =
            stored === 'light' || stored === 'dark' || stored === 'system'
              ? stored
              : 'system'
          var resolved =
            mode === 'system'
              ? window.matchMedia('(prefers-color-scheme: dark)').matches
                ? 'dark'
                : 'light'
              : mode
          document.documentElement.setAttribute('data-theme', resolved)
          document.documentElement.setAttribute('data-theme-mode', mode)
        } catch (e) {
          document.documentElement.setAttribute('data-theme', 'dark')
          document.documentElement.setAttribute('data-theme-mode', 'system')
        }
      })()
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Smoke check — no flash on reload**

Run: `npx pnpm --filter web dev`
- Set `localStorage.setItem('uc.theme', 'light')` in DevTools and hard-reload — first paint should be light.
- Set `localStorage.setItem('uc.theme', 'dark')` and hard-reload — first paint should be dark.
- Remove the key, reload — should follow OS preference.

- [ ] **Step 3: Commit**

```bash
git add apps/web/index.html
git commit -m "feat(theme): add pre-mount bootstrap and color-scheme meta"
```

---

## Task 11: Frontend — axios helper for `PATCH /me/preferences`

**Files:**
- Create: `apps/web/src/lib/api/users.ts` (or extend if it already exists)

- [ ] **Step 1: Check whether the file exists**

Run: `ls apps/web/src/lib/api/ 2>/dev/null`
If it doesn't exist, create `apps/web/src/lib/api/` and the file.

- [ ] **Step 2: Write the helper**

```ts
// apps/web/src/lib/api/users.ts
import { api } from '@/lib/axios'
import type { ThemePreference } from '@uniconnect/shared/types'

export async function updateUserPreferences(input: { themePreference: ThemePreference }) {
  const { data } = await api.patch<{ data: { themePreference: ThemePreference } }>(
    '/users/me/preferences',
    input,
  )
  return data.data
}
```

- [ ] **Step 3: Typecheck**

Run: `npx pnpm --filter web typecheck`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/api/users.ts
git commit -m "feat(theme): add updateUserPreferences axios helper"
```

---

## Task 12: Frontend — `themeStore`

**Files:**
- Create: `apps/web/src/stores/themeStore.ts`

- [ ] **Step 1: Write the store**

```ts
// apps/web/src/stores/themeStore.ts
import { create } from 'zustand'
import type { ThemePreference } from '@uniconnect/shared/types'
import { updateUserPreferences } from '@/lib/api/users'

export type ThemeMode = ThemePreference
export type ResolvedTheme = 'light' | 'dark'
export type CurtainPhase = 'idle' | 'falling' | 'rising'

const STORAGE_KEY = 'uc.theme'
const CURTAIN_MS = 550
const API_DEBOUNCE_MS = 300

/** Destination --surface-page values, kept in sync with tokens.css. */
const PAGE_COLOR: Record<ResolvedTheme, string> = {
  light: '#FAF7F2',
  dark:  '#060D1A',
}

function readBootstrap(): { mode: ThemeMode; resolved: ResolvedTheme } {
  if (typeof document === 'undefined') return { mode: 'system', resolved: 'dark' }
  const modeAttr = document.documentElement.getAttribute('data-theme-mode')
  const themeAttr = document.documentElement.getAttribute('data-theme')
  const mode: ThemeMode =
    modeAttr === 'light' || modeAttr === 'dark' || modeAttr === 'system' ? modeAttr : 'system'
  const resolved: ResolvedTheme = themeAttr === 'light' ? 'light' : 'dark'
  return { mode, resolved }
}

function systemResolved(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolveMode(mode: ThemeMode): ResolvedTheme {
  return mode === 'system' ? systemResolved() : mode
}

function applyDom(mode: ThemeMode, resolved: ResolvedTheme) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', resolved)
  document.documentElement.setAttribute('data-theme-mode', mode)
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

interface ThemeState {
  mode: ThemeMode
  resolved: ResolvedTheme
  phase: CurtainPhase
  targetColor: string | null

  setMode: (mode: ThemeMode) => void
  toggle: () => void
  hydrateFromProfile: (mode: ThemeMode) => void
  _onSystemChange: () => void
}

let apiDebounce: ReturnType<typeof setTimeout> | null = null
let skipApiOnce = false
let mediaQuery: MediaQueryList | null = null

function scheduleApi(mode: ThemeMode) {
  if (skipApiOnce) {
    skipApiOnce = false
    return
  }
  if (apiDebounce) clearTimeout(apiDebounce)
  apiDebounce = setTimeout(() => {
    updateUserPreferences({ themePreference: mode }).catch(() => {
      // Local state still wins; log and move on.
      // eslint-disable-next-line no-console
      console.warn('[themeStore] failed to persist theme preference')
    })
  }, API_DEBOUNCE_MS)
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const initial = readBootstrap()

  function internalSetMode(mode: ThemeMode, opts: { animate: boolean; persist: boolean }) {
    const nextResolved = resolveMode(mode)
    const current = get().resolved
    const shouldAnimate = opts.animate && nextResolved !== current && !prefersReducedMotion()

    if (!shouldAnimate) {
      applyDom(mode, nextResolved)
      set({ mode, resolved: nextResolved, phase: 'idle', targetColor: null })
      if (opts.persist) {
        try { localStorage.setItem(STORAGE_KEY, mode) } catch {}
        scheduleApi(mode)
      }
      bindSystemListener(mode)
      return
    }

    // Animated path: fall → swap → rise → idle.
    set({ phase: 'falling', targetColor: PAGE_COLOR[nextResolved] })
    setTimeout(() => {
      applyDom(mode, nextResolved)
      set({ mode, resolved: nextResolved, phase: 'rising' })
      if (opts.persist) {
        try { localStorage.setItem(STORAGE_KEY, mode) } catch {}
        scheduleApi(mode)
      }
      bindSystemListener(mode)
      setTimeout(() => set({ phase: 'idle', targetColor: null }), CURTAIN_MS + 40)
    }, CURTAIN_MS)
  }

  function bindSystemListener(mode: ThemeMode) {
    if (typeof window === 'undefined') return
    if (mode === 'system') {
      if (!mediaQuery) {
        mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        mediaQuery.addEventListener('change', () => get()._onSystemChange())
      }
    }
    // We never remove the listener — checking mode === 'system' inside _onSystemChange is enough.
  }

  // Bind once on construction in case bootstrap left us in system mode.
  bindSystemListener(initial.mode)

  return {
    mode: initial.mode,
    resolved: initial.resolved,
    phase: 'idle',
    targetColor: null,

    setMode: (mode) => internalSetMode(mode, { animate: true, persist: true }),

    toggle: () => {
      const next: ResolvedTheme = get().resolved === 'dark' ? 'light' : 'dark'
      internalSetMode(next, { animate: true, persist: true })
    },

    hydrateFromProfile: (mode) => {
      if (mode === get().mode) return
      skipApiOnce = true
      internalSetMode(mode, { animate: true, persist: true })
    },

    _onSystemChange: () => {
      const state = get()
      if (state.mode !== 'system') return
      const nextResolved = systemResolved()
      if (nextResolved === state.resolved) return
      internalSetMode('system', { animate: true, persist: false })
    },
  }
})
```

- [ ] **Step 2: Typecheck**

Run: `npx pnpm --filter web typecheck`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/stores/themeStore.ts
git commit -m "feat(theme): add Zustand themeStore with curtain phase machine"
```

---

## Task 13: Frontend — `themeStore` tests

**Files:**
- Create: `apps/web/src/stores/themeStore.test.ts`

- [ ] **Step 1: Write the tests**

```ts
// apps/web/src/stores/themeStore.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/api/users', () => ({
  updateUserPreferences: vi.fn().mockResolvedValue({ themePreference: 'light' }),
}))

import { updateUserPreferences } from '@/lib/api/users'

beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
  document.documentElement.setAttribute('data-theme', 'dark')
  document.documentElement.setAttribute('data-theme-mode', 'system')
  vi.useFakeTimers()
  ;(updateUserPreferences as ReturnType<typeof vi.fn>).mockClear()
})

async function loadStore() {
  // Re-import the store fresh so each test gets clean module state.
  return (await import('./themeStore')).useThemeStore
}

describe('themeStore', () => {
  it('initialises mode and resolved from <html> attributes', async () => {
    document.documentElement.setAttribute('data-theme', 'light')
    document.documentElement.setAttribute('data-theme-mode', 'light')
    const useThemeStore = await loadStore()
    const s = useThemeStore.getState()
    expect(s.mode).toBe('light')
    expect(s.resolved).toBe('light')
  })

  it('setMode flips data-theme, writes localStorage, and debounces the API call', async () => {
    const useThemeStore = await loadStore()
    useThemeStore.getState().setMode('light')

    // Curtain "falling" → "rising" → "idle"
    vi.advanceTimersByTime(550)
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(localStorage.getItem('uc.theme')).toBe('light')

    // API call is debounced — not fired yet
    expect(updateUserPreferences).not.toHaveBeenCalled()
    vi.advanceTimersByTime(300)
    expect(updateUserPreferences).toHaveBeenCalledWith({ themePreference: 'light' })
  })

  it('toggle() flips resolved theme between light and dark', async () => {
    const useThemeStore = await loadStore()
    useThemeStore.getState().toggle()
    vi.advanceTimersByTime(2000)
    expect(useThemeStore.getState().resolved).toBe('light')
    useThemeStore.getState().toggle()
    vi.advanceTimersByTime(2000)
    expect(useThemeStore.getState().resolved).toBe('dark')
  })

  it('hydrateFromProfile does not trigger the API', async () => {
    const useThemeStore = await loadStore()
    useThemeStore.getState().hydrateFromProfile('light')
    vi.advanceTimersByTime(2000)
    expect(updateUserPreferences).not.toHaveBeenCalled()
    expect(useThemeStore.getState().mode).toBe('light')
  })

  it('hydrateFromProfile is a no-op when the value matches current mode', async () => {
    const useThemeStore = await loadStore()
    const before = useThemeStore.getState().mode
    useThemeStore.getState().hydrateFromProfile(before)
    vi.advanceTimersByTime(2000)
    expect(updateUserPreferences).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the tests**

Run: `npx pnpm --filter web test src/stores/themeStore.test.ts`
Expected: all 5 cases pass.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/stores/themeStore.test.ts
git commit -m "test(theme): cover themeStore behaviour"
```

---

## Task 14: Frontend — `GlobalCurtain` component

**Files:**
- Create: `apps/web/src/components/GlobalCurtain.tsx`

- [ ] **Step 1: Write the component**

```tsx
// apps/web/src/components/GlobalCurtain.tsx
import { useThemeStore } from '@/stores/themeStore'

const EASING = 'cubic-bezier(0.76, 0, 0.24, 1)'
const DURATION_MS = 550

export function GlobalCurtain() {
  const phase = useThemeStore((s) => s.phase)
  const targetColor = useThemeStore((s) => s.targetColor)

  const isFalling = phase === 'falling'
  const isAnimating = phase !== 'idle'

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9997,
        pointerEvents: 'none',
        background: targetColor ?? 'transparent',
        transformOrigin: 'top',
        transform: isFalling ? 'scaleY(1)' : 'scaleY(0)',
        transition: isAnimating ? `transform ${DURATION_MS}ms ${EASING}` : 'none',
      }}
    />
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx pnpm --filter web typecheck`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/GlobalCurtain.tsx
git commit -m "feat(theme): add GlobalCurtain transition component"
```

---

## Task 15: Frontend — mount `GlobalCurtain` and theme-aware `Toaster` in `App.tsx`

**Files:**
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Update App.tsx**

```tsx
// apps/web/src/App.tsx
import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'
import { router } from '@/router'
import { GlobalCurtain } from '@/components/GlobalCurtain'
import { useThemeStore } from '@/stores/themeStore'

export default function App() {
  const resolved = useThemeStore((s) => s.resolved)
  return (
    <>
      <RouterProvider router={router} />
      <GlobalCurtain />
      <Toaster position="top-right" theme={resolved} richColors />
    </>
  )
}
```

- [ ] **Step 2: Smoke check**

Run: `npx pnpm --filter web dev`
- Page renders normally (curtain is invisible at rest).
- Manually call `useThemeStore.getState().toggle()` in DevTools console — full-viewport overlay should fall in ~550ms, theme should swap, overlay should retract over another ~550ms.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/App.tsx
git commit -m "feat(theme): mount GlobalCurtain and bind Toaster theme"
```

---

## Task 16: Frontend — hydrate from profile on login

**Files:**
- Modify: `apps/web/src/components/AuthLoader.tsx`

- [ ] **Step 1: Add the hydration call**

Edit `AuthLoader.tsx` so that immediately after `setAuth(meData.data, token)` we hydrate the theme:

```tsx
// apps/web/src/components/AuthLoader.tsx
import { useEffect, useRef, type ReactNode } from 'react'
import { api } from '@/lib/axios'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import type { User } from '@uniconnect/shared/types'

interface RefreshResponse {
  data: { accessToken: string }
}

interface MeResponse {
  data: User
}

export function AuthLoader({ children }: { children: ReactNode }) {
  const isLoading = useAuthStore((s) => s.isLoading)
  const didRun = useRef(false)

  useEffect(() => {
    if (didRun.current) return
    didRun.current = true

    async function rehydrate() {
      const { setAuth, setLoading, clearAuth } = useAuthStore.getState()

      if (!localStorage.getItem('uc:has_session')) {
        setLoading(false)
        return
      }

      try {
        const { data: refreshData } = await api.post<RefreshResponse>('/auth/refresh')
        const token = refreshData.data.accessToken
        if (!token) {
          clearAuth()
          return
        }
        const { data: meData } = await api.get<MeResponse>('/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        setAuth(meData.data, token)
        useThemeStore.getState().hydrateFromProfile(meData.data.themePreference)
      } catch {
        clearAuth()
      }
    }

    rehydrate()
  }, [])

  if (isLoading) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--surface-page)',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: '2px solid var(--border-default)',
            borderTopColor: 'var(--uc-indigo)',
            animation: 'spin 0.7s linear infinite',
          }}
        />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  return <>{children}</>
}
```

- [ ] **Step 2: Update existing AuthLoader test if it asserts on the User shape**

Run: `npx pnpm --filter web test src/components/AuthLoader.test.tsx`
If it fails because the mocked user lacks `themePreference`, open the test and add `themePreference: 'system'` to the mocked User object. Re-run.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/AuthLoader.tsx apps/web/src/components/AuthLoader.test.tsx
git commit -m "feat(theme): hydrate themeStore from server profile on login"
```

---

## Task 17: Frontend — `ThemeToggleButton` component

**Files:**
- Create: `apps/web/src/components/ThemeToggleButton.tsx`

- [ ] **Step 1: Write the component**

```tsx
// apps/web/src/components/ThemeToggleButton.tsx
import { useState, type CSSProperties } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'

interface ThemeToggleButtonProps {
  size?: number
  className?: string
}

export function ThemeToggleButton({ size = 36, className }: ThemeToggleButtonProps) {
  const resolved = useThemeStore((s) => s.resolved)
  const toggle = useThemeStore((s) => s.toggle)
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)

  const scale = pressed ? 0.96 : hovered ? 1.04 : 1

  const style: CSSProperties = {
    width: size,
    height: size,
    borderRadius: 'var(--r-pill)',
    background: hovered ? 'var(--surface-hover)' : 'var(--surface-raised)',
    color: 'var(--text-primary)',
    border: '0.5px solid var(--border-default)',
    boxShadow: '0 0 0 0.5px var(--border-strong)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transform: `scale(${scale})`,
    transition:
      'background 180ms var(--ease-out-strong), transform 120ms var(--ease-out-strong), color 180ms var(--ease-out-strong)',
    flexShrink: 0,
  }

  const Icon = resolved === 'dark' ? Sun : Moon
  const label = resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'

  return (
    <button
      type="button"
      className={className}
      onClick={toggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false) }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      aria-label={label}
      aria-pressed={resolved === 'dark'}
      style={style}
    >
      <Icon size={16} strokeWidth={1.75} />
    </button>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx pnpm --filter web typecheck`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ThemeToggleButton.tsx
git commit -m "feat(theme): add ThemeToggleButton sun/moon component"
```

---

## Task 18: Frontend — `ThemeToggleButton` test

**Files:**
- Create: `apps/web/src/components/ThemeToggleButton.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
// apps/web/src/components/ThemeToggleButton.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@/lib/api/users', () => ({
  updateUserPreferences: vi.fn().mockResolvedValue({ themePreference: 'light' }),
}))

import { ThemeToggleButton } from './ThemeToggleButton'
import { useThemeStore } from '@/stores/themeStore'

beforeEach(() => {
  document.documentElement.setAttribute('data-theme', 'dark')
  document.documentElement.setAttribute('data-theme-mode', 'dark')
  // Force the store into a known state
  useThemeStore.setState({ mode: 'dark', resolved: 'dark', phase: 'idle', targetColor: null })
})

describe('ThemeToggleButton', () => {
  it('renders a Sun icon and "Switch to light mode" label when resolved is dark', () => {
    render(<ThemeToggleButton />)
    const btn = screen.getByRole('button', { name: 'Switch to light mode' })
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveAttribute('aria-pressed', 'true')
  })

  it('renders a Moon icon and "Switch to dark mode" label when resolved is light', () => {
    useThemeStore.setState({ mode: 'light', resolved: 'light', phase: 'idle', targetColor: null })
    render(<ThemeToggleButton />)
    const btn = screen.getByRole('button', { name: 'Switch to dark mode' })
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls themeStore.toggle on click', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(useThemeStore.getState(), 'toggle')
    render(<ThemeToggleButton />)
    await user.click(screen.getByRole('button'))
    expect(spy).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test**

Run: `npx pnpm --filter web test src/components/ThemeToggleButton.test.tsx`
Expected: all 3 cases pass.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ThemeToggleButton.test.tsx
git commit -m "test(theme): cover ThemeToggleButton rendering and click"
```

---

## Task 19: Frontend — drop `ThemeToggleButton` into `LandingNav`

**Files:**
- Modify: `apps/web/src/features/landing/components/LandingNav.tsx`

- [ ] **Step 1: Add the import**

At the top of `LandingNav.tsx`:

```tsx
import { ThemeToggleButton } from '@/components/ThemeToggleButton'
```

- [ ] **Step 2: Insert into desktop right cluster**

Replace the desktop right-CTA cluster:

```tsx
{/* Right CTAs */}
<div style={{ display: 'flex', gap: 10, flexShrink: 0, marginLeft: 'auto', alignItems: 'center' }}>
  <ThemeToggleButton size={36} />
  <GhostBtn onClick={() => navigate(PATHS.LOGIN)}>Sign in</GhostBtn>
  <OrangeBtn onClick={() => navigate(PATHS.REGISTER.replace(':token', 'invite'))}>
    Join free
  </OrangeBtn>
</div>
```

- [ ] **Step 3: Insert into the mobile drawer**

Find the `<div className={\`uc-nav-mobile-drawer...}>` block. Add a row containing the toggle button at the top of it, before the list of NAV_LINKS:

```tsx
<div className={`uc-nav-mobile-drawer${menuOpen ? ' open' : ''}`}>
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0 12px' }}>
    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Theme</span>
    <ThemeToggleButton size={32} />
  </div>
  {NAV_LINKS.map(({ label, href }) => (
    /* ... existing items unchanged ... */
  ))}
  {/* ... existing CTA pair unchanged ... */}
</div>
```

- [ ] **Step 4: Smoke check**

Run: `npx pnpm --filter web dev`
- Open `/` (landing). The sun/moon button sits to the left of "Sign in". Click → page flips between light and dark, curtain animation plays.
- Resize to mobile, open the hamburger drawer. Theme row at the top of the drawer.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/landing/components/LandingNav.tsx
git commit -m "feat(landing): add theme toggle button to landing nav"
```

---

## Task 20: Frontend — add theme submenu to `TopNav` profile dropdown

**Files:**
- Modify: `apps/web/src/components/TopNav.tsx`

- [ ] **Step 1: Add imports**

At the top of `TopNav.tsx`, extend the lucide-react import and pull in the store:

```tsx
import { Bell, Check, LogOut, MessageSquare, Monitor, Moon, Search, Sun, User } from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'
import type { ThemeMode } from '@/stores/themeStore'
```

- [ ] **Step 2: Read theme state inside the component**

Inside the `TopNav` function body, near the other store reads:

```tsx
const themeMode = useThemeStore((s) => s.mode)
const setThemeMode = useThemeStore((s) => s.setMode)
```

- [ ] **Step 3: Extend the arrow-key handler to include radio items**

Find the `onKeyDown` handler inside the `useEffect` that manages dropdowns. Update its query selector:

```ts
const items = Array.from(
  menu.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemradio"]'),
)
```

- [ ] **Step 4: Insert the theme section in the dropdown**

In the `<motion.div role="menu" ...>` block, between the user-info block and the existing "View profile" button, add a theme section. The full updated dropdown body looks like:

```tsx
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

{/* Theme section */}
<div style={{ padding: '4px 0', borderBottom: '0.5px solid var(--border-default)', marginBottom: 4 }}>
  {([
    { value: 'light',  label: 'Light',  Icon: Sun },
    { value: 'dark',   label: 'Dark',   Icon: Moon },
    { value: 'system', label: 'System', Icon: Monitor },
  ] as { value: ThemeMode; label: string; Icon: typeof Sun }[]).map(({ value, label, Icon }) => {
    const checked = themeMode === value
    return (
      <button
        key={value}
        role="menuitemradio"
        aria-checked={checked}
        onClick={() => setThemeMode(value)}
        className="nav-menu-item"
        style={{ ...menuItemStyle, justifyContent: 'space-between' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon size={14} />
          {label}
        </span>
        {checked && <Check size={14} style={{ color: 'var(--uc-indigo-l)' }} />}
      </button>
    )
  })}
</div>

<button
  ref={firstMenuItemRef}
  role="menuitem"
  onClick={() => { setMenuOpen(false); navigate(PATHS.PROFILE.replace(':id', user?.id ?? '')) }}
  className="nav-menu-item"
  style={menuItemStyle}
>
  <User size={14} />
  View profile
</button>

<button
  role="menuitem"
  onClick={handleSignOut}
  className="nav-menu-item"
  style={menuItemStyle}
>
  <LogOut size={14} />
  Sign out
</button>
```

Note: `firstMenuItemRef` stays on "View profile" so the existing auto-focus behaviour is preserved. (Arrow-down from there reaches the theme rows via the updated selector.)

- [ ] **Step 5: Typecheck**

Run: `npx pnpm --filter web typecheck`
Expected: passes.

- [ ] **Step 6: Smoke check**

Run: `npx pnpm --filter web dev`
- Sign in. Open profile dropdown. Verify three theme rows are visible with the current selection check-marked. Clicking each row triggers curtain + theme swap. Reload — selection persists. Sign in on another browser — selection follows the account.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/TopNav.tsx
git commit -m "feat(topnav): add Light/Dark/System theme submenu to profile dropdown"
```

---

## Task 21: Frontend — final repo-wide checks and commit

**Files:** (no edits beyond what may surface)

- [ ] **Step 1: Sweep `landing.css` for hard-coded hex values**

Run: `grep -n "#[0-9a-fA-F]\{3,8\}" apps/web/src/styles/landing.css || echo "clean"`
- If any hex values are found, replace them with the matching token (e.g., `#060D1A` → `var(--surface-page)`). If only token usage is present, no change needed.
- Commit any changes:

```bash
git add apps/web/src/styles/landing.css
git commit -m "refactor(landing): replace hard-coded hex with tokens"
```

- [ ] **Step 2: Run the workspace gates**

Run (sequentially):
- `npx pnpm typecheck`
- `npx pnpm lint`
- `npx pnpm test`

Expected: all green. If any fail, fix the failure and commit before continuing.

- [ ] **Step 3: Manual acceptance run-through**

Run: `npx pnpm dev`

Walk through the acceptance checklist from the spec (§10) one item at a time:

- Migration runs cleanly; rollback restores prior schema (test: `npx pnpm --filter api db:rollback` then `db:migrate`).
- `theme_preference` defaults to `system` for newly-registered users.
- Logged-in user sees Light / Dark / System submenu in profile dropdown; selection persists across reloads and across devices.
- Unauthenticated visitor on landing page can toggle Light ⇄ Dark via the icon button; choice persists in localStorage across reloads.
- No flash of wrong theme on cold reload (set localStorage, hard-reload — first paint is correct).
- Curtain animation plays only when the resolved theme actually changes (selecting "System" while already on system-resolved theme does NOT animate).
- `prefers-reduced-motion: reduce` (emulate in DevTools) disables the curtain; theme swap is instant.
- No hard-coded hex values introduced in any new component file: `grep -n "#[0-9a-fA-F]\{3,8\}" apps/web/src/components/ThemeToggleButton.tsx apps/web/src/components/GlobalCurtain.tsx` should print nothing.

- [ ] **Step 4: Final commit if any cleanup occurred**

If any cleanup was required during Step 3, commit those changes with a `chore(theme): post-acceptance fixes` message. Otherwise nothing to do.

---

## Summary

21 tasks total. Backend changes (Tasks 1–8): migration, shared schema/type, service mapping, service method, route schema, controller, route registration, integration test. Frontend changes (Tasks 9–20): tokens.css restructure, bootstrap script, API helper, themeStore + tests, GlobalCurtain, App.tsx wiring, AuthLoader hydration, ThemeToggleButton + test, LandingNav integration, TopNav dropdown submenu. Task 21 is final verification.
