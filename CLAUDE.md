# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

UniConnecT — private university social network (students, alumni, faculty, admin). Multi-tenant SaaS. Team Mavericks, UIU, Dhaka 2026–27.

---

## Commands

> **`pnpm` is not on PATH in this environment — always prefix with `npx`:** `npx pnpm …`

```bash
# Root (monorepo)
npx pnpm install            # install all workspaces
npx pnpm dev                # start all services concurrently
npx pnpm build              # production build (all workspaces)
npx pnpm test               # run all tests
npx pnpm lint               # ESLint across workspaces
npx pnpm typecheck          # TypeScript check (no emit)

# Frontend — apps/web
npx pnpm --filter web dev           # Vite dev server :5173
npx pnpm --filter web test          # Vitest + React Testing Library
npx pnpm --filter web test src/features/feed/PostCard.test.tsx  # single file
npx pnpm --filter web build

# Backend — apps/api
npx pnpm --filter api dev           # Express + Socket.io :3001
npx pnpm --filter api worker        # Bull background workers (separate process)
npx pnpm --filter api test
npx pnpm --filter api db:migrate
npx pnpm --filter api db:rollback
npx pnpm --filter api db:seed
npx pnpm --filter api db:reset      # rollback → migrate → seed

# Docker (local infra only)
docker compose up -d        # Postgres, Redis, MinIO
docker compose down
```

**Always run `npx pnpm typecheck && npx pnpm lint` before finishing a task.**

### pnpm workspace — `allowBuilds` trap

When a new package with a post-install script (e.g. `esbuild`, `msw`) is added, pnpm appends `packagename: set this to true or false` to `pnpm-workspace.yaml` and fails the install. Set the value to `true` in `pnpm-workspace.yaml`, then re-run the install.

---

## Architecture

```
apps/
  api/        Express REST + Socket.io (Node.js, TypeScript)
  web/        React 18 SPA (Vite 5, Tailwind CSS)
packages/
  shared/     @uniconnect/shared — types, Zod schemas, constants
```

**Package boundaries are strict.** `apps/web` and `apps/api` never import from each other. All shared code lives in `packages/shared`. Import it as `@uniconnect/shared`.

### Multi-tenancy

Every domain table has a `university_id` UUID FK. There is no Postgres RLS — isolation is enforced entirely in the service layer. Services import `db` directly (they do not receive it as a parameter); `universityId` always comes from `req.university.id` set by the `resolveUniversity` middleware — never from the request body.

### Auth flow

JWT access token (15 min, payload: `{ userId, universityId, role }`) + refresh token (256-bit random, stored in `user_sessions`, 7 days, httpOnly cookie). Access token lives in Zustand `authStore` (memory only — cleared on page refresh, recovered via the refresh cookie). On `setAuth`, a `uc:has_session` flag is written to `localStorage` as a sentinel so the interceptor knows whether to attempt a silent refresh on 401.

Middleware: `src/middleware/auth.ts` → `requireAuth` / `requireRole('alumni')`.

- **Login**: `POST /auth/login` → returns `{ accessToken, user }` directly. No OTP step.
- **Registration**: `POST /auth/register` (requires invite token) → sends email OTP → `POST /auth/verify-otp` to complete.
- **Axios interceptor** (`apps/web/src/lib/axios.ts`) silently refreshes the access token on 401, but only when a session already exists (access token present) — it does not attempt refresh on unauthenticated 401s (e.g. bad login credentials).

All requests must include the `x-university-domain` header (e.g. `uiu.ac.bd`). The axios instance sets this from `VITE_UNIVERSITY_DOMAIN`. In API integration tests, pass it as `.set('x-university-domain', DOMAIN)` on every supertest request.

### Real-time

Socket.io on the same HTTP server, scaled via Redis pub/sub adapter (two IORedis connections: `pubClient` + `subClient`). Client authenticates via `socket.handshake.auth.token`. On `TOKEN_EXPIRED`, the client silently refreshes then reconnects. Rooms: `uni:{universityId}` (feed/events/jobs), `user:{userId}` (personal notifications), `conv:{conversationId}` (chat). Services emit to rooms **after** DB write — never from route handlers. Use `getIo()` from `src/socket/index.ts` inside services.

### File uploads

Presigned S3 PUT URL flow — client calls `POST /api/upload/presign`, uploads directly to S3, then sends the resulting URL to the relevant endpoint. File bytes never pass through the API server.

### Background jobs

Bull queues on Redis (`apps/api/src/queues/`), workers in `apps/api/src/workers/`. Three queues: `email`, `notification`, `badge`. Workers run as a **separate process** (`npx pnpm --filter api worker`) — never inline async work inside HTTP handlers, always enqueue.

### Backend module structure

All feature modules live under `apps/api/src/modules/`. Each module follows the same shape: `router.ts` (route declarations only), `controller.ts` (request/response handling), `service.ts` (all business logic + DB access), `schema.ts` (Zod schemas), `index.ts` (barrel).

