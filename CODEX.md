# CODEX.md

Living project context for Codex when working in this repository. Read this alongside `AGENTS.md`, `CLAUDE.md`, and the docs before making changes. Update it whenever the actual project state changes.

UniConnecT is a private university social network for students, alumni, faculty, and admins. It is a multi-tenant SaaS project for Team Mavericks, UIU, Dhaka 2026-27.

---

## Latest Summary

Snapshot date: 2026-05-14.

Recent work completed:

- Backend modules were expanded beyond auth into feed/posts, jobs, events, groups, conversations/messages, notifications, news, and campus tools.
- Frontend contracts are treated as canonical during this wiring phase. Backend services accept camelCase request bodies where the React app already sends them, while preserving snake_case aliases where implemented.
- Socket compatibility events were added for feed, messaging, notifications, and shuttle updates.
- Blank frontend pages were wired for messages, conversation detail, notifications, news list/detail, and job detail.
- Auth was corrected so existing-account login is password-only. OTP is used for registration verification and password reset, not normal login.
- Registration now supports `/register` as an invite-code entry page and `/register/:token` as the account creation page.
- API requests from the web client include `x-university-domain` from `VITE_UNIVERSITY_DOMAIN`, defaulting locally to `uiu.ac.bd`.
- `apps/api/tsconfig.json` is compiler-clean with CommonJS output, Node resolution, ES2022 libs, and an `@/*` alias to `./src/*`.

Recent verification:

```bash
npx pnpm typecheck
npx pnpm lint
```

Both commands passed after the latest auth, routing, and tsconfig changes.

---

## Working Rules

- `pnpm` is not on PATH in this environment. Always run pnpm through `npx`, for example `npx pnpm typecheck`.
- Before finishing code changes, run `npx pnpm typecheck && npx pnpm lint`.
- Respect strict package boundaries: `apps/web` and `apps/api` must not import from each other. Shared code belongs in `packages/shared` and is imported as `@uniconnect/shared`.
- Treat `docs/api.md`, `docs/database.md`, `docs/socket-events.md`, and `docs/deployment.md` as target specifications, not proof of implementation.
- Do not add dependencies without first checking existing workspaces and `packages/shared`.
- Do not touch unrelated user changes.

---

## Commands

Root:

```bash
npx pnpm install
npx pnpm dev
npx pnpm build
npx pnpm test
npx pnpm lint
npx pnpm typecheck
```

Backend:

```bash
npx pnpm --filter api dev
npx pnpm --filter api build
npx pnpm --filter api typecheck
npx pnpm --filter api lint
npx pnpm --filter api db:migrate
npx pnpm --filter api db:rollback
npx pnpm --filter api db:seed
npx pnpm --filter api db:reset
```

Frontend:

```bash
npx pnpm --filter web dev
npx pnpm --filter web build
npx pnpm --filter web test
npx pnpm --filter web lint
npx pnpm --filter web typecheck
```

Local server ports:

- API: `http://localhost:4000`
- Web: `http://localhost:5173`
- Backend health: `http://localhost:4000/health`

Kill local dev servers if ports are stuck:

```bash
lsof -ti :5173 | xargs kill -9
lsof -ti :4000 | xargs kill -9
```

Known pnpm workspace detail: if adding a package with a post-install script causes pnpm to append an entry under `allowBuilds` in `pnpm-workspace.yaml`, set the package value to `true` and rerun install.

---

## Current Repo Reality

Implemented workspaces:

- `apps/web`: React 18 SPA built with Vite 5, Tailwind CSS, TanStack Query, Zustand, Axios, Socket.io client, Sonner, and Lucide React.
- `apps/api`: Express REST API with Socket.io, PostgreSQL, Redis, JWT access tokens, httpOnly refresh cookies, Bull queues, S3 presigned upload helpers, and domain modules.
- `packages/shared`: shared TypeScript package for cross-app types, schemas, and constants. Keep shared contracts here when both apps need them.

Important package-boundary note: `apps/api` and `apps/web` must not import each other.

---

## Auth State

Current auth behavior:

- Existing-account login is password-only:
  - `POST /api/v1/auth/login`
  - verifies email/password
  - returns `{ data: { user, accessToken } }`
  - sets the refresh token cookie
- OTP is still used for:
  - registration verification (`purpose: 'verify'`)
  - password reset (`purpose: 'reset'`)
- Login OTP is not part of the current frontend login flow.
- Auth routes run `resolveUniversity`, so the frontend must send `x-university-domain`.
- The web Axios client sends `x-university-domain` from `VITE_UNIVERSITY_DOMAIN`, with local fallback `uiu.ac.bd`.
- Registration supports:
  - `/register`: invite-code entry screen
  - `/register/:token`: account creation form
  - backend accepts frontend fields `token` and `fullName` as aliases for `invitation_token` and `full_name`
- After registration, the user is signed in but unverified and routed to `/otp`.
- `OtpPage` posts `purpose: 'verify'` to `/auth/verify-otp` and `/auth/resend-otp`.

Local env expectations:

```bash
# apps/web/.env
VITE_API_URL=http://localhost:4000
VITE_SOCKET_URL=http://localhost:4000
VITE_UNIVERSITY_DOMAIN=uiu.ac.bd

# apps/api/.env
PORT=4000
DATABASE_URL=postgres://localhost:5432/uniconnect_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=change-me-min-32-chars-random-string
JWT_REFRESH_SECRET=change-me-different-from-jwt-secret
DEV_INVITE_TOKEN=dev-invite
DEV_INVITE_EMAIL=student@uiu.ac.bd
DEV_INVITE_ROLE=student
```

