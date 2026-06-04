# Notifications Bundle — Design Spec

**Date:** 2026-06-04
**Status:** Approved design, pre-implementation
**Scope:** One cohesive spec covering three coupled features — a Settings shell, notification preferences, and Web Push — that share a single preference gate.

> This is sub-project 1 of a 6-feature decomposition. The remaining specs (profile privacy controls, online presence, feed ranking, Postgres full-text search) are out of scope here and get their own spec → plan → implementation cycles.

---

## 1. Goals

1. A reusable `/settings` shell (sidebar/nested layout) hosting four sections: Notifications, Appearance, Account, Privacy (stub).
2. Per-user **notification preferences** — a 5-category × 2-channel matrix — enforced at a single backend chokepoint.
3. **Web Push** delivery (VAPID + service worker), opt-in per device, gated by the push channel preference.
4. An **Account** section: read-only account info, change password, active sessions management, reversible account deactivation.

Non-goals: email-on-notification, native mobile push, profile privacy controls, offline/PWA caching, `new_login` alerts.

---

## 2. Decisions log

| Decision | Choice |
|---|---|
| Push mechanism | Web Push API + VAPID + hand-written service worker (no FCM, no third-party) |
| Channels controlled | In-app + Push (email deferred) |
| Preference granularity | Per-category × per-channel |
| Settings IA | Full: Notifications, Appearance (relocated theme), Account, Privacy (stub) |
| Account section | Read-only info + change password + active sessions + reversible deactivate |
| Always-on category | 6th "System" category, no toggles, always delivered |
| Preference storage | `user_settings` table, single JSONB column |
| Enforcement point | `notificationsService.createNotification` |
| Deactivate semantics | Reversible: `status = 'deactivated'`, revoke sessions, hide content, reactivate on login, no deletion |

---

## 3. Notification categories & type mapping

Six categories. The first five are user-controllable (in-app + push toggles each); **System** is always delivered.

| Category | Notification `type` values (existing + new) |
|---|---|
| `connections` | `connection_request`, `connection_accepted` |
| `feed` | `post_reaction`, `post_comment` |
| `groups` | `group_join_request`, `group_join_approved`, `group_join_declined`, `group_invite`, `group_pinned_update`, `group_study_session_created` |
| `mentorship` | `mentorship`, `mentorship_request_declined`, `request_reminder`, `request_expire` |
| `messages` | `message:new` |
| `system` (always-on) | `system`, `password_changed` |

Any `type` not present in the map defaults to the `system` category (fail-safe: always delivered, never silently dropped).

---

## 4. Data model

### 4.1 Migration `065_create_user_settings.ts`

One row per user, created lazily on first preference write.

```
user_settings
  id                        uuid pk default uuid_generate_v4()
  user_id                   uuid not null references users(id) on delete cascade, unique
  university_id             uuid not null references universities(id)   -- indexed
  notification_preferences  jsonb not null default '{}'
  created_at                timestamptz default now()
  updated_at                timestamptz default now()
```

`notification_preferences` shape (missing keys fall back to defaults — all on):

```json
{
  "connections": { "in_app": true, "push": true },
  "feed":        { "in_app": true, "push": true },
  "groups":      { "in_app": true, "push": true },
  "mentorship":  { "in_app": true, "push": true },
  "messages":    { "in_app": true, "push": true }
}
```

### 4.2 Migration `066_create_push_subscriptions.ts`

Multiple rows per user (multi-device).

```
push_subscriptions
  id             uuid pk default uuid_generate_v4()
  user_id        uuid not null references users(id) on delete cascade   -- indexed
  university_id  uuid not null references universities(id)
  endpoint       text not null unique
  p256dh         text not null
  auth           text not null
  user_agent     text
  created_at     timestamptz default now()
  last_used_at   timestamptz default now()
```

### 4.3 Migration `067_add_deactivated_status.ts`

`users` gains a deactivated state. If `users.status` already exists, extend the allowed values; otherwise add it. Confirm the column shape during implementation.

```
users.status  -> add 'deactivated' as an allowed value (default 'active')
```

---

## 5. Shared package additions (`packages/shared`)

- `src/constants/notifications.ts`
  - `NOTIFICATION_CATEGORIES = ['connections','feed','groups','mentorship','messages','system'] as const`
  - `USER_CONTROLLABLE_CATEGORIES` (excludes `system`)
  - `NOTIFICATION_CATEGORY_MAP: Record<string, NotificationCategory>` (type → category, per §3)
  - `DEFAULT_NOTIFICATION_PREFERENCES` (all on)
- `src/schemas/notifications.ts`
  - `notificationPreferencesSchema` — object keyed by the five controllable categories, each `{ in_app: boolean, push: boolean }`, all optional (partial updates allowed).
