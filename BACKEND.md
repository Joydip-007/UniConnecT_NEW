# UniConnecT — Backend Project Memory
> Claude Code: read this file at the start of every session. It tracks what is built, what is pending, and all architectural rules.

---

## Project Identity
- **Name:** UniConnecT — University Social Network Platform
- **Team:** Mavericks · UIU (United International University), Dhaka, Bangladesh
- **Academic year:** 2026–27
- **Tagline:** "Your campus. One place."
- **Monorepo root:** `/` (pnpm workspaces)
- **This file covers:** `apps/api` (backend) only. Frontend is `apps/web` (React 18 + Vite, **complete**).

---

## Tech Stack
| Layer | Technology |
|---|---|
| Runtime | Node.js 20 |
| Framework | Express 5 + TypeScript 5 |
| DB query builder | Knex (no ORM) |
| Database | PostgreSQL 16 — local: `uniconnect_db` via postgres.app |
| Cache / queues | Redis 7 via ioredis |
| Real-time | Socket.io + @socket.io/redis-adapter |
| Background jobs | Bull queues |
| Email / OTP | Resend SDK (`resend` npm package) |
| Auth | JWT (15-min access) + httpOnly cookie (7-day refresh) → `user_sessions` table |
| Validation | Zod |
| Password hashing | bcryptjs (12 rounds) |
| File uploads | S3 presigned URL flow (client → POST /upload/presign → PUT direct to S3) |
| Package manager | pnpm |

---

## Database
- **Name:** `uniconnect_db`
- **Host:** localhost:5432 (postgres.app, macOS)
- **Extensions:** `uuid-ossp` (enabled), `postgis` (optional, shuttle GPS)
- **All IDs:** UUID (`uuid_generate_v4()`)
- **Multi-tenancy:** every query **must** be scoped by `university_id` — always from `req.university.id`, **never** from request body

### Schema domains (9 total)
1. **Core/Auth** — universities, university_settings, users, profiles, invitations, user_sessions
2. **Social Feed** — posts, comments, reactions, follows, saved_posts, tags, post_tags, polls, poll_options, poll_votes
3. **Job Board** — jobs, job_applications, saved_jobs
4. **Events** — events, event_rsvps
5. **Groups** — groups, group_members
6. **Messaging** — conversations, conversation_participants, messages
7. **Notifications/News** — notifications, news
8. **Campus Tools** — lost_and_found, courses, user_courses, shuttle_routes, shuttle_locations
9. **Engagement** — mentorship_requests, badges, user_badges, reports

---

## Architecture Rules (never break these)
1. **Services only touch DB/Redis** — controllers call services, services call Knex/Redis. No DB code in controllers or middleware.
2. **Socket.io events emit AFTER successful DB write** — never before, never speculatively.
3. **university_id always from req.university.id** — resolved by `resolveUniversity` middleware from JWT or `x-university-domain` header.
4. **OTP stored in Redis only** — bcrypt-hashed, TTL 600s. Keys: `otp:{purpose}:{userId}` and `otp_attempts:{purpose}:{userId}`. Never in the users table.
5. **Refresh token in httpOnly cookie** — `sameSite: strict`, `secure` in production. Stored in `user_sessions` table. Rotated on every use.
6. **No N+1 queries** — use Knex joins or subqueries for list endpoints.
7. **asyncHandler wraps all async route handlers** — no unhandled promise rejections.
8. **Bull queues handle** — email sending, notifications, badge awards, job application emails.

---

## Folder Structure (`apps/api/src/`)
```
config/
  db.ts              — Knex instance (DATABASE_URL)
  redis.ts           — ioredis client (REDIS_URL)
  env.ts             — typed env config, throws if required vars missing

middleware/
  auth.ts            — requireAuth, requireRole(...roles)
  university.ts      — resolveUniversity (sets req.university)
  validate.ts        — validate(ZodSchema) middleware
  rateLimiter.ts     — createRateLimiter, loginLimiter, otpLimiter, generalLimiter

modules/
  auth/              — register, verify-otp, login, verify-login-otp, refresh, logout, forgot/reset-password, /me
  users/             — profile CRUD, follow/unfollow, suggestions
  feed/              — posts CRUD, comments, reactions, polls
  jobs/              — jobs CRUD, applications, saved jobs
  events/            — events CRUD, RSVP, publish
  groups/            — groups CRUD, join/leave, member roles, group posts
  messages/          — conversations, messages, read receipts
  notifications/     — list, mark read, unread count
  campus/            — lost-found, shuttle, courses, admin

services/
  email.service.ts   — ResendEmailService (sendOtpEmail, sendWelcomeEmail, sendJobAlertEmail)
  otp.service.ts     — OtpService (generateOtp, storeOtp, verifyOtp, revokeOtp)
  token.service.ts   — TokenService (generate, verify, save, revoke, rotate)

socket/
  index.ts           — setupSocket(), getIo(), auth on connect, room joins, typing events

workers/
  notification.worker.ts  — Bull queue 'notifications'
  badge.worker.ts          — Bull queue 'badges'
  email.worker.ts          — Bull queue 'emails'
  index.ts                 — startWorkers()

types/
  express.d.ts       — req.user: {userId, universityId, role}, req.university: {id, name, domain, plan}

utils/
  errors.ts          — AppError, notFound, unauthorized, forbidden, badRequest, conflict, tooManyRequests, validationError
  response.ts        — sendSuccess, sendPaginated, sendError
  asyncHandler.ts    — wraps async RequestHandler

database/
  migrations/        — Knex migration files (001–007+)
  seeds/             — 01_initial_data.ts (UIU, 4 users, badges, sample jobs/events)

app.ts               — Express app, middleware stack, router mounts, global error handler
server.ts            — HTTP server, DB connect, Redis connect, setupSocket, startWorkers
```

