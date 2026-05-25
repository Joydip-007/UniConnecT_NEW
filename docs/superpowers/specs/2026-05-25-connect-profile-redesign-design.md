# Connect System + Profile Redesign — Design Spec

**Date:** 2026-05-25  
**Project:** UniConnecT — Team Mavericks, UIU  
**Status:** Approved, ready for implementation planning  

---

## Overview

Replace the one-directional follow system with a fully mutual LinkedIn-style **connect** system. Simultaneously redesign the user profile into a richer, section-based layout with Experience, Education, Featured, Skills, Analytics, and profile view tracking. Connection state gates profile visibility, messaging, and feed priority.

This spec covers two tightly coupled sub-features:
- **Spec A** — Connect system (DB, API, frontend, pre/post conditions)
- **Spec B** — Profile redesign (new tables, new sections, editing modals, premium-inspired features)

Spec B depends on Spec A (connection status gates what profile content is visible).

---

## What Changes vs. Today

| Today (follow) | After (connect) |
|---|---|
| One-directional, instant | Mutual, requires both parties to agree |
| `follows` table | `connections` table with `status` |
| Anyone can DM anyone | DM only after connection (or opt-in open-to-message) |
| All profile data public | Limited profile for non-connections |
| Followers / Following stats | Connections / Pending / Posts stats |
| Feed is chronological | Connected users' posts soft-boosted in feed |

---

## Spec A — Connect System

### A1. Database

#### New migration: `051_create_connections.ts`

```sql
CREATE TABLE connections (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id  UUID NOT NULL REFERENCES universities(id),
  requester_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  note           TEXT,          -- max 300 chars, optional
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (requester_id, addressee_id)
);

CREATE INDEX idx_connections_requester   ON connections (requester_id);
CREATE INDEX idx_connections_addressee   ON connections (addressee_id);
CREATE INDEX idx_connections_university  ON connections (university_id, status);
```

#### New migration: `052_drop_follows.ts`

```sql
DROP TABLE IF EXISTS follows;
```

All existing follow data is wiped. No migration of existing records.

#### Query patterns

```sql
-- Are A and B connected?
WHERE ((requester_id = $a AND addressee_id = $b)
    OR (requester_id = $b AND addressee_id = $a))
  AND status = 'accepted'

-- Pending received by me
WHERE addressee_id = $me AND status = 'pending'

-- Pending sent by me
WHERE requester_id = $me AND status = 'pending'

-- My connections (either direction)
WHERE (requester_id = $me OR addressee_id = $me)
  AND status = 'accepted'
```

---

### A2. Backend API

**New module:** `apps/api/src/modules/connections/`  
Structure: `router.ts`, `controller.ts`, `service.ts`, `schema.ts`, `index.ts`

#### Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/connections/request/:userId` | Send a connect request (optional note ≤ 300 chars in body) |
| `DELETE` | `/connections/request/:userId` | Withdraw a pending sent request |
| `POST` | `/connections/:connectionId/accept` | Accept a received request |
| `POST` | `/connections/:connectionId/decline` | Silent decline — row deleted, no notification |
| `DELETE` | `/connections/:userId` | Remove an accepted connection |
| `GET` | `/connections` | List my accepted connections (paginated) |
| `GET` | `/connections/pending` | List pending received requests (paginated) |
| `GET` | `/connections/sent` | List pending sent requests (paginated) |
| `GET` | `/connections/mutual/:userId` | Count + list mutual connections with another user |

#### Service rules

- Cannot connect to yourself → `badRequest('SELF_CONNECT_NOT_ALLOWED')`
- Cannot send if a pending or accepted relationship already exists in either direction → `conflict('CONNECTION_ALREADY_EXISTS')`
- Note capped at 300 chars — enforced in Zod schema
- **Decline is silent** — row deleted, requester receives no notification
- **Accept** → queues `connection_accepted` notification to requester
- **Send request** → queues `connection_request` notification to addressee
- **Withdraw** → deletes the pending row, no notification

#### Changes to `users` module

