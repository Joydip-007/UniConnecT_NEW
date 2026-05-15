# Backend Audit Report — `apps/api/src/`

---

## 1. File Existence Check

### `config/`
| File | Status |
|------|--------|
| `config/db.ts` | ✅ exists |
| `config/redis.ts` | ✅ exists |
| `config/env.ts` | ✅ exists |

### `middleware/`
| File | Status |
|------|--------|
| `middleware/auth.ts` | ✅ exists |
| `middleware/university.ts` | ✅ exists |
| `middleware/validate.ts` | ✅ exists |
| `middleware/rateLimiter.ts` | ✅ exists |

*Extra files not in BACKEND.md structure:*
- `middleware/async-handler.ts` — ⚠️ just re-exports `asyncHandler` from `utils/asyncHandler.ts` (redundant shim)
- `middleware/error-handler.ts` — ✅ correct but named differently from BACKEND.md (no `errorHandler` in structure doc)

### `modules/`
| Module | Status |
|--------|--------|
| `modules/auth/` | ✅ (router, controller, service, schema, index) |
| `modules/users/` | ✅ |
| `modules/feed/` | ✅ |
| `modules/jobs/` | ✅ |
| `modules/events/` | ✅ |
| `modules/groups/` | ✅ |
| `modules/messages/` | ✅ |
| `modules/notifications/` | ✅ |
| `modules/campus/` | ✅ |
| `modules/news/` | ✅ (not in BACKEND.md but fully implemented and mounted) |
| `modules/upload/` | ✅ (not in BACKEND.md but fully implemented and mounted) |

*Admin module* — 🔴 BACKEND.md lists it but no `modules/admin/` directory exists at all.

### `services/`
| File | Status |
|------|--------|
| `services/email.service.ts` | ✅ |
| `services/otp.service.ts` | ✅ |
| `services/token.service.ts` | ✅ |
| `services/upload.service.ts` | ✅ (bonus, not in BACKEND.md) |
| `services/auth-service.ts` | ⚠️ **orphan legacy file** — not imported by any active module |
| `services/auth-repository.ts` | ⚠️ **orphan legacy file** — not imported by any active module |
| `services/email-service.ts` | ⚠️ **orphan legacy thin-wrapper** — proxies to `email.service.ts` |
| `services/token-service.ts` | ⚠️ **orphan legacy thin-wrapper** — proxies to `token.service.ts` |

### `socket/`
| File | Status |
|------|--------|
| `socket/index.ts` | ✅ |

### `workers/`
| File | Status |
|------|--------|
| `workers/email.worker.ts` | ✅ |
| `workers/notification.worker.ts` | ✅ |
| `workers/badge.worker.ts` | 🔴 **MISSING** — specified in BACKEND.md, never created |
| `workers/index.ts` | ✅ |

### `types/`
| File | Status |
|------|--------|
| `types/express.d.ts` | ✅ |
| `types/auth.ts` | ✅ |

### `utils/`
| File | Status |
|------|--------|
| `utils/errors.ts` | ✅ — defines `AppError` and all factory helpers |
| `utils/response.ts` | ✅ |
| `utils/asyncHandler.ts` | ✅ |
| `utils/logger.ts` | ⚠️ exists but uses `console.*` internally (CLAUDE.md requires winston) |
| `utils/app-error.ts` | ⚠️ just re-exports `AppError` from `errors.ts` — redundant |
| `utils/cookies.ts` | ⚠️ extra file not in BACKEND.md structure |

### `database/`
| Item | Status |
|------|--------|
| `database/migrations/` (001–020) | ✅ all present |
| `database/seeds/dev.ts` | ⚠️ exists but named `dev.ts` — BACKEND.md specifies `01_initial_data.ts` |

### Orphan files not in BACKEND.md
- `src/routes/auth.ts` — 🔴 **not mounted in `app.ts`**, dead code
- `src/db/knex.ts`, `src/db/migrate.ts`, `src/db/seed.ts` — ⚠️ parallel DB infrastructure, not referenced by the active code path

---

## 2. TypeScript Errors

```
tsc --noEmit  → exit 0 (no output)
```

**Zero TypeScript errors.** The codebase type-checks cleanly.

---

## 3. Import/Export Consistency

### Active services — all consumers verified ✅