---

## API Conventions
- **Base URL:** `/api/v1/`
- **Success:** `{ data: T }`
- **Error:** `{ error: string, code: string }`
- **Paginated:** `{ data: { items: T[], total: number, page: number, hasMore: boolean } }`
- **Auth:** `Authorization: Bearer {accessToken}` header
- **Rate limits:** login/register 10 req/15min · OTP 5 req/5min · general 300 req/min/user
- **University scoping:** all endpoints automatically scoped to `req.university.id`

---

## Auth Flow (Resend OTP)
```
Register:        POST /auth/register          → Resend sends 6-digit OTP (purpose: 'verify')
Verify account:  POST /auth/verify-otp        → issues JWT access + refresh cookie
Login:           POST /auth/login             → Resend sends 6-digit OTP (purpose: 'login')
Verify login:    POST /auth/verify-login-otp  → issues JWT access + refresh cookie
Refresh:         POST /auth/refresh           → rotates refresh token (reads httpOnly cookie)
Logout:          POST /auth/logout            → revokes session from user_sessions
Forgot password: POST /auth/forgot-password   → Resend sends reset OTP (purpose: 'reset')
Reset password:  POST /auth/reset-password    → verifies OTP, hashes new password, revokes all sessions
Get current:     GET  /auth/me                → returns user + profile
```

---

## Socket.io Rooms
| Room | Who joins | Events |
|---|---|---|
| `uni:{universityId}` | All users in the university | post:created, job:created, event:published, poll:vote, shuttle:location |
| `user:{userId}` | The specific user | notification:new, badge:earned, conversation:updated |
| `conv:{conversationId}` | All conversation participants | message:new, message:deleted, typing, typing:stop, conversation:read |
| `group:{groupId}` | All group members | group:member_joined |

---

## Environment Variables (apps/api/.env)
```
PORT=3001
NODE_ENV=development
DATABASE_URL=postgresql://YOUR_MAC_USERNAME@localhost:5432/uniconnect_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=<64-byte hex>
JWT_REFRESH_SECRET=<64-byte hex>
RESEND_API_KEY=re_xxxx
RESEND_FROM_EMAIL=UniConnecT <onboarding@resend.dev>
CLIENT_URL=http://localhost:5173
```

---

## Build Status
> Update this section as modules are completed. Claude Code: check this before starting any session.

### ✅ Complete
- [ ] Scaffold (package.json, tsconfig, folder structure)
- [ ] Database migrations (all 9 domains)
- [ ] Seed file (UIU, test users, badges, sample data)
- [ ] Config (db.ts, redis.ts, env.ts)
- [ ] Utils (errors.ts, response.ts, asyncHandler.ts)
- [ ] Middleware (auth.ts, university.ts, validate.ts, rateLimiter.ts)
- [ ] Services (email.service.ts, otp.service.ts, token.service.ts)
- [ ] Auth module (/register, /verify-otp, /login, /verify-login-otp, /refresh, /logout, /forgot-password, /reset-password, /me)
- [ ] Users module (profile CRUD, follow/unfollow, suggestions)
- [ ] Feed module (posts, comments, reactions, polls)
- [ ] Socket.io setup (auth, rooms, typing)
- [ ] Jobs module (CRUD, applications, saved)
- [ ] Events module (CRUD, RSVP, publish)
- [ ] Groups module (CRUD, join/leave, roles, group posts)
- [ ] Messages module (conversations, messages, read receipts)
- [ ] Notifications module + Bull workers
- [ ] Campus tools (lost-found, shuttle, courses)
- [ ] Admin module (stats, user management, reports, invitations)
- [ ] Dockerfile + docker-compose.yml
- [ ] GitHub Actions (ci.yml, deploy-api.yml, deploy-web.yml)

### 🔴 Not Started
> Move items above to ✅ as you complete them.

---

## Known Decisions & Gotchas
- `password_hash` is nullable in users table — supports future passwordless-only flow
- `otp_code` and `otp_expires_at` columns were removed from users table (migration 007) — OTP lives in Redis only
- `group_members` may need a `status` field for private group join requests — add migration if implementing
- `messages` table may need `edited_at TIMESTAMPTZ` — add migration when building message edit
- Shuttle tracking uses `shuttle_locations` — one row per route, always upsert (not insert)
- Bull queues must connect to the same Redis instance. In production, use ElastiCache with TLS: `rediss://` URL
- Socket.io requires sticky sessions on ALB in production (ECS multi-instance)
- `@socket.io/redis-adapter` must be configured before any `io.to()` calls work across instances
- All migrations in `apps/api/src/database/migrations/` use TypeScript. Knexfile must register `ts-node` for migration commands in dev

---

## Seed Test Credentials
| Email | Password | Role |
|---|---|---|
| admin@uiu.ac.bd | Admin@1234 | admin |
| staff@uiu.ac.bd | Staff@1234 | staff |
| alumni@uiu.ac.bd | Alumni@1234 | alumni |
| student@uiu.ac.bd | Student@1234 | student |

University domain: `uiu.ac.bd` (set as `x-university-domain` header or JWT-resolved)

---

## Quick Commands
```bash
pnpm --filter api dev          # start API dev server (:3001)
pnpm --filter api db:migrate   # run pending migrations
pnpm --filter api db:rollback  # rollback last migration
pnpm --filter api db:seed      # run seed files
pnpm --filter api db:reset     # rollback all → migrate → seed
pnpm --filter api build        # compile TypeScript → dist/
pnpm --filter api test         # run Vitest tests
```
