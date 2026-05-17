# Groups section — design spec

Date: 2026-05-17
Status: Approved (brainstorm phase)
Owner: Joydip

## Goal

Bring the Groups section to feature-complete: creation flow, search, role-restricted membership, auto-managed admin/faculty groups, a 4-tab group detail page (Feed / Events / Collaborations / Members), member tags for Creator / Admin / Moderator, and group invitations delivered via the notifications system.

## Non-goals

- Presigned avatar/cover uploads (use URL inputs for now).
- Cross-university groups.
- Per-group push notifications / digest emails.
- Public (logged-out) group pages.
- Rich activity log UI.

## Existing state (baseline)

- Backend `groups` module has CRUD + join/leave + member role management + group posts. See `apps/api/src/modules/groups/`.
- Group types: `department / club / batch / research / interest / other`. Roles: `owner / admin / moderator / member`.
- Posts have a `group_id` column and a `type` enum (`post / announcement / lost_found / news / event_promo`).
- Events live in their own table with no group linkage.
- Frontend has `GroupsPage` (list + filter, no search, no create button) and `GroupDetailPage` (Feed + Members tabs only).
- User roles: `student / alumni / faculty / admin`. Profiles carry `department`.
- A `messages` module exists separately — out of scope here.

## Decisions

| Topic | Decision |
|---|---|
| Auto-created admin/faculty entities | Real Groups in the existing `groups` module (with feed, no built-in chat) |
| Creation perms | Students can create groups but membership is auto-restricted to students; alumni/faculty/admin can create open groups |
| Collaborations tab content | Jobs + mentorship listings matched by department (for `type='department'` groups) or by tag overlap (other types) |
| Events tab content | Real events (events table, group-linked) merged with `event_promo` posts, ordered by recency |
| Search | Two scopes — list-level group search (URL `?q=`) and member search inside the group |
| Member tags | Distinct visual tags: `Creator` (owner) / `Admin` / `Mod`. Members get no tag. |
| Invitations | Surface via notifications module, with inline Join / Decline buttons |

## Architecture overview

Backend changes are confined to the `groups`, `events`, `notifications`, `admin`, `users`, and `auth` modules. No new tables — only column additions and a new dedicated `system-groups.service.ts` that owns auto-membership lifecycle.

Frontend changes consolidate inline subcomponents from `GroupsPage.tsx` / `GroupDetailPage.tsx` into a new `apps/web/src/features/groups/` feature folder, matching the existing `features/feed`, `features/events`, etc. layout.

---

## 1. Data model

### Migration `027_add_groups_role_restriction_and_system_flag.ts`

```sql
ALTER TABLE groups
  ADD COLUMN allowed_role  varchar(20)  NULL,
  ADD COLUMN is_system     boolean      NOT NULL DEFAULT false,
  ADD COLUMN department    varchar(120) NULL;

ALTER TABLE groups
  ADD CONSTRAINT groups_allowed_role_check
  CHECK (allowed_role IS NULL OR allowed_role IN ('student','alumni','faculty','admin'));

CREATE UNIQUE INDEX uq_groups_system_admin
  ON groups (university_id)
  WHERE is_system = true AND allowed_role = 'admin';

CREATE UNIQUE INDEX uq_groups_system_faculty_dept
  ON groups (university_id, department)
  WHERE is_system = true AND allowed_role = 'faculty';
```

Semantics:

- `allowed_role` — when set, only users whose `users.role` matches can join. `NULL` means open to any role.
- `is_system` — flags auto-managed groups (All admins, per-dept faculty). Cannot be set via the public create endpoint.
- `department` — only used for faculty department groups (when `is_system = true AND allowed_role = 'faculty'`).

### Migration `028_events_add_group_id.ts`

```sql
ALTER TABLE events
  ADD COLUMN group_id uuid NULL REFERENCES groups(id) ON DELETE SET NULL;

CREATE INDEX idx_events_group ON events (group_id) WHERE group_id IS NOT NULL;
```

### Migration `029_backfill_system_groups.ts` (data migration, idempotent)

For each university:

1. Insert one `All admins` group (`type='other', is_system=true, allowed_role='admin', name='All admins'`) if missing. Add every existing user with role `admin` as a `member` row in `group_members`. `created_by` is set to the first admin user found, or NULL-safe sentinel if no admin exists yet.
2. For each distinct non-null `profiles.department` where at least one user with role `faculty` exists, insert one group (`type='department', is_system=true, allowed_role='faculty', department=<dept>, name=<dept>`). Add every faculty whose `profiles.department` matches.
3. Update each system group's `member_count`.

The migration is idempotent — it checks for the unique-index target before insert and re-syncs membership.

### Response shape change

`GET /groups/:id` and `GET /groups` items now return:

