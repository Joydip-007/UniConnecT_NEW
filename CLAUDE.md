# UniConnecT

University Social Network Platform — Team Mavericks, UIU, Dhaka 2026–27.
Private social network for students, alumni, faculty, and admin. Multi-tenant SaaS.

See @README.md for full overview · @docs/architecture.md for system design · @package.json for all scripts.

---

## Commands

```bash
# Root (monorepo)
pnpm install            # install all workspaces
pnpm dev                # start frontend + backend concurrently
pnpm build              # production build (all workspaces)
pnpm test               # run all tests
pnpm lint               # ESLint across workspaces
pnpm typecheck          # TypeScript check (no emit)

# Backend — apps/api
pnpm --filter api dev           # Express + Socket.io on :4000
pnpm --filter api test          # Vitest unit + integration
pnpm --filter api test:e2e      # Supertest E2E suite
pnpm --filter api db:migrate    # run pending Knex migrations
pnpm --filter api db:rollback   # rollback last migration batch
pnpm --filter api db:seed       # seed dev data
pnpm --filter api db:reset      # rollback all → migrate → seed

# Frontend — apps/web
pnpm --filter web dev           # Vite dev server on :5173
pnpm --filter web test          # Vitest + React Testing Library
pnpm --filter web build         # production Vite build → dist/

# Docker (local infra only)
docker compose up -d            # start Postgres, Redis, MinIO
docker compose down             # stop all containers
```

**Always run `pnpm typecheck` and `pnpm lint` before finishing a task.**
**Run the smallest relevant test, not the full suite: `pnpm --filter api test src/routes/jobs.test.ts`.**

---

## Project Structure

```
uniconnect/
├── apps/
│   ├── api/                    # Express REST + Socket.io
│   │   ├── src/
│   │   │   ├── config/         # env, db pool, redis, s3 clients
│   │   │   ├── middleware/     # auth, errorHandler, validate, rateLimit
│   │   │   ├── routes/         # one file per domain (posts, jobs, events…)
│   │   │   ├── services/       # business logic — never import from routes
│   │   │   ├── sockets/        # Socket.io event handlers
│   │   │   ├── db/
│   │   │   │   ├── migrations/ # Knex migration files
│   │   │   │   └── seeds/      # Knex seed files
│   │   │   └── utils/          # shared helpers, no side effects
│   │   └── tests/              # mirrors src/ structure
│   └── web/                    # React 18 + Vite + Tailwind
│       ├── src/
│       │   ├── components/     # shared UI — no data fetching here
│       │   ├── features/       # domain folders (feed/, jobs/, events/…)
│       │   │   └── feed/
│       │   │       ├── components/   # feed-specific components
│       │   │       ├── hooks/        # data-fetching hooks for this domain
│       │   │       └── index.ts      # barrel export
│       │   ├── hooks/          # truly shared hooks (useAuth, useSocket)
│       │   ├── lib/            # axios instance, queryClient, socket init
│       │   ├── pages/          # route-level components — thin orchestrators
│       │   └── stores/         # Zustand stores (auth, notifications, ui)
│       └── tests/
├── packages/
│   └── shared/                 # types, zod schemas, constants shared by api + web
└── docker-compose.yml
```

---

## Architecture

**Multi-tenant:** Every DB query is scoped by `university_id`. The authenticated user's `university_id` is set on `req.university` by `authMiddleware`. Always pass it to service functions — never re-derive it from user lookups.

**Auth flow:** JWT access token (15 min) + refresh token (7 days stored in `user_sessions`). Middleware is at `src/middleware/auth.ts`. Protected routes use `requireAuth`. Role checks use `requireRole('alumni')`.

**Real-time:** Socket.io rooms are named `uni:{university_id}` and `user:{user_id}`. Emit to the university room for feed events; to the user room for personal notifications. Socket context is in `apps/api/src/sockets/`.

**File uploads:** Presigned S3 URL flow — client calls `POST /api/upload/presign`, uploads directly to S3, then sends the resulting URL to the relevant endpoint. Never pipe file bytes through the API server.

**Background jobs:** Bull queues on Redis. Queue definitions in `src/queues/`. Workers in `src/workers/`. Add new jobs by creating a producer in the service layer and a worker file — do not inline async work inside HTTP handlers.

---

## Code Conventions

### Naming

| Thing | Convention | Example |
|-------|-----------|---------|
| Files (routes, services, utils) | kebab-case | `job-applications.ts` |
| React components | PascalCase file + named export | `PostCard.tsx` |
| DB tables / columns | snake_case | `job_applications`, `created_at` |
| TS types / interfaces | PascalCase | `JobApplication`, `UserProfile` |
| Zod schemas | camelCase + `Schema` suffix | `createJobSchema` |
| Env variables | UPPER_SNAKE_CASE | `REDIS_URL` |
| React hooks | camelCase + `use` prefix | `useJobApplications` |
| Zustand stores | camelCase + `Store` suffix | `authStore` |

### TypeScript

- Strict mode is on. No `any` — use `unknown` + narrowing or a proper type.
- All shared types live in `packages/shared/src/types/`. Import from `@uniconnect/shared`.
- Zod schemas are the single source of truth for validation and TS types. Use `z.infer<typeof schema>` — never duplicate types.
- API response shapes: `{ data: T }` on success, `{ error: string, code: string }` on failure.

### React

- Data fetching only in `hooks/` using TanStack Query. Components receive props, never call `axios` directly.
- `useQuery` key pattern: `['domain', 'action', { param1, param2 }]` — e.g. `['jobs', 'list', { universityId, page }]`.
- Global state in Zustand (auth, socket, UI preferences). Server state in TanStack Query. No useState for server data.
- Co-locate component styles with the component. Tailwind classes only — no inline `style={{}}` except for truly dynamic values (e.g. width percentages from JS calculations).
- Never call `queryClient.invalidateQueries` in a component — do it in the mutation's `onSuccess` callback.

