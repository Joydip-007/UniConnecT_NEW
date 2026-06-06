# Usernames — design spec

**Date:** 2026-06-06
**Status:** Approved, ready for implementation plan
**Scope:** Sub-project A of two. Sub-project B (subdomain tenant routing) is a separate, later spec.

## Goal

Give every user a human-readable `username` and a vanity profile URL:

```
https://www.uniconnectt.me/profile/<username>
```

Usernames are **user-chosen and editable**, **unique per university** (case-insensitive), and resolve to exactly one person on the current single-tenant deployment. Per-university uniqueness keeps the design forward-compatible with future subdomain-based multi-tenant routing without rework.

## Key decisions

| Decision | Choice | Rationale |
|---|---|---|
| Source | User-chosen, editable | Familiar vanity-URL pattern (LinkedIn/GitHub/X). |
| Uniqueness scope | Per-university (case-insensitive) | Keeps multi-tenant isolation pure; current deployment is single-tenant at the web layer so it still resolves unambiguously on `www.uniconnectt.me`. |
| Routing relationship | Username is a **public alias**; UUID stays **canonical** | UUID remains the internal id for all FKs, API params, socket rooms. Lowest risk, no churn to existing `/profile/<uuid>` links. |
| Where it lives | `users.username` | `users` already carries `university_id` for the tenant-scoped unique index; identity belongs on the account row, not `profiles`. |

## Out of scope (follow-up spec B)

Subdomain tenant routing (`uiu.uniconnectt.me`), wildcard DNS, CORS for `*.uniconnectt.me`, refresh-cookie domain scoping across subdomains, per-tenant host routing. Not required for usernames to ship.

---

## 1. Data model

New migration `072_add_username_to_users.ts`:

1. Add `username varchar(30)` **nullable** (so the migration can run, then backfill, then tighten).
2. Backfill existing users (section 3).
3. Create the tenant-scoped, case-insensitive unique index:
   ```sql
   CREATE UNIQUE INDEX idx_users_username_per_uni
     ON users (university_id, lower(username));
   ```
4. `ALTER COLUMN username SET NOT NULL`.

- Username stored **lowercased**.
- The unique index doubles as the lookup index for `(university_id, lower(username))` — no separate index needed.
- Never edit a committed migration; this is a new sequential `NNN_` file (latest was `071`).

## 2. Validation rules — single source of truth

New `usernameSchema` in `packages/shared/src/schemas/users.ts`, reused by API validation, the availability check, and the settings form.

- Length **3–30** characters.
- Allowed characters: `a–z`, `0–9`, `_`, `.`.
- Must **start and end with a letter or digit** (no leading/trailing `.`/`_`).
- No **consecutive** separators (`..`, `__`, `._`, `_.`).
- Input is **lowercased before validation** (users may type mixed case).
- **Reserved usernames** rejected, kept as a `RESERVED_USERNAMES` constant in shared so both apps agree. Initial list: `admin`, `api`, `www`, `support`, `about`, `login`, `register`, `settings`, `me`, `profile`, `null`, `undefined`.

Add unit tests for boundary cases (length, leading/trailing separators, consecutive separators, reserved words, casing).

## 3. Backfill for existing users

Inside migration `072`, after adding the nullable column and before adding the NOT NULL constraint:

1. Derive a candidate from the user's **email local-part** (`jdatta2330960@…` → `jdatta2330960`), normalized through the same rules (strip invalid chars, collapse separators, trim to 30).
2. Resolve collisions **within each `university_id`** by appending `1`, `2`, … until unique.
3. Fallback to `user_<first8ofUUID>` if the normalized candidate is empty or reserved.
4. Result: every user has a unique, non-null, valid username scoped to its tenant.

## 4. API — `apps/api`, `users` module (no new module)

### 4.1 Resolve by username (public)
`GET /api/v1/users/by-username/:username`
- Tenant-scoped via `req.university.id`.
- Normalize + validate the param; look up `user_id`; **reuse `getPublicProfile(viewerId, targetUserId, universityId)`** so the response shape is byte-identical to `GET /users/:userId` (including the silent `profile_views` upsert side-effect).
- Miss → `notFound('User not found')`.

### 4.2 Availability check (auth required)
`GET /api/v1/users/username-available?username=<x>` → `{ available: boolean, reason?: 'invalid' | 'reserved' | 'taken' }`
- Validate format first (`invalid` / `reserved`), then check the tenant-scoped index, **excluding the caller's own current username** (so re-saving an unchanged value reads as available).

### 4.3 Edit username
Fold into the existing `PATCH /users/me` account/profile update path.
- Add `username` (optional) to that route's update schema using `usernameSchema`.
- On write: lowercase → re-validate → write, relying on the **unique index as the race-safe guard**. Catch the unique-violation and rethrow as `conflict('Username already taken')`. The availability endpoint is advisory only; the DB index is authoritative.

### 4.4 Expose username in responses
- Add `username` to the public profile selection, to `GET /users/me`, and to the lightweight user shapes used by feed authors / connections / suggestions (additive — no breaking change).
- Add `username` to `publicUserProfileSchema` and the `PublicUserProfile` type in `packages/shared`.

## 5. Web — `apps/web`

### 5.1 Routing
- Keep `PROFILE: '/profile/:id'`; treat `:id` as a **handle** (UUID *or* username).
- In `ProfilePage`'s data hook: if the param matches a UUID regex → `GET /users/:id` (unchanged behavior, existing links keep working); else → `GET /users/by-username/:id`. Both return the same `PublicUserProfile`.

### 5.2 Vanity link + share
- Add a `profileUrl(username)` helper in `src/lib/` building `https://www.uniconnectt.me/profile/<username>` (base from an env var, defaulting to the current origin).
- Surface a "Copy profile link" affordance in `ProfileHeader`. Build new internal profile links using the username form going forward; UUID links remain valid, so the migration is incremental.

### 5.3 Settings UI
- Add a **username field to `AccountSection`** (`src/features/settings/`): current value, inline edit, debounced availability check via a new `useUsernameAvailability` hook (TanStack Query, calls the availability endpoint), and validation messages sourced from the shared schema.
- Save goes through the existing account-update mutation (`PATCH /users/me`); on `409 conflict` show "Username already taken".

## 6. Testing

**Backend (integration):**
- `by-username`: hit, miss (404), and tenant isolation — the same username under a different `university_id` resolves to the correct person.
- `username-available`: valid / taken / reserved / invalid, and that the caller's own current username reads as available.
- `PATCH /users/me`: successful change + `409` conflict on a duplicate within the tenant.
- Migration test: backfill produced unique, non-null usernames per tenant.

**Shared (unit):**
- `usernameSchema` boundary cases (length, leading/trailing separators, consecutive separators, reserved words, casing/lowercasing).

**Web:**
- `ProfilePage` resolves both a UUID param and a username param (MSW handlers for both endpoints).
- `AccountSection` shows taken / available / invalid states.

## 7. Conventions checklist

- Migration: sequential `072_` prefix, never edit committed migrations.
- Index FK + tenant column; uniqueness enforced in the DB (not just app layer).
- Validation lives in `packages/shared` Zod schemas; types via `z.infer`.
- Services own DB access; routers only declare routes; controllers wrapped in `asyncHandler`; responses via `sendSuccess`.
- `universityId` always from `req.university.id`, never the request body.
- After UI changes, refresh affected screenshots (`profile`, settings).
- Run `npx pnpm typecheck && npx pnpm lint` before finishing.