| Export | File | Imported by |
|--------|------|-------------|
| `emailService` | `services/email.service.ts` | `modules/auth/service.ts`, `workers/email.worker.ts`, `services/email-service.ts` |
| `otpService` | `services/otp.service.ts` | `modules/auth/service.ts` |
| `tokenService` | `services/token.service.ts` | `modules/auth/service.ts`, `socket/index.ts` |
| `verifyAccessToken` (fn alias) | `services/token.service.ts` | `middleware/auth.ts`, `middleware/university.ts` |
| `verifyRefreshToken` (fn alias) | `services/token.service.ts` | `middleware/university.ts` |

### Broken or inconsistent import chains

1. **`utils/app-error.ts` vs `utils/errors.ts` split** — `AppError` is defined in `errors.ts` but `app-error.ts` re-exports it. Different consumers import from different paths:
   - `middleware/auth.ts` → `../utils/app-error`
   - `middleware/error-handler.ts` → `../utils/errors`
   - `services/email-service.ts` → `../utils/app-error`
   - Not broken (both resolve to same class) but inconsistent.

2. **`middleware/async-handler.ts` → `utils/asyncHandler.ts`** — `async-handler.ts` is just `export { asyncHandler } from '../utils/asyncHandler'`. Different modules import from different paths (`../../middleware/async-handler` vs `../../utils/asyncHandler`). Not broken but inconsistent.

3. **Orphaned legacy chain (dead code, not broken at runtime)**:
   - `services/auth-service.ts` imports from `./auth-repository`, `./email-service`, `./token-service`
   - `services/auth-repository.ts` references `otp_code` / `otp_expires_at` columns that were removed in migration `007`
   - These files compile because the columns are referenced as plain strings in Knex, not typed
   - None of these are imported by any active module — but they are a footgun if ever re-used

---

## 4. Architecture Rule Violations

### Rule 1 — No DB/Knex/Redis in controllers
All active controllers are clean. Every controller delegates to a service. ✅

**One violation in a worker:**
- `workers/notification.worker.ts:39` — direct `db('profiles')` call to fetch actor name inside the worker:
  ```ts
  const profile = await db('profiles').select<{ full_name: string }[]>('full_name').where({ user_id: actorId }).first()
  ```
  Should go through a service. Minor — workers are not controllers — but breaks the pattern.

---

### Rule 2 — Socket.io emits AFTER DB write
All checked services (feed, jobs, events, messages, notifications, campus, news) emit Socket.io events **after** the `await db.transaction(...)` or `await db(...).insert/update` call completes. ✅

No emit-before-write violations found.

---

### Rule 3 — `university_id` always from `req.university.id`
**Partial violation in feed and jobs controllers:**

```ts
// modules/feed/controller.ts  and  modules/jobs/controller.ts — getAuthContext()
universityId: req.university?.id ?? req.user.universityId,
//                           ↑ optional-chain fallback to JWT value
```

If `resolveUniversity` middleware somehow failed silently, the JWT-sourced `universityId` (not DB-validated) would be used. The fallback `req.user.universityId` bypasses the DB lookup that `resolveUniversity` provides. All other controllers (auth, events, groups, messages, notifications, campus, news, upload) correctly access `req.university.id` (or throw on missing).

---

### Rule 4 — OTP in Redis only, never in DB
**Violated in legacy dead code (critical footgun):**

`services/auth-repository.ts` — `saveOtp` function:
```ts
// services/auth-repository.ts:116–121
export async function saveOtp(db: Knex, userId: string, otpCode: string, expiresAt: Date, sentAt: Date) {
  await db('users').where({ id: userId }).update({
    otp_code: otpCode,
    otp_expires_at: expiresAt,
  })
}
```
And `markUserVerified` also writes `otp_code: null, otp_expires_at: null` to the users table. `verifyOtp` in `auth-service.ts` reads OTP from the DB `user.otpCode`.

This is dead code (not reachable from any active route), but:
- It references columns that migration `007` was explicitly supposed to remove
- `userBaseQuery` in `auth-repository.ts` selects `users.otp_code` and `users.otp_expires_at` — these columns don't exist per migration 007, so any accidental invocation of this file would cause a runtime query error
- The files should be deleted

---

### Rule 5 — Refresh token in httpOnly cookie ✅
`auth/controller.ts` correctly sets `httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'strict'`. ✅

