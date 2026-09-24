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

Roles: `student`, `alumni`, `faculty`, `admin`, plus a least-privilege `driver` role (migration `073`) — transport staff walled off from the social app whose only write is `POST /shuttle/locations` (GPS broadcast). Each user also has a per-university-unique `username` (migration `072`) powering vanity profile URLs (`/profile/<username>`).

JWT access token (15 min, payload: `{ userId, universityId, role }`) + refresh token (256-bit random, stored in `user_sessions`, 7 days, httpOnly cookie). Access token lives in Zustand `authStore` (memory only — cleared on page refresh, recovered via the refresh cookie). On `setAuth`, a `uc:has_session` flag is written to `localStorage` as a sentinel so the interceptor knows whether to attempt a silent refresh on 401.

Middleware: `src/middleware/auth.ts` → `requireAuth` / `requireRole('alumni')`.

- **Login**: `POST /auth/login` → returns `{ accessToken, user }` directly. No OTP step.
- **Registration**: `POST /auth/register` (requires invite token) → sends email OTP → `POST /auth/verify-otp` to complete.
- **Axios interceptor** (`apps/web/src/lib/axios.ts`) silently refreshes the access token on 401, but only when a session already exists (access token present) — it does not attempt refresh on unauthenticated 401s (e.g. bad login credentials).

All requests must include the `x-university-domain` header (e.g. `uiu.ac.bd`). The axios instance sets this from `VITE_UNIVERSITY_DOMAIN`. In API integration tests, pass it as `.set('x-university-domain', DOMAIN)` on every supertest request.

### Real-time

Socket.io on the same HTTP server, scaled via Redis pub/sub adapter (two IORedis connections: `pubClient` + `subClient`). Client authenticates via `socket.handshake.auth.token`. On `TOKEN_EXPIRED`, the client silently refreshes then reconnects. Rooms: `uni:{universityId}` (feed/events/jobs), `user:{userId}` (personal notifications), `conv:{conversationId}` (chat). Services emit to rooms **after** DB write — never from route handlers. Use `getIo()` from `src/socket/index.ts` inside services.

`conversations` has a `type` discriminator: `'direct'` (regular DM), `'group'` (group chat), `'mentorship'` (auto-created when a mentorship request is accepted). Mentorship threads also carry a `mentorship_request_id` back-reference via `mentorship_requests.conversation_id`.

### File uploads

Presigned S3 PUT URL flow — client calls `POST /api/upload/presign`, uploads directly to S3, then sends the resulting URL to the relevant endpoint. File bytes never pass through the API server.

### Background jobs

Bull queues on Redis (`apps/api/src/queues/`), workers in `apps/api/src/workers/`. Queues: `email`, `notification`, `badge`, `group-digest` (weekly group digest cron), `mentorship` (48 h alumni reminder + 7 d request auto-expiry), `push` (Web Push fan-out), `content-sync` (admin-triggered external content import), `feed-ranking` (cron that recomputes `posts.hot_score`), `ai-content` (hourly crons for university quiz generation, per-group AI posting, and learning-path generation). Workers run as a **separate process** (`npx pnpm --filter api worker`) — never inline async work inside HTTP handlers, always enqueue. In production, workers run in-process with the API server.

**Changing a repeatable job's schedule is a two-part change.** Bull persists repeatable jobs in Redis keyed by name+cron+`jobId`; deleting the registration from code does *not* deregister the running job. Change the `jobId` alongside the cron, or the old schedule survives the deploy and both fire. `ai-content.worker.ts` calls `pruneStaleRepeatableJobs()` before registering, which removes any repeatable whose id isn't in the current desired set — extend that set rather than adding an unpruned job.

The AI worker throttles Gemini calls via `env.AI_CALLS_PER_MINUTE` (default 12); on exceeding it, it sleeps out the rest of the wall-clock minute. Tests raise it in `apps/api/vitest.config.ts` so the suite never pays that stall.

### Full-text search & feed ranking

`search` uses Postgres **stored, generated `search_vector` columns** (migration `070`) on `profiles`, `posts`, `jobs`, `events`, `groups`, each with a GIN index. Weighting: A = name/title, B = secondary fields, C = long-form body; names use the `simple` dictionary, prose uses `english`. The pg_trgm indexes (migration `024`) remain as a fuzzy fallback.

The "Top" feed sorts on denormalised ranking columns on `posts` (migration `071`): `reaction_count`, `comment_count`, and a precomputed HN-style `hot_score` (index `idx_posts_hot_score`). Counters are maintained transactionally on reaction/comment writes; the `feed-ranking` Bull cron periodically recomputes `hot_score` so the feed sorts by index instead of correlated subqueries.

### Backend module structure

All feature modules live under `apps/api/src/modules/`. Each module follows the same shape: `router.ts` (route declarations only), `controller.ts` (request/response handling), `service.ts` (all business logic + DB access), `schema.ts` (Zod schemas), `index.ts` (barrel).

Current modules: `academic`, `admin`, `auth`, `campus`, `connections`, `content-sync`, `drafts`, `events`, `explore`, `feed`, `groups`, `jobs`, `klipy`, `learning`, `learning-admin`, `mentorship`, `messages`, `moderation`, `news`, `notifications`, `presence`, `push`, `quiz`, `search`, `upload`, `users`.

Mount points are all in `apps/api/src/app.ts` — check there rather than guessing, since several don't match their module name:

