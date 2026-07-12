# UniConnecT — Backend Project Memory
> Claude Code: read this file at the start of every session. It tracks what is built and all architectural rules. For the full route/module/schema reference, see `docs/api.md`, `docs/database.md`, and `docs/architecture.md` — this file is the quick-orientation summary, not the source of truth for exact routes or columns.

---

## Project Identity
- **Name:** UniConnecT — University Social Network Platform
- **Team:** Mavericks · UIU (United International University), Dhaka, Bangladesh
- **Academic year:** 2026–27
- **Tagline:** "Your campus. One place."
- **Monorepo root:** `/` (pnpm workspaces)
- **This file covers:** `apps/api` (backend) only. Frontend is `apps/web` (React 18 + Vite).

---

## Tech Stack
| Layer | Technology |
|---|---|
| Runtime | Node.js 20 |
| Framework | Express 5 + TypeScript 5 |
| DB query builder | Knex (no ORM) |
| Database | PostgreSQL — Neon (production), local Postgres via `docker compose` (dev) |
| Cache / queues | Redis via ioredis — Redis Cloud (production), local Redis via `docker compose` (dev) |
| Real-time | Socket.io + `@socket.io/redis-adapter` (two IORedis connections: pubClient + subClient) |
| Background jobs | Bull queues, run as a **separate worker process** in dev (`npx pnpm --filter api worker`), **in-process with the API** in production |
| Email / OTP | Resend SDK (`resend` npm package) |
| Auth | JWT (15-min access) + httpOnly cookie (7-day refresh) → `user_sessions` table |
| Validation | Zod (`packages/shared` is the single source of truth for schemas/types) |
| Password hashing | bcryptjs |
| File uploads | Presigned PUT URL flow (client → `POST /upload/presign` → PUT direct to S3-compatible storage). Production storage is Cloudflare R2, not AWS S3. |
| AI | Gemini (flashcards, quiz generation, course outlines) — gated by `AI_CONTENT_ENABLED` |
| Package manager | pnpm — **not on PATH in this environment, always prefix commands with `npx`** |

---

## Database
- **Production:** Neon PostgreSQL (serverless, sslmode=require)
- **Local dev:** Postgres via `docker compose up -d` (see root `docker-compose.yml`)
- **All IDs:** UUID (`uuid_generate_v4()`)
- **Multi-tenancy:** every query **must** be scoped by `university_id` — always from `req.university.id` (set by `resolveUniversity` middleware), **never** from the request body. There is no Postgres RLS; isolation is enforced entirely in the service layer.
- **Soft deletes:** `is_deleted boolean default false` — not `deleted_at`

### Schema domains
The schema has grown well beyond the original 9-domain scaffold. Current domains (see `docs/database.md` for full table-by-table detail):
1. **Core/Auth** — universities, university_settings, users, profiles, invitations, user_sessions
2. **Social Feed** — posts (with lifecycle + feed-ranking columns), comments, reactions, saved_posts, post_shares, tags, post_tags, polls, poll_options, poll_votes
3. **Job Board** — jobs, job_applications, saved_jobs
4. **Events** — events, event_rsvps
5. **Groups** — groups, group_members, group_join_requests, group_resources, group_study_sessions, group rules/pinned posts
6. **Messaging** — conversations (direct/group/mentorship), conversation_participants, messages, message_reactions, message_stickers
7. **Notifications/News** — notifications, news (with imported_* columns from content-sync)
8. **Campus Tools** — lost_and_found, courses, user_courses, shuttle_routes, shuttle_locations
9. **Engagement** — mentorship_requests, mentorship_sessions, gift_cards, mentor_redemptions, badges, user_badges, reports
10. **Connections** — `connections` (bidirectional, `pending`/`accepted`, optional note) — **replaces the old `follows` table, dropped in migration `052_drop_follows`**
11. **Profile sections** — profile_experiences, profile_education, profile_featured, profile_views
12. **Settings** — `user_settings` (one row per user, JSONB notification_preferences + privacy_preferences)
13. **Push** — push_subscriptions (Web Push/VAPID)
14. **Content sync** — content_sync_runs, content_attachments, imported_* columns on news/events/posts
15. **Audit** — university_audit_log
16. **Moderation** — user_blocks, user_mutes, account_deletion_requests
17. **Academic LMS** — course_outline, academic LMS modules/assignments/submissions/gradebook tables (migrations 093–096)
18. **Learning platform** — skill paths, units, enrollments, streaks, daily quiz slots/attempts, AI quiz pool, badges v2 (migrations 085–100)

