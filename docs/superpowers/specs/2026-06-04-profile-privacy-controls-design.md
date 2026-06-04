# Profile Privacy Controls — Design Spec

**Date:** 2026-06-04
**Status:** Draft design, pre-implementation
**Scope:** Per-user privacy controls that gate who can see each section of a profile, who can contact / connect, and whether the profile is discoverable — enforced at the service layer and surfaced in the `/settings/privacy` slot reserved by the notifications bundle.

> Sub-project 2 of the 6-feature decomposition. Depends on the Settings shell + `user_settings` table delivered by the [notifications bundle](2026-06-04-notifications-bundle-design.md) (it fills the `/settings/privacy` placeholder and adds a second JSONB column to the same table). Online-status visibility is **defined here** but consumed by [online presence](2026-06-04-online-presence-design.md). Search discoverability is **defined here** but consumed by [full-text search](2026-06-04-fulltext-search-design.md).

---

## 1. Goals

1. **Audience tiers** for profile sections — each gated to `everyone` | `connections` | `only_me`. ("Everyone" always means *authenticated users within the same university* — there is no anonymous/cross-tenant access in this app.)
2. **Per-section granularity** (not per-field) over a fixed set of profile sections: contact info, experience, education, connections list, activity.
3. **Contact gates** — who can send a connection request, and who can send a direct message (generalises the existing `is_open_to_msg` boolean into a tier).
4. **Discoverability** — whether the profile appears in People search and "people you may know" suggestions.
5. **Online-status visibility** tier (consumed by the presence feature).
6. A single enforcement chokepoint so every read path that exposes a user's profile honours the same rules — including the **deactivated-author hiding** the notifications bundle deferred.

Non-goals: per-field (vs per-section) toggles, granular audience lists / "close friends" circles, message-request inbox for blocked-but-allowed senders, profile-view anonymity ("view privately"), GDPR export/delete (separate concern). User **blocking** is specified here but flagged as splittable (§7).

---

## 2. Decisions log

| Decision | Choice |
|---|---|
| Granularity | Per-**section**, not per-field — five gated sections + three gate/flag settings |
| Audience model | Three tiers: `everyone` (same-university authed) · `connections` · `only_me` |
| Always-visible core | Name, avatar, headline, role, department, batch — never hideable (needed for search results, mentions, message lists) |
| Storage | **Reuse `user_settings`** — add a `privacy_preferences` JSONB column (no new table) |
| Defaults | Open by default (`everyone`) to preserve current behaviour; contact gates default to current effective values |
| Enforcement point | `profilePrivacyService.filterProfileForViewer()` + `canViewSection()`, called from `users` service reads |
| Self-view | Owner always sees everything; API never strips for `viewerId === targetUserId` |
| Deactivated authors | Folded in here: the same chokepoint treats `deactivated_at IS NOT NULL` as hard-hidden to everyone but the owner and admins |
| Blocking | Included as an optional `user_blocks` table; can split to a follow-up if it balloons |

---

## 3. Privacy model

### 3.1 Gated sections (audience tier each)