- Remove `followUser`, `unfollowUser`, `listFollowers`, `listFollowing` from service and router
- `getPublicProfile` returns:
  - `connectionStatus: 'none' | 'pending_sent' | 'pending_received' | 'connected'`
  - `connectionId: string | null`
  - `mutualConnections: number`
  - `stats: { connections, pendingReceived, posts }` (replaces followers/following)
  - `isFollowing` field removed
- `getSuggestions` excludes users already connected or with a pending request in either direction
- `getProgress` replaces `followerCount` with `connectionCount`

#### Feed soft boost

In the feed query, add a computed column:
```sql
CASE WHEN posts.author_id IN (
  SELECT CASE
    WHEN requester_id = $me THEN addressee_id
    ELSE requester_id
  END
  FROM connections
  WHERE (requester_id = $me OR addressee_id = $me)
    AND status = 'accepted'
) THEN 1 ELSE 0 END AS is_connected
```
Sort: `ORDER BY is_connected DESC, created_at DESC`

#### Badge worker

- `follow_count` criterion renamed to `connection_count`
- Queries `connections` table: `WHERE (requester_id = $userId OR addressee_id = $userId) AND status = 'accepted'`

#### Notification worker

- Add types: `connection_request`, `connection_accepted`
- Remove type: `follow`

---

### A3. Pre-conditions and Post-conditions

#### Pre-conditions (blocked without connection)

**DM gating — `messagesService.createConversation`** (direct type only):
```ts
// Before inserting conversation row:
await assertConnected(userId, participantId, universityId)
// throws forbidden('NOT_CONNECTED') if no accepted connection exists
```

**DM send gating — `messagesService.createMessage`** (direct conversations):
- Re-check connection on every message send
- Handles edge case: user removed connection but conversation row still exists
- `type = 'mentorship'` and `type = 'group'` are **exempt** from this check
- `role = 'admin'` is **exempt** from this check
- If `target.isOpenToMsg = true` → **exempt** (opt-in bypass)

**Profile visibility gating — `getPublicProfile`:**  
Non-connected viewer receives a stripped response:
```
HIDDEN:  experience, education, featured, contact info
         (phone, email, website, github, portfolio)
VISIBLE: name, headline, role, department, bio (truncated to 150 chars),
         skills (first 3 only), mutual connections count
```

**Profile view identity:**
- Non-connection visits profile → logged as `{ anonymous: true, role, department }` in `/me/viewers`
- Connected user visits profile → logged with full identity (name + avatar)
- User with `is_open_to_msg = true` → always logged with full identity

**Connections list visibility:**
- `GET /users/:userId/connections` — only visible to own profile and connections of that user
- Non-connected viewer sees only the count, not the list

#### Post-conditions (unlocked after connecting)

- Full profile revealed immediately (experience, education, featured, contact info)
- DM now allowed — "Message" button appears on profile
- Connected user's posts soft-boosted in feed
- Profile views now show requester's full identity (not anonymous)
- In-app confirmation shown to both parties: *"You are now connected with [Name]"*
- `connection_accepted` notification sent to requester
- Mutual connections count updated on both profiles

---

### A4. Socket Events

Added to `packages/shared/src/constants/socket.ts`:
```ts
CONNECTION_REQUEST_RECEIVED: 'connection:request_received'
CONNECTION_ACCEPTED:         'connection:accepted'
```

Both use existing `user:{userId}` personal room — no new rooms needed.

---

## Spec B — Profile Redesign

### B1. Database

#### `053_create_profile_experiences.ts`

```sql
CREATE TABLE profile_experiences (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES universities(id),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  company       TEXT NOT NULL,
  location      TEXT,
  start_date    DATE NOT NULL,
  end_date      DATE,             -- NULL = currently working here
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_profile_exp_user ON profile_experiences (user_id);
CREATE INDEX idx_profile_exp_uni  ON profile_experiences (university_id, user_id);
```

#### `054_create_profile_education.ts`

```sql
CREATE TABLE profile_education (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id  UUID NOT NULL REFERENCES universities(id),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  institution    TEXT NOT NULL,   -- defaults to university name, editable
  degree         TEXT,            -- e.g. "Bachelor of Science"
  field_of_study TEXT,
  start_year     INT NOT NULL,
  end_year       INT,             -- NULL = ongoing
  grade          TEXT,
  description    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_profile_edu_user ON profile_education (user_id);
CREATE INDEX idx_profile_edu_uni  ON profile_education (university_id, user_id);
```

