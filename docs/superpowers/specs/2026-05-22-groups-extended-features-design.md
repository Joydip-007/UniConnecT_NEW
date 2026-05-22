# Groups Extended Features — Design Spec

**Date:** 2026-05-22  
**Project:** UniConnecT — Team Mavericks, UIU  
**Scope:** Eight new capabilities in the Groups section, implemented as Approach A (purpose-built tables, single Bull digest job).

---

## 1. Feature Summary

| # | Feature | Who can act |
|---|---------|------------|
| 1 | **Join requests** — request to join private groups with optional message; owner/admin approve or decline | Any authenticated user (request); owner/admin (review) |
| 2 | **Group resources** — members upload URL links categorised as notes/syllabus/past_papers/assignments/other; click count tracked | Any member (upload/view); uploader or owner/admin/moderator (delete) |
| 3 | **Pinned announcement** — single text block (≤ 1 000 chars) pinned on group; notifies all members via Bull | owner/admin/moderator (set/clear) |
| 4 | **Group rules/about** — markdown block (≤ 5 000 chars) describing rules and purpose | owner/admin (write); all members (read) |
| 5 | **Group analytics** — live weekly stats via Promise.all: new members, posts, active contributors, pending requests, upcoming sessions | group admin/moderator (view) |
| 6 | **Weekly digest** — Bull repeatable job every Monday 09:00 BDT; computes top-5 posts by engagement per group; inserts one notification per member | system (automatic) |
| 7 | **Study sessions** — lightweight group-scoped events: physical or online, optional capacity cap, RSVP in/out, creator auto-RSVPs, members notified on creation | any member |
| 8 | **Member directory enhancements** — search covers name AND department via ILIKE; new group-role filter; paginated at 20 | any member |

---

## 2. Database Schema

### 2.1 Migration 039 — `group_join_requests`

```sql
CREATE TABLE group_join_requests (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id      uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  university_id uuid NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  message       text,
  status        varchar(10) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','declined')),
  reviewed_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- One pending request per user per group (allows re-request after decline)
CREATE UNIQUE INDEX uq_join_requests_pending
  ON group_join_requests (group_id, user_id)
  WHERE status = 'pending';

CREATE INDEX idx_join_requests_group_status ON group_join_requests (group_id, status);
CREATE INDEX idx_join_requests_user_group   ON group_join_requests (user_id, group_id);
```

**Design notes:**
- The partial unique index covers `pending` only, so a user can have one historical `declined` row and one new `pending` row simultaneously.
- `reviewed_by` uses `SET NULL` so the audit row survives if the reviewer is deleted.

---

### 2.2 Migration 040 — `group_resources`

```sql
CREATE TABLE group_resources (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id      uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  university_id uuid NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  uploaded_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  title         varchar(255) NOT NULL,
  url           text NOT NULL,
  category      varchar(20) NOT NULL
                  CHECK (category IN ('notes','syllabus','past_papers','assignments','other')),
  description   text,
  click_count   integer NOT NULL DEFAULT 0 CHECK (click_count >= 0),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_resources_group_cat  ON group_resources (group_id, category, created_at DESC);
CREATE INDEX idx_resources_group_date ON group_resources (group_id, created_at DESC);
```

**Design notes:**
- `uploaded_by` uses `SET NULL` (not `CASCADE`) so resources survive member departure — the link stays accessible to remaining members.
- `click_count` is incremented atomically via Knex `.increment('click_count', 1)` on `PATCH /track`.

---

### 2.3 Migration 041 — `group_study_sessions` + `group_study_session_rsvps`

