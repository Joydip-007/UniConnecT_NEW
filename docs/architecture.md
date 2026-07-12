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
│  │  /api/v1/…   │  │  Handlers    │  │  (email, notifs)   │   │
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
│  │  Knex (pg pool) │   │  Redis     │   │  S3 / Cloudinary │  │
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

Every row in every domain table carries a `university_id` UUID foreign key. Tenants are isolated at the query level — there is no row-level security at the Postgres layer, so every service function **must** receive and filter by `university_id`.

```
Request → authMiddleware → sets req.university.id
        → route handler  → passes university_id to service
        → service        → always includes .where('university_id', universityId)
```

A university registers once via the `universities` table. Admins invite users via `invitations` (tokenised email links). There is no cross-university data leakage by design.

---

## Authentication & Session Flow

```
1. POST /api/auth/login
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
   POST /api/auth/refresh
   ├─ Reads refresh token from cookie
   ├─ Looks up user_sessions row (validates not revoked / not expired)
   └─ Issues new access token (refresh token rotation optional)

5. Logout:
   POST /api/auth/logout → deletes user_sessions row
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
| `user:{userId}` | The authenticated user only | Personal notifications, DM messages, mentorship updates |
| `conv:{conversationId}` | Participants of that conversation | New messages, typing indicators, read receipts |

Services emit to rooms via the exported `io` instance — never from route handlers directly.

---

## File Upload Flow

Files never pass through the API server. All media goes directly to S3 (or Cloudinary in dev).

```
1. Client  → POST /api/upload/presign  { fileType, fileName, folder }
2. API     → generates S3 presigned PUT URL (expires in 5 min)
3. Client  → PUT {presigned URL}  (direct to S3, no API involved)
4. Client  → sends the resulting public S3 URL to the relevant endpoint
            e.g. PATCH /api/users/profile { avatarUrl: "https://s3…" }
```

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

There are eight Bull queues in total, all backed by Redis. Queue definitions: `apps/api/src/queues/`
Workers: `apps/api/src/workers/` — run as a **separate process** in development (`npx pnpm --filter api worker`); in production, workers run in-process with the API server.

---

## Caching Strategy

Redis is used for three purposes:

| Pattern | Key | TTL | Purpose |
|---------|-----|-----|---------|
| Session store | `session:{userId}` | 7 days | Refresh token validation |
| Feed cache | `feed:{universityId}:{page}` | 5 min | Paginated home feed |
| Online presence | `online:{universityId}` | Volatile (TTL on disconnect) | Track connected users per university |
| Rate limiting | `rl:{ip}:{route}` | 1 min window | Prevent abuse |

Cache invalidation: on any write to the relevant domain, call `cache.invalidate('feed:{universityId}:*')` in the service layer before responding.

---

## Service Layer Rules

- Services are the only layer allowed to touch the database and Redis.
- Services are plain TypeScript modules that export async functions — no classes.
- Every service function signature begins: `(db: Knex, universityId: string, ...)`.
- Services throw `AppError` for expected failures; unexpected errors bubble to the global error handler.
- Services emit Socket.io events **after** a successful DB write — never before.

---

## Backend Modules

Every feature module under `apps/api/src/modules/` follows the same shape: `router.ts`, `controller.ts`, `service.ts`, `schema.ts`, `index.ts`.

| Module | Responsibility |
|--------|-----------------|
| `academic` | Academic records/programs data backing the learning features |
| `admin` | Platform admin: stats, user/role management, invitations, content-report review, allowed email domains |
| `auth` | Login, invite-token registration, OTP verification, JWT + refresh-token session flow |
| `campus` | Lost-and-found items and shuttle schedules (`driver`-role GPS broadcast) |
| `connections` | Bidirectional LinkedIn-style connection graph (request/accept/decline/remove, mutual connections) — replaces the dropped `follows` table |
| `content-sync` | Admin-triggered import of external university news/notices/events (WordPress REST + Skyvern fallback) |
| `drafts` | Unified list of the current user's own unpublished posts/jobs/news/events |
| `events` | Campus events CRUD and RSVPs |
| `explore` | Discovery/browse surface across feed content |
| `feed` | Social feed posts, reactions, comments, hot-score ranking |
| `groups` | Groups with join requests, member roles, resources, study sessions, pinned posts, rules |
| `jobs` | Job board postings and applications |
| `klipy` | GIF/media picker integration |
| `learning` | Student-facing learning/course content |
| `learning-admin` | Admin management of learning content and AI configuration |
| `mentorship` | Mentorship request lifecycle, points economy, gift-card redemption, per-session tracking, auto-created mentorship conversations |
| `messages` | Direct, group, and mentorship conversations/messages |
| `moderation` | Content moderation and reporting workflows |
| `news` | University news/notices |
| `notifications` | In-app notification records and preferences |
| `presence` | Redis-backed online/offline presence tracking, respecting privacy tiers |
| `push` | Web Push (VAPID) subscription management |
| `quiz` | Quiz/assessment content tied to learning |
| `search` | Full-text search (Postgres generated `search_vector` columns + pg_trgm fallback) |
| `upload` | Presigned S3 upload URL issuance |
| `users` | User/profile CRUD, experience, education, featured items, analytics, viewers, settings, privacy, account preferences |

## Frontend Feature Bundles

Each bundle under `apps/web/src/features/{domain}/` follows `components/`, `hooks/`, `index.ts`.

`connections`, `content-sync`, `drafts`, `events`, `explore`, `feed`, `groups`, `jobs`, `landing`, `learning`, `learning-admin`, `lost-found`, `mentorship`, `messages`, `moderation`, `news`, `notifications`, `onboarding`, `presence`, `profile`, `quiz`, `search`, `settings`, `share`, `shuttle`

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