- `src/schemas/push.ts`
  - `pushSubscribeSchema` — `{ endpoint: string.url(), keys: { p256dh: string, auth: string } }`
- `src/schemas/auth.ts` (extend)
  - `changePasswordSchema` — `{ currentPassword, newPassword }` (newPassword reuses existing password strength rules)
- Types via `z.infer` — no manual duplication.

---

## 6. Backend

### 6.1 Preference enforcement (the chokepoint)

`notificationsService.createNotification(input)` is the single funnel for every notification (direct callers + the `notification` Bull worker). New logic:

```
1. category = NOTIFICATION_CATEGORY_MAP[input.type] ?? 'system'
2. if category === 'system':  // always-on
     create DB row + emit socket + enqueue push (if subscribed)
     return
3. prefs = loadPreferences(userId)   // defaults all-on if no row
4. if prefs[category].in_app:  create DB row + emit socket   (else skip)
5. if prefs[category].push:    enqueuePush(userId, payload)  (independent of step 4)
```

- Channels are independent: push fires from a self-contained payload (title, body, url) and does not depend on the in-app DB row existing.
- `loadPreferences` reads `user_settings.notification_preferences`, deep-merged over `DEFAULT_NOTIFICATION_PREFERENCES`.
- This preserves current behavior for any user who never touches settings (everything on).

### 6.2 Preferences API (extend `notifications` module)

- `GET  /api/v1/notifications/preferences` → merged effective prefs for the current user.
- `PUT  /api/v1/notifications/preferences` → validate with `notificationPreferencesSchema`, upsert `user_settings` row, return merged result.

Router applies `resolveUniversity` + `requireAuth`. Validation via `validate(notificationPreferencesSchema)`. Logic in `notifications/service.ts`. Responses via `sendSuccess`.

### 6.3 Push module (new `apps/api/src/modules/push/`)

Standard module shape (`router/controller/service/schema/index`).

- `POST   /api/v1/push/subscribe` — upsert a `push_subscriptions` row keyed by `endpoint` (idempotent). Body validated by `pushSubscribeSchema`. `user_id`/`university_id` from `req` context, never the body.
- `DELETE /api/v1/push/subscribe` — delete by `endpoint` (body or query). Used on explicit opt-out.

VAPID public key is delivered to the client via `VITE_VAPID_PUBLIC_KEY` (build-time env) — no runtime endpoint needed.

### 6.4 Push queue + worker

- New Bull queue `push` (`apps/api/src/queues/push.queue.ts`) on Redis.
- New worker `apps/api/src/workers/push.worker.ts` (runs in the existing worker process):
  - Job payload: `{ userId, notification: { title, body, url, icon? } }`.
  - Loads all `push_subscriptions` for the user, sends each via `web-push.sendNotification` signed with VAPID.
  - On `404`/`410` response → delete that subscription (dead endpoint). On other errors → log via `logger`, do not crash the job for the whole batch.
  - Update `last_used_at` on success.
- `enqueuePush` helper enqueues; never sends inline from an HTTP handler.
- New dependency: `web-push` (api workspace). Watch the `pnpm-workspace.yaml` `allowBuilds` trap for any post-install script.
- New env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (add to `.env.example`).

### 6.5 Account endpoints (extend `auth` + `users` modules)

`auth` module:
- `POST   /api/v1/auth/change-password` — `requireAuth`; verify `currentPassword` against `password_hash` (bcrypt), reject if absent/mismatch (`unauthorized`/`badRequest`), re-hash `newPassword` at cost 12, update. On success emit a **System** `password_changed` notification. Optionally revoke other sessions (keep current).
- `GET    /api/v1/auth/sessions` — list current user's `user_sessions`: `id`, `device_info`, `ip_address`, `created_at`, and an `is_current` flag (match the request's refresh token). Never return the raw `refresh_token`.
- `DELETE /api/v1/auth/sessions/:id` — revoke one session (must belong to the user).
- `DELETE /api/v1/auth/sessions` — revoke all (reuses `tokenService.revokeAllUserSessions`).

`users` module:
- `GET    /api/v1/users/me` — already returns profile; ensure it surfaces account info (email, role, university, joined date) for the read-only panel (extend if missing).
- `POST   /api/v1/users/me/deactivate` — set `users.status = 'deactivated'`, revoke all sessions. Profile/content becomes hidden from other users (service-layer filters exclude deactivated authors). Reactivation: on next successful login the status flips back to `active` (handled in `auth.service.login`). No data deleted.

---

## 7. Frontend (`apps/web`)

### 7.1 Settings shell

