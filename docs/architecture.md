# Architecture

UniConnecT is a multi-tenant monorepo with a React SPA frontend, an Express REST + Socket.io backend, PostgreSQL for persistence, and Redis for caching and real-time coordination.

---

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                          Clients                                │
│         Browser (React SPA)  ·  Mobile (future React Native)   │
└────────────────┬──────────────────────────┬────────────────────┘
                 │ HTTPS / REST             │ WSS / Socket.io
                 ▼                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      apps/api  (Express)                        │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐   │
│  │  REST Routes │  │  Socket.io   │  │  Bull Job Workers  │   │
│  │  /api/v1/…   │  │  Handlers    │  │  (12 queues)       │   │
│  └──────┬───────┘  └──────┬───────┘  └────────┬───────────┘   │
│         │                 │                   │                │
│  ┌──────▼─────────────────▼───────────────────▼───────────┐   │
│  │                    Modules (apps/api/src/modules/)       │   │
│  │  academic · admin · auth · campus · connections ·        │   │
│  │  content-sync · drafts · events · explore · feed ·       │   │
│  │  groups · jobs · klipy · learning · learning-admin ·     │   │
│  │  mentorship · messages · moderation · news ·             │   │
│  │  notifications · presence · push · quiz · search ·       │   │
│  │  upload · users                                          │   │
│  └──────┬─────────────────────────────────────────────────┘   │
│         │                                                       │
│  ┌──────▼──────────┐   ┌────────────┐   ┌──────────────────┐  │
│  │  Knex (pg pool) │   │  Redis     │   │  S3 / R2 · Gemini│  │
│  └──────┬──────────┘   └────────────┘   └──────────────────┘  │
│         │                                                       │
└─────────┼───────────────────────────────────────────────────────┘
          │
┌─────────▼──────────┐
│  PostgreSQL 16      │
│  (multi-tenant)     │
└────────────────────┘
```

---

## Multi-Tenancy

Every row in every domain table carries a `university_id` UUID foreign key. Tenants are isolated at the query level. There is no row-level security at the Postgres layer, so every service function **must** filter by `university_id`.

```
Request → resolveUniversity → sets req.university.id (from x-university-domain or the JWT)
        → requireAuth       → sets req.user
        → controller        → passes req.university.id to the service
        → service           → always includes .where('university_id', universityId)
```

`universityId` always comes from `req.university.id`, never from the request body.

A university registers once via the `universities` table. Admins invite users via `invitations` (tokenised email links). There is no cross-university data leakage by design.

---

## Authentication & Session Flow

```
1. POST /api/v1/auth/login
   ├─ Validate credentials → bcrypt compare
   ├─ Issue access token  (JWT, 15 min, payload: {userId, universityId, role})
   └─ Issue refresh token (random 256-bit, stored in user_sessions, 7 days)

2. Client stores:
   ├─ accessToken  → memory (Zustand authStore)
   └─ refreshToken → httpOnly cookie

3. Authenticated request:
   Authorization: Bearer <accessToken>
   ├─ authMiddleware verifies JWT signature + expiry
   └─ Sets req.user and req.university on every protected route

4. Token refresh:
   POST /api/v1/auth/refresh
   ├─ Reads refresh token from cookie
   ├─ Looks up user_sessions row (validates not revoked / not expired)
   └─ Issues new access token (refresh token rotation optional)

5. Logout:
   POST /api/v1/auth/logout → deletes user_sessions row
```

**Never** put sensitive data (password hash, private fields) in the JWT payload. Only `userId`, `universityId`, and `role`.

---

## Real-Time Architecture

Socket.io runs on the same Express HTTP server. On connection, the client authenticates by sending its access token in the handshake `auth` object.

```
// Client
const socket = io(VITE_SOCKET_URL, {
  auth: { token: accessToken }
});

// Server (socket middleware)
socket.use((socket, next) => {
  const token = socket.handshake.auth.token;
  // verify JWT → attach socket.data.user
});
```

### Room Structure

| Room name | Who joins | Events emitted |
|-----------|-----------|---------------|
| `uni:{universityId}` | All connected users of that university | New posts, news, events, job board activity |
| `user:{userId}` | The authenticated user only | Personal notifications, mentorship updates, conversation-list activity (`conv:activity`, `conv:list:typing`), group review-queue changes |
| `conv:{conversationId}` | Participants of that conversation | New/edited messages, typing indicators, read receipts, view-once opens |

Services emit to rooms via `getIo()` from `src/socket/index.ts`, after the DB write and never from route handlers. Socket.io is scaled across instances with the Redis pub/sub adapter. Event names live in `packages/shared/src/constants/socket.ts` (see `socket-events.md`).

---

## File Upload Flow

Files never pass through the API server. All media goes directly to S3-compatible storage (Cloudflare R2 in production, via `AWS_ENDPOINT` / `AWS_PUBLIC_URL`).

```
1. Client  → GET /api/v1/upload/presign?fileType=…&folder=…
2. API     → generates a presigned PUT URL
3. Client  → PUT {presigned URL}  (direct to R2/S3, no API involved)
4. Client  → sends the resulting public URL to the relevant endpoint
            e.g. PATCH /api/v1/users/me { avatar_url: "https://…" }