| Module | Mounted at | Notes |
|---|---|---|
| `academic` | `/api/v1/groups` | Shares the groups prefix — course outline, modules, assignments, gradebook for `type: 'academic'` groups |
| `learning-admin` | `/api/v1/admin/learning` | Admin-only AI learning/quiz config per university |
| `learning` | `/api/v1/learning` | Skill paths and units for learners |
| `quiz` | `/api/v1/quiz` | Daily quiz slots and attempts |
| `moderation` | `/api/v1/moderation` | User-level blocks/reports |
| `klipy` | `/api/v1/klipy` | GIF/sticker search proxy |
| `feed` | `/api/v1/posts` | Note the prefix differs from the module name. `GET /` takes `type` (post type) **and** `scope=my_groups` — membership is a relationship, so it cannot be a `type`. Both must be applied to the count query as well as the rows, or pagination totals lie. `GET /saved` (the caller's bookmarks, backing `/saved`) and `GET /archived` are declared **before** `/:postId`, or the param route swallows them |
| `messages` | `/api/v1/conversations` | Same |
| `drafts` | `/api/v1/me/drafts` | Same |
| `campus` | `/api/v1` | Mounted at the root prefix — lost-and-found and shuttle |
| `feed` (`pollsRouter`) | `/api/v1/polls` | Second router exported from the `feed` module, not its own module |

The `admin` module (`/api/v1/admin`) requires `faculty` or `admin` role (stats endpoint requires `admin` only) and exposes: stats, user list + role/status management, invitations (create/list/delete/bulk), content reports (list/resolve), and allowed email domains management. Admin actions are recorded in `university_audit_log`.

**Admin Content moderation (`/admin?tab=content`) is a queue over feed posts, not the four content tables.** `GET /admin/content/feed?type=post|news|event_promo|job_promo` returns `FeedPost` rows (via `feedService.listPostsForAdmin`, including unpublished ones) so the expanded row is the shipped `PostCard` in its `variant="admin"` (no like/comment/share/save row; `headerSlot` carries the status pills and the Manage menu). Admin **Delete is a soft removal**: `PATCH /admin/content/posts/:id/removed { is_removed }` archives the post (`archived_at`, so every existing public filter hides it) and stamps `removed_at`/`removed_by` (migration `108`); `?removed=true` lists the "Recently removed" tray and `is_removed: false` restores. The author cannot unarchive a removed post (`403 POST_REMOVED`) and their Archived view excludes it. `PATCH …/comments { comments_disabled }` is "Close to replies"; `PATCH …/publish` now also accepts `posts` (clears `publish_at` and cancels the scheduled job when publishing). `GET /admin/content/summary` feeds the four stat cards. The older per-table `GET /admin/content/:kind` routes (`posts|events|jobs|news`) and hard `DELETE` remain for other callers.

**Admin Moderation (`/admin?tab=moderation`) is a queue over report *targets*, not individual reports.** `GET /admin/reports/grouped` collapses reports per `(target_type, target_id)` with the highest severity, and every row carries a `location: { label, path }` resolved by `hydrateTargets()` in `admin/service.ts` — a comment resolves to its post (`/feed/:postId`), a message to its conversation, a user to their profile — so the admin sees *where* before deciding. **Review** (`GET /admin/reports/target/:targetType/:targetId`) lists every open report on that target with reporter, reason and their `description`; Remove/Dismiss go through the `PATCH` of the same path. There is deliberately no verification-requests counter on this tab: registration is OTP-gated, so nothing waits on an admin. The panel lives in `apps/web/src/pages/admin/ReportedContentPanel.tsx`. Moderation health (`stats.moderationHealth`) is **not** rendered in the centre column — the design puts it in the admin right rail, still to be built.

The `groups` module now includes: join-request flow (private groups → request → admin review), member roles (owner/admin/moderator/member), resources (file links with view tracking), study sessions (with RSVP), pinned posts, group rules, study tools (flashcard decks with spaced repetition, shared notes), settings (`PATCH /:groupId/settings` — private/post-approval/event-approval toggles), a post/event review queue (`/:groupId/review/summary|posts|events`, honoured by `feed`/`events` services via `require_post_approval`/`require_event_approval`), a moderation log (`GET /:groupId/moderation-log`), analytics (`GET /:groupId/analytics`), group chat + ask-a-teacher (`POST /:groupId/chat`, `/:groupId/ask-teacher(/queue)`), announcements and consultation slots/bookings (academic groups). `GET /groups/suggestions`, `POST /groups/course-outline/draft`, `POST /groups/from-outline` and `GET /groups/invite-match` are declared before `/:groupId` in `router.ts`, or the param route would swallow them. The detail page (`GroupDetailPage.tsx`) keeps tab state in the URL (`?tab=`), and `GroupHeader` keeps its open overlay there too (`?modal=share|members|invite`, via `useGroupModal` in `features/groups/groupDetailRoute.ts` — opening pushes so Back closes, switching/closing replaces, and a modal the viewer cannot use resolves to closed), and replaces the left/right rails with page-scoped overrides via `stores/pageRailStore.ts` (`usePageRails`) — `LeftSidebar`/`RightSidebar` render the override when one is set.

**Group roles are a separate axis from platform roles.** `group_members.role` is `owner | admin | moderator | member` (CHECK constraint, migration `017`) and governs what you can do *inside* a group; `users.role` governs which groups you may create or join. Enforcement helpers live at the bottom of `groups/service.ts`: `assertCanAdminGroup` (owner/admin — settings, invites, join-request review, rules, member management), `canModerate` (owner/admin/moderator — pinned text, stats, and deleting *any* member's content), and `assertCanAssignRole`/`assertCanRemoveRole`, which cap admins below their own tier so only an owner can promote to admin or transfer ownership. Content deletion is uniformly "creator **or** `canModerate`" — use `canModerate`, never a hand-rolled role array. `is_system` groups (auto-managed by role/department/batch) reject join, leave, invite, delete, and membership changes outright.

**AI settings on academic groups** live in the `groups.ai_settings` jsonb column, validated by `AISettingsSchema` (`groups/schema.ts`) and admin-only. Two independent toggles — `ai_flashcards_enabled` and `ai_quiz_enabled` — plus `subject`, `difficulty`, `question_style`, `language`, `custom_instructions`, and per-group scheduling (`items_per_run`, `frequency`, `run_hour` UTC, `run_weekday`). Rules that matter:
- **Never read-modify-write the blob.** Use `mergeAiSettings(groupId, patch)` (module-level export in `groups/service.ts`), which merges via SQL `||` so the worker and a concurrent admin save can't clobber each other.
- **`.partial()` does NOT suppress `.default()`** — it only makes keys optional; an absent key still resolves through its `ZodDefault`. So a PATCH schema derived from a defaulted one turns `{ ai_quiz_enabled: true }` into the *full* default set, and the jsonb merge resets every field the client didn't touch (this is what made the AI toggles mutually exclusive). `UpdateGroupAISettingsSchema` is therefore built from a separate default-free shape (`aiSettingsShape`); only `AISettingsSchema` carries defaults, for the read path. **Never put a `.default()` on a schema used to validate a partial/merge write.**
- Defaults are applied on read via `withAiSettingsDefaults`, spread *under* the stored row so runtime keys (`last_ai_post_date`, `pending_deck_id`, `pending_quiz_id`) survive. The worker reads raw rows, so it still needs its own `?? fallback`.
- Tests that call `groupsService.updateAiSettings` directly bypass `validate()` and cannot catch write-schema bugs — cover PATCH behaviour over HTTP (`src/__tests__/groups/ai-settings.test.ts`).
- `run_hour` is a **lower bound**, not an equality check — a delayed worker run must still post. `last_ai_post_date` is therefore the only de-dup mechanism; stamp it whenever a branch completes, or hourly runs will duplicate content.

The `campus` module covers lost-and-found items and shuttle schedules (no dedicated `lost-found` or `shuttle` module — both live under `/api/v1/campus`). Shuttle routes carry client-side estimation params (`est_duration_min`, `cycle_minutes` — migration `073`) so the browser can interpolate a bus along the route; `driver`-role users broadcast live GPS via `POST /shuttle/locations`.

The `mentorship` module has a points economy (`POINTS_PER_SESSION = 10`, `POINTS_PER_USD = 100`) and supports gift card redemption. It also manages: a `mentorship_sessions` child table (per-session date/duration/topic/notes, editable by either party), alumni capacity enforcement (`max_mentees` on profiles, default 3, checked at accept time), Bull lifecycle jobs per request (48 h alumnus reminder → `request_reminder`; 7 d auto-expiry → `request_expire`, status transitions to `expired`), and automatic conversation creation on accept (`conversations.type = 'mentorship'`, FK `mentorship_requests.conversation_id`).

The `connections` module (`/api/v1/connections`) implements a **bidirectional LinkedIn-style connection graph** — the old `follows` table has been dropped (migration `052_drop_follows`). Connections have `status: 'pending' | 'accepted'` and an optional `note`. Key routes: `POST /connections/request/:userId`, `DELETE /connections/request/:userId` (withdraw), `POST /connections/:connectionId/accept`, `POST /connections/:connectionId/decline`, `DELETE /connections/:userId` (remove), `GET /connections` (my accepted), `GET /connections/pending` (received), `GET /connections/sent`, `GET /connections/mutual/:userId`. On accept/receive, the service emits `CONNECTION_EVENTS.ACCEPTED` / `CONNECTION_EVENTS.REQUEST_RECEIVED` (from `@uniconnect/shared`) to the target's `user:{userId}` room.

The `users` module owns the full profile sub-API in addition to user lookup. Extra endpoints beyond `GET/PATCH /users/me`:
- **Experience**: `GET /:userId/experience`, `POST /me/experience`, `PATCH /me/experience/:entryId`, `DELETE /me/experience/:entryId` — table `profile_experiences`
- **Education**: same shape — table `profile_education`
- **Featured**: `GET /:userId/featured`, `POST /me/featured` (max 5), `DELETE /me/featured/:entryId`, `PATCH /me/featured/reorder` — table `profile_featured` with `display_order`
- **Analytics**: `GET /me/analytics` — returns 7/30/90-day profile-view counts from `profile_views`
- **Viewers**: `GET /me/viewers` — paginated list of recent profile viewers (last 90 days)
- **Connections**: `GET /:userId/connections` — public list of a user's accepted connections
- **Suggestions**: `GET /users/suggestions` — people the current user might know

**Profile view side-effect:** `GET /users/:userId` (`getUser`) silently upserts a row in `profile_views` (no separate endpoint needed). The `profiles` table has new optional columns: `location`, `website_url`, `github_url`, `portfolio_url`, `is_open_to_msg` (boolean).

**Settings, account & privacy** also live on the `users`/`notifications` routers, all backed by the single `user_settings` table (one row per user, two JSONB columns `notification_preferences` + `privacy_preferences`; missing keys deep-merge onto `DEFAULT_*` constants in `users/privacy.service.ts`):
- **Account**: `PATCH /users/me/preferences` (theme/locale), `POST /users/me/deactivate` (sets `users.deactivated_at`)
- **Privacy**: `GET /users/me/privacy`, `PUT /users/me/privacy` — controls profile/presence/message visibility tiers, enforced server-side via `loadPrivacy()` in `users/privacy.service.ts`
- **Notification prefs**: `GET /notifications/preferences`, `PUT /notifications/preferences`

The `presence` module (`/api/v1/presence`) tracks online status in **Redis** (not Postgres): a per-user socket-count key (`presence:count:{userId}`, TTL-refreshed by socket heartbeats) and a per-university online set (`presence:online:{universityId}`). The socket lifecycle calls `registerConnect`/`registerDisconnect` (0→1 and 1→0 transitions emit `PRESENCE_EVENTS`); on full disconnect it persists `users.last_seen`. Visibility respects each user's privacy tier (`OnlineVisibilityTier`). Routes: `GET /presence?userIds=…`, `GET /presence/online` (online connections). TTLs come from `PRESENCE_TTL_SECONDS` in `src/config/redis.ts`.

The `push` module (`/api/v1/push`) handles Web Push (VAPID) subscriptions: `POST /push/subscribe`, `DELETE /push/subscribe`, stored in `push_subscriptions`. Delivery is enqueued on the `push` Bull queue and sent by the `push` worker — never inline.

The `drafts` module (`/api/v1/me/drafts`) exposes a single `GET /` that returns the current user's own unpublished drafts unified across posts, jobs, news, and events (each of those tables gained `is_published` / publish columns in migration `064`). Drafts are author-only.

The `content-sync` module (`/api/v1/admin/content-sync`, **admin role only**) imports external university news/notices/events via the WordPress REST API with a Skyvern browser-automation fallback. Routes: `GET/PATCH /config`, `POST /run` (enqueues on the `content-sync` queue), `GET /pending` (imported-but-unpublished items for review), `GET /runs` (run history, `content_sync_runs`). Imported rows carry `imported_*` columns (migration `060`) and attachments live in `content_attachments` (`061`). Emits `CONTENT_SYNC_EVENTS`.

---

## apps/api internals

### Route / middleware patterns

Every router applies `resolveUniversity` first (resolves by `x-university-domain` header or JWT), then `requireAuth` for protected routes. Validation uses:

- `validate(schema)` — validates `req.body` against a Zod schema (`validateBody` is an alias; prefer `validate`)
- `validateRequest({ body?, params?, query? })` — validates multiple parts; use when you need params or query validation too

All async controller functions must be wrapped with `asyncHandler` from `src/utils/asyncHandler.ts` — this forwards unhandled promise rejections to the `errorHandler` middleware so nothing is swallowed silently.

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

Zod validation failures surface as **422 `VALIDATION_ERROR`**, not 400 — assert 422 in tests that exercise a bad payload or query param.

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
| `src/stores/` | Zustand stores: `authStore`, `notificationsStore`, `themeStore`, `socketStore`, `presenceStore`, `pendingMsgsStore` |
| `src/styles/` | `tokens.css` (CSS vars), `index.css` (Tailwind entry + token import) |
| `src/router/` | `index.tsx` (router), `paths.ts` (PATHS constants), `ProtectedRoute`, `AdminRoute`, `GuestRoute` |

**Implemented feature bundles** (each at `src/features/{domain}/` with `components/`, `hooks/`, `index.ts`):
`connections`, `content-sync`, `drafts`, `events`, `explore`, `feed`, `groups`, `jobs`, `landing`, `learning`, `learning-admin`, `lost-found`, `mentorship`, `messages`, `moderation`, `news`, `notifications`, `onboarding`, `presence`, `profile`, `quiz`, `search`, `settings`, `share`, `shuttle`

Notable feature internals:
- `src/features/connections/` — `ConnectButton`, `ConnectionRequestModal`, `PendingRequestCard`, `ConnectionCard`; hooks `useConnectionAction`, `useMyConnections`, `usePendingReceived`, `usePendingSent`, `useMutualConnections`
- `src/features/settings/` — `AccountSection`, `AppearanceSection`, `NotificationsSection`, `PrivacySection`, `Toggle`; hooks `useAccountSettings`, `useNotificationPreferences`, `usePrivacyPreferences`, `usePushSettings`
- `src/features/profile/` — `ProfileHeader`, `ProfileAbout`, `ProfileExperience`, `ProfileEducation`, `ProfileSkills`, `ProfileFeatured`, `ProfileContactInfo`, `ProfileActivity`, `ProfileAnalytics`, `ProfileViewers`, `ResumeExportButton`, plus editing modals (`ExperienceModal`, `EducationModal`, `FeaturedModal`, `EditProfileModal`)

**All implemented page routes** (`src/router/paths.ts` + lazy pages in `src/pages/`):
`/about`, `/login`, `/register` (entry), `/register/:token`, `/otp`, `/verify-otp`, `/forgot-password`, `/feed`, `/feed/:id` (post detail), `/jobs`, `/jobs/:id`, `/events`, `/events/:id`, `/messages`, `/messages/:id`, `/profile/:id`, `/groups`, `/groups/:id`, `/notifications`, `/news`, `/news/:id`, `/lost-found`, `/mentorship`, `/shuttle`, `/shuttle/drive` (driver GPS broadcast view), `/explore`, `/explore/tag/:tag`, `/connections` (displayed as "My Network"), `/saved`, `/settings` (+ sub-routes `/settings/notifications`, `/settings/appearance`, `/settings/account`, `/settings/privacy`), `/drafts`, `/learn`, `/admin`

**The app shell is role-aware and manifest-driven.** Two config files are the single source of navigation truth — never add a `user.role === '…'` branch to a component:

| File | Owns |
|------|------|
| `src/config/roleShell.ts` | `ROLE_SHELL[role]`: `home` (where `/` and the logo resolve), `rightRail` (`WidgetKey[]`), `stats` (`[StatSpec, StatSpec]`), plus `isRouteAllowedForRole()` — the driver allowlist **and the admin feed block** (`/feed`, `/feed/:id`) that `ProtectedRoute` consults, bouncing to `ROLE_SHELL[role].home` — and `statsFor(role, isOwnProfile)`. Search is global, so the placeholder is the module-level `SEARCH_PLACEHOLDER` constant, not a per-role field |
| `src/components/rightRail/index.ts` | `RIGHT_RAIL_WIDGETS`: the total `Record<WidgetKey, ComponentType>` — a manifest key with no widget is a compile error |
| `src/components/leftSidebar.config.ts` | `RAILS[role]`: `fixed` rows (max 5, driver 4), `contextual` rules, `tools`, and `secondary` |

- **The contextual zone is rule-driven and its signals come from `src/components/useRailContext.ts`.** A `CtxRule.when(ctx)` reads only keys on `RailContext`; the hook fills them and is the only place that fetches. Rules there:
  - **Every query is `enabled:`-gated by role** — the rail mounts on every authenticated page, so an ungated admin-only fetch would 403 on each one. A rule may only read a signal its role's API answers; `LeftSidebar.test.tsx` feeds each role the signals it is *not* entitled to and fails if any rule fires.
  - **Reuse the existing query key** of whatever widget or page already fetches that endpoint (`['admin','stats']`, `['mentorship','incoming',{…}]`, `['jobs','my']` — the last is a `useInfiniteQuery`, so the rail uses one too) and `staleTime` 60s. Derive counts from the cache; add an endpoint properly rather than over-fetching a list, unless a page already holds that exact list (admin invites).
  - **Sort order is pinned-first, then `TONE_RANK` descending**, capped at 2 with the remainder as `+n more`. A `pinned` rule (driver's "On duty now") can never land in that overflow. The zone freezes its rendered list while hovered so rows do not shuffle under the pointer.
  - Faculty has **no** rule but drafts, by design: no timetable, unanswered-query, grade-window or cross-group join-request data exists. An empty zone is the correct resting state — never approximate a rule with a hardcoded value.
- `secondary` holds what the 5-row cap pushed out. It renders in **both** the avatar menu (desktop) and the mobile More sheet — mobile has no avatar menu, so omitting either makes the route unreachable on a phone.
- `src/config/reachability.test.ts` walks every `PATHS` entry and fails if it is unreachable from the shell for every role. **A new page must join a rail or `secondary`**, or be listed as reached-by-context (detail pages, auth flows).
- Which role gets a row follows what the API lets that role *do*, not the mockups — faculty gets Jobs (`requireRole('alumni','faculty','admin')`) but not Mentorship (no faculty write access there).
- Rows can share a base path and differ only by query (`/admin?tab=…`), so `isActive` is query-aware and a `findIndex` picks exactly one active row — framer-motion's `layoutId="nav-active-pill"` must never mount twice.
- Rail deep links must use `AdminPage`'s own `Tab` values (`overview`/`users`/`reports`/`content-sync`/`deletion`/`shuttle`/…); `config/adminTabs.test.ts` parses that union from source to enforce it, across **every** zone — fixed, secondary, contextual and tools. A bare `/admin` with no `?tab=` fails that check: it silently lands on Overview whatever the row promised, which is how "Audit log" and "Broadcast" once pointed at screens that do not exist.
- **A tool tile is an external campus utility, or a destination no row in that role's rail already offers — never a second name for a row.** `roleShell.test.ts` fails a tile whose `to` matches any `fixed` or `secondary` row. It must also name something that exists: "Audit log", "Broadcast", "Attendance", "Trip log" and "Report issue" were all tiles for features with no screen and no endpoint, each silently landing on a page that had nothing to do with the label. The driver's `tools` is `[]` for the same reason its `rightRail` is — its whole surface is two routes, both fixed rows — and `LeftSidebar` drops the bordered "Campus tools" section entirely when the list is empty rather than rendering a titled empty box. Where a tile gives up a shared member surface (admin's shuttle tile points at the ops tab, not the rider map), that surface moves to `secondary`, or `reachability.test.ts`'s member-feature check fails.
- `/admin` renders **inside** `FeedLayout` — same grid, not a forked layout.
- **The right rail is manifest-driven, and `data-wide` is a consequence, not a route rule.** `RightSidebar` is a dispatcher over `ROLE_SHELL[role].rightRail`; each widget owns its own query and returns `null` when empty, so there is no role branch and no shared empty-state. `FeedLayout` sets `data-wide` on `.feed-layout-grid` when a role's list is empty (driver only) — keying that off the pathname instead would fork the layout the shell rule forbids.
- A widget only goes to roles whose API would answer it; `roleShell.test.ts` keeps a `gated` map for that (empty today — every surviving widget reads a member-open endpoint) so a widget that 403s can never ship. A widget that 403s is the "row that leads to a 403" the shell rule bans.
- **Each feature gets one home per zone — left rail, top bar, right rail — and the more capable control wins.** A right-rail widget must address something the rail cannot: a *specific* event, person or tag (`/events/:id`, `/profile/:id`, `?q=#tag`). A widget whose every row leads back to a page the rail already owns is that row a second time — that is why `mentee-requests` and `platform-today` were deleted (every destination was a fixed row, and their counts came from the very query the contextual zone already reads). `RightSidebar.test.tsx` asserts the surviving set. For the same reason `SectionHeader` takes only a `title`: the "See all" button linked out to `/events` and `/explore`, both left-rail rows, so passing one is now a compile error rather than a rule to remember. Likewise, the avatar menu filters out `TOPNAV_ICON_ROUTES` (Messages, Notifications): each has a badged icon with a peek popover inches away in the same bar. They stay in `secondary` regardless — the mobile More sheet renders that list verbatim and mobile hides both icons, so removing them from the manifest would strand them on a phone.
- **The four member roles carry the same number of widgets** (`roleShell.test.ts` enforces it); they differ in payload, not in rail length, so one role never looks under-served. `profile-progress` is the shared filler — `/users/me/progress` is own-profile so every role can answer it, and it retires itself at 100%.
- **The desktop rail and the mobile bar must agree on which row is lit and how it looks.** Both call `isRailRowActive()` from `leftSidebar.config.ts` (one matcher, not a copy each) and both mark the active row with `--uc-indigo*` — the interactive colour. `--uc-orange*` stays reserved for *your own activity* per the design rule.
- Sections that absorbed a former rail row, deep-linkable with the old route still valid: `/explore?section=lost-found`, `/groups?section=people` (deep-link only — the Groups page has a single "Groups" tab, and the people directory is reached from the invite panel / create-group modal links), `/feed?tab=` (`FEED_TABS`).
- **Pages whose default view is role-dependent put the role's own default *out* of the URL** and write the param only for the non-default, so a shared link stays clean: `/jobs` is `view=mine` for alumni and `view=browse` for everyone else. Read the param back defensively — a role that cannot use a view (a student on `view=mine`) falls back to its default rather than rendering an empty or forbidden panel.
- There is no separate faculty "sections" view any more: academic groups sit in the one Groups list behind the "Sections" type chip. Faculty's rail has Explore as a fixed row (not in `secondary`) in the slot that view used to take.
- **The profile card's two numbers are manifest-driven, and the role-scoped ones are computed server-side only for the role they describe.** `countRoleStats()` in `users/service.ts` fills `mentees` (alumni), `sections`/`students` (faculty) and `members`/`groups` (admin); they are **optional** on `publicUserProfileSchema.stats`, so absent means "not that role" while `0` means a real zero. Never add a stat to a role the API does not compute it for — `roleShell.test.ts` fails on that, since it would render a silent zero.
- `pendingReceived` is returned as `0` for anyone but the profile owner, so it is flagged `ownerOnly` and `statsFor()` swaps in `PUBLIC_STAT` (`posts`) for visitors. Any future owner-only count needs the same flag, or a visitor reads the placeholder zero as real.
- `groups` has **no** soft-delete column — do not add `is_deleted` to a groups query. `users` and `mentorship_requests` do have it.

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
- `src/constants/socket.ts` — Socket.io event name constants: `UNIVERSITY_EVENTS`, `CONNECTION_EVENTS` (`REQUEST_RECEIVED`, `ACCEPTED`), `CONTENT_SYNC_EVENTS`, `PRESENCE_EVENTS`

Zod schemas are the **single source of truth** for validation and TS types. Use `z.infer<typeof schema>` — never duplicate types manually. Schema naming: `camelCase` + `Schema` suffix (e.g. `createJobSchema`).

---

## TypeScript

Strict mode on everywhere. No `any` — use `unknown` + narrowing or a specific type. API response shapes: `{ data: T }` on success, `{ error: string, code: string }` on failure (defined in `packages/shared`).

---

## Design system (non-negotiable)

CSS tokens are in `apps/web/src/styles/tokens.css` and loaded globally via `src/styles/index.css`. Default theme: **Warm Futuristic Dark** — navy surfaces, UIU orange identity, indigo interactive. A **Warm Neutral Light** theme is also defined under `[data-theme='light']` in the same file (toggled via `theme_preference` on the `users` table and stored in `themeStore`). Full token reference is in `docs/DESIGN.md`.

| Rule | Detail |
|------|--------|
| No hardcoded hex | Always `var(--token-name)` — never raw `#rrggbb` in component code |
| Borders | `0.5px solid var(--border-*)` — never `1px` for structural borders |
| Depth | Surface stacking only (`--surface-page → --surface-card → --surface-raised`) — no `box-shadow` |
| Buttons | `border-radius: var(--r-pill)` exclusively — no sharp corners |
| Font weight | 400 and 500 only — never 600, 700, or 800 |
| Text case | Sentence case everywhere — no ALL CAPS or Title Case on UI labels/buttons |
| Coloured surfaces | Text on a coloured background must use the matching light token (e.g. `--uc-orange-l` on `--uc-orange-bg`) |
| Eyebrow labels | 11px `0.04em` section labels use `--text-label`; `--text-tertiary` is for 12px meta, timestamps and placeholders only |
| No glassmorphism | Never `backdropFilter` / `WebkitBackdropFilter`; use a solid `--overlay-bg-strong` |
| Self vs network | `--uc-orange*` signals *your own* activity, `--uc-indigo*` signals other people's — an unread-activity dot is indigo, never orange |

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
- Validate with `validate(schema)` or `validateRequest({...})` at the route level.
- Errors: throw named error helpers from services (e.g. `notFound()`, `badRequest()`); `errorHandler` middleware catches them.
- DB: Knex query builder. Raw SQL only when Knex genuinely cannot express the query.

---

## Database

- Migrations: `apps/api/src/database/migrations/`, filename `NNN_description.ts` (sequential number prefix, e.g. `020_create_mentorship.ts`). Never edit a committed migration — create a new one.
- **The one exception: fixing a broken `down()`.** The rule above protects `up()`, which has already run against real databases and will never re-run. A `down()` that has never successfully executed anywhere is different, and no new migration can repair a previous migration's `down()` — so edit it in place. Never touch a committed `up()`.
- **A `down()` that narrows a CHECK constraint must drop the constraint, fix the data, then re-add it — in that order, mirroring `up()`.** Getting it wrong fails two ways: rewriting rows while the old constraint is still live gives `new row … violates check constraint`, and re-adding the narrowed constraint while offending rows remain gives `violated by some row`. So fold or delete every row using the value being removed first. Prefer converting over deleting when rows carry dependents — deleting cascades. Worked examples: `073` deletes `driver` users, `092` folds `academic` groups to `other`, `047` folds `expired` mentorship requests to `declined`, `103` folds `job_promo` posts to `post`.
- Verify a rollback with the hostile data actually present (an expired request, an academic group, a driver user), not against an empty database — `047`'s bug stayed invisible for months because the test DB had no `expired` rows, while the 7-day auto-expiry job creates them in any environment that has run a week.
- Column defaults: `id` UUID (`uuid_generate_v4()`), `university_id` UUID FK indexed, `created_at`/`updated_at` timestamptz default `now()`.
- Always index FK columns used in WHERE, and `(university_id, created_at DESC)` on high-volume tables.
- Soft deletes: `is_deleted boolean default false` — not `deleted_at`.
- Redis keys: `{prefix}:{university_id}:{id}`. Never hardcode TTL values — centralise them (see `src/config/redis.ts` for the client; OTP TTL lives in env `OTP_EXPIRES_MINUTES`).
- DB schema domains: Core/Auth, Social Feed, Job Board, Events, Groups, Messaging, Notifications/News, Campus Tools, Engagement (mentorship, badges, reports), Connections (`connections`), Profile sections (`profile_experiences`, `profile_education`, `profile_featured`, `profile_views`), Settings (`user_settings`, `push_subscriptions`), Content sync (`content_sync_runs`, `content_attachments`), Audit (`university_audit_log`).
- Latest migration: `110_add_group_chat_conversation` (`groups.chat_conversation_id` FK, backing the academic class group chat). **Start the next migration at `111_`.**
- Migration landmarks worth knowing: the `follows` table no longer exists (dropped in `052_drop_follows`); `user_settings` (`065`, notification + privacy JSONB); `push_subscriptions` (`066`); `users.deactivated_at` (`067`); `users.last_seen` (`069`); generated `search_vector` columns (`070`); `posts` feed-ranking columns (`071`); `posts` lifecycle columns (`072_add_post_lifecycle`); per-university-unique `users.username` (`072_add_username_to_users`); `driver` role + shuttle estimation params (`073`); generalized content attachments (`077`); user moderation (`078`); account deletion requests (`079`); message reactions/stickers (`081`–`082`); learning tables + badges (`085`–`087`); group study tools — flashcard decks, shared notes (`088`); daily quiz (`089`–`090`); `ai_quiz_pool` (`091`); the `academic` group type (`092`); course outline + academic LMS tables (`093`–`094`); session notes (`096`); AI learning/quiz settings (`097`–`100`); the `job_promo` post type (`103`).
- Column names that differ from the obvious guess (verify with `psql -d <db> -c '\d <table>'` before writing a fixture): `groups.is_private` (not `privacy`); `group_members` has a composite `(group_id, user_id)` primary key and **no** `id` column.
- **Two migration-number collisions exist:** two `072_` files (`072_add_post_lifecycle`, `072_add_username_to_users`) and two `098_` files (`098_add_ai_quiz_settings`, `098_add_skill_path_source_and_quiz_approval`). Never re-use a prefix — check `ls apps/api/src/database/migrations | tail -1` before creating one.

---

## Testing

### Backend integration tests

The test setup is in `apps/api/src/__tests__/setup.ts`. It:
1. Runs pending migrations against `DATABASE_URL` (there is no `TEST_DATABASE_URL` — point `DATABASE_URL` at a scratch DB)
2. Upserts four seed users (admin, faculty, alumni, student) with known credentials
3. Exports `loginAs(email, password)` → `{ accessToken, cookie }` for authenticated requests

All supertest requests must include `.set('x-university-domain', DOMAIN)`. Use `loginAs()` to get the bearer token.

**Running them without Docker.** There is no committed `.env`, so a bare `pnpm --filter api test` dies in `config/env.ts`. Every var has a default except `GEMINI_API_KEY`. Point it at any Postgres (a local `brew services` instance is fine) and pass env inline rather than writing a `.env`:

```bash
createdb uniconnect_test && psql -d uniconnect_test -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; CREATE EXTENSION IF NOT EXISTS pg_trgm;'
DATABASE_URL="postgresql://$(whoami)@localhost:5432/uniconnect_test" GEMINI_API_KEY=test-key npx pnpm --filter api test
```

`ai.service.test.ts` logs many "Gemini call failed" warnings — it is exercising the retry path on purpose, not a failure.

### Frontend tests

React tests: `@testing-library/react` + `user-event`. Test behaviour, not implementation. Mock HTTP with MSW handlers at `src/tests/msw/handlers.ts`.

- **Run `npx pnpm --filter @uniconnect/shared build` first** if `packages/shared/dist/` is absent, or every web test importing it fails with `Failed to resolve entry for package "@uniconnect/shared"`.
- **MSW paths must start with the `*` wildcard** (`*/groups/:id/ai-settings`). `VITE_API_URL` is unset under vitest, so the axios baseURL is literally `"undefined/api/v1"` and a handler pinned to an absolute origin never matches — the component just hangs in "Loading…". Grep the output for `[MSW] Error: intercepted a request` when that happens.
- **jsdom has no `IntersectionObserver`**; infinite-scroll pages (feed, groups, lost & found) need `vi.stubGlobal('IntersectionObserver', NoopObserver)`.
- Mocking the hook layer cannot catch a bug in the hook — cover cache/optimistic-update behaviour over MSW instead (`AISettingsPanel.toggles.test.tsx`).

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

`apps/api/.env` (see `.env.example`): `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `CLIENT_URL` (comma-separated list of allowed CORS origins), `AWS_S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`. Cloudflare R2 support: additionally set `AWS_ENDPOINT` (R2 endpoint URL) and `AWS_PUBLIC_URL` (public bucket base URL).

`apps/web/.env`: `VITE_API_URL=http://localhost:3001`, `VITE_SOCKET_URL=http://localhost:3001`, `VITE_UNIVERSITY_DOMAIN=uiu.ac.bd`.

### Dev seed

`npx pnpm --filter api db:seed` inserts UIU (domain `uiu.ac.bd`) and one reusable invitation: token `dev-invite`, email `student@uiu.ac.bd`, role `student`. Use this invite token to register the first account. No admin user is seeded — promote via `PATCH /admin/users/:id/role` or directly in the DB after registering.

### Deployment

Azure App Service (CI/CD via GitHub Actions on `main`). The frontend can alternatively be deployed to Vercel (`vercel.json`). Production start command runs `db:migrate:prod` before starting the server.

## Screenshots

`screenshots/` holds reference PNG captures of every built page — used by Figma design sessions as the source of truth for what the live app looks like.

**After any UI change to `apps/web/src/`, update the affected page screenshot(s):**

```bash
node scripts/screenshot.cjs <name>   # single page
node scripts/screenshot.cjs all      # all pages
```

| Name | Route | Auth needed |
|---|---|---|
| `landing` | `/` | no |
| `about` | `/about` | no |
| `feed` | `/feed` | yes |
| `profile` | `/profile/:devId` | yes |
| `login` | `/login` | no |
| `login-mob` | `/login` (390×844) | no |
| `register` | `/register` | no |
| `otp` | `/otp` | no |
| `learn` | `/learn` | yes |
| `groups` | `/groups` | yes |
| `groups-people` | `/groups?section=people` | yes |
| `saved` | `/saved` | yes |
| `explore` | `/explore` (discovery carousels) | yes |
| `explore-search` | `/explore?q=machine+learning` (search tabs with counts) | yes |
| `explore-see-all` | `/explore?see=groups` (in-page See all view) | yes |
| `admin-learning` | `/admin?tab=learning` (admin role via `dev-role=admin`) | yes |
| `group-detail` | `/groups/:devGroupId` (member view) | yes |
| `group-detail-admin` | `/groups/:devGroupId` (owner view via `dev-role=faculty`) | yes |
| `groups-mobile` | `/groups/:devGroupId` (390×844) | yes |

Rules:
- Requires Vite dev server running (`npx pnpm --filter web dev`, port 5173). No backend needed.
- Pages that require auth use `?dev-auth=1` — `AuthLoader` detects this in DEV mode and seeds a mock user, bypassing the real refresh/login flow entirely. Add `&dev-role=admin|faculty|alumni` to seed that role (a route's `role` field in `screenshot.cjs`). In this mode the axios dev adapter never reaches a real API and the socket never connects — a live `:3001` would 401 the fake bearer and log the mock user out.
- Public marketing pages also expose a small matrix: `landing|about`, `*-light`, `*-mobile`, `*-mobile-light`.
- Replace the old screenshot — never keep both. The file in `screenshots/` is always the current state.
- When adding a new page to `ROUTES` in `scripts/screenshot.cjs`, also add a row to this table.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