Current modules: `auth`, `users`, `feed`, `jobs`, `events`, `groups`, `messages`, `notifications`, `news`, `campus`, `upload`, `admin`, `mentorship`, `search`.

The `admin` module (`/api/v1/admin`) requires `admin` or `staff` role and exposes: stats, user list + role/status management, invitations (create/list/delete), content reports (list/resolve).

The `mentorship` module has a points economy: `POINTS_PER_SESSION = 10`, `POINTS_PER_USD = 100`, and supports gift card redemption.

---

## apps/api internals

### Route / middleware patterns

Every router applies `resolveUniversity` first (resolves by `x-university-domain` header or JWT), then `requireAuth` for protected routes. Validation uses:

- `validateBody(schema)` — validates `req.body` against a Zod schema
- `validateRequest({ body?, params?, query? })` — validates multiple parts; use when you need params or query validation too

### Response helpers (`src/utils/response.ts`)

Always use these instead of raw `res.json()`:

```ts
sendSuccess(res, data, statusCode?)     // → { data: T }
sendPaginated(res, items, total, page, limit)  // → { data: { items, total, page, hasMore } }
```

### Error helpers (`src/utils/errors.ts`)

Throw these from services — `errorHandler` middleware catches them:

```ts
throw notFound('Post not found')
throw badRequest('Invalid input')
throw unauthorized()
throw forbidden()
throw conflict('Email already exists')
throw tooManyRequests()
// or the full form:
throw new AppError(message, statusCode, code)
```

### Shared services (`src/services/`)

Cross-cutting services not owned by any module: `token.service.ts`, `email.service.ts`, `otp.service.ts`, `upload.service.ts`.

---

## apps/web internals

**Path alias:** `@/` → `apps/web/src/` (configured in both `vite.config.ts` and `tsconfig.json`).

**Folder conventions:**

| Path | Rule |
|------|------|
| `src/components/` | Shared UI — no data fetching, props only |
| `src/features/{domain}/` | Domain bundle: `components/`, `hooks/`, `index.ts` barrel |
| `src/hooks/` | Truly shared hooks: `useAuth`, `useSocket` |
| `src/lib/` | Singleton instances: axios, queryClient, socket |
| `src/pages/` | Route-level components — thin orchestrators, no business logic |
| `src/stores/` | Zustand stores: `authStore`, `notificationsStore`, `uiStore`, `socketStore` |
| `src/styles/` | `tokens.css` (CSS vars), `index.css` (Tailwind entry + token import) |
| `src/router/` | `index.tsx` (router), `paths.ts` (PATHS constants), `ProtectedRoute`, `AdminRoute`, `GuestRoute` |

**React conventions:**
- Data fetching only in `hooks/` via TanStack Query. Components receive props, never call axios.
- `useQuery` key: `['domain', 'action', { param1, param2 }]`
- Global state → Zustand. Server state → TanStack Query. No `useState` for server data.
- `queryClient.invalidateQueries` only in mutation `onSuccess` — never in a component body.
- All pages are lazy-loaded via the `page()` helper in `src/router/index.tsx` wrapping React `lazy` + `Suspense`.

---

## packages/shared internals

Exports TypeScript types, Zod schemas, and socket event name constants consumed by both apps.

- `src/types/` — interfaces (`UserProfile`, `JobApplication`, …)
- `src/schemas/` — Zod schemas, one file per domain (e.g. `src/schemas/jobs.ts`)
- `src/constants/socket.ts` — Socket.io event name constants

Zod schemas are the **single source of truth** for validation and TS types. Use `z.infer<typeof schema>` — never duplicate types manually. Schema naming: `camelCase` + `Schema` suffix (e.g. `createJobSchema`).

---

## TypeScript

Strict mode on everywhere. No `any` — use `unknown` + narrowing or a specific type. API response shapes: `{ data: T }` on success, `{ error: string, code: string }` on failure (defined in `packages/shared`).

---

## Design system (non-negotiable)

CSS tokens are in `apps/web/src/styles/tokens.css` and loaded globally via `src/styles/index.css`. Theme: **Warm Futuristic Dark** — navy surfaces, UIU orange identity, indigo interactive. Full token reference is in `DESIGN.md`.

| Rule | Detail |
|------|--------|
| No hardcoded hex | Always `var(--token-name)` — never raw `#rrggbb` in component code |
| Borders | `0.5px solid var(--border-*)` — never `1px` for structural borders |
| Depth | Surface stacking only (`--surface-page → --surface-card → --surface-raised`) — no `box-shadow` |
| Buttons | `border-radius: var(--r-pill)` exclusively — no sharp corners |
| Font weight | 400 and 500 only — never 600, 700, or 800 |
| Text case | Sentence case everywhere — no ALL CAPS or Title Case on UI labels/buttons |
| Coloured surfaces | Text on a coloured background must use the matching light token (e.g. `--uc-orange-l` on `--uc-orange-bg`) |

