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
│  │                    Service Layer                        │   │
│  │   posts · jobs · events · auth · notifications · …     │   │
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
| `notifications` | Post reactions, comments, mentions, follows | Write `notifications` rows + emit to `user:{userId}` room |
| `badge-awards` | Post created, job applied, follow count | Check trigger conditions, award `user_badges` rows |
| `feed-fan-out` | New post by high-follower user | Pre-cache feed entries in Redis |

Queue definitions: `apps/api/src/queues/`
Workers: `apps/api/src/workers/`

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
