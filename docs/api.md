# API Reference

**Base URL:** `https://api.uniconnect.app/api/v1` (production) · `http://localhost:3001/api/v1` (dev)

All endpoints return JSON. Authentication uses a Bearer token in the `Authorization` header unless noted. Every request must also include `x-university-domain` (e.g. `uiu.ac.bd`) so the `resolveUniversity` middleware can scope the request to a tenant.

Every `/api/v1` response carries `Cache-Control: no-store` (set in `app.ts`). Responses are per-user, and a conditional 304 once served a stale `GET /notifications` body after a new notification landed.

Zod validation failures return **422 `VALIDATION_ERROR`**, not 400.

---

## Conventions

### Request headers
```
Authorization: Bearer <accessToken>
Content-Type: application/json
x-university-domain: uiu.ac.bd
```

### Success response
```json
{ "data": <payload> }
```

### Error response
```json
{
  "error": "Human-readable message",
  "code": "MACHINE_READABLE_CODE"
}
```

### Common error codes
| Code | HTTP | Meaning |
|------|------|---------|
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Authenticated but not permitted |
| `NOT_FOUND` | 404 | Resource does not exist |
| `VALIDATION_ERROR` | 422 | Request body failed Zod schema |
| `RATE_LIMITED` | 429 | Too many requests |
| `CONFLICT` | 409 | Unique constraint violation |

### Pagination
List endpoints accept `?page=1&limit=20`. Response:
```json
{ "data": { "items": [...], "total": 120, "page": 1, "limit": 20, "hasMore": true } }
```

### Mount paths — not all routers live at `/api/v1/<moduleName>`
A few modules are mounted at a base path that differs from their directory name under `apps/api/src/modules/`. This table is ground truth (from `apps/api/src/app.ts`):

| Module dir | Mounted at |
|---|---|
| `feed` | `/api/v1/posts` (+ a second router `pollsRouter` at `/api/v1/polls`) |
| `messages` | `/api/v1/conversations` |
| `content-sync` | `/api/v1/admin/content-sync` |
| `learning-admin` | `/api/v1/admin/learning` |
| `academic` | `/api/v1/groups` (mounted alongside `groupsRouter`, `mergeParams: true`, so its routes are `/groups/:groupId/course-outline`, etc.) |
| `campus` | `/api/v1` (bare — its own routes start with `/lost-found`, `/shuttle/...`, `/courses...`, so there is **no** `/api/v1/campus` prefix) |
| `drafts` | `/api/v1/me/drafts` |
| everything else | `/api/v1/<moduleName>` |

---

## Auth (`/api/v1/auth`)
No `requireAuth` on the whole router — only on `/me`, `/change-password`, `/sessions*`.

| Method | Path | Description | Auth |
|---|---|---|---|
| POST | `/auth/register` | Register with an invitation token; sends email OTP | — |
| POST | `/auth/verify-otp` | Verify registration OTP | — (rate limited) |
| POST | `/auth/login` | Login → `{ accessToken, user }` directly (no OTP step for verified users); sets refresh cookie | — (rate limited: 10/min/IP) |
| POST | `/auth/verify-login-otp` | Verify OTP for an unverified user attempting login | — (rate limited) |
| POST | `/auth/resend-otp` | Resend a 6-digit OTP | — (rate limited) |
| POST | `/auth/refresh` | Issue new access token from refresh cookie | — |
| POST | `/auth/logout` | Revoke refresh token | — |
| POST | `/auth/forgot-password` | Send password-reset email | — |
| POST | `/auth/reset-password` | Reset password with token | — (rate limited) |
| GET | `/auth/me` | Current user + profile | required |
| POST | `/auth/change-password` | Change password (old + new) | required |
| GET | `/auth/sessions` | List active `user_sessions` | required |
| DELETE | `/auth/sessions` | Revoke all sessions except current | required |
| DELETE | `/auth/sessions/:sessionId` | Revoke a specific session | required |
| GET | `/auth/invitation/:token` | Look up invitation details (email, role) before registering | — |

### `POST /auth/register`
```json
// body
{ "token": "inv_abc123", "password": "min8chars", "fullName": "Joydip Datta" }
// response 201
{ "data": { "user": { "id": "uuid", "email": "jd@uiu.ac.bd", "role": "student" }, "accessToken": "..." } }
```

### `POST /auth/login`
```json
// body
{ "email": "jd@uiu.ac.bd", "password": "..." }
// response 200 — also sets httpOnly refreshToken cookie
{ "data": { "user": {...}, "accessToken": "..." } }
```

---

