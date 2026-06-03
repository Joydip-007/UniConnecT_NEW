# Admin Mentorship Dashboard + Feedback System

**Date:** 2026-06-03  
**Status:** Approved  
**Scope:** Backend (DB + API) + Frontend (admin tab + student/alumni feedback UI)

---

## What's being built

Two connected features:

1. **Admin mentorship dashboard** — a new "Mentorship" tab in the admin panel showing all alumni who have acted as mentors, their points balance, mentee capacity, and completed sessions. Each row expands to reveal their full request history with feedback from both parties.

2. **Post-completion feedback** — after a mentorship request is marked `completed`, both the student and the alumni see a persistent "Leave feedback" button on their request card. They submit a 1–5 star rating + optional comment. The admin can view both submissions in the expanded row.

---

## What already exists (no changes needed)

- `mentorship_requests` table — statuses `pending | accepted | declined | completed | expired`
- `mentorship_sessions` table — per-session records per request
- `profiles.mentorship_points` — alumni earn 10 pts when a request transitions to `completed`
- `profiles.is_open_to_mentorship`, `profiles.max_mentees`
- Admin module already has `/admin/mentorship/redemptions` (gift card fulfillment)
- `requireRole('alumni', 'admin')` already on incoming-request routes

---

## Section 1 — Database schema

### New migration: `058_create_mentorship_feedback.ts`

```sql
CREATE TABLE mentorship_feedback (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  request_id    UUID NOT NULL REFERENCES mentorship_requests(id) ON DELETE CASCADE,
  author_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_role   VARCHAR(10) NOT NULL CHECK (author_role IN ('student', 'alumni')),
  rating        INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One feedback entry per person per request
ALTER TABLE mentorship_feedback
  ADD CONSTRAINT uq_feedback_request_author UNIQUE (request_id, author_id);

-- Indexes
CREATE INDEX idx_feedback_university_request ON mentorship_feedback (university_id, request_id);
CREATE INDEX idx_feedback_request_role       ON mentorship_feedback (request_id, author_role);
```

**Design decisions:**
- No `updated_at` — feedback is write-once; the unique constraint enforces this at the DB level.
- `author_role` is stored explicitly (not derived from a join) so admin queries can group by role without an extra join.

---

## Section 2 — Backend API

### 2a. Mentorship module — new endpoints

**`POST /api/v1/mentorship/requests/:id/feedback`**

- Auth: `requireAuth` (student or alumni)
- Guards:
  - Request must exist in the caller's university and not be deleted
  - Request status must be `completed` → `400 FEEDBACK_REQUEST_NOT_COMPLETED`
  - Caller must be either `student_id` or `alumni_id` on the request → `403`
  - No existing feedback from this author → `409 FEEDBACK_ALREADY_SUBMITTED`
- Body schema (Zod): `{ rating: z.number().int().min(1).max(5), comment: z.string().max(1000).optional() }`
- Response: `{ data: FeedbackEntry }`
- No point award — points fire on `completed` transition, not here

**`GET /api/v1/mentorship/requests/:id/feedback`**

- Auth: `requireAuth`
- Access: caller must be a participant (student or alumni) OR `context.role === 'admin'` — the service skips the participant assertion when the caller is admin
- Response shape:
  ```ts
  { data: { student: FeedbackEntry | null, alumni: FeedbackEntry | null } }
  ```
- `FeedbackEntry`: `{ id, authorId, authorRole, rating, comment, createdAt }`

### 2b. Admin module — new endpoints

**`GET /api/v1/admin/mentorship/mentors`**  
_(requires `faculty` or `admin` role, consistent with rest of admin module)_

Query params: `page` (default 1), `limit` (default 20)

Returns a paginated list of alumni who appear as `alumni_id` in at least one non-deleted `mentorship_request`. Each item:

```ts
{
  id: string
  fullName: string
  avatarUrl: string | null
  department: string | null
  batchYear: string | null
  mentorshipPoints: number
  maxMentees: number
  currentMentees: number      // COUNT where status = 'accepted'
  completedCount: number      // COUNT where status = 'completed'
  totalSessions: number       // SUM of sessions across all their requests
}
```

Single query with subqueries — no N+1.

**`GET /api/v1/admin/mentorship/mentors/:alumniId/requests`**

Returns all non-deleted requests for the given alumni (any status). Each item:

```ts
{
  id: string
  status: RequestStatus
  message: string
  createdAt: Date
  updatedAt: Date
  sessionCount: number
  student: { id, fullName, avatarUrl, department, batchYear }
  feedback: {
    student: FeedbackEntry | null
    alumni:  FeedbackEntry | null
  }
}
```

No pagination — a single mentor rarely has more than 10–20 lifetime requests.

The feedback sub-object is populated by a single query that left-joins `mentorship_feedback` twice (once filtered by `author_role = 'student'`, once by `author_role = 'alumni'`), so feedback for all requests is loaded in one round-trip.

**Implementation location:** New methods on `AdminService` + new controller functions + routes added to `adminRouter` under the `/mentorship` prefix (alongside the existing `/mentorship/redemptions` routes).