#### `055_create_profile_featured.ts`

```sql
CREATE TABLE profile_featured (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id    UUID NOT NULL REFERENCES universities(id),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type             TEXT NOT NULL CHECK (type IN ('post', 'link')),
  post_id          UUID REFERENCES posts(id) ON DELETE CASCADE,
  link_url         TEXT,
  link_title       TEXT,
  link_description TEXT,
  display_order    INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_profile_featured_user ON profile_featured (user_id);
-- Max 5 items per user enforced in service layer
```

#### `056_add_profile_fields.ts`

```sql
ALTER TABLE profiles ADD COLUMN location      TEXT;
ALTER TABLE profiles ADD COLUMN website_url   TEXT;
ALTER TABLE profiles ADD COLUMN github_url    TEXT;
ALTER TABLE profiles ADD COLUMN portfolio_url TEXT;
ALTER TABLE profiles ADD COLUMN is_open_to_msg BOOLEAN NOT NULL DEFAULT false;
```

#### `057_create_profile_views.ts`

```sql
CREATE TABLE profile_views (
  viewer_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  university_id UUID NOT NULL,
  viewed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (viewer_id, viewed_id)   -- upsert on repeat visit, bounded table
);
CREATE INDEX idx_profile_views_viewed ON profile_views (viewed_id, viewed_at DESC);
```

---

### B2. Backend API additions (users module)

#### Experience

| Method | Route | Auth |
|--------|-------|------|
| `GET` | `/users/:userId/experience` | Own profile **or** connected users only — returns `[]` for non-connections (no error) |
| `POST` | `/users/me/experience` | Own profile only |
| `PATCH` | `/users/me/experience/:id` | Own entry only |
| `DELETE` | `/users/me/experience/:id` | Own entry only |

#### Education

| Method | Route | Auth |
|--------|-------|------|
| `GET` | `/users/:userId/education` | Own profile **or** connected users only — returns `[]` for non-connections (no error) |
| `POST` | `/users/me/education` | Own profile only |
| `PATCH` | `/users/me/education/:id` | Own entry only |
| `DELETE` | `/users/me/education/:id` | Own entry only |

#### Featured

| Method | Route | Auth |
|--------|-------|------|
| `GET` | `/users/:userId/featured` | Own profile **or** connected users only — returns `[]` for non-connections (no error) |
| `POST` | `/users/me/featured` | Own profile only (max 5 enforced) |
| `DELETE` | `/users/me/featured/:id` | Own entry only |
| `PATCH` | `/users/me/featured/reorder` | Own profile only |

#### Profile viewers

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/users/me/viewers` | Paginated list, last 90 days, most recent first |

Viewer identity rules:
- Connected to me → full identity (name, avatar, headline)
- Not connected → `{ anonymous: true, role, department }`
- Has `is_open_to_msg = true` → always full identity

Profile view upsert triggered as side-effect of `GET /users/:userId` when `viewer ≠ target`.

#### Analytics

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/users/me/analytics` | Profile views (7d / 30d / 90d), post reach totals |

Response shape:
```ts
{
  profileViews: { last7d: number, last30d: number, last90d: number },
  postReach:    { reactions: number, comments: number, total: number }
}
```
All values default to `0`, never `null`.

#### Job match score

Added to `GET /jobs/:id` response:
```ts
jobMatch: {
  matched:    number,   // skills in common
  total:      number,   // job's required skills count
  percentage: number    // 0 if user has no skills — never throws
} | null                // null if job has no requiredSkills listed
```

#### Profile fields update

`PATCH /users/me` (existing) — add to `UpdateProfileSchema`:
- `location`, `websiteUrl`, `githubUrl`, `portfolioUrl`, `isOpenToMsg`

#### Progress checklist update

`GET /users/me/progress` — add to checklist items:
- `hasAddedExperience: boolean`
- `hasAddedEducation: boolean`

---

### B3. Skills null-safety convention

Applied everywhere — backend and frontend:

```ts
// Backend — every query touching skills
const userSkills = user.skills ?? []

// Frontend — every component reading skills
const skills = user.profile.skills ?? []
```