## Users & Profiles (`/api/v1/users`)
All routes require auth.

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/users/me` | Own profile | required |
| PATCH | `/users/me` | Update own profile | required |
| PATCH | `/users/me/preferences` | Theme / locale prefs | required |
| POST | `/users/me/deactivate` | Sets `users.deactivated_at` | required |
| GET | `/users/me/export` | Export own data | required |
| GET | `/users/me/deletion-request` | Get own pending account-deletion request | required |
| POST | `/users/me/deletion-request` | Request account deletion (admin reviews) | required |
| DELETE | `/users/me/deletion-request` | Cancel own pending deletion request | required |
| GET | `/users/me/privacy` | Get privacy preferences | required |
| PUT | `/users/me/privacy` | Update privacy preferences | required |
| GET | `/users/me/progress` | Learning-progress summary | required |
| GET | `/users/suggestions` | People-you-may-know | required |
| GET | `/users/username-available` | Check if `?username=` is free | required |
| GET | `/users/by-username/:username` | Look up user by vanity username | required |
| GET | `/users/` | Paginated user list/search | required |
| GET | `/users/:userId` | Public profile (also upserts a `profile_views` row as a side effect) | required |
| GET | `/users/:userId/experience` | List a user's experience entries | required |
| POST | `/users/me/experience` | Create own experience entry | required |
| PATCH | `/users/me/experience/:entryId` | Update own experience entry | required |
| DELETE | `/users/me/experience/:entryId` | Delete own experience entry | required |
| GET | `/users/:userId/education` | List a user's education entries | required |
| POST | `/users/me/education` | Create own education entry | required |
| PATCH | `/users/me/education/:entryId` | Update own education entry | required |
| DELETE | `/users/me/education/:entryId` | Delete own education entry | required |
| GET | `/users/:userId/featured` | List a user's featured items | required |
| POST | `/users/me/featured` | Add a featured item (max 5) | required |
| DELETE | `/users/me/featured/:entryId` | Delete a featured item | required |
| PATCH | `/users/me/featured/reorder` | Reorder featured items | required |
| GET | `/users/me/analytics` | 7/30/90-day profile-view counts | required |
| GET | `/users/me/viewers` | Paginated recent profile viewers (last 90 days) | required |
| GET | `/users/:userId/connections` | Public list of a user's accepted connections | required |
| POST | `/users/me/problem-reports` | File a crash report from the in-shell "This page didn't load" card. One row per `(user_id, error_id)`, so a resend is a retry; capped at `PROBLEM_REPORTS_PER_HOUR` | required |

Note: static paths (`/me`, `/suggestions`, `/username-available`, `/by-username/:username`) are declared before the catch-all `GET /:userId` in the router, so they are not shadowed.

---

## Connections (`/api/v1/connections`)
Bidirectional connection graph (the old `follows` table was dropped in migration `052`). All routes require auth.

| Method | Path | Description | Auth |
|---|---|---|---|
| POST | `/connections/request/:userId` | Send a connection request (optional `note`) | required (rate limited) |
| DELETE | `/connections/request/:userId` | Withdraw a sent request | required |
| POST | `/connections/:connectionId/accept` | Accept a received request | required |
| POST | `/connections/:connectionId/decline` | Decline a received request | required |
| DELETE | `/connections/:userId` | Remove an existing connection | required |
| GET | `/connections/` | My accepted connections | required |
| GET | `/connections/pending` | Requests received (pending) | required |
| GET | `/connections/sent` | Requests sent (pending) | required |
| GET | `/connections/mutual/:userId` | Mutual connections with a user | required |

---

## Posts / Feed (mounted at `/api/v1/posts`, module dir `feed`)
All routes require auth. Static paths (`/trending`, `/archived`, `/saved`) are declared before `/:postId` in the router.

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/posts` | Home/group feed. Takes `type` (post type), `scope=my_groups` (posts from groups you belong to), `groupId` and a ranking sort. Both `type` and `scope` apply to the count query as well as the rows | required |
| POST | `/posts` | Create a post (rate limited). In a group with `require_post_approval`, non-moderators' posts land as `group_review_status='pending'` | required |
| GET | `/posts/trending` | Trending posts | required |
| GET | `/posts/archived` | Own archived posts (excludes posts an admin removed) | required |
| GET | `/posts/saved` | My bookmarked posts (backs `/saved`) | required |
| GET | `/posts/:postId` | Get a post | required |
| PATCH | `/posts/:postId` | Update own post | required |
| DELETE | `/posts/:postId` | Delete own post | required |
| POST | `/posts/:postId/archive` | Archive a post | required |
| POST | `/posts/:postId/unarchive` | Unarchive a post. Refused with `403 POST_REMOVED` if an admin removed it | required |
| POST | `/posts/:postId/reactions` | React to a post | required |
| DELETE | `/posts/:postId/reactions` | Remove own reaction | required |
| GET | `/posts/:postId/reactions` | List reactions on a post | required |
| GET | `/posts/:postId/comments` | List comments (supports `parentId`) | required |
| POST | `/posts/:postId/comments` | Create a comment (rate limited) | required |
| DELETE | `/posts/:postId/comments/:commentId` | Delete own comment | required |
| POST | `/posts/:postId/comments/:commentId/reactions` | React to a comment | required |
| DELETE | `/posts/:postId/comments/:commentId/reactions` | Remove comment reaction | required |
| POST | `/posts/:postId/poll/vote` | Vote in a post's poll | required |
| POST | `/posts/:postId/save` | Save post | required |
| DELETE | `/posts/:postId/save` | Unsave post | required |
| POST | `/posts/:postId/share` | Share/repost (rate limited) | required |
| DELETE | `/posts/:postId/share` | Unshare | required |

### Polls (mounted at `/api/v1/polls`)
| Method | Path | Description | Auth |
|---|---|---|---|
| POST | `/polls/:pollId/vote` | Vote directly by poll id | required |

---

## Jobs (`/api/v1/jobs`)
All routes require auth.

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/jobs/` | List jobs (filters, search). Jobs with a future `publish_at` are hidden by the `isLive` filter | required |
| POST | `/jobs/` | Create a job posting | `alumni`, `faculty`, `admin` |
| GET | `/jobs/saved` | My saved jobs | required |
| GET | `/jobs/my` | Jobs I posted | required |
| GET | `/jobs/applications/my` | My job applications | required |
| GET | `/jobs/:jobId` | Get a job | required |
| PATCH | `/jobs/:jobId` | Update a job | `alumni`, `faculty`, `admin` |
| DELETE | `/jobs/:jobId` | Delete a job | `alumni`, `faculty`, `admin` |
| POST | `/jobs/:jobId/apply` | Apply to a job. For students, the API enforces `evaluateJobEligibility()` from `@uniconnect/shared` (departments, batches, `min_cgpa`) | required |
| POST | `/jobs/:jobId/withdraw` | Withdraw my application. This is the only way to set `status='withdrawn'` | required |
| GET | `/jobs/:jobId/applications` | List applicants | `alumni`, `faculty`, `admin` |
| PATCH | `/jobs/:jobId/applications/:appId` | Update application status | `alumni`, `faculty`, `admin` |
| POST | `/jobs/:jobId/save` | Save a job | required |
| DELETE | `/jobs/:jobId/save` | Unsave a job | required |

---

## Events (`/api/v1/events`)
All routes require auth.

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/events/` | List events | required |
| POST | `/events/` | Create an event | `faculty`, `admin` |
| GET | `/events/my` | My RSVP'd / organized events (`MyEventsQuerySchema`) | required |
| GET | `/events/dates` | Days that have events in a range (backs the date picker) | required |
| GET | `/events/organisers` | Top organisers (right rail) | required |
| GET | `/events/:eventId` | Get an event | required |
| PATCH | `/events/:eventId` | Update an event | `faculty`, `admin` |
| DELETE | `/events/:eventId` | Delete an event | `faculty`, `admin` |
| PATCH | `/events/:eventId/publish` | Publish a draft/scheduled event | `faculty`, `admin` |
| POST | `/events/:eventId/rsvp` | RSVP. Once an event is at `capacity`, a `going` RSVP is stored as `waitlisted` (migration 115) | required |
| DELETE | `/events/:eventId/rsvp` | Remove RSVP | required |
| GET | `/events/:eventId/attendees` | List attendees | required |
| GET | `/events/:eventId/ical` | Download `.ics` calendar file | required |