```

Some features have their own scoped presign endpoints (assignment submissions, module files, shared notes, session notes), all following the same flow.

This keeps API server memory and bandwidth usage near zero for media.

---

## Background Jobs (Bull + Redis)

Long-running or deferrable work lives in Bull queues, not HTTP handlers.

| Queue | Triggered by | Worker action |
|-------|-------------|--------------|
| `email` | Registration, OTP, job application status | Send via Resend |
| `notification` | Post reactions, comments, mentions, connection requests | Write `notifications` rows + emit to `user:{userId}` room |
| `badge` | Post created, job applied, mentorship milestones | Check trigger conditions, award `user_badges` rows |
| `group-digest` | Weekly cron | Compile and send weekly group activity digest emails |
| `mentorship` | Mentorship request accepted / pending | 48h alumni reminder (`request_reminder`) and 7-day auto-expiry (`request_expire`) |
| `push` | Notification created while user has a push subscription | Web Push (VAPID) fan-out via `push_subscriptions` |
| `content-sync` | Admin-triggered import run | Fetch external university news/notices/events (WordPress API, Skyvern fallback) |
| `feed-ranking` | Cron | Recompute `posts.hot_score` for the "Top" feed sort |
| `post-lifecycle` | Scheduled/expiring post, plus a reconciliation sweep cron | Publish scheduled posts (`publish_at`) and auto-archive expired ones (`expires_at`) |
| `notification-digest` | Daily cron (03:00 UTC) | Email a digest of unread notifications |
| `learning` | Hourly cron (`:10`), acting per university local hour | Streak sweeps, freezes and reminders for the learning platform |
| `ai-content` | Hourly crons (`quiz-gen`, `group-post`, `learning-gen`) | Gemini-generated daily quizzes, per-group AI posts and flashcards/quizzes, skill paths. Throttled by `AI_CALLS_PER_MINUTE`; models from `GEMINI_MODELS` |

The quiz worker (`quiz.worker.ts`) fills `daily_quiz_slots` from `ai_quiz_pool`. These twelve job types share **two physical Bull queues**: `realtime` for user-facing work and `batch` for slow and scheduled work (`QUEUE_LANES` in `config/bull.ts`). Each queue that processes jobs holds its own blocking Redis connection, so two lanes keep an instance at 6 Redis connections instead of 16. Queue definitions: `apps/api/src/queues/`
Workers: `apps/api/src/workers/` — run as a **separate process** in development (`npx pnpm --filter api worker`); in production, workers run in-process with the API server.

**Changing a repeatable job's schedule:** Bull persists repeatable jobs in Redis keyed by name + cron + `jobId`, so removing a registration from code does not deregister it. Change the `jobId` along with the cron. `ai-content.worker.ts` calls `pruneStaleRepeatableJobs()` before registering; extend its desired set rather than adding an unpruned job.

---

## Caching Strategy

There is no application-level response cache. Every `/api/v1` response is sent with `Cache-Control: no-store`, and the "Top" feed is kept fast by the denormalised `posts.hot_score` column rather than a Redis cache. Refresh tokens live in Postgres (`user_sessions`), not Redis.

Redis holds:

| Pattern | Key | TTL | Purpose |
|---------|-----|-----|---------|
| Presence count | `presence:count:{userId}` | `PRESENCE_TTL_SECONDS` (60s), refreshed by socket heartbeats | Number of live sockets per user |
| Online set | `presence:online:{universityId}` | — | Online users per university |
| Rate limiting | `rl:{keyPrefix}:{subject}` | limiter window | `globalLimiter`, `writeLimiter`, `searchLimiter`, `uploadLimiter`, auth limiters |
| Bull queues | `bull:{queue}:*` | — | Background jobs and repeatable crons |
| Socket.io adapter | pub/sub channels | — | Cross-instance event fan-out |

---

## Service Layer Rules

- Services are the only layer allowed to touch the database and Redis.
- Services are plain TypeScript modules that export async functions — no classes.
- Services import `db` directly (they do not receive it as a parameter) and take `universityId` from the caller.
- Services throw `AppError` for expected failures; unexpected errors bubble to the global error handler.
- Services emit Socket.io events **after** a successful DB write — never before.

---

## Backend Modules

Every feature module under `apps/api/src/modules/` follows the same shape: `router.ts`, `controller.ts`, `service.ts`, `schema.ts`, `index.ts`.

| Module | Responsibility |
|--------|-----------------|
| `academic` | LMS for `type: 'academic'` groups, mounted under `/groups`: course outline, modules, assignments/submissions, gradebook |
| `admin` | Platform admin: stats, user/role/verification management, invitations and invite batches, grouped moderation queue, content moderation over feed posts (soft removal), problem reports, shuttle ops settings, allowed email domains |
| `auth` | Login, invite-token registration, OTP verification, JWT + refresh-token session flow |
| `campus` | Lost-and-found (saves, pins, desk info) and shuttle (routes, `driver`-role GPS broadcast, driver shifts, rider stop prefs, service notices). Mounted at the bare `/api/v1` |
| `connections` | Bidirectional LinkedIn-style connection graph (request/accept/decline/remove, mutual connections) — replaces the dropped `follows` table |
| `content-sync` | Admin-triggered import of external university news/notices/events (WordPress REST + Skyvern fallback) |
| `drafts` | Unified list of the current user's own unpublished posts/jobs/news/events |
| `events` | Campus events CRUD, RSVPs with capacity waitlist, date index and top organisers |
| `explore` | Discovery/browse surface across feed content |
| `feed` | Social feed posts, reactions, comments, hot-score ranking |
| `groups` | Groups with join requests, member roles, invitations, resources, study sessions, pinned posts, rules, settings, post/event review queue, moderation log, analytics, group chat, ask-a-teacher, announcements, consultation slots, study tools, AI settings, course-outline import |
| `jobs` | Job board postings and applications, with eligibility rules (departments, batches, CGPA), scheduled publishing and application withdrawal |
| `klipy` | GIF/media picker integration |
| `learning` | Skill paths, units, streaks, checkpoint-quiz attempts, badges and badge pins |
| `learning-admin` | Admin path/unit builder, AI path and quiz generation, pending-review queues, learning analytics, AI configuration |
| `mentorship` | Mentorship request lifecycle, per-session points, gift-card redemption, session requests, end/reopen with undo, mentor settings, waitlist, auto-created mentorship conversations |
| `messages` | Direct, group and mentorship conversations: attachments, view-once photos, edits, delete-for-me, per-thread pin/theme/emoji, shared files |
| `moderation` | User-level blocks, mutes and reports |
| `news` | University news/notices with summary, tags, key dates and a right-rail feed |
| `notifications` | In-app notification records and preferences |
| `presence` | Redis-backed online/offline presence tracking, respecting privacy tiers |
| `push` | Web Push (VAPID) subscription management |
| `quiz` | Daily per-department campus quiz, leaderboard and history |
| `search` | Full-text search (Postgres generated `search_vector` columns + pg_trgm fallback) |
| `upload` | Presigned S3 upload URL issuance |
| `users` | User/profile CRUD, experience, education, featured items, analytics, viewers, settings, privacy, account preferences, deletion requests, problem reports |

## Frontend Feature Bundles

Each bundle under `apps/web/src/features/{domain}/` follows `components/`, `hooks/`, `index.ts`.

`connections`, `content-sync`, `drafts`, `events`, `explore`, `feed`, `groups`, `jobs`, `landing`, `learning`, `learning-admin`, `lost-found`, `mentorship`, `messages`, `moderation`, `news`, `notifications`, `onboarding`, `presence`, `problem-reports`, `profile`, `quiz`, `search`, `settings`, `share`, `shuttle`

`problem-reports` is the admin view of crash reports, rendered in the admin Moderation tab.

`lost-found` and `shuttle` are frontend-only feature names — both are served by the backend `campus` module (there is no separate `lost-found` or `shuttle` backend module).

---

## Package Boundaries

```
packages/shared   →  consumed by apps/api AND apps/web
apps/api          →  never imports from apps/web
apps/web          →  never imports from apps/api
```

Shared exports: TypeScript types, Zod schemas, socket event name constants, utility types.

---

## Key Dependency Decisions

| Decision | Rationale |
|----------|-----------|
| Knex over Prisma | Fine-grained SQL control for complex multi-tenant queries; migration tooling is simpler for the team |
| Zustand over Redux | Minimal boilerplate; server state handled by TanStack Query; client state is small |
| Bull over BullMQ | Team familiarity; BullMQ migration is a non-breaking upgrade path |
| Vite over CRA | Build speed; native ESM; better DX |
| pnpm workspaces | Faster installs; strict dependency isolation between apps |