**Presence has no Postgres table** — it's tracked entirely in Redis (`presence:count:{userId}`, `presence:online:{universityId}`), never persisted except `users.last_seen` on full disconnect.

Latest migration tip: `100_add_ai_last_error.ts`. Note the `072_` filename collision (`072_add_post_lifecycle.ts` and `072_add_username_to_users.ts`) — next available prefix is `101_`.

---

## Architecture Rules (never break these)
1. **Services only touch DB/Redis** — controllers call services, services call Knex/Redis. No DB code in controllers or middleware.
2. **Socket.io events emit AFTER successful DB write** — never before, never speculatively. Emit from services via `getIo()`, never from route handlers.
3. **university_id always from req.university.id** — resolved by `resolveUniversity` middleware from JWT or `x-university-domain` header. Never from the request body.
4. **OTP stored in Redis only** — bcrypt-hashed, TTL from `OTP_EXPIRES_MINUTES` env var. Never in the users table (columns removed in migration `007`).
5. **Refresh token in httpOnly cookie** — stored in `user_sessions` table, 7-day expiry, rotated on every use.
6. **No N+1 queries** — use Knex joins or subqueries for list endpoints.
7. **asyncHandler wraps all async route handlers** — no unhandled promise rejections.
8. **Bull queues handle async work** — never do inline async work in HTTP handlers, always enqueue. Eight queues: `email`, `notification`, `badge`, `group-digest`, `mentorship`, `push`, `content-sync`, `feed-ranking`.

---

## Folder Structure (`apps/api/src/`)
```
config/
  db.ts              — Knex instance (DATABASE_URL)
  redis.ts           — ioredis client (REDIS_URL), PRESENCE_TTL_SECONDS
  env.ts             — typed env config, throws if required vars missing

middleware/
  auth.ts            — requireAuth, requireRole(...roles)
  university.ts      — resolveUniversity (sets req.university)
  validate.ts        — validate(ZodSchema) / validateRequest({ body, params, query })
  rateLimiter.ts     — createRateLimiter, loginLimiter, otpLimiter, generalLimiter

modules/            — 26 modules, each: router.ts, controller.ts, service.ts, schema.ts, index.ts
  academic, admin, auth, campus, connections, content-sync, drafts, events,
  explore, feed, groups, jobs, klipy, learning, learning-admin, mentorship,
  messages, moderation, news, notifications, presence, push, quiz, search,
  upload, users
  — see docs/api.md for the full route reference per module, including
    mount paths that differ from the module directory name (e.g. feed →
    /api/v1/posts, messages → /api/v1/conversations, campus mounted bare
    at /api/v1 with no /campus prefix).

services/            — cross-cutting services not owned by any module
  email.service.ts   — ResendEmailService
  otp.service.ts     — OtpService (generateOtp, storeOtp, verifyOtp, revokeOtp)
  token.service.ts   — TokenService (generate, verify, save, revoke, rotate)
  upload.service.ts  — presigned URL generation (S3-compatible)

socket/
  index.ts           — setupSocket(), getIo(), auth on connect, room joins

queues/               — Bull queue definitions (email, notification, badge,
                         group-digest, mentorship, push, content-sync, feed-ranking)
workers/               — Bull queue processors; run as a separate process in
                         dev (`npx pnpm --filter api worker`), in-process with
                         the API server in production

types/
  express.d.ts       — req.user: {userId, universityId, role}, req.university: {id, name, domain}

utils/
  errors.ts          — AppError, notFound, unauthorized, forbidden, badRequest, conflict, tooManyRequests
  response.ts        — sendSuccess, sendPaginated
  asyncHandler.ts     — wraps async RequestHandler

database/
  migrations/        — Knex migration files, sequential NNN_ prefix, 001–100+ (never edit a committed migration)
  seeds/             — seed data (UIU tenant, one reusable dev invitation)

app.ts               — Express app, middleware stack, router mounts, global error handler
server.ts            — HTTP server, DB connect, Redis connect, setupSocket
```

---

## API Conventions
- **Base URL:** `/api/v1/`
- **Success:** `{ data: T }`
- **Error:** `{ error: string, code: string }`
- **Paginated:** `{ data: { items: T[], total: number, page: number, hasMore: boolean } }`
- **Auth:** `Authorization: Bearer {accessToken}` header
- **University scoping:** all endpoints automatically scoped to `req.university.id`
- **Required header:** `x-university-domain` on every request (e.g. `uiu.ac.bd`)

