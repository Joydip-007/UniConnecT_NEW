# Mentorship Enhancement — Design Spec

**Date:** 2026-05-23  
**Branch:** feature/mentorship-enhancement  
**Author:** Joydip / Team Mavericks  

---

## Overview

Four interconnected improvements to the mentorship module:

1. **`mentorship_sessions` child table** — structured per-session logbook (either party can create/edit their own entries)
2. **Alumni capacity cap** — `max_mentees` column (default 3) on `profiles`; acceptance rejected at cap with a clear message
3. **Pending-request lifecycle jobs** — Bull `mentorship` queue; 48 h alumni reminder, 7 d auto-expiry with student notification
4. **Auto-conversation on accept** — dedicated `type: 'mentorship'` thread created in the `conversations` table; `conversation_id` FK written back to the request

### Animation requirement

All new frontend components use **21st.dev Magic MCP** (`mcp__magic__21st_magic_component_builder` / `mcp__magic__21st_magic_component_refiner`) to generate animations that match the existing Warm Futuristic Dark design system (navy surfaces, UIU orange identity, indigo interactive). No raw CSS keyframes — use 21st.dev outputs, then refine tokens to match `DESIGN.md`.

---

## Section 1 — Data model (4 migrations)

### `043_add_mentorship_capacity.ts`

```sql
ALTER TABLE profiles ADD COLUMN max_mentees INTEGER NOT NULL DEFAULT 3;
```

### `044_add_mentorship_request_jobs.ts`

Three new nullable columns on `mentorship_requests`:

| column | type | purpose |
|---|---|---|
| `conversation_id` | UUID FK → conversations ON DELETE SET NULL | auto-created thread; populated on accept |
| `reminder_job_id` | TEXT | Bull job ID for the 48 h alumni reminder |
| `expire_job_id` | TEXT | Bull job ID for the 7 d auto-expiry |

### `045_create_mentorship_sessions.ts`

New table `mentorship_sessions`:

| column | type | notes |
|---|---|---|
| `id` | UUID PK | `uuid_generate_v4()` |
| `university_id` | UUID FK → universities CASCADE | indexed |
| `request_id` | UUID FK → mentorship_requests CASCADE | indexed |
| `created_by` | UUID FK → users | author of this entry |
| `session_date` | DATE NOT NULL | |
| `duration_minutes` | INTEGER NOT NULL | e.g. 30, 60 |
| `topic` | VARCHAR(255) NOT NULL | short label |
| `notes` | TEXT | nullable free-form |
| `created_at` | TIMESTAMPTZ DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ DEFAULT now() | |

Index: `(university_id, request_id, session_date DESC)`.  
No `is_deleted` — hard deletes only (low volume, easily re-created).

### `046_add_conversations_type.ts`

```sql
ALTER TABLE conversations
  ADD COLUMN type VARCHAR(20) NOT NULL DEFAULT 'direct';

ALTER TABLE conversations
  ADD CONSTRAINT conversations_type_check
  CHECK (type IN ('direct', 'group', 'mentorship'));
```

### `047_add_expired_status_to_mentorship.ts`

Drop and re-add the `mentorship_requests_status_check` CHECK constraint to include `'expired'`:

```sql
ALTER TABLE mentorship_requests
  DROP CONSTRAINT mentorship_requests_status_check;

ALTER TABLE mentorship_requests
  ADD CONSTRAINT mentorship_requests_status_check
  CHECK (status IN ('pending', 'accepted', 'declined', 'completed', 'expired'));
```

`'expired'` is distinct from `'declined'` — the student UI shows different copy for each ("no response in 7 days" vs "mentor declined"). Total migrations in this feature: `043` → `047`.

---

## Section 2 — Backend API

### Modified: `GET /mentorship/alumni` (listAlumni)

Each alumni row in the response must include:
- `maxMentees: number` — from `profiles.max_mentees`
- `currentMentees: number` — count of `mentorship_requests` with `alumni_id = ?` and `status = 'accepted'`

The `AlumniCard` uses these to render the capacity pill and disable the request button when full.  
Add a subquery or left join count to the existing `listAlumni` query.

### Modified: `POST /mentorship/requests` (createRequest)

After row insert, enqueue two delayed jobs on the new `mentorship` queue:
- `request_reminder` — delay `48 * 60 * 60 * 1000` ms
- `request_expire` — delay `7 * 24 * 60 * 60 * 1000` ms

Both jobs receive `{ type, requestId, universityId, alumniId, studentId }`.  
Store returned Bull job IDs in `reminder_job_id` and `expire_job_id` on the row.

### Modified: `PATCH /mentorship/requests/:id` (updateRequest)

Status transition logic:

| transition | new behaviour |
|---|---|
| → `accepted` | 1. Count `alumni`'s accepted requests (`WHERE alumni_id = ? AND status = 'accepted'`). If count ≥ `max_mentees` → `badRequest('This mentor is currently full', 'MENTOR_AT_CAPACITY')`. 2. Run in DB transaction: create `conversations` row (`type: 'mentorship'`, `name: "{studentFirst} ↔ {alumniFirst} — Mentorship"`, `created_by: alumniId`), insert two `conversation_participants` rows, write `conversation_id` back to the request. Insert system message: `"Mentorship connection started. You can now propose sessions, share resources, and chat here."` 3. Cancel both Bull jobs via `cancelMentorshipJobs()`. 4. Emit `mentorship:request:accepted` → `user:{studentId}` with `{ requestId, conversationId }`. Emit `conversation:new` → both user rooms. |
| → `declined` | Cancel both Bull jobs. Enqueue `NotificationQueueJob` with type `mentorship_request_declined` to student. |
| → `completed` | Award `POINTS_PER_SESSION` points (unchanged). Cancel expire job if alive. |

### New endpoints

```
GET    /mentorship/requests/:id/sessions        list sessions
POST   /mentorship/requests/:id/sessions        create session
PATCH  /mentorship/requests/:id/sessions/:sid   edit session (created_by only)
DELETE /mentorship/requests/:id/sessions/:sid   delete session (created_by only)
```

Auth: caller must be the `student_id` or `alumni_id` on the parent request (not role-based). Enforced by looking up the request and comparing `req.user.id` against both FK columns.

### Modified: `PATCH /profile` (users module)

Add optional `maxMentees: z.number().int().min(1).max(20)` to profile update schema. Only settable by `alumni` role; other roles receive `forbidden()`.

### New schemas (`mentorship/schema.ts` additions)

```ts
CreateSessionSchema = z.object({
  sessionDate: z.string().date(),          // 'YYYY-MM-DD'
  durationMinutes: z.number().int().min(1).max(480),
  topic: z.string().trim().min(1).max(255),
  notes: z.string().trim().max(5000).nullable().optional(),
})

UpdateSessionSchema = CreateSessionSchema.partial().refine(hasAtLeastOne)
```

---

## Section 3 — Bull jobs

### New queue: `apps/api/src/queues/mentorship.queue.ts`

```ts
export type MentorshipJobType = 'request_reminder' | 'request_expire'

export interface MentorshipQueueJob {
  type: MentorshipJobType
  requestId: string
  universityId: string
  alumniId: string
  studentId?: string   // present on expire jobs only
}

export const mentorshipQueue = new Queue<MentorshipQueueJob>('mentorship', env.REDIS_URL)
```

### New worker: `apps/api/src/workers/mentorship.worker.ts`

**`request_reminder` (48 h)**
1. Fetch request — if `status !== 'pending'`, no-op (idempotency guard).
2. Fetch alumni email from `users`.
3. Enqueue `EmailQueueJob` — subject: `"You have an unanswered mentorship request"`.
4. Enqueue `NotificationQueueJob` — type: `mentorship_request_reminder`.

Does **not** mutate the request row.

**`request_expire` (7 d)**
1. Fetch request — if `status !== 'pending'`, no-op.
2. Update `status = 'expired'`, clear `reminder_job_id` and `expire_job_id`.
3. Enqueue `NotificationQueueJob` → student — type: `mentorship_request_expired`, content: `"Your mentorship request expired — the mentor didn't respond in time."`.
4. Emit `mentorship:request:expired` → `user:{studentId}`.

### Cancellation helper (`mentorship/service.ts`)

```ts
async function cancelMentorshipJobs(reminderId: string | null, expireId: string | null) {
  const q = mentorshipQueue
  if (reminderId) await q.getJob(reminderId).then(j => j?.remove())
  if (expireId)   await q.getJob(expireId).then(j => j?.remove())
}
```

Called on accept, decline, and completed transitions.

### `workers/index.ts`

Register `mentorship.worker.ts` alongside existing workers so it starts with `npx pnpm --filter api worker`.

---

## Section 4 — Auto-conversation on accept

Wrapped in the same DB transaction as the status → `accepted` update:

```
conversations row:
  type:       'mentorship'
  name:       "{studentFirstName} ↔ {alumniFirstName} — Mentorship"
  is_group:   false
  avatar_url: null
  created_by: alumniId

conversation_participants:
  (conversationId, studentId, joined_at = now())
  (conversationId, alumniId,  joined_at = now())

messages row (system message):
  type:    'system'
  content: "Mentorship connection started. You can now propose sessions, share resources, and chat here."
  sender_id: alumniId
```

`mentorship_requests.conversation_id` is written in the same transaction.

Socket events emitted **after** commit:
- `mentorship:request:accepted` → `user:{studentId}` — payload `{ requestId, conversationId }`
- `conversation:new` → `user:{studentId}` and `user:{alumniId}` — inbox updates automatically

Frontend navigation: `MyRequestRow` and `IncomingRequestCard` both render an **"Open chat →"** link to `/messages/{conversationId}` when `status === 'accepted'` and `conversationId` is non-null. No extra API call needed — the conversation ID is in the request payload.