---

## Section 3 — Feedback UI (student and alumni views)

### When it appears
On any request card whose `status === 'completed'`, a feedback section is rendered at the bottom.

### Behavior
- `useRequestFeedback(requestId)` is called when the card is in `completed` state. It fetches `GET /mentorship/requests/:id/feedback` and determines whether the current user has already submitted.
- If not yet submitted: renders a "Leave feedback" button.
- Clicking expands an **inline section on the card** (not a modal) with:
  - 5 interactive star icons (1–5 selection)
  - Optional textarea (max 1000 chars)
  - "Submit" pill button
- On success: `useQueryClient().invalidateQueries(['mentorship', 'feedback', requestId])` and the section collapses, replaced by a "Feedback submitted" state (greyed, non-interactive).
- If already submitted: renders the "Feedback submitted" state immediately on load.

### New hooks in `src/features/mentorship/hooks/`

| Hook | Type | Endpoint |
|------|------|----------|
| `useRequestFeedback(requestId)` | `useQuery` | `GET /mentorship/requests/:id/feedback` |
| `useSubmitFeedback()` | `useMutation` | `POST /mentorship/requests/:id/feedback` |

### Affected components
- `src/features/mentorship/components/MyRequestRow.tsx` — student's completed requests
- `src/features/mentorship/components/IncomingRequestCard.tsx` — alumni's completed requests

Both components receive the current user's id from `useAuthStore` to determine which feedback slot to check/fill.

---

## Section 4 — Admin Mentorship tab

### Tab registration
`AdminPage.tsx`: add `{ label: 'Mentorship', value: 'mentorship', icon: <GraduationCap size={14} /> }` to the `TABS` array and render `<MentorshipTab />` when active. `Tab` type gains `'mentorship'`.

### `MentorshipTab` component
File: `src/pages/admin/MentorshipTab.tsx`

**Collapsed row** (per alumni mentor):
```
[Avatar] Name · dept · batch         [120 pts] [▓▓▓░ 2/3 mentees] [4 completed] [›]
```
- Points: indigo pill
- Capacity: slim progress bar + `X / Y mentees` label
- Completed count: plain text
- Chevron rotates on expand

**Expanded row** (lazy-fetched on first open, cached):
- Uses `useAdminMentorRequests(alumniId, { enabled: isExpanded })`
- Request sub-rows grouped: accepted first, then completed, then others
- Each completed request shows student info + session count + two feedback cards side by side:
  ```
  [Student feedback]          [Alumni feedback]
  ★★★★☆  "Great mentor…"     ★★★★★  "Keen student…"
  ```
  or `— No feedback yet` if the slot is empty.

### New hooks (inline in `MentorshipTab.tsx` or in `src/features/mentorship/hooks/`)

| Hook | Type | Endpoint |
|------|------|----------|
| `useAdminMentors(page)` | `useQuery` | `GET /admin/mentorship/mentors` |
| `useAdminMentorRequests(alumniId, opts)` | `useQuery` | `GET /admin/mentorship/mentors/:alumniId/requests` |

---

## File change summary

| File | Change |
|------|--------|
| `apps/api/src/database/migrations/058_create_mentorship_feedback.ts` | New |
| `apps/api/src/modules/mentorship/schema.ts` | Add `SubmitFeedbackSchema` |
| `apps/api/src/modules/mentorship/service.ts` | Add `submitFeedback`, `getRequestFeedback` |
| `apps/api/src/modules/mentorship/controller.ts` | Add `submitFeedback`, `getRequestFeedback` |
| `apps/api/src/modules/mentorship/router.ts` | Add two new routes |
| `apps/api/src/modules/admin/service.ts` | Add `listMentors`, `getMentorRequests` |
| `apps/api/src/modules/admin/controller.ts` | Add `listMentors`, `getMentorRequests` |
| `apps/api/src/modules/admin/router.ts` | Add two new admin routes |
| `apps/web/src/features/mentorship/hooks/useRequestFeedback.ts` | New |
| `apps/web/src/features/mentorship/hooks/useSubmitFeedback.ts` | New |
| `apps/web/src/features/mentorship/components/MyRequestRow.tsx` | Add feedback section |
| `apps/web/src/features/mentorship/components/IncomingRequestCard.tsx` | Add feedback section |
| `apps/web/src/pages/admin/MentorshipTab.tsx` | New |
| `apps/web/src/pages/AdminPage.tsx` | Add Mentorship tab entry |

---

## Design constraints honoured

- No hardcoded hex — all colours via `var(--token)` 
- Borders `0.5px solid var(--border-*)` 
- Buttons `border-radius: var(--r-pill)`
- Font weight 400/500 only
- Sentence case on all labels
- No direct `res.json()` — use `sendSuccess` / `sendPaginated`
- Errors thrown as named helpers (`notFound`, `badRequest`, `forbidden`, `conflict`)
- `asyncHandler` wraps all controller functions
- `university_id` always from `req.university.id`, never from body