```ts
{
  id, universityId, createdBy, name, description, type,
  avatarUrl, coverUrl, isPrivate, memberCount, createdAt,
  userRole, isMember,
  allowedRole: 'student' | 'alumni' | 'faculty' | 'admin' | null,  // new
  isSystem: boolean,                                                 // new
  department: string | null,                                         // new
}
```

The shared TS type lives in `packages/shared/src/types/groups.ts` (extend existing or create).

---

## 2. Auto-managed groups lifecycle

A single service — `apps/api/src/modules/groups/system-groups.service.ts` — owns all auto-membership churn. Route handlers never insert/delete system-group memberships directly.

### Public surface

```ts
class SystemGroupsService {
  ensureSystemGroupsForUniversity(universityId: string): Promise<void>
  addUserToSystemGroups(userId: string, role: UserRole, department: string | null): Promise<void>
  removeUserFromSystemGroups(userId: string, oldRole: UserRole, oldDepartment: string | null): Promise<void>
  syncUserMembership(userId: string, oldState: { role, department }, newState: { role, department }): Promise<void>
}
```

### Trigger points (server-side service calls)

| Event | Hook location | Action |
|---|---|---|
| New user registers with role `admin` | `auth/service.ts` `verifyOtp` | `addUserToSystemGroups` |
| User registers as `faculty` | `auth/service.ts` `verifyOtp` | `addUserToSystemGroups` (department from profile) |
| Admin promotes user via `PATCH /admin/users/:id/role` | `admin/service.ts` `updateUserRole` | `syncUserMembership` |
| Profile department changes | `users/service.ts` `updateProfile` | `syncUserMembership` (compares old/new dept) |
| User soft-deleted or status change to inactive | `admin/service.ts` `updateUserStatus` | `removeUserFromSystemGroups` |
| New university provisioned | `admin/service.ts` (future university-create flow — out of scope but the hook exists) | `ensureSystemGroupsForUniversity` |

### Guardrails on system groups

| Operation | Behaviour on `is_system = true` |
|---|---|
| `POST /groups/:id/members` (join) | 403 `GROUP_SYSTEM_JOIN_FORBIDDEN` |
| `DELETE /groups/:id/members/me` (leave) | 403 `GROUP_SYSTEM_LEAVE_FORBIDDEN` |
| `DELETE /groups/:id` | 403 `GROUP_SYSTEM_DELETE_FORBIDDEN` |
| `PATCH /groups/:id` for `name / type / allowed_role / department` | 403 `GROUP_SYSTEM_EDIT_FORBIDDEN` |
| `PATCH /groups/:id` for `description / avatar_url / cover_url` | Allowed only when caller has user-level role `admin` |
| `PATCH /groups/:id/members/:userId` | 403 |
| `DELETE /groups/:id/members/:userId` | 403 |
| `POST /groups` with `is_system=true` from a client | 400 — flag is not in the public schema |

### Ownership

System groups have no `owner` role in `group_members`. `groups.created_by` is set to the first admin user found at backfill time, but no behaviour reads it for system groups. Frontend will not render a Creator tag for system groups.

### Visibility

System groups appear in `GET /groups` and `GET /groups/my` like normal groups. Their feed/events/collab tabs work like any other group's. Members may post freely. Non-members cannot read posts (private-by-effect because non-members aren't auto-added).

---

## 3. Backend API surface

All routes stay under `/api/v1/groups`. Bolded rows are new or changed.

| Method + path | Status | Notes |
|---|---|---|
| `GET /groups` | unchanged | `search` query already supported |
| **`POST /groups`** | changed | Service forces `allowed_role='student'` when caller is a student. `is_system` rejected at the schema layer. |
| `GET /groups/my` | unchanged | Includes new response fields |
| `GET /groups/:id` | unchanged | New response fields |
| **`PATCH /groups/:id`** | changed | Rejects edits to `name/type/allowed_role/department` on system groups; only `description / avatar_url / cover_url` permitted, and only for users with user-level role `admin` |
| **`DELETE /groups/:id`** | changed | 403 on system groups |
| **`POST /groups/:id/members`** | changed | Rejects when `allowed_role` set and user role doesn't match → 400 `GROUP_ROLE_NOT_ALLOWED`. 403 on system groups. |
| `DELETE /groups/:id/members/me` | unchanged | 403 on system groups |
| **`GET /groups/:id/members`** | changed | Accept `search` query (case-insensitive `whereILike` on `profiles.full_name`, plus existing trgm index from migration 024). Response includes `role`. |
| `PATCH /groups/:id/members/:userId` | unchanged | 403 on system groups |
| `DELETE /groups/:id/members/:userId` | unchanged | 403 on system groups |
| `GET /groups/:id/posts` | unchanged | Feed tab |
| **`GET /groups/:id/events`** | new | Merged: `events WHERE group_id=:id` ∪ `posts WHERE group_id=:id AND type='event_promo'`, ordered by `created_at DESC`. Paginated. Returns discriminated union items: `{ kind: 'event', ...event } \| { kind: 'post', ...post }`. |
| **`GET /groups/:id/collaborations`** | new | Department group: `jobs WHERE department = group.department` ∪ `mentorship_listings WHERE department = group.department`. Other types: items matched by tag overlap on `post_tags`/`job_tags` (or equivalent). Same discriminated union shape. Paginated. |
| **`POST /groups/:groupId/invitations`** | new | Owner/admin invites a user. Body: `{ userId }`. Creates a `notifications` row of type `group_invite`. 409 if already a member, 400 if user role conflicts with `allowed_role`, 403 on system groups. Idempotent on a pending invite for the same `(groupId, userId)` pair. |