---

## Section 5 — Frontend

### Animation strategy

Use **21st.dev Magic MCP** for all new animated components:
- `mcp__magic__21st_magic_component_builder` — generate initial component from description
- `mcp__magic__21st_magic_component_refiner` — refine outputs to match design tokens from `DESIGN.md`

All generated components must use `var(--token-name)` CSS variables, never hardcoded hex. Animations should be subtle and purposeful — micro-interactions on session log entries (slide-in on add, fade-out on delete), status badge transitions, capacity pill pulse when full.

### Type updates (`features/mentorship/types.ts`)

```ts
// RequestStatus gains 'expired'
export type RequestStatus = 'pending' | 'accepted' | 'declined' | 'completed' | 'expired'

// AlumniMentor gains capacity fields
export interface AlumniMentor {
  // ...existing fields
  maxMentees: number
  currentMentees: number
}

// MyRequest and IncomingRequest gain conversationId
export interface MyRequest {
  // ...existing fields
  conversationId: string | null
}
export interface IncomingRequest {
  // ...existing fields
  conversationId: string | null
}

// New type
export interface MentorshipSession {
  id: string
  requestId: string
  createdBy: string
  sessionDate: string      // 'YYYY-MM-DD'
  durationMinutes: number
  topic: string
  notes: string | null
  createdAt: string
  updatedAt: string
}
```

### Changed components

**`AlumniCard.tsx`**
- Add capacity pill: `"{currentMentees} / {maxMentees} mentees"` — `--uc-orange-bg` / `--uc-orange-l` tokens
- When `currentMentees >= maxMentees`: disable "Request mentorship" button, show tooltip `"This mentor is currently full"`
- Animate capacity pill with a subtle pulse (21st.dev) when at capacity

**`MyRequestRow.tsx`**
- `status === 'accepted'` + `conversationId`: render **"Open chat →"** link navigating to `/messages/{conversationId}`
- `status === 'expired'`: muted copy `"Request expired — mentor didn't respond"` with `--text-muted` token
- Animated status badge transitions via 21st.dev (fade between status states)

**`IncomingRequestCard.tsx`**
- `status === 'accepted'` + `conversationId`: render **"Open chat →"** link
- On accept, if API returns `MENTOR_AT_CAPACITY`: inline error (not toast) — `"You've reached your mentee limit. Update your capacity in settings to accept more."`

**`AlumniMentorToggle.tsx`**
- Add `maxMentees` stepper (1–20) below opt-in toggle — label `"Max mentees at a time"`, default `3`
- Calls `PATCH /profile` with `{ maxMentees }`

### New component: `SessionLogPanel.tsx`

Built with 21st.dev. Displayed inside the accepted request detail view (expanded card or slide-out sheet for both student and alumni views).

- Lists `MentorshipSession` entries sorted by `session_date DESC`
- Each entry shows: date, duration pill, topic, notes (collapsible), edit/delete icons (own entries only)
- **"+ Log session"** button opens an inline form (date picker, duration select, topic input, notes textarea)
- Add animation: new entries slide in from top; deleted entries fade + collapse with height animation (21st.dev)
- Empty state: `"No sessions logged yet. Add your first one."` with subtle illustration

### New hooks

| hook | query key | purpose |
|---|---|---|
| `useSessionLog(requestId)` | `['mentorship', 'sessions', requestId]` | GET sessions |
| `useCreateSession(requestId)` | — | POST, invalidates query key |
| `useUpdateSession(requestId)` | — | PATCH, invalidates query key |
| `useDeleteSession(requestId)` | — | DELETE, invalidates query key |

### Socket handlers (StudentView)

Add to existing socket listener in `StudentView`:
- `mentorship:request:accepted` → invalidate `['mentorship', 'my-requests']` + toast `"Your request was accepted! A chat thread has been opened."`
- `mentorship:request:expired` → invalidate `['mentorship', 'my-requests']` + toast `"A mentorship request expired after 7 days without a response."`

---

## Error codes reference

| code | HTTP | when |
|---|---|---|
| `MENTOR_AT_CAPACITY` | 400 | alumni tries to accept but is at `max_mentees` |
| `SESSION_NOT_FOUND` | 404 | session ID doesn't exist on this request |
| `SESSION_FORBIDDEN` | 403 | caller is not `created_by` on edit/delete |
| `REQUEST_NOT_PARTICIPANT` | 403 | caller is not student or alumni on the request |

---

## Testing notes

- Backend integration tests: cover `MENTOR_AT_CAPACITY` path, job enqueue on create, job cancellation on accept/decline, transaction rollback if conversation insert fails
- Frontend: MSW handlers for all new session endpoints; test `SessionLogPanel` add/delete flow
- Worker tests: stub Bull job execution, verify idempotency guard (job fires on already-accepted request → no-op)