---

## Backend Status

Mounted API modules in `apps/api/src/app.ts`:

- `/api/v1/auth`
- `/api/v1/users`
- `/api/v1/upload`
- `/api/v1/posts`
- `/api/v1/polls`
- `/api/v1/jobs`
- `/api/v1/events`
- `/api/v1/groups`
- `/api/v1/conversations`
- `/api/v1/notifications`
- `/api/v1/news`
- campus tools under `/api/v1`
- `/health`

Implemented domain areas:

- Auth, users, follows, profile reads/updates.
- S3 presigned upload route.
- Feed posts, comments, reactions, saved posts, polls, and poll votes.
- Jobs, applications, saved jobs, posted jobs, and current-user application history.
- Events, RSVP, attendees, publish flow, and iCal export.
- Groups, membership, role management, group posts, and my groups.
- Conversations, participants, messages, read receipts, soft delete, and conversation sockets.
- Notifications list/read operations.
- News list/detail/create/update/delete.
- Campus tools including lost-found, shuttle routes/live locations, and courses.

Migrations live under `apps/api/src/database/migrations/` and currently cover core auth tables plus posts through campus tools.

Socket.io:

- Authenticates with `socket.handshake.auth.token`.
- Joins `uni:{universityId}` and `user:{userId}` on connect.
- Supports conversation rooms `conv:{conversationId}` through join/leave events.
- Supports both backend and frontend transition event names for feed and messaging.
- Production note: multiple ECS tasks require ALB sticky sessions for Socket.io.

Important backend convention:

- Services emit Socket.io events only after successful database writes/transactions.
- Route files should stay thin; service modules own business logic.
- All tenant-scoped service logic must use `req.university.id` or the authenticated token context, never request-body `university_id`.

---

## Frontend Status

Core app:

- Vite React SPA with `@/` alias to `apps/web/src`.
- React Router with guest routes, protected routes, lazy pages, and `ErrorBoundary`.
- `FeedLayout` shell with sidebars and top navigation.
- Zustand auth store, in-memory access token, Axios bearer-token injection, refresh flow, and Socket.io connect/disconnect integration.

Implemented route pages:

- Landing
- Login
- Register invite entry and register form
- OTP verification
- Feed
- Jobs list and job detail
- Events list and event detail
- Profile
- Groups list and group detail
- Messages list and conversation detail
- Notifications page
- News list and news detail
- Lost and found
- Shuttle tracker
- Not found

Still simple placeholders:

- `AdminPage`
- `SearchPage`
- `MentorshipPage`

Feature/component bundles:

- Feed: `CreatePost`, `PostCard`, feed socket hook.
- Jobs: `JobCard`, `PostJobForm`, `ApplyModal`, `ApplicationsList`.
- Events: `EventCard`, `CreateEventForm`.
- Messages: `ConversationList`, `ChatView`, `MessageInput`, `NewConversationModal`, conversation socket hook.
- Notifications: dropdown and notification socket hook.
- Profile: edit profile modal and follow modal.

Frontend-canonical compatibility notes:

- Backend accepts camelCase aliases used by the frontend, including jobs, events, lost-found, messages, reactions, and polls.
- Legacy frontend group routes are supported:
  - `POST /groups/:groupId/members`
  - `DELETE /groups/:groupId/members/me`
- Poll legacy route is supported:
  - `POST /polls/:pollId/vote`
- Conversation responses include frontend-friendly `type`, `otherParticipant`, `lastMessage.body`, and `lastMessage.sentAt`.
- Message responses include `body`, `sentAt`, `replyTo`, and sender profile data.

---

## Database And Infra Notes

- Local infrastructure is expected via Docker Compose for Postgres, Redis, and MinIO.
- Domain tables include `university_id` and rely on service-layer multi-tenancy, not Postgres RLS.
- Redis is used for OTP lifecycle, rate limiting, Socket.io adapter, and Bull queues.
- Background queue declarations exist for email and notifications; worker implementation exists but should be reviewed before production claims.
- File bytes do not pass through the API; clients request presigned URLs and upload directly.

---

## Design System Rules

The frontend uses the Warm Futuristic Dark theme: navy surfaces, UIU orange identity, and indigo interactive states.

Non-negotiables:

- Use CSS tokens from `apps/web/src/styles/tokens.css`; do not hardcode raw hex in component code.
- Structural borders are `0.5px solid var(--border-*)`, not `1px`.
- Use surface stacking for depth; do not add new shadows.
- Buttons must use `border-radius: var(--r-pill)`.
- Use font weights `400` and `500` only.
- UI text uses sentence case.
- Text on coloured backgrounds must use the matching light token.

---

## Source Of Truth Notes

- `AGENTS.md` defines repo conventions and Codex operating rules.
- `README.md` is the user-facing project overview and quick start.
- `CODEX.md` is the current living implementation snapshot.
- `CLAUDE.md` and `docs/` may describe target architecture and should be checked against the actual code before assuming a feature exists.
- `uniconnect_schema.sql` is a local schema artifact and may lag behind migrations.
