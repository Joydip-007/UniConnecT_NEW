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

# Backend — apps/api (not yet scaffolded)
npx pnpm --filter api dev           # Express + Socket.io :4000
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

Every domain table has a `university_id` UUID FK. There is no Postgres RLS — isolation is enforced entirely in the service layer. Every service function signature starts with `(db: Knex, universityId: string, …)`. The value always comes from `req.university.id` set by `authMiddleware` — never from the request body.

### Auth flow

JWT access token (15 min, payload: `{ userId, universityId, role }`) + refresh token (256-bit random, stored in `user_sessions`, 7 days, httpOnly cookie). Access token lives in Zustand `authStore` (memory only). Middleware: `src/middleware/auth.ts` → `requireAuth` / `requireRole('alumni')`.

### Real-time

Socket.io on the same HTTP server. Client authenticates via `socket.handshake.auth.token`. Rooms: `uni:{universityId}` (feed/events/jobs), `user:{userId}` (personal notifications), `conv:{conversationId}` (chat). Services emit to rooms **after** DB write — never from route handlers.

### File uploads

Presigned S3 PUT URL flow — client calls `POST /api/upload/presign`, uploads directly to S3, then sends the resulting URL to the relevant endpoint. File bytes never pass through the API server.

### Background jobs

Bull queues on Redis (`apps/api/src/queues/`), workers in `apps/api/src/workers/`. Never inline async work inside HTTP handlers — always enqueue.

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
| `src/stores/` | Zustand stores: `authStore`, `notificationsStore`, `uiStore` |
| `src/styles/` | `tokens.css` (CSS vars), `index.css` (Tailwind entry + token import) |

**React conventions:**
- Data fetching only in `hooks/` via TanStack Query. Components receive props, never call axios.
- `useQuery` key: `['domain', 'action', { param1, param2 }]`
- Global state → Zustand. Server state → TanStack Query. No `useState` for server data.
- `queryClient.invalidateQueries` only in mutation `onSuccess` — never in a component body.

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

CSS tokens are in `apps/web/src/styles/tokens.css` and loaded globally via `src/styles/index.css`. Theme: **Warm Futuristic Dark** — navy surfaces, UIU orange identity, indigo interactive.

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
- Validate with Zod at the route level via `validate(schema)` middleware helper.
- Errors: throw `AppError(message, statusCode, code)` from services; `errorHandler` middleware catches it.
- DB: Knex query builder. Raw SQL only when Knex genuinely cannot express the query.

---

## Database

- Migrations: `apps/api/src/db/migrations/`, filename `YYYYMMDDHHMMSS_description.ts`. Never edit a committed migration — create a new one.
- Column defaults: `id` UUID (`uuid_generate_v4()`), `university_id` UUID FK indexed, `created_at`/`updated_at` timestamptz default `now()`.
- Always index FK columns used in WHERE, and `(university_id, created_at DESC)` on high-volume tables.
- Soft deletes: `is_deleted boolean default false` — not `deleted_at`.
- Redis keys: `{prefix}:{university_id}:{id}`. TTLs in `src/config/cache.ts` — never hardcode TTL values elsewhere.

---

## Testing

- Unit tests: `*.test.ts` co-located with source.
- Integration tests (routes): `apps/api/tests/routes/*.test.ts` against a real `TEST_DATABASE_URL`.
- React tests: `@testing-library/react` + `user-event`. Test behaviour, not implementation. Mock HTTP with MSW handlers at `src/tests/msw/handlers.ts`.
- Test data factories: `tests/factories/{domain}.ts` — never hardcode UUIDs.
- Always clean up with `afterEach`/`afterAll`. Never depend on test order.

---

## Do not

- Query the DB from route files — always go through a service.
- Store anything sensitive in the JWT payload — only `userId`, `universityId`, `role`.
- Emit Socket.io events from route handlers — emit from services after DB write.
- Use `university_id` from the request body for auth decisions — use `req.university.id`.
- Import across app boundaries (`apps/web` ↔ `apps/api`) — use `packages/shared`.
- Add a dependency without checking if `packages/shared` or an existing workspace already covers it.
- Call `console.log` in production-path code — use the `logger` from `src/utils/logger.ts` (winston).

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

`apps/api/.env` (see `.env.example`): `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `AWS_S3_BUCKET`, `AWS_REGION`, `EMAIL_FROM`, `SMTP_HOST/PORT/USER/PASS`.

`apps/web/.env` (see `.env.example`): `VITE_API_URL`, `VITE_SOCKET_URL`.