```sql
CREATE TABLE group_study_sessions (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id      uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  university_id uuid NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  created_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  title         varchar(255) NOT NULL,
  description   text,
  location      varchar(255),
  is_online     boolean NOT NULL DEFAULT false,
  online_link   text,
  starts_at     timestamptz NOT NULL,
  ends_at       timestamptz,
  capacity      integer CHECK (capacity > 0),
  rsvp_count    integer NOT NULL DEFAULT 0 CHECK (rsvp_count >= 0),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_study_sessions_group   ON group_study_sessions (group_id, starts_at DESC);
CREATE INDEX idx_study_sessions_univ    ON group_study_sessions (university_id, starts_at);

CREATE TABLE group_study_session_rsvps (
  session_id  uuid NOT NULL REFERENCES group_study_sessions(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      varchar(12) NOT NULL CHECK (status IN ('going','not_going')),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, user_id)
);
```

**Design notes:**
- `rsvp_count` tracks `going` RSVPs only (consistent with capacity semantics). Decremented on `not_going` upsert, incremented on `going` upsert — both inside a transaction.
- `created_by` uses `SET NULL` so sessions survive moderator account deletion.

---

### 2.4 Migration 042 — four new columns on `groups`

```sql
ALTER TABLE groups
  ADD COLUMN pinned_text  text,
  ADD COLUMN pinned_at    timestamptz,
  ADD COLUMN pinned_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN rules_md     text;

ALTER TABLE groups
  ADD CONSTRAINT groups_pinned_text_len CHECK (char_length(pinned_text) <= 1000),
  ADD CONSTRAINT groups_rules_md_len    CHECK (char_length(rules_md)    <= 5000);
```

Both columns are denormalised on `groups` for O(1) reads. `rules_md` is included in `getGroup` but excluded from `listGroups`/`listMyGroups` (heavy field excluded from list mappers). `pinned_by` is informational — displayed in the UI as "Pinned by [name]".

---

## 3. API Endpoints

All routes under `/api/v1/groups`, all require `requireAuth + resolveUniversity`.

### 3.1 Join requests

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| `POST` | `/:groupId/members` | authenticated | **Upgraded**: private group → 202 join request; public → 200 direct join |
| `GET` | `/:groupId/join-requests` | owner / admin | Paginated list of pending requests |
| `PATCH` | `/:groupId/join-requests/:requestId` | owner / admin | `{ action: 'approve' \| 'decline' }` |
| `DELETE` | `/:groupId/join-requests/me` | requester | Cancel own pending request |

**`POST /:groupId/members` branching logic:**
- Public group → existing direct-join path (unchanged, 200)
- Private, not a member, no pending request → insert `group_join_requests` with `status: 'pending'`, notify all owners/admins via `notificationQueue` (`group_join_request`), return **202** `{ requested: true, requestId }`
- Private, already pending → **409** `JOIN_REQUEST_ALREADY_PENDING`
- Already a member → **409** `ALREADY_GROUP_MEMBER`
- System group → **403** (unchanged)

**`PATCH` approve:** transaction — insert `group_members`, `increment('member_count', 1)`, mark request `approved`, enqueue `notificationQueue` to requester (`group_join_approved`).

**`PATCH` decline:** mark request `declined`, enqueue `notificationQueue` to requester (`group_join_declined`). Users may re-request after decline (partial unique index allows it).

---

### 3.2 Group resources

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| `GET` | `/:groupId/resources` | member | `?category&page&limit` |
| `POST` | `/:groupId/resources` | member | `{ title, url, category, description? }` |
| `DELETE` | `/:groupId/resources/:id` | uploader or owner/admin/moderator | — |
| `PATCH` | `/:groupId/resources/:id/track` | member | Atomic `increment`, returns `{ clickCount }` |

---

### 3.3 Pinned announcement

| Method | Path | Auth | Body |
|--------|------|------|------|
| `PATCH` | `/:groupId/pinned` | owner / admin / moderator | `{ text: string \| null }` max 1 000 chars |

Setting `text: null` clears the pin silently (no notification). Setting a non-null value: update `groups` row (`pinned_text`, `pinned_at`, `pinned_by`), then enqueue one `notificationQueue` job per member excluding the actor (`group_pinned_update`). Enqueueing happens after DB write, never inline in the HTTP handler.

---

### 3.4 Group rules / about

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| `PATCH` | `/:groupId/rules` | owner / admin | `{ content: string }` max 5 000 chars |