If user has no skills:
- Job match score → `{ matched: 0, total: N, percentage: 0 }`
- Frontend shows: *"Add skills to your profile to see your match score"* (no error)
- Resume PDF → skills section omitted silently
- Skills section on profile → shows "No skills added yet" with an "Add skills" prompt

---

### B4. Frontend

#### Connect button — 4 states

| `connectionStatus` | Button | Secondary action |
|---|---|---|
| `none` | `Connect` (primary) | — |
| `pending_sent` | `Pending` (ghost) | Dropdown → "Withdraw request" |
| `pending_received` | `Accept` + `Decline` | — |
| `connected` | `Connected` (ghost) | Dropdown → "Message" + "Remove connection" |

**Invitation modal** (shown on "Connect" click, before API call):
> **"Want to add a note?"**  
> Personalise your invitation to **[Name]** — people who include a note get accepted more often.  
> `[ Add a note ]` `[ Send invite ]`

"Add a note" expands a 300-char textarea inline. "Send invite" skips it and fires immediately.

#### Profile page — section layout

```
┌─ Header card ──────────────────────────────────────────────┐
│  Cover photo · Avatar                                      │
│  Name · Verified badge · Role badge · Department          │
│  Headline · Location · X mutual connections               │
│  [ Connect / Pending / Accept+Decline / Connected ▾ ]     │
│  [ Message ]  (only if connected or is_open_to_msg=true)  │
│  Stats: Connections · Pending (own only) · Posts          │
└────────────────────────────────────────────────────────────┘
┌─ About ─────────────────────────────────────────────── ✏️ ┐
├─ Activity (3 recent posts + "See all posts" link) ─────────┤
├─ Featured (pinned posts / external links, max 5) ────── ✏️ ┤
├─ Experience ─────────────────────────────────────── ✏️  ＋ ┤
├─ Education ──────────────────────────────────────── ✏️  ＋ ┤
├─ Skills ─────────────────────────────────────────── ✏️     ┤
├─ Contact info (connection-gated) ───────────────── ✏️     ┤
└─ Analytics (own profile only) ─────────────────────────────┘
```

#### Non-connected limited view

- **Header**: fully visible, no contact info
- **About**: bio truncated to 150 chars, fades with *"Connect to see full profile"*
- **Experience / Education / Featured / Contact info**: replaced with single locked card:
  > 🔒 *Connect with [Name] to see their full profile*
- **Skills**: first 3 shown, rest hidden behind *"+ N more"* (non-clickable)
- **Analytics**: never shown to non-self

#### Section editing modals

| Modal | Fields |
|---|---|
| **Edit intro** | Full name, headline, location, department, batch year, open to work, open to mentorship, open to message |
| **Edit about** | Bio textarea |
| **Edit contact** | Phone, LinkedIn URL, website URL, GitHub URL, portfolio URL |
| **Experience** | Title, company, location, start date, end date (or "currently here" toggle), description |
| **Education** | Institution, degree, field of study, start year, end year (or "ongoing"), grade, description |
| **Featured** | Pick from own posts OR paste external link with title + description |
| **Skills** | Tag input — add/remove skills, self-declared only |

Each section card has a `✏️` pencil icon (top-right) opening its edit modal. Experience and Education have a `＋` button to add a new entry alongside the pencil.

#### Resume export

- `ResumeExportButton` on own profile header only
- Uses `react-pdf` — client-side PDF generation, no backend call
- Sections with no data silently omitted from PDF
- PDF includes: name, headline, location, contact info, about, experience, education, skills, links

#### Profile viewers page

- Accessible from analytics card: *"X people viewed your profile"* → links to `/profile/viewers`
- Shows last 90 days, most recent first
- Connected viewers: full card (avatar, name, headline, "Connect" / "Connected" button)
- Anonymous viewers: generic card *"Someone from [Department], UIU"*

#### New routes

| Path | Page |
|---|---|
| `/connections` | My network (3 tabs: Network, Received, Sent) |
| `/profile/viewers` | Who viewed my profile |

#### New frontend files