---

### Rule 6 — No N+1 queries
No N+1 patterns found in active service code. All list endpoints use:
- Joins and subqueries for related data (reaction counts, comment counts, application counts via `knex.raw` correlated subqueries)
- Batch fetching for related entities (e.g., `attachPolls` fetches all poll data for all post IDs in two queries)
- `getParticipantsForConversations` fetches all participants for all conversation IDs in one query ✅

---

### Rule 7 — `asyncHandler` wraps all async route handlers ✅
All route handlers use `asyncHandler(async (req, res) => {...})`. ✅

---

### Rule 8 — Bull queues handle async work
**Critical bug: workers are never started.**

`server.ts` does NOT import `./workers`:
```ts
// server.ts — missing import:
// import './workers'   ← not present
```

`workers/index.ts` sets up workers via side-effect imports but is never imported from `server.ts`. Email and notification queues are enqueued correctly throughout the app, but **no worker process consumes them** — all queued jobs will silently accumulate and never be processed.

---

## 5. Missing Route Registrations

All module routers that exist are correctly mounted in `app.ts`:

| Router | Mounted at |
|--------|------------|
| `authRouter` | `/api/v1/auth` ✅ |
| `usersRouter` | `/api/v1/users` ✅ |
| `uploadRouter` | `/api/v1/upload` ✅ |
| `feedRouter` | `/api/v1/posts` ✅ |
| `pollsRouter` | `/api/v1/polls` ✅ |
| `jobsRouter` | `/api/v1/jobs` ✅ |
| `eventsRouter` | `/api/v1/events` ✅ |
| `groupsRouter` | `/api/v1/groups` ✅ |
| `messagesRouter` | `/api/v1/conversations` ✅ |
| `notificationsRouter` | `/api/v1/notifications` ✅ |
| `newsRouter` | `/api/v1/news` ✅ |
| `campusRouter` | `/api/v1` ✅ |

**One orphan router not mounted:**
- `src/routes/auth.ts` — has a router but is imported nowhere in `app.ts`. Dead code.

**One module missing entirely:**
- No `modules/admin/` — BACKEND.md specifies admin stats, user management, reports, invitations, but no admin module was created.

---

## 6. Missing Middleware on Routes

### Global auth applied correctly
Every module except `auth` applies `requireAuth + resolveUniversity` as a router-level middleware (`router.use(...)`), meaning all routes in those modules are protected. ✅

### Role-gated write endpoints — issues found

| Route | Problem |
|-------|---------|
| `PATCH /jobs/:jobId` | No `requireRole` — ownership enforced in service only |
| `DELETE /jobs/:jobId` | No `requireRole` — ownership enforced in service only |
| `PATCH /jobs/:jobId/applications/:appId` | No `requireRole` — ownership enforced in service only |
| `PATCH /events/:eventId` | No `requireRole` — ownership enforced in service only |
| `DELETE /events/:eventId` | No `requireRole` — ownership enforced in service only |
| `PATCH /lost-found/:itemId` | No `requireRole` — ownership enforced in service only |
| `PATCH /lost-found/:itemId/resolve` | No `requireRole` — ownership enforced in service only |

These are **not exploitable** because service-layer checks prevent unauthorized mutations. However, they expose the endpoints to all authenticated users without early rejection at the routing layer — increases surface area for authorization bugs during future refactors.

### Role-gated write endpoints — correct ✅

| Route | Guard |
|-------|-------|
| `POST /jobs/` | `requireRole('alumni', 'staff', 'admin')` ✅ |
| `GET /jobs/:jobId/applications` | `requireRole('alumni', 'staff', 'admin')` ✅ |
| `POST /events/` | `requireRole('staff', 'admin')` ✅ |
| `PATCH /events/:eventId/publish` | `requireRole('staff', 'admin')` ✅ |
| `POST /news/` | `requireRole('staff', 'admin')` ✅ |
| `PATCH /news/:newsId` | `requireRole('staff', 'admin')` ✅ |
| `DELETE /news/:newsId` | `requireRole('staff', 'admin')` ✅ |
| `POST /shuttle/routes` | `requireRole('staff', 'admin')` ✅ |
| `PATCH /shuttle/routes/:routeId` | `requireRole('staff', 'admin')` ✅ |
| `POST /shuttle/locations` | `requireRole('staff', 'admin')` ✅ |
| `POST /courses` | `requireRole('staff', 'admin')` ✅ |
| `PATCH /courses/:courseId` | `requireRole('staff', 'admin')` ✅ |