---

## Groups (`/api/v1/groups`)
The largest module. All routes require auth. Group roles (`owner | admin | moderator | member`) are separate from platform roles. The service-layer helpers are `assertCanAdminGroup` (owner/admin) and `canModerate` (owner/admin/moderator). "admin/moderator" below means the service check, not `requireRole`.

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/groups/` | List groups | required |
| POST | `/groups/` | Create a group | required |
| GET | `/groups/my` | My groups | required |
| GET | `/groups/suggestions` | Suggested groups for me | required |
| POST | `/groups/course-outline/draft` | AI-draft a course outline from pasted/uploaded text (import wizard step 1) | `faculty`, `admin` |
| POST | `/groups/from-outline` | Create an academic group from a confirmed outline | `faculty`, `admin` |
| GET | `/groups/invite-match` | Count users matching a department/batch invite filter | `faculty`, `admin` |
| GET | `/groups/:groupId` | Get a group | required |
| PATCH | `/groups/:groupId` | Update a group | owner/admin (service-enforced) |
| DELETE | `/groups/:groupId` | Delete a group | owner/admin |
| PATCH | `/groups/:groupId/settings` | Toggle `is_private`, `require_post_approval`, `require_event_approval` | owner/admin |
| GET | `/groups/:groupId/moderation-log` | Moderation log (`group_moderation_log`) | owner/admin |
| GET | `/groups/:groupId/review/summary` | Pending post/event counts | owner/admin/moderator |
| GET | `/groups/:groupId/review/posts` | Pending posts | owner/admin/moderator |
| PATCH | `/groups/:groupId/review/posts/:postId` | Approve/decline a pending post | owner/admin/moderator |
| GET | `/groups/:groupId/review/events` | Pending events | owner/admin/moderator |
| PATCH | `/groups/:groupId/review/events/:eventId` | Approve/decline a pending event | owner/admin/moderator |
| GET | `/groups/:groupId/analytics` | Group analytics | owner/admin/moderator |
| POST | `/groups/:groupId/join` | Join or request to join (private groups) | required |
| DELETE | `/groups/:groupId/leave` | Leave group | required |
| POST | `/groups/:groupId/members` | Alias of join (same handler as `/join`) | required |
| DELETE | `/groups/:groupId/members/me` | Alias of leave (same handler) | required |
| PATCH | `/groups/:groupId/members/me/mute` | Mute/unmute the group for myself (`group_members.is_muted`) | member |
| GET | `/groups/:groupId/members` | List members | required |
| PATCH | `/groups/:groupId/members/:userId` | Change a member's role | admin/moderator |
| DELETE | `/groups/:groupId/members/:userId` | Remove a member | admin/moderator |
| GET | `/groups/:groupId/join-requests` | List join requests (`JoinRequestsQuerySchema`) | owner/admin |
| PATCH | `/groups/:groupId/join-requests/:requestId` | Approve/reject a join request | admin/moderator |
| DELETE | `/groups/:groupId/join-requests/me` | Cancel my own join request | required |
| GET | `/groups/:groupId/posts` | Group's posts | required |
| GET | `/groups/:groupId/events` | Group's events | required |
| GET | `/groups/:groupId/collaborations` | Group's collaboration items | required |
| POST | `/groups/:groupId/invitations` | Invite a user to the group | owner/admin |
| POST | `/groups/:groupId/invitations/bulk` | Bulk-invite by filter | `admin` |
| GET | `/groups/:groupId/invitations` | Pending invites | owner/admin |
| DELETE | `/groups/:groupId/invitations/:invitationId` | Cancel an invite | owner/admin |
| POST | `/groups/:groupId/chat` | Open (lazily create) the group chat conversation (`groups.chat_conversation_id`) | member |
| POST | `/groups/:groupId/ask-teacher` | Ask the group's teacher a question | member |
| GET | `/groups/:groupId/ask-teacher/queue` | Teacher's queue of questions | owner/admin |
| GET | `/groups/:groupId/announcements` | List announcements (academic groups) | member |
| POST | `/groups/:groupId/announcements` | Create an announcement (`urgent`/`schedule`/`notice`); academic groups only | owner/admin |
| PATCH | `/groups/:groupId/announcements/:announcementId` | Update an announcement | owner/admin |
| DELETE | `/groups/:groupId/announcements/:announcementId` | Delete an announcement | owner/admin |
| GET | `/groups/:groupId/consultation-slots` | List consultation slots with bookings | member |
| POST | `/groups/:groupId/consultation-slots` | Create a weekly slot | owner/admin |
| DELETE | `/groups/:groupId/consultation-slots/:slotId` | Delete a slot | owner/admin |
| POST | `/groups/:groupId/consultation-slots/:slotId/book` | Book a slot for a date | member |
| PATCH | `/groups/:groupId/consultation-slots/:slotId/bookings/:bookingId` | Confirm/decline a booking | owner/admin |
| GET | `/groups/:groupId/resources` | List resources | required |
| POST | `/groups/:groupId/resources` | Add a resource (file link) | required |
| DELETE | `/groups/:groupId/resources/:resourceId` | Delete a resource | required |
| PATCH | `/groups/:groupId/resources/:resourceId/track` | Record a resource view | required |
| PATCH | `/groups/:groupId/pinned` | Set pinned announcement/post | admin/moderator |
| PATCH | `/groups/:groupId/rules` | Set group rules | admin/moderator |
| GET | `/groups/:groupId/stats` | Analytics stats | required |
| GET | `/groups/:groupId/study-sessions` | List study sessions | required |
| POST | `/groups/:groupId/study-sessions` | Create a study session | required |
| DELETE | `/groups/:groupId/study-sessions/:sessionId` | Delete a study session | creator/admin |
| POST | `/groups/:groupId/study-sessions/:sessionId/rsvp` | RSVP to a study session | required |
| GET | `/groups/:groupId/study-sessions/:sessionId/notes/creator` | Get session creator notes | required |
| PUT | `/groups/:groupId/study-sessions/:sessionId/notes/creator` | Set session creator notes | creator |
| GET | `/groups/:groupId/study-sessions/:sessionId/notes/creator/upload-url` | Presign upload URL for creator notes attachment | creator |
| GET | `/groups/:groupId/study-sessions/:sessionId/notes/private` | Get my private session notes | required |
| PUT | `/groups/:groupId/study-sessions/:sessionId/notes/private` | Set my private session notes | required |
| GET | `/groups/:groupId/study-sessions/:sessionId/notes/private/upload-url` | Presign upload URL for private notes attachment | required |
| GET | `/groups/:groupId/flashcard-decks` | List flashcard decks | required, `requireAcademicGroup` |
| POST | `/groups/:groupId/flashcard-decks` | Create a flashcard deck | required, `requireAcademicGroup` |
| PATCH | `/groups/:groupId/flashcard-decks/:deckId` | Update a deck | required, `requireAcademicGroup` |
| DELETE | `/groups/:groupId/flashcard-decks/:deckId` | Delete a deck | required, `requireAcademicGroup` |
| GET | `/groups/:groupId/flashcard-decks/:deckId/cards` | List cards in a deck | required, `requireAcademicGroup` |
| POST | `/groups/:groupId/flashcard-decks/:deckId/cards` | Create a card in a deck | required, `requireAcademicGroup` |
| GET | `/groups/:groupId/flashcard-decks/:deckId/review` | Get spaced-repetition review queue | required, `requireAcademicGroup` |
| PATCH | `/groups/:groupId/flashcards/:cardId` | Update a card | required, `requireAcademicGroup` |
| DELETE | `/groups/:groupId/flashcards/:cardId` | Delete a card | required, `requireAcademicGroup` |
| POST | `/groups/:groupId/flashcards/:cardId/review` | Submit a review (SM-2 style) | required, `requireAcademicGroup` |
| GET | `/groups/:groupId/shared-notes` | List shared notes | required |
| POST | `/groups/:groupId/shared-notes` | Create a shared note | required |
| PATCH | `/groups/:groupId/shared-notes/:noteId` | Update a shared note | author/admin |
| DELETE | `/groups/:groupId/shared-notes/:noteId` | Delete a shared note | author/admin |
| POST | `/groups/:groupId/shared-notes/upload-url` | Presign upload URL for a shared note attachment | required |
| GET | `/groups/:groupId/ai-settings` | Get AI-content settings (academic groups only) | required |
| PATCH | `/groups/:groupId/ai-settings` | Update AI-content settings | admin/moderator |
| GET | `/groups/:groupId/ai-settings/pending` | List pending AI-generated content for review | admin/moderator |
| POST | `/groups/:groupId/ai-settings/pending/:contentId/approve` | Approve pending AI content | admin/moderator |
| DELETE | `/groups/:groupId/ai-settings/pending/:contentId` | Discard pending AI content | admin/moderator |

### Academic sub-router (mounted with `mergeParams` under `/api/v1/groups`)
Course-management endpoints for academic groups. All under `/groups/:groupId/...`, all require auth.

| Method | Path | Description |
|---|---|---|
| GET | `/groups/:groupId/course-outline` | Get course outline |
| POST | `/groups/:groupId/course-outline` | Create course outline |
| PUT | `/groups/:groupId/course-outline` | Replace course outline |
| PATCH | `/groups/:groupId/course-outline/assessments` | Update assessment weights |
| PATCH | `/groups/:groupId/course-outline/topics` | Update topic list |
| GET | `/groups/:groupId/gradebook` | Get gradebook |
| PUT | `/groups/:groupId/gradebook/entries` | Upsert gradebook entries |
| GET | `/groups/:groupId/gradebook/me` | My grade card |
| GET | `/groups/:groupId/gradebook/students/:studentId` | A specific student's grade card |
| GET | `/groups/:groupId/modules` | List modules |
| POST | `/groups/:groupId/modules` | Create a module |
| POST | `/groups/:groupId/modules/upload-url` | Presign upload URL for a module file (`academic_group_modules.file_urls`) |
| PATCH | `/groups/:groupId/modules/reorder` | Reorder modules |
| PATCH | `/groups/:groupId/modules/:moduleId` | Update a module |
| DELETE | `/groups/:groupId/modules/:moduleId` | Delete a module |
| PATCH | `/groups/:groupId/modules/:moduleId/publish` | Publish a module |
| GET | `/groups/:groupId/assignments` | List assignments |
| POST | `/groups/:groupId/assignments` | Create an assignment |
| POST | `/groups/:groupId/assignments/upload-url` | Presign upload URL for assignment attachment |
| GET | `/groups/:groupId/assignments/:assignmentId` | Get an assignment |
| PATCH | `/groups/:groupId/assignments/:assignmentId` | Update an assignment |
| DELETE | `/groups/:groupId/assignments/:assignmentId` | Delete an assignment |
| GET | `/groups/:groupId/assignments/:assignmentId/submissions` | List submissions |
| POST | `/groups/:groupId/assignments/:assignmentId/submit` | Submit an assignment |
| POST | `/groups/:groupId/assignments/:assignmentId/submissions/upload-url` | Presign upload URL for a submission |
| PATCH | `/groups/:groupId/assignments/:assignmentId/submissions/:submissionId/grade` | Grade a submission |

---

## Conversations & Messages (mounted at `/api/v1/conversations`, module dir `messages`)
All routes require auth.

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/conversations/` | List my conversations | required |
| POST | `/conversations/` | Start a new DM/group chat (rate limited) | required |
| GET | `/conversations/:convId` | Get a conversation | required |
| PATCH | `/conversations/:convId` | Update conversation (rename group, etc.) | required |
| DELETE | `/conversations/:convId/leave` | Leave a conversation | required |
| PATCH | `/conversations/:convId/preferences` | My per-thread prefs: pin, `chat_theme`, `quick_emoji`, mute | required |
| GET | `/conversations/:convId/common-groups` | Groups I share with the other participant | required |
| GET | `/conversations/:convId/files` | Shared files/media in the thread (`SharedFilesQuerySchema`) | required |
| GET | `/conversations/:convId/messages` | List messages (cursor pagination) | required |
| POST | `/conversations/:convId/messages` | Send a message (supports `attachments`, `view_once`) | required |
| PATCH | `/conversations/:convId/messages/:msgId` | Edit own message (sets `edited_at`, emits `conv:message:updated`) | required |
| DELETE | `/conversations/:convId/messages/:msgId` | Delete own message for everyone | required |
| POST | `/conversations/:convId/messages/:msgId/hide` | Delete for me only (`message_user_states.is_hidden`) (rate limited) | required |
| POST | `/conversations/:convId/messages/:msgId/open-once` | Open a view-once photo (stamps `once_viewed_at`, emits `conv:message:once-opened`) (rate limited) | required |
| POST | `/conversations/:convId/messages/:msgId/reactions` | React to a message (rate limited) | required |
| DELETE | `/conversations/:convId/messages/:msgId/reactions` | Remove message reaction | required |
| POST | `/conversations/:convId/read` | Mark conversation read | required |