### Notifications module additions

| Method + path | Purpose |
|---|---|
| **`POST /notifications/:id/accept`** | Recipient-only. Validates notification is `type='group_invite'` and unread, calls `groupsService.joinGroupViaInvite(userId, groupId)`, marks notification read with `acceptedAt` in metadata. |
| `DELETE /notifications/:id` | Existing — used as "decline" (dismisses the notification). |

`groupsService.joinGroupViaInvite` is a new internal method that bypasses the `is_private` block (since the user was invited) but still enforces `allowed_role` — a role mismatch at accept-time returns `GROUP_ROLE_NOT_ALLOWED`.

### Realtime emits

- Existing emits (post create, event create) gain a second emit on `group:{groupId}` so a future per-group subscriber is cheap. No client wiring in this spec.
- Invite creation triggers the existing per-user notification emit on `user:{invitedUserId}`; nothing new needed.

### New error codes

`GROUP_SYSTEM_JOIN_FORBIDDEN`, `GROUP_SYSTEM_LEAVE_FORBIDDEN`, `GROUP_SYSTEM_DELETE_FORBIDDEN`, `GROUP_SYSTEM_EDIT_FORBIDDEN`, `GROUP_ROLE_NOT_ALLOWED`, `GROUP_INVITE_DUPLICATE`, `GROUP_INVITE_SELF_FORBIDDEN`.

### File layout

```
apps/api/src/modules/groups/
  router.ts                  (extended — adds /events, /collaborations, /invitations)
  controller.ts              (extended)
  service.ts                 (extended — adds listEvents, listCollaborations, joinGroupViaInvite, plus is_system / allowed_role enforcement)
  system-groups.service.ts   (new — auto-membership lifecycle)
  schema.ts                  (extended — adds search to members query, invitations body)
  index.ts
apps/api/src/modules/notifications/
  controller.ts              (extended — adds accept)
  router.ts                  (extended)
  service.ts                 (extended — adds acceptInvite that delegates to groupsService)
  schema.ts                  (extended)
```

---

## 4. Frontend

### 4.1 `GroupsPage` (list)

Layout (top to bottom):

```
┌───────────────────────────────────────────────────────────┐
│  [Search groups…]                         [+ Create group] │
├───────────────────────────────────────────────────────────┤
│  [All] [Department] [Club] [Batch] [Research] [Interest]  │
├───────────────────────────────────────────────────────────┤
│  Grid of GroupCard                                         │
└───────────────────────────────────────────────────────────┘
```

- Search input is debounced 300ms, syncs to `?q=` URL param, passed to the existing backend `?search=`.
- `+ Create group` opens `CreateGroupModal`.
- `GroupCard` gains two badges in the meta row:
  - `Students only` when `allowedRole === 'student'`.
  - `Official` when `isSystem` is true. The join/leave button is replaced by a muted `Auto-managed` label for system groups.

### 4.2 `CreateGroupModal` (new)

Single-screen form using existing primitives (`Input`, `Textarea`, `PrimaryBtn`, `GhostBtn`):

| Field | Rule |
|---|---|
| Name | required, max 255 |
| Description | required |
| Type | select among `department / club / batch / research / interest / other` |
| Privacy | toggle "Private group" → maps to `is_private` |
| Members | radio: "Anyone in your university" / "Students only". Students see only "Students only" with the radio disabled (selected). Other roles pick freely. |
| Avatar URL / Cover URL | optional URL inputs |

On submit → `POST /groups` → on success invalidate `['groups','list']`, close, `navigate(/groups/{id})`.

### 4.3 `GroupDetailPage` — 4 tabs

Replace current Feed/Members with **Feed · Events · Collaborations · Members**.