---

## 7. Environment Variable Usage

### Direct `process.env` bypasses `env.ts` validator

| File | Line | Call | Issue |
|------|------|------|-------|
| `middleware/error-handler.ts` | 28 | `process.env.NODE_ENV !== 'production'` | Should be `env.NODE_ENV` (imported env is already available in scope) |
| `modules/auth/service.ts` | 403 | `process.env.NODE_ENV === 'production'` | Same — `env` is already imported in this file |
| `modules/auth/service.ts` | 406 | `process.env.NODE_ENV === 'production'` | Same |

### All env vars coverage

Every variable read via `env.ts` (`envSchema`) is declared in `.env.example`:

| Variable | `env.ts` | `.env.example` |
|----------|----------|----------------|
| `NODE_ENV` | ✅ | ✅ |
| `PORT` | ✅ | ✅ |
| `CLIENT_URL` | ✅ | ✅ |
| `WEB_URL` | ✅ | ✅ |
| `DATABASE_URL` | ✅ | ✅ |
| `REDIS_URL` | ✅ | ✅ |
| `JWT_SECRET` | ✅ | ✅ |
| `JWT_REFRESH_SECRET` | ✅ | ✅ |
| `RESEND_API_KEY` | ✅ | ✅ |
| `RESEND_FROM_EMAIL` | ✅ | ✅ |
| `EMAIL_FROM` | ✅ | ✅ |
| `AWS_REGION` | ✅ | ✅ |
| `AWS_S3_BUCKET` | ✅ | ✅ |
| `AWS_ACCESS_KEY_ID` | ✅ | ✅ |
| `AWS_SECRET_ACCESS_KEY` | ✅ | ✅ |
| `OTP_EXPIRES_MINUTES` | ✅ | ✅ |
| `OTP_RESEND_COOLDOWN_SECONDS` | ✅ | ✅ |
| `DEV_INVITE_TOKEN` | ✅ | ✅ |
| `DEV_INVITE_EMAIL` | ✅ | ✅ |
| `DEV_INVITE_ROLE` | ✅ | ✅ |

**All environment variables are fully covered.** ✅

---

## Priority Summary

| Severity | Finding |
|----------|---------|
| 🔴 Critical | Workers never started — `server.ts` missing `import './workers'` — all queued emails and notifications silently pile up |
| 🔴 Critical | `services/auth-repository.ts` writes OTP to DB (`otp_code`, `otp_expires_at`) — violates Rule 4. Dead code now but must be deleted before it can be accidentally re-used |
| 🔴 Missing | `workers/badge.worker.ts` — listed in BACKEND.md, never created |
| 🔴 Missing | `modules/admin/` — entire admin module absent |
| 🔴 Dead code | `src/routes/auth.ts` — router not mounted, stale file |
| ⚠️ Medium | 3× `process.env.NODE_ENV` direct calls in `error-handler.ts` and `auth/service.ts` — should use `env.NODE_ENV` |
| ⚠️ Medium | `feed` and `jobs` controllers fallback `req.university?.id ?? req.user.universityId` — bypasses DB-validated university if middleware silently fails |
| ⚠️ Medium | `notification.worker.ts:39` — direct `db('profiles')` call violates services-only DB rule |
| ⚠️ Low | 4 orphan legacy service files (`auth-service.ts`, `auth-repository.ts`, `email-service.ts`, `token-service.ts`) — should be deleted |
| ⚠️ Low | 3 orphan DB files (`src/db/knex.ts`, `migrate.ts`, `seed.ts`) — dead code |
| ⚠️ Low | `AppError` import inconsistency (`utils/app-error` vs `utils/errors`) across middleware |
| ⚠️ Low | `asyncHandler` import path inconsistency (`middleware/async-handler` vs `utils/asyncHandler`) |
| ⚠️ Low | 7 write routes missing route-level `requireRole` (guarded only by service layer) |
| ℹ️ Note | `utils/logger.ts` uses `console.*` internally — CLAUDE.md requires winston; this is the logger's own impl so technically OK but diverges from spec |