`conversations.type` discriminates `direct` / `group` / `mentorship` (auto-created on mentorship-request acceptance).

---

## Moderation (`/api/v1/moderation`)
All routes require auth.

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/moderation/blocks` | List blocked users | required |
| POST | `/moderation/block/:userId` | Block a user (rate limited) | required |
| DELETE | `/moderation/block/:userId` | Unblock a user | required |
| GET | `/moderation/mutes` | List muted users | required |
| POST | `/moderation/mute/:userId` | Mute a user (rate limited) | required |
| DELETE | `/moderation/mute/:userId` | Unmute a user | required |
| POST | `/moderation/report` | Report content/a user (rate limited) | required |

---

## Notifications (`/api/v1/notifications`)
All routes require auth.

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/notifications/preferences` | Get notification preferences | required |
| PUT | `/notifications/preferences` | Update notification preferences | required |
| GET | `/notifications/` | List notifications | required |
| PATCH | `/notifications/:notificationId/read` | Mark one as read | required |
| POST | `/notifications/read-all` | Mark all as read | required |
| DELETE | `/notifications/:notificationId` | Delete a notification | required |
| POST | `/notifications/:notificationId/accept` | Accept a group invitation notification | required |

---

## News (`/api/v1/news`)
All routes require auth.

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/news/` | List news items | required |
| GET | `/news/rail` | News page right-rail data (key dates, etc.) | required |
| POST | `/news/` | Create a news item (`summary`, `tags`, `key_date` since migration 114) | `faculty`, `admin` |
| GET | `/news/:newsId` | Get a news item | required |
| PATCH | `/news/:newsId` | Update a news item | `faculty`, `admin` |
| DELETE | `/news/:newsId` | Delete a news item | `faculty`, `admin` |

---

## Campus — Lost & Found, Shuttle, Courses (mounted bare at `/api/v1`, module dir `campus`)
**No `/campus` prefix** — routes hang directly off `/api/v1`. All require auth.

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/lost-found` | List lost/found items | required |
| POST | `/lost-found` | Report a lost/found item | `student`, `alumni`, `faculty`, `admin` |
| GET | `/lost-found/saved` | My saved items | required |
| GET | `/lost-found/stats` | Counts for the page header | required |
| PUT | `/lost-found/desk` | Edit the campus lost-and-found desk info (`university_settings.lost_found_desk`) | `admin` |
| GET | `/lost-found/:itemId` | Get an item | required |
| PATCH | `/lost-found/:itemId` | Update an item | members (owner-checked in service) |
| DELETE | `/lost-found/:itemId` | Delete an item | members (owner-checked in service) |
| PATCH | `/lost-found/:itemId/resolve` | Mark resolved (stamps `resolved_at`) | members (owner-checked in service) |
| PATCH | `/lost-found/:itemId/pin` | Pin/unpin an item | `admin` |
| POST | `/lost-found/:itemId/save` | Save an item | members |
| DELETE | `/lost-found/:itemId/save` | Unsave an item | members |
| GET | `/shuttle/routes` | List shuttle routes | required |
| POST | `/shuttle/routes` | Create a route | `faculty`, `admin` |
| PATCH | `/shuttle/routes/:routeId` | Update a route | `faculty`, `admin` |
| DELETE | `/shuttle/routes/:routeId` | Delete a route | `faculty`, `admin` |
| GET | `/shuttle/locations` | Latest GPS per active route | required |
| POST | `/shuttle/locations` | Broadcast live GPS | `driver`, `admin` |
| GET | `/shuttle/duty` | The driver's duty view: open shift, recent shifts | `driver`, `admin` |
| POST | `/shuttle/shifts/start` | Open a shift on a route (one open shift per driver) | `driver`, `admin` |
| POST | `/shuttle/shifts/stop` | Close the open shift | `driver`, `admin` |
| POST | `/shuttle/shifts/riders` | Adjust the open shift's `riders_count` | `driver`, `admin` |
| GET | `/shuttle/me/stop` | My saved stop and 5-min arrival alert | required |
| PUT | `/shuttle/me/stop` | Set my stop / alert | required |
| GET | `/shuttle/notices` | Active service notices | required |
| POST | `/shuttle/notices` | Post a notice (`disruption` or `info`) | `faculty`, `admin` |
| DELETE | `/shuttle/notices/:noticeId` | Remove a notice (soft delete) | `faculty`, `admin` |
| GET | `/courses` | List courses | required |
| POST | `/courses` | Create a course | `faculty`, `admin` |
| PATCH | `/courses/:courseId` | Update a course | `faculty`, `admin` |
| POST | `/courses/:courseId/enroll` | Enroll in a course | required |
| GET | `/courses/my` | My enrolled courses | required |