```
src/features/connections/
  components/
    ConnectButton.tsx
    ConnectionRequestModal.tsx
    PendingRequestCard.tsx
    ConnectionCard.tsx
  hooks/
    useConnectionAction.ts    (send, withdraw, accept, decline, remove)
    useConnections.ts         (list, pending, sent, mutual)
  index.ts

src/features/profile/
  components/
    ProfileAbout.tsx
    ProfileExperience.tsx
    ProfileEducation.tsx
    ProfileFeatured.tsx
    ProfileSkills.tsx
    ProfileContactInfo.tsx
    ProfileActivity.tsx
    ProfileAnalytics.tsx
    ProfileViewers.tsx
    editModals/
      EditIntroModal.tsx
      EditAboutModal.tsx
      EditContactModal.tsx
      ExperienceModal.tsx
      EducationModal.tsx
      FeaturedModal.tsx
      SkillsModal.tsx

src/pages/ConnectionsPage.tsx
```

#### Modified files

- `ProfileHeader.tsx` — replace follow logic with `ConnectButton`, add Message button, update stats bar
- `PersonSuggestionCard.tsx` — replace follow with `ConnectButton`
- `PeopleResultCard.tsx` — replace follow with `ConnectButton`
- `RightSidebar.tsx` — suggestions use `ConnectButton`
- `LeftSidebar.tsx` — add "My network" nav link → `/connections`
- `ProfilePage.tsx` — orchestrate all new profile sections

---

### B5. Shared types (`packages/shared`)

#### Updated `publicUserProfileSchema`

```ts
// Replaced
isFollowing: z.boolean()
stats: { followers, following, posts }

// With
connectionStatus: z.enum(['none', 'pending_sent', 'pending_received', 'connected'])
connectionId:     z.string().uuid().nullable()
mutualConnections: z.number().int()
stats: z.object({
  connections:     z.number().int(),
  pendingReceived: z.number().int(),   // own profile only, 0 for others
  posts:           z.number().int(),
})
profile: {
  // additions
  location:      z.string().nullable(),
  websiteUrl:    z.string().nullable(),
  githubUrl:     z.string().nullable(),
  portfolioUrl:  z.string().nullable(),
  isOpenToMsg:   z.boolean(),
}
```

#### New schemas

```ts
connectionSchema              // accepted connection row
connectionRequestSchema       // pending request row (includes note)
profileExperienceSchema       // one experience entry
profileEducationSchema        // one education entry
profileFeaturedSchema         // one featured item
profileAnalyticsSchema        // analytics response
profileViewerSchema           // viewer (identified or anonymous)
jobMatchSchema                // job match score
```

---

## Premium-inspired features (Tier 1 — in scope)

| Feature | Where |
|---|---|
| Who viewed your profile (last 90 days) | `/profile/viewers`, analytics card |
| Resume PDF export | Profile header (own only), `react-pdf` client-side |
| Profile & post analytics | Analytics section (own only) |
| Job match score | Job detail page — *"You match X of Y skills"* |
| Open to message toggle | Profile settings, bypasses DM connection gate |
| Portfolio links (GitHub, portfolio URL) | Contact info section + edit intro modal |

## Tier 2 — Upcoming features (not in this spec)

- Alumni career paths (*"Alumni from your department now work at…"*)
- Strong applicant signal on job applications
- Search appearance insights (*"Your profile appeared in 12 searches this week"*)

---

## Design system rules (non-negotiable)

All new UI follows existing token conventions:
- No hardcoded hex — always `var(--token-name)`
- Borders: `0.5px solid var(--border-*)`
- Buttons: `border-radius: var(--r-pill)`
- Font weight: 400 and 500 only
- Text: sentence case everywhere
- Surface stacking: `--surface-page → --surface-card → --surface-raised`

---

## Implementation order

1. DB migrations (051 → 057)
2. Connections module (backend)
3. Users module cleanup (remove follow, update getPublicProfile, getProgress, getSuggestions)
4. Messages module (DM gating)
5. Feed boost
6. Badge + notification workers
7. Shared types update
8. `ConnectButton` + `ConnectionRequestModal` (frontend)
9. `ConnectionsPage` + hooks
10. Profile sections (backend routes + frontend components)
11. Editing modals
12. Analytics + viewers
13. Resume export
14. Job match score
15. Full regression: profile visibility, DM gates, feed, notifications
