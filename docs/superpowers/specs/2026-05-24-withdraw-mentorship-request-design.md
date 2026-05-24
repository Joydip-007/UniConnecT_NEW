# Withdraw Mentorship Request

**Date:** 2026-05-24  
**Status:** Approved  
**Scope:** Backend (API + worker + migration) + Frontend (MyRequestRow mutation)

---

## Problem

Students who send a mentorship request to an alumni have no way to cancel it. They must wait up to 7 days for the auto-expiry job to reclaim their slot. The UI (MyRequestRow) already renders a "Withdraw request" confirmation flow but calls a non-existent endpoint (`PATCH /mentorship/requests/:id` with `{ status: 'cancelled' }`).

---

## Approach: Soft-delete via `DELETE /requests/:id`

The request is soft-deleted (`is_deleted = true`). No new status value is introduced. All existing queries already filter `WHERE is_deleted = false`, so the withdrawn request disappears from the student's list and from the alumni's incoming requests automatically. The frontend `sentAlumniIds` set in `StudentView` is rebuilt from the filtered list, so the "Ask for guidance" button reappears on the `AlumniCard`.

Rejected alternatives:
- **`'cancelled'` status** — requires schema migration + enum update + StatusBadge rendering + fixing the `sentAlumniIds` exclusion. More moving parts for no user-visible benefit.
- **Extending existing `PATCH /requests/:id`** — mixes student and alumni concerns in one handler.

---

## Decision: Allow re-requesting after withdrawal

A withdrawal is a "changed mind", not a permanent block. The current full unique constraint on `(student_id, alumni_id)` prevents re-requesting the same alumni after any terminal state (declined, expired, withdrawn). This is corrected by migrating to a **partial unique index** that only enforces uniqueness for active requests.

---

## Data Model

### Migration `048_withdraw_mentorship_request.ts`

```sql
-- up
ALTER TABLE mentorship_requests DROP CONSTRAINT uq_mentorship_student_alumni;

CREATE UNIQUE INDEX uq_mentorship_active_per_alumni
  ON mentorship_requests (student_id, alumni_id)
  WHERE (is_deleted = false AND status IN ('pending', 'accepted'));

-- down
DROP INDEX IF EXISTS uq_mentorship_active_per_alumni;

ALTER TABLE mentorship_requests
  ADD CONSTRAINT uq_mentorship_student_alumni UNIQUE (student_id, alumni_id);
```

No column changes. No check constraint changes.

**Side effect (intentional):** Students can now also re-request alumni whose request was previously declined or expired. This is correct behavior that was accidentally blocked by the original full unique constraint.

---

## API

### `DELETE /api/v1/mentorship/requests/:id`

- **Auth:** `requireAuth` + `requireRole('student')`
- **Response:** `204 No Content`

### Service: `withdrawRequest(context, requestId)`

1. Fetch request: `WHERE id = requestId AND university_id = context.universityId AND is_deleted = false`. Throw `notFound` if missing.
2. Authorization: `context.userId !== request.student_id` → throw `forbidden('You do not have permission to withdraw this request', 'REQUEST_FORBIDDEN')`.
3. Status guard: `request.status !== 'pending'` → throw `badRequest('Only pending requests can be withdrawn', 'REQUEST_NOT_PENDING')`.
4. Soft-delete: `UPDATE mentorship_requests SET is_deleted = true, updated_at = now() WHERE id = requestId`.
5. Cancel Bull jobs: call existing `cancelMentorshipJobs(request.reminder_job_id, request.expire_job_id)`.
6. Return `void` (controller sends 204).

No socket emit. No notification. Silent withdrawal.

### Error codes

| Code | HTTP | When |
|------|------|------|
| `REQUEST_NOT_FOUND` | 404 | Request doesn't exist or is already deleted |
| `REQUEST_FORBIDDEN` | 403 | Caller is not the student who owns the request |
| `REQUEST_NOT_PENDING` | 400 | Request status is not `'pending'` (already accepted, declined, completed, or expired) |

---

## Worker Fix

`apps/api/src/workers/mentorship.worker.ts` — both Bull job guards fetch the request without filtering `is_deleted`. Race condition: if a Bull job fires after `is_deleted = true` is written but before the job is cancelled, it would update a soft-deleted record.

**Fix:** Add `is_deleted: false` to both `.where()` calls:

```ts
// request_reminder guard (line ~13)
const request = await db('mentorship_requests')
  .where({ id: requestId, is_deleted: false })
  .select<{ status: string }[]>('status')
  .first()

// request_expire guard (line ~52)
const request = await db('mentorship_requests')
  .where({ id: requestId, is_deleted: false })
  .select<{ status: string }[]>('status')
  .first()
```

Both already return early if `!request`, so a soft-deleted row will now be treated as "no longer actionable" rather than updated.

---

## Frontend

### `MyRequestRow.tsx`

Change the mutation from PATCH to DELETE, remove the TODO comment:

```ts
// Before
mutationFn: () =>
  api.patch(`/mentorship/requests/${request.id}`, { status: 'cancelled' }).then((r) => r.data.data),

// After
mutationFn: () =>
  api.delete(`/mentorship/requests/${request.id}`).then(() => undefined),
```

The `onSuccess` handler already invalidates `['mentorship', 'requests', 'mine']`, which causes the row to disappear from the list. No other frontend changes needed.

---

## Files Changed

| File | Type | Change |
|------|------|--------|
| `apps/api/src/database/migrations/048_withdraw_mentorship_request.ts` | new | Partial unique index migration |
| `apps/api/src/modules/mentorship/router.ts` | edit | Add `DELETE /requests/:id` route |
| `apps/api/src/modules/mentorship/controller.ts` | edit | Add `withdrawRequest` controller function |
| `apps/api/src/modules/mentorship/service.ts` | edit | Add `withdrawRequest` service method |
| `apps/api/src/workers/mentorship.worker.ts` | edit | Add `is_deleted: false` to both job guard queries |
| `apps/web/src/features/mentorship/components/MyRequestRow.tsx` | edit | Change mutation to DELETE, remove TODO |

---

## Out of Scope

- Notifying the alumni (decided: silent withdrawal)
- Showing a "Withdrawn" history entry to the student (soft-delete removes the row entirely)
- Re-requesting rate limiting (not required at this stage)
- Admin-facing visibility into withdrawn requests (admin queries use `is_deleted = false` and won't see them either — consistent with the soft-delete pattern used elsewhere)