### API / Express

- Route files only contain `router.get(...)` calls. All logic is in `services/`.
- Validate request body/params with Zod at the route level using the `validate(schema)` middleware helper.
- Service functions always receive `universityId` as their first argument after db/clients.
- DB queries use the Knex query builder. Never raw SQL unless the Knex API genuinely can't express it.
- Errors: throw a typed `AppError(message, statusCode, code)` from service layer. The `errorHandler` middleware catches it.

---

## Database

- **Migrations:** `apps/api/src/db/migrations/`. Filename: `YYYYMMDDHHMMSS_description.ts`.
- **Never edit a committed migration.** Create a new one instead.
- **Column conventions:** `id` (UUID, `uuid_generate_v4()`), `university_id` (UUID FK, indexed), `created_at` / `updated_at` (timestamptz, default `now()`).
- **Indexes to always add:** any FK column used in WHERE clauses, `(university_id, created_at DESC)` on high-volume tables.
- **Soft deletes:** use `is_deleted boolean default false` — not `deleted_at`. Filter with `.where('is_deleted', false)`.
- **Redis:** keys follow `{prefix}:{university_id}:{id}` pattern. TTLs in `src/config/cache.ts`. Never hardcode TTL numbers in service files.

---

## Environment Variables

Required in `apps/api/.env` (see `.env.example`):

```
DATABASE_URL        # postgres://user:pass@localhost:5432/uniconnect
REDIS_URL           # redis://localhost:6379
JWT_SECRET          # min 32 chars
JWT_REFRESH_SECRET  # min 32 chars, different from JWT_SECRET
AWS_S3_BUCKET       # or CLOUDINARY_URL for local dev
AWS_REGION
EMAIL_FROM          # verified sender address
SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS
```

Required in `apps/web/.env`:

```
VITE_API_URL        # http://localhost:4000
VITE_SOCKET_URL     # http://localhost:4000
```

---

## Common Tasks

**Add a new API route:**
1. Create `apps/api/src/routes/{domain}.ts` with an Express router.
2. Create `apps/api/src/services/{domain}.ts` with business logic.
3. Register the router in `apps/api/src/app.ts` under `/api/{domain}`.
4. Add Zod schemas to `packages/shared/src/schemas/{domain}.ts`.
5. Write tests in `apps/api/tests/routes/{domain}.test.ts`.

**Add a new feature to the frontend:**
1. Create `apps/web/src/features/{name}/` with `components/`, `hooks/`, `index.ts`.
2. Add the data-fetching hook in `hooks/use{Name}.ts` using TanStack Query.
3. Add the page component in `apps/web/src/pages/`.
4. Register the route in `apps/web/src/App.tsx`.

**Add a new DB migration:**
```bash
pnpm --filter api db:migrate:make add_{description}
# edit the generated file in src/db/migrations/
pnpm --filter api db:migrate
```

**Add a new Socket.io event:**
1. Define the event name constant in `packages/shared/src/constants/socket.ts`.
2. Add the emitter in the relevant service file.
3. Add the handler in `apps/api/src/sockets/{domain}.ts`.
4. Add the client listener in `apps/web/src/hooks/useSocket.ts`.

---

## Do Not

- **Do not** query the DB from route files — always go through a service function.
- **Do not** store sensitive data in JWT payload — only `userId`, `universityId`, `role`.
- **Do not** emit Socket.io events directly from route handlers — emit from services after DB write.
- **Do not** use `university_id` from the request body for security decisions — always use `req.university.id` from the auth middleware.
- **Do not** create migrations that modify existing column types without a backfill strategy — discuss first.
- **Do not** import from `apps/api` inside `apps/web` or vice versa — all shared code lives in `packages/shared`.
- **Do not** add new npm dependencies without checking if `packages/shared` or an existing workspace already covers it.
- **Do not** commit `.env` files — `.env.example` only.
- **Do not** call `console.log` in production-path code — use the `logger` from `src/utils/logger.ts` (winston).

---

## Testing Conventions

- **Unit tests:** pure functions and services with mocked DB/Redis. File: `*.test.ts` next to the source.
- **Integration tests:** routes with a real test DB (`TEST_DATABASE_URL`). File: `tests/routes/*.test.ts`.
- **React tests:** React Testing Library + user-event. Test behaviour, not implementation. Mock API calls with MSW handlers in `tests/msw/handlers.ts`.
- **Test factories:** use `tests/factories/{domain}.ts` to build consistent test data — never hardcode UUIDs.
- Always clean up test data with `afterEach` / `afterAll`. Never depend on test execution order.

---

## Git Workflow

```
main            # production-ready, protected
develop         # integration branch — PRs merge here
feature/{name}  # new features
fix/{name}      # bug fixes
chore/{name}    # tooling, deps, config
```

Commit format: `type(scope): short description` — e.g. `feat(jobs): add alumni job posting endpoint`.
Types: `feat` · `fix` · `chore` · `refactor` · `test` · `docs`.
PRs require passing CI (lint + typecheck + tests) before merge.

---

## Detailed References

- @docs/architecture.md — system design, data flow diagrams
- @docs/api.md — complete REST endpoint reference
- @docs/database.md — full schema with indexes and relationships
- @docs/socket-events.md — all Socket.io events, payloads, rooms
- @docs/deployment.md — AWS infra, env config, CI/CD pipeline
- @docs/design-system.md — UI tokens, component patterns, brand guide