Shuttle routes carry client-side estimation params (`est_duration_min`, `cycle_minutes`) so the browser can interpolate a bus along the route between GPS pings.

---

## Mentorship (`/api/v1/mentorship`)
Points economy (`POINTS_PER_SESSION = 10`, `POINTS_PER_USD = 100`), gift-card redemption, Bull lifecycle jobs (48h reminder, 7d auto-expiry). All routes require auth.

Since migration 117, points are paid **per logged session** to the alumnus, whoever logs it. The amount is recorded in `mentorship_sessions.points_awarded`, so deleting a session reverses exactly that amount. Completing a mentorship awards nothing.

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/mentorship/alumni` | List alumni open to mentoring | required |
| POST | `/mentorship/alumni/:alumniId/waitlist` | "Notify me" when a full mentor opens a place | `student` |
| DELETE | `/mentorship/alumni/:alumniId/waitlist` | Leave the waitlist | `student` |
| GET | `/mentorship/settings` | My mentor settings: accepting, `max_mentees`, `mentorship_topics`, `mentorship_availability` | `alumni` |
| PATCH | `/mentorship/settings` | Update mentor settings (`max_mentees` can't drop below current mentees; raising it notifies the waitlist) | `alumni` |
| GET | `/mentorship/sessions/mine` | Session history across mentees, plus mentorships I ended before any session (shown as "canceled") | `alumni` |
| POST | `/mentorship/requests` | Create a mentorship request. A full mentor rejects with `MENTOR_AT_CAPACITY` | `student` |
| GET | `/mentorship/requests/mine` | My sent requests | `student` |
| GET | `/mentorship/requests/incoming` | Requests received | `alumni`, `admin` |
| PATCH | `/mentorship/requests/:id` | Accept/decline (with `decline_reason`). Accepting auto-creates a `mentorship` conversation. `{ status: 'pending' }` undoes an accept/decline within `UNDO_WINDOW_MS` (15 min). Undoing an accept is refused once a session exists | `alumni`, `admin` |
| DELETE | `/mentorship/requests/:id` | Withdraw a request | `student` |
| POST | `/mentorship/requests/:id/end` | End an accepted mentorship `{ reason, note? }` → `completed`, stamps `ended_by`/`end_reason` | either party |
| POST | `/mentorship/requests/:id/reopen` | Undo an end within 15 min (only the person who ended it) | either party |
| POST | `/mentorship/requests/:id/session-requests` | Student proposes a time (slot optional) or alumnus schedules one (slot required). At most one open row per mentorship | either party |
| DELETE | `/mentorship/requests/:id/session-requests/:srid` | Withdraw a session request | either party |
| GET | `/mentorship/requests/:id/sessions` | List sessions on a request | required (either party) |
| POST | `/mentorship/requests/:id/sessions` | Log a session (date/duration/topic/notes). Awards points and closes the open session request (`done`) | required |
| PATCH | `/mentorship/requests/:id/sessions/:sid` | Update a session | required (either party) |
| DELETE | `/mentorship/requests/:id/sessions/:sid` | Delete a session (reverses its `points_awarded`) | required (either party) |
| GET | `/mentorship/requests/:id/feedback` | Get feedback for a request | required |
| POST | `/mentorship/requests/:id/feedback` | Submit feedback | required |
| GET | `/mentorship/rewards/me` | My points/rewards | `alumni` |
| GET | `/mentorship/gift-cards` | List redeemable gift cards | required |
| POST | `/mentorship/redeem` | Redeem points for a gift card | `alumni` |

Note: the actual routes differ from a naive guess — creation/list are `/requests`, `/requests/mine`, `/requests/incoming` (not a single `/requests` shared by both roles), and gift-card redemption is `POST /mentorship/redeem` (not `POST /gift-cards`).

Alumni capacity is enforced via `max_mentees` on `profiles` (default 3) at accept time. Whenever a place opens (the mentorship ends or completes, capacity is raised, or the mentor reopens to mentees), `notifyWaitlist()` notifies everyone on `mentorship_waitlist` and clears it.

---

## Presence (`/api/v1/presence`)
Tracked in Redis, not Postgres. All routes require auth.

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/presence/?userIds=...` | Online status for a set of users (respects each user's privacy tier) | required |
| GET | `/presence/online` | Online connections | required |

---

## Push (`/api/v1/push`)
Web Push (VAPID) subscriptions. All routes require auth.

| Method | Path | Description | Auth |
|---|---|---|---|
| POST | `/push/subscribe` | Register a push subscription | required |
| DELETE | `/push/subscribe` | Remove a push subscription | required |

Delivery is enqueued on the `push` Bull queue and sent by the `push` worker.

---

## Drafts (mounted at `/api/v1/me/drafts`, module dir `drafts`)

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/me/drafts/` | Own unpublished drafts unified across posts, jobs, news, events | required |

---

## Explore (`/api/v1/explore`)
All routes require auth.

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/explore/discovery` | Discovery feed (mixed content) | required |
| GET | `/explore/tags/:tag` | Posts by hashtag/tag | required |

---

## Search (`/api/v1/search`)
Rate limited (`searchLimiter`). All routes require auth.

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/search/` | Search across all types (`?q=`) | required |
| GET | `/search/people` | Search people | required |
| GET | `/search/posts` | Search posts | required |
| GET | `/search/jobs` | Search jobs | required |
| GET | `/search/events` | Search events | required |
| GET | `/search/groups` | Search groups | required |

Backed by Postgres generated `search_vector` columns (GIN-indexed) with `pg_trgm` fuzzy fallback.

---

## Upload (`/api/v1/upload`)

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/upload/presign` | Get a presigned S3/R2 PUT URL (query params define file type/folder) | required (rate limited) |

File bytes never pass through the API server — the client PUTs directly to S3/R2 after presigning.

---

## Learning (`/api/v1/learning`)
Gamified micro-learning paths. All routes require auth.

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/learning/paths` | List learning paths | required |
| GET | `/learning/paths/:pathId` | Get a path | required |
| POST | `/learning/paths/:pathId/enroll` | Enroll in a path | required |
| POST | `/learning/paths/:pathId/abandon` | Abandon a path | required |
| GET | `/learning/me/today` | Today's unit/assignment | required |
| GET | `/learning/me/stats` | My learning stats | required |
| POST | `/learning/units/:unitId/complete` | Mark a unit complete (one unit per day pace) | required |
| GET | `/learning/units/:unitId/attempts` | My past checkpoint-quiz attempts ("Past results") | required |
| POST | `/learning/units/:unitId/attempts` | Submit a checkpoint quiz. Graded server-side; a pass also completes the unit. Returns `completionError` when the daily pace refuses completion | required |
| GET | `/learning/me/quizzes` | Backs the Learn page Quizzes tab | required |
| GET | `/learning/me/badges` | My earned badges | required |
| GET | `/learning/me/badges/progress` | Learning badge catalogue with my progress counters | required |
| PUT | `/learning/me/badges/:badgeId/pin` | Pin/unpin a badge. Max `LEARNING.MAX_PINNED_BADGES` (3); a fourth pin drops the oldest | required |
| PUT | `/learning/me/badges/showcase` | Set showcased badge (legacy single-showcase) | required |
| GET | `/learning/users/:userId/badges` | A user's earned badges | required |

---

## Learning Admin (mounted at `/api/v1/admin/learning`, module dir `learning-admin`, admin only)
Mirrors the `content-sync` admin pattern for AI-generated learning content.

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/admin/learning/config` | Get learning-admin config | `admin` |
| PATCH | `/admin/learning/config` | Update config | `admin` |
| GET | `/admin/learning/pending-paths` | List AI-generated paths pending review | `admin` |
| POST | `/admin/learning/pending-paths/:id/approve` | Approve a pending path | `admin` |
| POST | `/admin/learning/pending-paths/:id/discard` | Discard a pending path | `admin` |
| GET | `/admin/learning/pending-quiz` | List AI-generated quiz batches pending review | `admin` |
| POST | `/admin/learning/pending-quiz/:id/approve` | Approve a quiz batch | `admin` |
| POST | `/admin/learning/pending-quiz/:id/discard` | Discard a quiz batch | `admin` |
| POST | `/admin/learning/generate` | Trigger on-demand AI generation (`TriggerGenerateSchema`) | `admin` |
| GET | `/admin/learning/upcoming-quizzes` | Upcoming daily-quiz slots | `admin` |
| GET | `/admin/learning/analytics` | Learning analytics | `admin` |
| GET | `/admin/learning/quizzes` | All quizzes (daily + pool) | `admin` |
| POST | `/admin/learning/quizzes/generate` | AI-generate a quiz on demand | `admin` |
| GET | `/admin/learning/quizzes/:kind/:id` | A quiz's questions | `admin` |
| POST | `/admin/learning/paths/draft` | AI-draft a skill path | `admin` |
| GET | `/admin/learning/paths` | List paths (`AdminListPathsQuerySchema`) | `admin` |
| POST | `/admin/learning/paths` | Create a path (optionally scoped by `department`) | `admin` |
| GET | `/admin/learning/paths/:id` | Path detail with units | `admin` |
| PATCH | `/admin/learning/paths/:id` | Update a path | `admin` |
| PATCH | `/admin/learning/paths/:id/publish` | Publish/unpublish | `admin` |
| POST | `/admin/learning/paths/:id/units` | Add a unit | `admin` |
| PATCH | `/admin/learning/paths/:id/units/reorder` | Reorder units (declared before `/:unitId`) | `admin` |
| PATCH | `/admin/learning/paths/:id/units/:unitId` | Update a unit (writes `content.estimatedMinutes`, `video_url`, …) | `admin` |
| DELETE | `/admin/learning/paths/:id/units/:unitId` | Delete a unit | `admin` |

---

## Quiz (`/api/v1/quiz`)
Daily quiz slot + leaderboard. All routes require auth.

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/quiz/today` | Today's quiz slot | required |
| GET | `/quiz/today/leaderboard` | Today's leaderboard | required |
| POST | `/quiz/today/:slotId/attempt` | Submit answers for today's slot | required |
| GET | `/quiz/me/history` | My quiz history | required |

---

## Klipy (`/api/v1/klipy`)
GIF/sticker media search (Klipy provider). All routes require auth.

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/klipy/:media/trending` | Trending items for a media type (`gifs`\|`stickers`\|`clips`) | required |
| GET | `/klipy/:media/search` | Search items | required |
| GET | `/klipy/:media/categories` | List categories | required |
| POST | `/klipy/:media/share/:slug` | Record a share event | required |

---

## Admin (`/api/v1/admin`)
Requires `faculty` or `admin` role on every route; several sub-routes additionally require `admin` only (marked below). Admin actions are recorded in `university_audit_log`.

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/admin/stats` | Dashboard stats | `admin` only |
| GET | `/admin/shuttle/stats` | Shuttle ops stats | `admin` only |
| GET | `/admin/shuttle/settings` | Shuttle ops toggles (live GPS, rider ETA, auto-assign, service alerts) | `admin` only |
| PATCH | `/admin/shuttle/settings` | Update shuttle ops toggles | `admin` only |
| GET | `/admin/users` | Paginated user list (`ListUsersQuerySchema`: role/status/search filters) | `faculty`/`admin` |
| GET | `/admin/groups` | Paginated group list | `faculty`/`admin` |
| PATCH | `/admin/users/:userId/verify` | Mark a user verified | `admin` only |
| PATCH | `/admin/users/:userId/role` | Change a user's role | `admin` only |
| PATCH | `/admin/users/:userId/status` | Activate/suspend a user | `admin` only |
| DELETE | `/admin/users/:userId` | Delete a user | `admin` only |
| POST | `/admin/users/driver` | Create a `driver`-role user | `admin` only |
| GET | `/admin/reports` | Content-report queue | `faculty`/`admin` |
| PATCH | `/admin/reports/:reportId` | Resolve a report | `faculty`/`admin` |
| GET | `/admin/reports/grouped` | Moderation queue: reports collapsed per `(target_type, target_id)` with the highest severity and a resolved `location: { label, path }` | `faculty`/`admin` |
| GET | `/admin/reports/target/:targetType/:targetId` | Every open report on one target, with reporter, reason and description ("Review") | `faculty`/`admin` |
| PATCH | `/admin/reports/target/:targetType/:targetId` | Remove or dismiss all reports on a target | `faculty`/`admin` |
| GET | `/admin/problem-reports` | Crash reports filed from the error card | `admin` only |
| PATCH | `/admin/problem-reports/:reportId` | Resolve/reopen a problem report (audited) | `admin` only |
| GET | `/admin/deletion-requests` | List account-deletion requests | `faculty`/`admin` |
| PATCH | `/admin/deletion-requests/:requestId` | Approve/reject a deletion request | `admin` only |
| POST | `/admin/invitations/bulk` | Bulk-create invitations | `admin` only |
| POST | `/admin/invitations` | Create an invitation | `faculty`/`admin` |
| GET | `/admin/invitations` | List invitations | `faculty`/`admin` |
| GET | `/admin/invitations/batches` | List bulk-invite batches (`invitations.batch_id`/`batch_label`) | `admin` only |
| GET | `/admin/invitations/batches/:batchId` | Invitations in one batch | `admin` only |
| DELETE | `/admin/invitations/:invitationId` | Delete an invitation | `admin` only |
| GET | `/admin/university/domains` | List allowed email domains | `admin` only |
| PATCH | `/admin/university/domains` | Update allowed email domains | `admin` only |
| GET | `/admin/content/summary` | The four stat cards on the Content tab | `faculty`/`admin` |
| GET | `/admin/content/feed` | Content moderation queue as `FeedPost` rows (`?type=post\|news\|event_promo\|job_promo`, `?removed=true` for "Recently removed"), including unpublished posts | `faculty`/`admin` |
| PATCH | `/admin/content/posts/:id/comments` | `{ comments_disabled }` — "Close to replies" | `faculty`/`admin` |
| PATCH | `/admin/content/posts/:id/removed` | `{ is_removed }` — soft removal: archives the post and stamps `removed_at`/`removed_by`; `false` restores it | `faculty`/`admin` |
| GET | `/admin/content/:kind` | Legacy per-table list (`posts`\|`events`\|`jobs`\|`news`) with filters | `faculty`/`admin` |
| DELETE | `/admin/content/:kind/:id` | Delete a content item | `faculty`/`admin` |
| PATCH | `/admin/content/:kind/:id/pin` | Toggle pin | `faculty`/`admin` |
| PATCH | `/admin/content/:kind/:id/publish` | Toggle publish (for `posts`, also clears `publish_at` and cancels the scheduled job) | `faculty`/`admin` |
| PATCH | `/admin/content/:kind/:id/active` | Toggle active | `faculty`/`admin` |
| GET | `/admin/mentorship/mentors` | List alumni mentors (paginated) | `faculty`/`admin` |
| GET | `/admin/mentorship/mentors/:alumniId` | A mentor's request history | `faculty`/`admin` |
| GET | `/admin/mentorship/redemptions` | List gift-card redemptions | `admin` only |
| PATCH | `/admin/mentorship/redemptions/:redemptionId` | Fulfill/update a redemption | `admin` only |

---

## Content Sync (mounted at `/api/v1/admin/content-sync`, module dir `content-sync`, admin only)
Imports external university news/notices/events via WordPress REST API with a Skyvern browser-automation fallback.

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/admin/content-sync/config` | Get sync config | `admin` |
| PATCH | `/admin/content-sync/config` | Update sync config | `admin` |
| POST | `/admin/content-sync/run` | Enqueue a sync run on the `content-sync` queue | `admin` |
| GET | `/admin/content-sync/pending` | Imported-but-unpublished items for review | `admin` |
| GET | `/admin/content-sync/runs` | Run history (`content_sync_runs`) | `admin` |

---

## Rate Limits

| Route group | Limit |
|-------------|-------|
| `/auth/login` | 10 req / min per IP |
| `/auth/*` OTP routes (verify/resend/reset) | 12 req / min per IP |
| `/upload/presign` | rate limited via `uploadLimiter` |
| `/search/*` | rate limited via `searchLimiter` |
| Post/comment/share/connection-request/message-reaction/block/mute/report writes | rate limited via `writeLimiter` |
| General API | `globalLimiter` applied to all of `/api/v1` |