---

## Auth Flow (Resend OTP)
```
Register:        POST /auth/register (requires invite token) → Resend sends 6-digit OTP
Verify account:  POST /auth/verify-otp        → issues JWT access + refresh cookie
Login:           POST /auth/login             → returns { accessToken, user } directly, no OTP step
Refresh:         POST /auth/refresh           → rotates refresh token (reads httpOnly cookie)
Logout:          POST /auth/logout            → revokes session from user_sessions
Forgot password: POST /auth/forgot-password   → Resend sends reset OTP
Reset password:  POST /auth/reset-password    → verifies OTP, hashes new password
Get current:     GET  /auth/me
Sessions:        GET/DELETE /auth/sessions, DELETE /auth/sessions/:sessionId
Change password: POST /auth/change-password
Check invite:    GET  /auth/invitation/:token
```
Roles: `student`, `alumni`, `faculty`, `admin`, and the least-privilege `driver` role (migration `073`) — transport staff, only write is `POST /shuttle/locations`. Each user also has a per-university-unique `username` (migration `072`).

---

## Socket.io Rooms
| Room | Who joins | Example events |
|---|---|---|
| `uni:{universityId}` | All users in the university | feed/events/jobs updates |
| `user:{userId}` | The specific user | personal notifications, connection events |
| `conv:{conversationId}` | All conversation participants | message:new, typing, conversation:read |

Client authenticates via `socket.handshake.auth.token`; on `TOKEN_EXPIRED` it silently refreshes then reconnects. Scaled via `@socket.io/redis-adapter`.

---

## Environment Variables (apps/api/.env)
See `apps/api/.env.example` and `docs/deployment.md` for the full current list. Key vars:
```
PORT=3001
NODE_ENV=development
DATABASE_URL=...
REDIS_URL=...
JWT_SECRET=<64-byte hex>
JWT_REFRESH_SECRET=<64-byte hex>
RESEND_API_KEY=...
RESEND_FROM_EMAIL=...
CLIENT_URL=http://localhost:5173
AWS_S3_BUCKET=...
AWS_REGION=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_ENDPOINT=...        # Cloudflare R2 endpoint (production)
AWS_PUBLIC_URL=...      # Cloudflare R2 public bucket URL (production)
KLIPY_API_KEY=...
GEMINI_API_KEY=...
AI_CONTENT_ENABLED=true
```

---

## Known Decisions & Gotchas
- `password_hash` is nullable in users table — supports future passwordless-only flow
- `otp_code`/`otp_expires_at` columns were removed from users table (migration `007`) — OTP lives in Redis only
- Shuttle tracking uses `shuttle_locations` — upsert, not insert, per route
- All migrations use TypeScript; migration commands run via `ts-node` in dev, compiled JS in production (`node dist/db/migrate.js latest`, runs at API startup)
- `array_to_string` is `STABLE` not `IMMUTABLE` in Postgres — breaks `STORED` generated columns (bit us once on the `search_vector` columns, migration `070`); avoid it in any future generated column
- Redis is shared by Bull queues and the Socket.io pub/sub adapter — same `REDIS_URL` for both
- Soft-deleted users retain their email in a global unique index — re-registering with a soft-deleted email needs the `is_deleted` filter accounted for, or it 500s opaquely (fixed once in `auth/service.ts`; watch for regressions)

---

## Seed Test Credentials
No admin user is seeded by default — promote via `PATCH /admin/users/:id/role` or directly in the DB after registering.

`npx pnpm --filter api db:seed` inserts UIU (domain `uiu.ac.bd`) and one reusable invitation: token `dev-invite`, email `student@uiu.ac.bd`, role `student`. Use this invite token to register the first account, then promote it to `admin`.

University domain: `uiu.ac.bd` (set as `x-university-domain` header).

---

## Quick Commands
> `pnpm` is not on PATH in this environment — always prefix with `npx`.
```bash
npx pnpm --filter api dev           # start API dev server (:3001)
npx pnpm --filter api worker        # start Bull background workers (separate process)
npx pnpm --filter api db:migrate    # run pending migrations
npx pnpm --filter api db:rollback   # rollback last migration
npx pnpm --filter api db:seed       # run seed files
npx pnpm --filter api db:reset      # rollback all → migrate → seed
npx pnpm --filter api build         # compile TypeScript → dist/
npx pnpm --filter api test          # run Vitest tests
```