`rules_md` is returned in `getGroup` response (added to `toGroup` mapper) but excluded from list-query mappers (`toGroupSummary`).

---

### 3.5 Group analytics

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/:groupId/stats` | group role = admin or moderator |

Returns via `Promise.all`:
```ts
{
  newMembersThisWeek:    number   // group_members.joined_at > now() - interval '7 days'
  postsThisWeek:         number   // posts.group_id = groupId AND created_at > now() - 7d
  activeContributors:    number   // COUNT(DISTINCT author_id) on above posts
  pendingJoinRequests:   number   // group_join_requests WHERE status = 'pending'
  upcomingStudySessions: number   // group_study_sessions.starts_at > now()
}
```

---

### 3.6 Study sessions

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| `GET` | `/:groupId/study-sessions` | member | `?page&limit`, ordered `starts_at DESC` |
| `POST` | `/:groupId/study-sessions` | member | See schema |
| `DELETE` | `/:groupId/study-sessions/:id` | creator or owner/admin | — |
| `POST` | `/:groupId/study-sessions/:id/rsvp` | member | `{ status: 'going' \| 'not_going' }` |

**Create:** transaction — insert session, insert creator RSVP as `going`, increment `rsvp_count`. After commit: enqueue one `notificationQueue` job per member excluding creator (`group_study_session_created`).

**RSVP upsert:** if `going` and `capacity` set and `rsvp_count >= capacity` → **409** `SESSION_AT_CAPACITY`. Upsert `(session_id, user_id)` — if previous status was `going` and new is `not_going`, decrement `rsvp_count`; if previous was `not_going` or null and new is `going`, increment. Both in a transaction.

---

### 3.7 Member directory (enhanced)

Existing `GET /:groupId/members` gains two new optional query params:

- `?search=string` — ILIKE on `full_name` **OR** `department` (was `full_name` only)
- `?role=owner|admin|moderator|member` — exact match on `group_members.role`

`MembersQuerySchema` in `schema.ts` extends with `role: GroupRoleSchema.optional()`.

---

### 3.8 New Zod schemas (added to `schema.ts`)

```ts
JoinGroupSchema           — { message?: z.string().trim().max(500) }
JoinRequestActionSchema   — { action: z.enum(['approve','decline']) }
ResourceCategorySchema    — z.enum(['notes','syllabus','past_papers','assignments','other'])
CreateResourceSchema      — { title, url, category, description? (max 1000) }
ResourceListQuerySchema   — PaginationQuery + { category?: ResourceCategorySchema }
SetPinnedSchema           — { text: z.string().trim().max(1000).nullable() }
SetRulesSchema            — { content: z.string().max(5000) }
CreateStudySessionSchema  — { title, description?, location?, is_online, online_link?, starts_at, ends_at?, capacity? }
RsvpStudySessionSchema    — { status: z.enum(['going','not_going']) }
MembersQuerySchema        — (extended) + { role?: GroupRoleSchema }
```

---

## 4. Background Jobs

### 4.1 Ad-hoc notification fan-outs (existing `notificationQueue`)

All fired from service methods **after** DB write. No new queue — reuses existing `NotificationQueueJob` shape.

| Trigger | Type | Recipients |
|---------|------|-----------|
| Join request submitted (private group) | `group_join_request` | All owners + admins of group |
| Join request approved | `group_join_approved` | Requester |
| Join request declined | `group_join_declined` | Requester |
| Pinned text set (non-null) | `group_pinned_update` | All members except actor |
| Study session created | `group_study_session_created` | All members except creator |

---

### 4.2 Weekly digest — repeatable Bull job

**Files:**
- `apps/api/src/queues/group-digest.queue.ts`
- `apps/api/src/workers/group-digest.worker.ts`
- Registered in `apps/api/src/workers/index.ts`

**Schedule:** `cron: '0 3 * * 1'` (Monday 03:00 UTC = 09:00 BDT)

**Stable job ID:** `'group-weekly-digest'` — prevents duplicate registration on worker restart.

**Processor algorithm:**

```
1. SELECT DISTINCT university_id FROM groups WHERE is_system = false