| Key | Covers | Default |
|---|---|---|
| `contact_info` | email, phone, `website_url`, `github_url`, `portfolio_url`, `linkedin_url`, `location` | `connections` |
| `experience` | `profile_experiences` rows | `everyone` |
| `education` | `profile_education` rows | `everyone` |
| `connections_list` | `GET /users/:id/connections` (a user's accepted connections) | `everyone` |
| `activity` | `ProfileActivity` (recent posts/reactions on the profile) | `everyone` |

**Always-visible core** (never gated): `full_name`, `avatar_url`, `headline`, `role`, `department`, `batch_year`. These power search, mentions, message lists, and connection cards, so hiding them would break unrelated surfaces.

`profile_views` / analytics / viewers are already owner-only (existing behaviour) — unchanged, not part of this matrix.

### 3.2 Gate / flag settings

| Key | Type | Default | Effect |
|---|---|---|---|
| `connection_requests` | `everyone` \| `only_me` | `everyone` | `only_me` ⇒ `POST /connections/request/:userId` returns `403` |
| `messages` | `everyone` \| `connections` \| `only_me` | derived from `is_open_to_msg` | gates DM initiation; `only_me` ⇒ no one can open a new DM |
| `discoverable` | boolean | `true` | `false` ⇒ excluded from People search + suggestions (still reachable by direct link / existing connections) |
| `online_visibility` | `everyone` \| `connections` \| `only_me` | `connections` | consumed by presence: who receives your online/last-seen status |

> `messages` supersedes the `profiles.is_open_to_msg` boolean. Migration backfills `connections`→`everyone` mapping: `is_open_to_msg = true` → `everyone`, else `connections`. The boolean column is kept (read by nothing new) to avoid a destructive change; mark deprecated in code comments.

### 3.3 Tier evaluation

`canView(viewerId, targetUserId, tier)`:

```
if viewerId === targetUserId            -> true   (owner)
if viewer is admin/faculty (moderation) -> true   (see §6 caveat)
if target is deactivated                -> false  (unless owner/admin)
switch tier:
  'everyone'    -> true
  'connections' -> isAcceptedConnection(viewerId, targetUserId)
  'only_me'     -> false
```

`isAcceptedConnection` reuses the `connections` table (`status = 'accepted'`, either direction).

---

## 4. Data model

### 4.1 Migration `068_add_privacy_preferences.ts`

Add one JSONB column to the existing `user_settings` table (created in the notifications bundle, migration 065).

```
user_settings
  + privacy_preferences  jsonb not null default '{}'
```

Shape (missing keys fall back to §3 defaults via deep-merge):

```json
{
  "sections": {
    "contact_info": "connections",
    "experience": "everyone",
    "education": "everyone",
    "connections_list": "everyone",
    "activity": "everyone"
  },
  "connection_requests": "everyone",
  "messages": "connections",
  "discoverable": true,
  "online_visibility": "connections"
}
```

### 4.2 Migration `069_create_user_blocks.ts` *(optional — see §7)*

```
user_blocks
  id              uuid pk default uuid_generate_v4()
  blocker_id      uuid not null references users(id) on delete cascade
  blocked_id      uuid not null references users(id) on delete cascade
  university_id   uuid not null references universities(id)
  created_at      timestamptz default now()
  unique (blocker_id, blocked_id)
  index (blocked_id)
```

A block is symmetric for visibility: neither party sees the other's profile, neither can message or send a connection request, and an existing connection is severed on block.

> Migration numbers are indicative. These specs build in independent cycles — confirm the next free `NNN` against `apps/api/src/database/migrations/` at implementation time. (Latest committed today is `067`.)

---

## 5. Shared package additions (`packages/shared`)

- `src/constants/privacy.ts`
  - `PRIVACY_SECTIONS = ['contact_info','experience','education','connections_list','activity'] as const`
  - `AUDIENCE_TIERS = ['everyone','connections','only_me'] as const`
  - `DEFAULT_PRIVACY_PREFERENCES` (§4.1 shape)
- `src/schemas/privacy.ts`
  - `privacyPreferencesSchema` — partial object; `sections` keyed by `PRIVACY_SECTIONS` with `AUDIENCE_TIERS` enum values; the gate/flag fields each their own enum/boolean. All optional (partial updates merge).
- Types via `z.infer` (`PrivacyPreferences`, `AudienceTier`, `PrivacySection`).

---

## 6. Backend

### 6.1 Enforcement chokepoint (`users` module)

New `src/modules/users/privacy.service.ts`:

- `loadPrivacy(userId)` → `user_settings.privacy_preferences` deep-merged over `DEFAULT_PRIVACY_PREFERENCES`.
- `canViewSection(viewerId, target, section)` → boolean per §3.3.
- `filterProfileForViewer(viewer, profile)` → returns the profile with disallowed sections stripped and a parallel `visibility` map (`{ contact_info: 'hidden' | 'visible', ... }`) so the client can render "private" states without guessing.

Wire into existing reads:
- `GET /users/:userId` (`getUser`) — strip contact info / activity per tier; still upsert `profile_views` only when the viewer is allowed to see the profile at all.
- `GET /users/:userId/experience`, `/education`, `/connections` — return `403`/empty per the corresponding tier.
- `GET /users/suggestions` and People search — exclude `discoverable === false` and blocked users.
- Connection request (`POST /connections/request/:userId`) — reject when target `connection_requests === 'only_me'` or a block exists (`forbidden()`).
- DM creation (`messages` module, new-conversation path) — reject per `messages` tier / block.

**Deactivated authors:** `filterProfileForViewer` and the list-level filters treat `users.deactivated_at IS NOT NULL` as hidden to everyone but owner/admin. This is the concrete landing place for the notifications-bundle §10 "deactivate content hiding" item. Enumerate and patch the author-exposing read paths: **feed, comments, connections lists, People search, suggestions, messages, groups member lists, mentorship**. A shared `db` helper scope (`whereActiveAuthor`) keeps it DRY.

> **Admin/faculty caveat:** moderation needs to see reported content authored by private/deactivated users. `canView` grants admin/faculty an override *for moderation surfaces only* (admin module, reports) — **not** for normal profile browsing. Keep the override explicit (a `forModeration` flag on the call), never a blanket role bypass, so a faculty member browsing the app still sees other users' privacy honoured.

### 6.2 Privacy preferences API (extend `users` module)

- `GET  /api/v1/users/me/privacy` → merged effective privacy prefs.
- `PUT  /api/v1/users/me/privacy` → validate `privacyPreferencesSchema`, upsert `user_settings`, return merged result.

Router: `resolveUniversity` + `requireAuth`. Logic in `users/privacy.service.ts`. Responses via `sendSuccess`. `university_id` from `req.university.id`.

### 6.3 Blocking API (optional, `users` module)

- `POST   /api/v1/users/:userId/block` — insert `user_blocks`, sever any `connections` row, withdraw pending requests both ways.
- `DELETE /api/v1/users/:userId/block` — remove block (does not restore the connection).
- `GET    /api/v1/users/me/blocks` — list blocked users (owner only).

---

## 7. Frontend (`apps/web`)

### 7.1 Privacy settings section

Fills the `/settings/privacy` route the notifications bundle stubbed (`PrivacyPlaceholder` → `PrivacyPanel`):

- `PrivacyPanel` — one row per gated section with an audience `<select>` (everyone / connections / only me); separate controls for connection requests, messages, discoverable (toggle), and online visibility.
- Hooks: `usePrivacyPreferences()` (GET) + `useUpdatePrivacyPreferences()` (PUT, invalidates `['users','me','privacy']`). Optimistic toggle acceptable.
- `BlockedUsersPanel` (if §6.3 shipped) — list + unblock, plus a "Block" action surfaced from the profile header overflow menu.

### 7.2 Profile rendering

Profile components (`ProfileContactInfo`, `ProfileExperience`, `ProfileEducation`, `ProfileConnections`, `ProfileActivity`) read the `visibility` map the API returns and:
- render nothing (or a subtle "This information is private" placeholder) for hidden sections when viewing **someone else**;
- when viewing **your own** profile, render everything plus a small "Only you / Connections" badge per gated section so you can preview what others see (a "View as connections / view as everyone" preview toggle is a nice-to-have, out of scope for v1).

`ConnectButton` / message CTA respect `connection_requests` / `messages` gates (disabled with a tooltip when not permitted) — the server enforces regardless.

---

## 8. Multi-tenancy & security

- `privacy_preferences` and `user_blocks` carry `university_id` from `req.university.id` — never the body.
- Server-side enforcement is authoritative; the client `visibility` map is a rendering hint only — never trust it for access decisions.
- Block checks run **before** profile/message/connection reads; a blocked viewer gets the same "not found / forbidden" shape as a non-existent user (no information leak about block existence).
- The admin/faculty moderation override is scoped to moderation endpoints only (§6.1 caveat).

---

## 9. Testing

**API (integration, supertest + `x-university-domain`):**
- Defaults: no `user_settings` row ⇒ everything `everyone` except `contact_info`/`online_visibility` = `connections`.
- `only_me` contact info hidden from a connection and a stranger, visible to owner.
- `connections` section: visible to an accepted connection, hidden from a non-connection.
- `discoverable = false` ⇒ absent from People search + suggestions, still reachable by direct `GET /users/:id`.
- Connection-request gate `only_me` ⇒ `403`; message gate enforced.
- Deactivated author hidden from feed/comments/search but visible to admin moderation endpoint.
- Block: severs connection, hides both profiles, blocks messaging; unblock restores visibility but not the connection.
- Preferences PUT round-trips and partial-merges.

**Web (RTL + MSW):**
- Privacy panel renders defaults, mutation fires + invalidates.
- Other-user profile hides gated sections per `visibility` map; own profile shows all + badges.
- Connect/message CTAs disable per gate.

---

## 10. Risks & open items

- **Read-path enumeration** is the broadest surface (same risk the notifications bundle flagged). The deactivated-author + privacy filters must touch every author-exposing query; a shared `whereActiveAuthor` scope plus a checklist of modules (feed, comments, connections, search, suggestions, messages, groups, mentorship) is the mitigation. If it balloons, split blocking (§6.3/§4.2) to a follow-up and ship section gating first.
- **`is_open_to_msg` migration** — confirm current readers of the boolean before generalising to the `messages` tier; keep the column to avoid a destructive change.
- **Performance** — `connections`-tier checks add a connection lookup per profile read; batch via the existing connection-status join already used in People search rather than N+1 lookups.
- **Migration number** — confirm next free `NNN` at implementation (latest committed is `067`).

---

## 11. Out of scope (future specs)

Per-field privacy · audience circles / close-friends · profile-view anonymity · message-request inbox · data export/delete · cross-university visibility.