---

## Naming conventions

| Thing | Convention | Example |
|-------|-----------|---------|
| Files (routes, services, utils) | kebab-case | `job-applications.ts` |
| React components | PascalCase file + named export | `PostCard.tsx` |
| DB tables / columns | snake_case | `job_applications`, `created_at` |
| TS types / interfaces | PascalCase | `JobApplication` |
| Zod schemas | camelCase + `Schema` | `createJobSchema` |
| Env vars | UPPER_SNAKE_CASE | `REDIS_URL` |
| React hooks | camelCase + `use` prefix | `useJobApplications` |
| Zustand stores | camelCase + `Store` suffix | `authStore` |

---

## API / Express conventions

- Route files contain only `router.METHOD(...)` declarations — all logic in `services/`.
- Validate with `validateBody(schema)` or `validateRequest({...})` at the route level.
- Errors: throw named error helpers from services (e.g. `notFound()`, `badRequest()`); `errorHandler` middleware catches them.
- DB: Knex query builder. Raw SQL only when Knex genuinely cannot express the query.

---

## Database

- Migrations: `apps/api/src/database/migrations/`, filename `NNN_description.ts` (sequential number prefix, e.g. `020_create_mentorship.ts`). Never edit a committed migration — create a new one.
- Column defaults: `id` UUID (`uuid_generate_v4()`), `university_id` UUID FK indexed, `created_at`/`updated_at` timestamptz default `now()`.
- Always index FK columns used in WHERE, and `(university_id, created_at DESC)` on high-volume tables.
- Soft deletes: `is_deleted boolean default false` — not `deleted_at`.
- Redis keys: `{prefix}:{university_id}:{id}`. TTLs in `src/config/cache.ts` — never hardcode TTL values elsewhere.

---

## Testing

### Backend integration tests

The test setup is in `apps/api/src/__tests__/setup.ts`. It:
1. Runs pending migrations against `TEST_DATABASE_URL`
2. Upserts four seed users (admin, faculty, alumni, student) with known credentials
3. Exports `loginAs(email, password)` → `{ accessToken, cookie }` for authenticated requests

All supertest requests must include `.set('x-university-domain', DOMAIN)`. Use `loginAs()` to get the bearer token.

### Frontend tests

React tests: `@testing-library/react` + `user-event`. Test behaviour, not implementation. Mock HTTP with MSW handlers at `src/tests/msw/handlers.ts`.

### General

- Unit tests: `*.test.ts` co-located with source.
- Test data factories: `tests/factories/{domain}.ts` — never hardcode UUIDs.
- Always clean up with `afterEach`/`afterAll`. Never depend on test order.

---

## Do not

- Query the DB from route files — always go through a service.
- Store anything sensitive in the JWT payload — only `userId`, `universityId`, `role`.
- Emit Socket.io events from route handlers — emit from services after DB write (via `getIo()`).
- Use `university_id` from the request body for auth decisions — use `req.university.id`.
- Import across app boundaries (`apps/web` ↔ `apps/api`) — use `packages/shared`.
- Add a dependency without checking if `packages/shared` or an existing workspace already covers it.
- Call `console.log` in production-path code — use the `logger` from `src/utils/logger.ts` (winston).
- Use `res.json()` directly in controllers — use `sendSuccess()` or `sendPaginated()`.
- Use timestamp-prefixed migration filenames — use sequential `NNN_` prefix instead.

---

## Git

```
main            # production-ready, protected
develop         # integration — PRs merge here
feature/{name}
fix/{name}
chore/{name}
```

Commit format: `type(scope): short description` — e.g. `feat(jobs): add alumni job posting endpoint`.
Types: `feat` · `fix` · `chore` · `refactor` · `test` · `docs`. CI (lint + typecheck + tests) must pass before merge.

---

## Environment variables

`apps/api/.env` (see `.env.example`): `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `CLIENT_URL`, `AWS_S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`.

`apps/web/.env`: `VITE_API_URL=http://localhost:3001`, `VITE_SOCKET_URL=http://localhost:3001`, `VITE_UNIVERSITY_DOMAIN=uiu.ac.bd`.

### Dev seed

`npx pnpm --filter api db:seed` inserts UIU (domain `uiu.ac.bd`) and one reusable invitation: token `dev-invite`, email `student@uiu.ac.bd`, role `student`. Use this invite token to register the first account. No admin user is seeded — promote via `PATCH /admin/users/:id/role` or directly in the DB after registering.

### Deployment

Render.com (`render.yaml`): API on Node runtime (Singapore region), frontend as static site, Postgres managed DB, Redis key-value store. Frontend can alternatively be deployed to Vercel (`vercel.json`). Production start command runs `db:migrate:prod` before starting the server.