- **Feed** — existing `FeedTab` extracted to `features/groups/components/FeedTab.tsx`.
- **Events** — new `EventsTab`. Fetches `GET /groups/:id/events` (infinite query). Renders each item: `kind='event'` → existing `EventCard`; `kind='post'` → existing `PostCard`. Empty state: "No upcoming events in this group yet."
- **Collaborations** — new `CollabTab`. Fetches `GET /groups/:id/collaborations`. Renders `kind='job'` with `JobCard` and `kind='mentorship'` with a thin `MentorshipCard`. Empty-state copy adapts: department groups say "No jobs from your department yet"; other types say "No collaborations matching this group's tags yet".
- **Members** — extended `MembersTab`:
  - Search input at the top, debounced 300ms, sends `?search=` to the endpoint.
  - Tag rendering: `Creator` for owner, `Admin` for admin, `Mod` for moderator. No tag for plain members.
  - System groups: no Creator tag, admin actions hidden (`PATCH/DELETE` on system-group members are 403).

System-group banner under the header when `group.isSystem` is true: "This is an official auto-managed group. Membership is updated automatically." Hides the join/leave button.

### 4.4 Header tweaks

`GroupHeader` adds the `Students only` and `Official` badges next to the type pill. No other layout changes.

### 4.5 Notifications integration

Add a `group_invite` case to `NotificationsPage`. Card content:

```
[Avatar]  <Inviter name> invited you to join "<Group name>" · 2h
                                                  [Join] [Decline]
```

- **Join** → `POST /notifications/:id/accept` → on 200 invalidate `['notifications']` and `['groups','my']`, toast success, and replace the buttons with a muted `Joined` pill linking to the group.
- **Decline** → `DELETE /notifications/:id` → invalidate `['notifications']`.

Role-mismatch error at accept time (e.g. invitee's role changed since invite) shows the server-provided message via toast.

### 4.6 Invite-user modal (inside Members tab)

For owner/admin only, an `Invite member` button above the member list opens a small modal:

- Typeahead user search (calls a small `GET /users/search?q=` — already exists per `users` module; if not, scope-add a thin endpoint). Filters: same university, exclude existing members, exclude users whose role conflicts with `allowed_role`.
- Pick a user → submit → `POST /groups/:groupId/invitations`.
- On success: toast "Invitation sent", close modal.

### 4.7 File layout (frontend)

```
apps/web/src/features/groups/
  components/
    GroupCard.tsx
    GroupHeader.tsx
    GroupBadges.tsx         (StudentsOnly + Official pills)
    CreateGroupModal.tsx
    InviteMemberModal.tsx
    FeedTab.tsx             (extracted)
    EventsTab.tsx
    CollabTab.tsx
    MembersTab.tsx          (extracted + search + tags)
    MemberRoleTag.tsx       (Creator/Admin/Mod)
  hooks/
    useGroups.ts            (list + search)
    useMyGroups.ts
    useGroupDetail.ts
    useGroupMembers.ts      (search-aware)
    useGroupEvents.ts
    useGroupCollab.ts
    useCreateGroup.ts
    useInviteToGroup.ts
    useAcceptInvite.ts
  index.ts
apps/web/src/pages/
  GroupsPage.tsx             (slim orchestrator)
  GroupDetailPage.tsx        (slim orchestrator)
apps/web/src/pages/NotificationsPage.tsx (extended — group_invite case)
```

Today both `GroupsPage.tsx` (~450 lines) and `GroupDetailPage.tsx` (~650 lines) inline their subcomponents. Splitting them into the feature folder matches the repo convention (`features/feed`, `features/events`, …) and is a real readability win, not unrelated refactoring.

---

## 5. Future work (out of scope here)

- Pin announcements to top of group feed (column already exists on `posts.is_pinned`).
- Group rules section (split from description).
- Presigned-URL flow for avatar/cover uploads (use the existing `/upload/presign` endpoint).
- Group activity log (joins/leaves/role changes) for admin view.
- Trending groups widget on the right sidebar.
- Email digest of unread group posts.

---

## Open questions

None. Reviewed by user on 2026-05-17.

## Risks

- **Auto-membership backfill** — running migration 029 on a populated database briefly takes a write lock on `group_members` and `groups`. Acceptable for the current scale (single seeded university). For multi-uni production rollouts, gate the backfill behind a CLI command instead of a migration.
- **Department string mismatches** — faculty whose `profiles.department` is misspelled or null won't be auto-added to a faculty group. Mitigation: surface a small admin warning in the admin module (out of scope here) listing faculty with empty departments.
- **Role-mismatch at invite-accept time** — invitee's role can change between invite send and accept. Re-check on accept; surface a clear error toast.
- **`is_system` flag bypass** — Postgres only enforces uniqueness, not "you can't insert is_system=true from outside the system service". The schema layer rejects the field; engineers must always go through the service. CLAUDE.md already mandates "services import db directly" — reinforce in code review.