2. For each university:
   a. SELECT id, name FROM groups WHERE university_id = $1

   b. For each group:
      i.  Top-5 posts by engagement (likes + comments) in last 7 days.
          NOTE: confirm exact table names from feed module during implementation
          (likely `post_likes` and `post_comments`, but verify against feed/service.ts):

          SELECT posts.id,
                 (COUNT(DISTINCT likes.id) + COUNT(DISTINCT comments.id)) AS score
          FROM posts
          LEFT JOIN post_likes    ON post_likes.post_id    = posts.id
          LEFT JOIN post_comments ON post_comments.post_id = posts.id
          WHERE posts.group_id = $groupId
            AND posts.created_at > now() - interval '7 days'
          GROUP BY posts.id ORDER BY score DESC LIMIT 5

      ii.  If no posts this week → skip (no notification inserted)

      iii. SELECT user_id FROM group_members WHERE group_id = $groupId

      iv.  For each member:
           notificationQueue.add({
             type: 'group_weekly_digest',
             userId: memberId,
             referenceId: groupId, referenceType: 'group',
             content: `Top posts this week in "${groupName}"`,
             payload: { groupId, postIds: top5Ids }
           })

3. Log: total groups processed, total notifications enqueued
```

**Safety:** sequential `for…of` loops (no Promise.all fan-out here) to avoid Redis flooding. `jobId` prevents duplicate repeatable registration. Bull retries up to 3× on crash — double-notification harmless in practice. No emails fired — only `notificationQueue`.

---

## 5. Frontend Components

### 5.1 Tab structure (updated)

| Tab | Visible to | Badge |
|-----|-----------|-------|
| Feed | all members | — |
| Resources | all members | — |
| Study Sessions | all members | — |
| Members | all members | — |
| Events | all members | — |
| About | all members | — |
| Stats | group admin / moderator | — |
| Join Requests | group owner / admin | pending count |

Non-members of a public group see Feed, Events, Members (read-only). Private group non-members see a "Request to join" gate.

### 5.2 Tab bar — Tabs 6 animated underline pattern

Rebuilt with a sliding `position: absolute` underline (`border-bottom: 2px solid var(--uc-orange)`) that tracks the active tab using `offsetLeft` + `offsetWidth`. Horizontal scroll on narrow screens (`overflow-x: auto; scrollbar-width: none`). Join Requests badge: `var(--uc-orange-bg)` pill next to label text.

### 5.3 `PinnedBanner` — 21st.dev Banner pattern

Between `GroupHeader` and tabs. Background `var(--uc-indigo-bg)`, `border-left: 2px solid var(--uc-indigo)`. Animated `::before` shimmer stripe. Dismiss button stores `dismissed` in component state (cosmetic — resets on refresh). Owner/admin/moderator see inline "Edit" ghost link.

### 5.4 `AdminStatsTab` — Stats05 card grid pattern

Five metric cards in `display: flex; gap: 12px; flex-wrap: wrap`. Each card: `background: var(--surface-card); border: 0.5px solid var(--border-default); border-radius: var(--r-lg); padding: 16px 20px`. Number in 28px / weight 500 `--text-primary`; label in 12px `--text-tertiary`. "Pending requests" card gets `var(--uc-orange-bg)` tint when count > 0. Shimmer skeleton while loading. `GhostBtn` "↺ Refresh" triggers `queryClient.invalidateQueries`.

### 5.5 `ResourcesTab` — filter chips + list rows

Category chips: pill buttons, inactive `var(--surface-raised)`, active `var(--uc-indigo-bg)` + `var(--uc-indigo-l)`. Resource rows show category pill tag, title, uploader, click count, date, "Open link ↗" (`<a target="_blank">` + fire-and-forget PATCH track), inline two-step delete confirm. `CreateResourceModal`: title, URL, category select, optional description. Infinite scroll.

### 5.6 `StudySessionCard` — Event Card token-chip pattern

Date + time displayed as `var(--surface-raised)` rounded chips. Location prefix 📍/🌐. RSVP toggle: `PrimaryBtn` when going, `GhostBtn` when not. Capacity shown as `{count} / {capacity}` or `{count} going`. Optimistic RSVP updates. `CreateStudySessionModal`: title, physical/online toggle, location/URL, date/time, optional capacity. Upcoming/Past split client-side.

### 5.7 `JoinRequestsTab` — user approval card pattern

Avatar + name/department + age + optional message block + Approve (`PrimaryBtn`) / Decline (`GhostBtn`) buttons. Approved/declined rows animate out (`opacity: 0; max-height: 0; overflow: hidden` 100ms ease-out) then removed from list. Paginated, infinite scroll.

### 5.8 `AboutTab`

Renders `rulesmd` as markdown (check for existing `react-markdown` in bundle before adding). Edit mode: inline `<textarea>` with live char counter `(n / 5 000)`. Saves on `PATCH /:groupId/rules`.

### 5.9 `MembersTab` enhancements

Existing name-search input unchanged. New "Role" pill-dropdown filter appended right of search: All · Owner · Admin · Moderator · Member. Search term now covers both `full_name` and `department` (ILIKE OR on backend).

### 5.10 New TanStack Query hooks

| Hook | Endpoint |
|------|----------|
| `useGroupResources(groupId, category)` | `GET /:groupId/resources` |
| `useCreateResource(groupId)` | `POST /:groupId/resources` |
| `useDeleteResource(groupId)` | `DELETE /:groupId/resources/:id` |
| `useTrackResource(groupId)` | `PATCH /:groupId/resources/:id/track` |
| `useStudySessions(groupId)` | `GET /:groupId/study-sessions` |
| `useCreateStudySession(groupId)` | `POST /:groupId/study-sessions` |
| `useRsvpStudySession(groupId)` | `POST /:groupId/study-sessions/:id/rsvp` |
| `useJoinRequests(groupId)` | `GET /:groupId/join-requests` |
| `useReviewJoinRequest(groupId)` | `PATCH /:groupId/join-requests/:id` |
| `useCancelJoinRequest(groupId)` | `DELETE /:groupId/join-requests/me` |
| `useSetPinned(groupId)` | `PATCH /:groupId/pinned` |
| `useSetRules(groupId)` | `PATCH /:groupId/rules` |
| `useGroupStats(groupId)` | `GET /:groupId/stats` |

All mutation hooks: `onSuccess` invalidates relevant query keys; `onError` calls `toast.error`.

---

## 6. Error Handling

### 6.1 New error codes

| Code | HTTP | Thrown when |
|------|------|-------------|
| `JOIN_REQUEST_ALREADY_PENDING` | 409 | User submits a second request while one is already pending |
| `JOIN_REQUEST_NOT_FOUND` | 404 | `PATCH /join-requests/:id` references a non-existent or already-reviewed request |
| `SESSION_AT_CAPACITY` | 409 | RSVP `going` on a session where `rsvp_count >= capacity` |
| `RESOURCE_NOT_FOUND` | 404 | `DELETE` or `PATCH /track` on a non-existent resource |
| `RESOURCE_DELETE_FORBIDDEN` | 403 | Non-uploader without admin/moderator role tries to delete |

All existing error helpers (`notFound`, `conflict`, `forbidden`, `badRequest`) reused. New codes are string constants in `src/utils/errors.ts`.

### 6.2 Service-level guards

- **Join request on public group:** `assertCanJoinGroup` already handles public-group fast-path; `joinGroup` code path unchanged.
- **Stats auth:** new `assertGroupRole(context, groupId, ['admin','moderator'])` helper that reads `group_members.role`; throws `forbidden` if not matched.
- **Pinned/rules on system groups:** system groups can have pinned + rules — no restriction added (useful for official announcements).
- **Study session RSVP race:** capacity check + increment inside a single transaction with `SELECT ... FOR UPDATE` on the session row.
- **Weekly digest job crash:** Bull retries 3× with exponential back-off. Each retry re-computes from scratch — safe because notifications are append-only (idempotency is acceptable rather than guaranteed).

---

## 7. Testing

### 7.1 Backend integration tests

All in `apps/api/src/__tests__/groups/` (new subfolder). Pattern: `loginAs()` → supertest with `.set('x-university-domain', DOMAIN)`.

| Test file | Key cases |
|-----------|-----------|
| `join-requests.test.ts` | Submit request on private group → 202; duplicate pending → 409; approve → member inserted, count incremented; decline → no member; cancel own request; non-admin cannot review |
| `resources.test.ts` | Upload → listed; category filter returns only matching; track increments click_count; uploader can delete; non-uploader member cannot delete; admin can delete; non-member cannot list |
| `pinned.test.ts` | Set pinned → groups row updated, notifications enqueued (mock Bull); clear → null, no notification; moderator can set; member cannot set |
| `rules.test.ts` | Set rules → returned in getGroup; max 5000 chars enforced; admin can set; moderator cannot set |
| `stats.test.ts` | Admin gets stats object with all five keys; moderator gets stats; member gets 403 |
| `study-sessions.test.ts` | Create → RSVP row inserted for creator, members notified; RSVP going → count incremented; not_going → decremented; at-capacity → 409; delete by creator; delete by admin; non-creator member cannot delete |
| `members-enhanced.test.ts` | Search by department; role filter for moderator; combined search + role filter; pagination |
| `digest-job.test.ts` (unit) | Processor inserts correct notification count; skips groups with no posts this week |

### 7.2 Frontend tests

React Testing Library + MSW handlers.

| Component | Key cases |
|-----------|-----------|
| `PinnedBanner` | Renders when `pinnedText` set; dismiss hides banner; not rendered when null |
| `ResourcesTab` | Category filter chip updates query param; "Open link" fires track mutation; delete confirm two-step |
| `StudySessionsTab` | Upcoming/Past split; RSVP toggle optimistic update; capacity badge shown/hidden |
| `JoinRequestsTab` | Approve fires mutation, row animates out; pending count badge matches data |
| `AdminStatsTab` | Renders five stat cards from mock data; orange tint on pending > 0; skeleton while loading |
| `MembersTab` | Role dropdown filter; search covers department via mock handler |

### 7.3 General

- `afterEach`: clean up `group_join_requests`, `group_resources`, `group_study_sessions`, `group_study_session_rsvps` rows inserted during tests.
- Factory helpers in `tests/factories/groups.ts`: `makeJoinRequest`, `makeResource`, `makeStudySession`.
- Never hardcode UUIDs — use factory-generated IDs.

---

## 8. Key Decisions Log

| Decision | Rationale |
|----------|-----------|
| `group_join_requests` table (not notifications) | Notifications are ephemeral; join requests need persistent pending/approved/declined states and paged listing for admins |
| `rsvp_count` denormalised on `group_study_sessions` | Fast capacity check on RSVP without COUNT sub-query; maintained transactionally |
| Single weekly Bull job (not two) | Stats are live (`Promise.all` on demand); digest is the only job needed Monday morning |
| `uploaded_by SET NULL` on resources | Resources survive member departure — link stays accessible |
| `pinned_text` max 1 000 chars, `rules_md` max 5 000 chars | Enforced at Zod layer first, DB constraint as final guard |
| Study sessions separate table (not reusing events) | Lighter schema, no cover image, simpler RSVP (going/not_going only), keeps events module clean |
| Partial unique index on `pending` join requests | Allows re-request after decline without complex status-transition logic |
| 21st.dev patterns adapted to inline CSS vars | Project uses inline styles with CSS tokens, not Tailwind; visual patterns (sliding tab underline, shimmer banner, metric cards, token chips) are adapted to `var(--*)` system |