- New paths in `src/router/paths.ts`: `SETTINGS: '/settings'` plus child paths `/settings/notifications`, `/settings/appearance`, `/settings/account`, `/settings/privacy`.
- New feature bundle `src/features/settings/` (`components/`, `hooks/`, `index.ts`).
- A `SettingsLayout` with a left nav (sentence-case labels) and nested route outlet. Lazy-loaded via the `page()` helper. Default redirect `/settings` → `/settings/notifications`.
- Protected route (`requireAuth`).

### 7.2 Notifications section

- `NotificationPreferencesPanel` — renders the 5-category × 2-channel matrix (rows = categories, columns = In-app / Push toggles).
- Data via TanStack Query: `useNotificationPreferences()` (GET) + `useUpdateNotificationPreferences()` mutation (PUT) that invalidates on success. Query key `['notifications','preferences']`.
- **Push opt-in toggle** ("Enable push on this device"):
  - Reflects `Notification.permission` + whether a subscription exists.
  - On enable: `Notification.requestPermission()` → if granted, `serviceWorker.register('/sw.js')` (if not already) → `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VITE_VAPID_PUBLIC_KEY })` → `POST /push/subscribe`.
  - On disable: `pushManager.getSubscription().unsubscribe()` → `DELETE /push/subscribe`.
  - Never auto-prompt on app load.

### 7.3 Appearance section

- Relocates the existing theme control into `/settings/appearance`. Reuses `themeStore` and `updateUserPreferences` — **no backend change**. The header/menu theme toggle can remain or link here (keep existing for now).

### 7.4 Account section

- `AccountInfoPanel` — read-only email, role, university, joined date (from `users/me`).
- `ChangePasswordForm` — current + new + confirm; calls `POST /auth/change-password`.
- `ActiveSessionsPanel` — lists sessions from `GET /auth/sessions`; per-row "Revoke" + a "Log out everywhere" action; current session badged and non-revocable from the list.
- `DeactivateAccountPanel` — confirmation dialog → `POST /users/me/deactivate` → on success clears auth and redirects to login.

### 7.5 Privacy section

- `PrivacyPlaceholder` — a simple "Coming soon" panel. Reserves the route/nav slot for the next spec.

### 7.6 Service worker

- `apps/web/public/sw.js` — minimal, push-only:
  - `push` event → `self.registration.showNotification(title, { body, data: { url }, icon })`.
  - `notificationclick` event → focus an existing client on `url` or open a new window.
  - No precaching, no offline strategy, no Workbox.
- New env: `VITE_VAPID_PUBLIC_KEY` (add to `apps/web/.env` docs).

---

## 8. Multi-tenancy & security

- `user_settings` and `push_subscriptions` both carry `university_id` from `req.university.id` — never the body.
- Sessions endpoints scope strictly to the authenticated `userId`; `:id` revoke verifies ownership.
- `change-password` requires the current password; refresh-token revocation policy decided in implementation (recommend: keep current session, offer "log out everywhere" separately).
- Refresh tokens are never returned by the sessions list.
- Deactivated users: login flow must treat `deactivated` as reactivatable (not as a hard block) while service-layer reads exclude deactivated authors from other users' views.

---

## 9. Testing

**API (integration, supertest + `x-university-domain`):**
- Preferences GET returns defaults when no row; PUT upserts and round-trips; partial update merges.
- Enforcement: in-app off → no `notifications` row + no socket emit; push off → no push enqueue; System type bypasses both toggles; unknown type → treated as System.
- Push: subscribe is idempotent on `endpoint`; unsubscribe deletes; worker prunes on mocked 410 (mock `web-push`).
- Account: change-password rejects wrong current password, succeeds + emits `password_changed`; sessions list excludes refresh token + flags current; revoke-one and revoke-all; deactivate sets status + revokes sessions; login reactivates.

**Web (RTL + MSW):**
- Settings layout renders nav + default redirect.
- Matrix toggle fires mutation and invalidates query.
- Push opt-in flow with mocked `Notification` + `navigator.serviceWorker` (granted / denied paths).
- Change-password, sessions, deactivate happy paths.

---

## 10. Risks & open items

- **`users.status` shape** — confirm whether the column exists and its current allowed values before writing migration `067`. Adjust migration accordingly.
- **Deactivate content hiding** — auditing every service read path that exposes authors is the broadest surface; implementation should enumerate them (feed, comments, connections, search, messages) and add a deactivated-author filter. If this balloons, the content-hiding portion can be split into a follow-up.
- **Browser push support** — Safari/iOS Web Push requires the app be added to the home screen; the opt-in UI should degrade gracefully when `PushManager` is unavailable.

---

## 11. Out of scope (future specs)

Profile privacy controls · online presence · feed ranking algorithm · Postgres full-text search · email-on-notification · native mobile push.
