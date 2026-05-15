# Design: Staff → Faculty rename, profile data fix, department at registration

**Date:** 2026-05-16  
**Status:** Approved

---

## Summary

Four related problems solved in one sweep:

1. **`staff` role renamed to `faculty`** across DB, API, and frontend.
2. **Profile fields always null** — `toAuthUser` hardcoded every profile field to `null`; fix by selecting all columns and mapping real values.
3. **Sidebar card shrinks/extends** — caused by the dept row appearing/disappearing as profile data changes between sessions; fix by always reserving the row's height.
4. **Department missing from registration form** — add an optional Department field for `student`/`alumni`/`faculty` roles, hidden for `admin`. A new peek endpoint tells the form the role before it renders.

---

## Section 1: Database

### Migration `025_rename_staff_to_faculty.ts`

```
up:
  - Drop constraint users_role_check
  - Add new constraint: role IN ('student', 'alumni', 'faculty', 'admin')
  - UPDATE users     SET role = 'faculty' WHERE role = 'staff'
  - UPDATE invitations SET role = 'faculty' WHERE role = 'staff'

down:
  - UPDATE invitations SET role = 'staff' WHERE role = 'faculty'
  - UPDATE users     SET role = 'staff'   WHERE role = 'faculty'
  - Drop constraint users_role_check
  - Add old constraint: role IN ('student', 'alumni', 'staff', 'admin')
```

> `invitations.role` has no CHECK constraint, so only a data UPDATE is needed for that table.

### New endpoint: `GET /auth/invitation/:token`

- No auth required; lives on the `authRouter`.
- Resolves university via `resolveUniversity` middleware.
- Calls `authService.peekInvitation(token, universityId)`.
- Returns `200 { data: { role, email } }` when valid.
- Returns `404` when token is invalid, expired, or already used.
- Purpose: lets the registration form know the role before rendering.

---

## Section 2: Backend

### `packages/shared/src/types/user.ts`

```ts
export type UserRole = 'student' | 'alumni' | 'faculty' | 'admin'
```

### `apps/api/src/modules/auth/schema.ts`

```ts
export const AuthRoleSchema = z.enum(['student', 'alumni', 'faculty', 'admin'])
```

Add `department` to `RegisterSchema`:
```ts
department: z.string().trim().min(1).max(100).optional().nullable(),
```
Include in the `.transform` output as `department`.

### `apps/api/src/modules/auth/service.ts`

**`UserWithProfileRow` interface** — add:
```ts
bio: string | null
cover_url: string | null
headline: string | null
department: string | null
batch_year: string | null
linkedin_url: string | null
phone: string | null
skills: string[] | null
is_open_to_work: boolean
```

**`findUserWithProfile` + `findUserWithProfileByEmail`** — extend `.select(...)` to include all profile columns listed above.

**`toAuthUser`** — remove all hardcoded nulls; map from row:
```ts
department: user.department,
batchYear: user.batch_year,
bio: user.bio,
headline: user.headline,
coverUrl: user.cover_url,
linkedinUrl: user.linkedin_url,
phone: user.phone,
skills: user.skills ?? [],
isOpenToWork: user.is_open_to_work ?? false,
```

**`register` method** — pass `department` in the profile insert:
```ts
await trx('profiles').insert({
  user_id: createdUser.id,
  full_name: data.full_name,
  department: data.department ?? null,
})
```

**New `peekInvitation` method:**
```ts
async peekInvitation(token: string, universityId: string) {
  const inv = await db('invitations')
    .where({ token, university_id: universityId, is_used: false })
    .where('expires_at', '>', db.fn.now())
    .first()
  if (!inv) throw new AppError('Invitation not found', 404, 'NOT_FOUND')
  return { role: inv.role as UserRole, email: inv.email }
}
```

### Other backend files — `'staff'` → `'faculty'`

Simple string replace in:
- `apps/api/src/modules/admin/router.ts`
- `apps/api/src/modules/admin/schema.ts`
- `apps/api/src/modules/news/router.ts`
- `apps/api/src/modules/campus/router.ts`
- `apps/api/src/modules/jobs/router.ts`
- `apps/api/src/modules/events/router.ts`
- `apps/api/src/modules/feed/service.ts`
- `apps/api/src/modules/users/schema.ts`
- `apps/api/src/services/token.service.ts`
- `apps/api/src/__tests__/setup.ts`
- `apps/api/src/database/seeds/dev.ts`
- `apps/api/src/config/env.ts`

### Auth controller — add `checkInvitation` handler

```ts
export async function checkInvitation(req: Request, res: Response) {
  const { token } = req.params
  const data = await authService.peekInvitation(token, req.university.id)
  res.json({ data })
}
```

Register on `authRouter`:
```ts
authRouter.get('/invitation/:token', checkInvitation)
```

---

## Section 3: Frontend

### `apps/web/src/pages/RegisterPage.tsx`

When a token is present in the URL:

1. On mount, call `GET /auth/invitation/:token`.
2. Show a loading state while fetching.
3. On error (404): show "Invitation is invalid or has already been used" and stop rendering the form.
4. On success: store `{ role, email }` in state.
5. Render the Department field only when `role !== 'admin'`:
   - Text input, optional (no `required`)
   - Placeholder: `e.g. CSE`
   - maxLength: 100
6. Pass `department: department.trim() || undefined` in the POST body.

### `apps/web/src/components/LeftSidebar.tsx`

Replace conditional dept row with always-rendered version:
```tsx
{/* Always renders to keep card height stable */}
<div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2, minHeight: 16 }}>
  {deptLabel}
</div>
```
Removing the `{deptLabel && (...)}` guard ensures the row occupies space even when empty, eliminating the height jump.

### Other frontend files — `'staff'` → `'faculty'`

- `apps/web/src/components/RightSidebar.tsx`
- `apps/web/src/features/landing/components/CtaSection.tsx`
- `apps/web/src/features/landing/components/HeroSection.tsx`
- `apps/web/src/features/messages/components/NewConversationModal.tsx`
- `apps/web/src/features/messages/components/ConversationList.tsx`
- `apps/web/src/features/profile/components/FollowModal.tsx`
- `apps/web/src/features/feed/components/PostCard.tsx`
- `apps/web/src/features/events/components/CreateEventForm.tsx`
- `apps/web/src/pages/AdminPage.tsx`
- `apps/web/src/pages/JobsPage.tsx`
- `apps/web/src/pages/ProfilePage.tsx`
- `apps/web/src/pages/EventsPage.tsx`
- `apps/web/src/pages/MentorshipPage.tsx`
- `apps/web/src/router/AdminRoute.tsx`

---

## Out of scope

- No changes to badge display logic beyond the string rename.
- No changes to existing profile fields beyond fixing the select/map.
- No UI changes to EditProfileModal (department field already exists there).
- Stats in the sidebar mini-card remain hardcoded at 0 (real stats require a separate endpoint, not in scope here).
