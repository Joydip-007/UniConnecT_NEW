# Auto-Groups: Role & Batch System Groups

**Date:** 2026-05-22  
**Project:** UniConnecT  
**Status:** Approved — ready for implementation planning

---

## Overview

Every user is automatically placed into one or more system-managed groups at registration (and kept in sync when profile data changes). System groups cannot be joined, left, or deleted by users. Membership is controlled entirely by role, department, and batch.

---

## 1. Group Naming Conventions

| Role | Group name pattern | Example |
|---|---|---|
| `admin` | "Admins of {University Name}" | "Admins of United International University" |
| `faculty` | "{Dept} Dept" | "CSE Dept" |
| `alumni` | "{batch} Graduates" | "Fall 2023 Graduates" |
| `student` | "{batch}" | "Fall 2023" |

University name is fetched from the `universities.name` column at group creation time.

---

## 2. Data Model

No new DB columns needed on any table.

### `groups` table — system group discriminator pattern

The existing `groups.department` column serves as an opaque sub-key for system groups. Combined with `groups.allowed_role`, it uniquely identifies every system group per university:

| `allowed_role` | `groups.department` | Identifies |
|---|---|---|
| `admin` | `NULL` | The single admin group for the university |
| `faculty` | `"CSE"` | The CSE faculty dept group |
| `alumni` | `"Fall 2023"` | The Fall 2023 alumni graduation batch group |
| `student` | `"Fall 2023"` | The Fall 2023 student admission batch group |

All system groups have `is_system = true` and `is_private = true`.

### `profiles` table — user-facing fields (unchanged schema)

- `profiles.department` — the user's actual academic department. Used for mentorship search, profile display, and faculty group placement. Completely separate from `groups.department`.
- `profiles.batch_year` — stored as `"Fall 2023"` (semester + space + 4-digit year). Used for student/alumni batch group placement.

### Batch string format

Batch values are always stored as `"{Semester} {Year}"` where:
- Semester ∈ `{ Fall, Spring, Summer }`
- Year ∈ 2020–2030 (4-digit)

Example: `"Fall 2023"`, `"Spring 2025"`.

---

## 3. Registration Form Changes (Frontend — `RegisterPage.tsx`)

### Fields by role

| Field | Admin | Faculty | Alumni | Student |
|---|---|---|---|---|
| Full name | ✓ required | ✓ required | ✓ required | ✓ required |
| Password | ✓ required | ✓ required | ✓ required | ✓ required |
| University (read-only display) | ✓ | — | — | — |
| Department (text input) | — | ✓ required | ✓ required | ✓ required |
| Graduation trimester (dropdowns) | — | — | ✓ required | — |
| Admission trimester (dropdowns) | — | — | — | ✓ required |

### Batch dropdowns

Two dropdowns rendered side by side:
- **Semester**: `Fall | Spring | Summer`
- **Year**: `2020 | 2021 | … | 2030`

Combined on submit into a single `batch_year` string: `"Fall 2023"`.

### Helper text

- Alumni graduation trimester field: *"Enter the trimester you graduated. This determines which batch group you'll be added to."*
- Student admission trimester field: *"Enter the trimester you were admitted. This determines which batch group you'll be added to."*

### University read-only display (admin only)

The invite peek response (`GET /auth/invitation/:token`) is extended to include `universityName`. On the admin form, this is displayed as a non-editable confirmation banner so the admin can verify they're registering under the correct institution.

### Validation (client-side)

- Department: required for faculty, alumni, student — error if empty on submit
- Batch dropdowns: both semester and year must be selected for alumni and student — error if either is unset

### Registration payload additions

```ts
{
  // existing fields...
  department?: string      // required for faculty, alumni, student
  batch_year?: string      // required for alumni, student — e.g. "Fall 2023"
}
```

---

## 4. Backend — Auth Changes

### `auth/schema.ts`

Add `batch_year` as an optional string field to `RegisterSchema` (max 20 chars, trimmed). Role-based required validation is handled in the service, not in Zod, because the role is resolved from the invitation token.

### `auth/service.ts` — `register`

After resolving role from the invitation:
- If `role === 'faculty' | 'alumni' | 'student'`: validate `department` is present and non-empty, else throw `badRequest`.
- If `role === 'alumni' | 'student'`: validate `batch_year` is present and non-empty, else throw `badRequest`.
- Insert `batch_year` into `profiles` alongside `department` in the transaction.

### `auth/service.ts` — `verifyAccount`

After marking the user as verified, call:
```ts
systemGroupsService.addUserToSystemGroups(
  user.id,
  user.university_id,
  user.role,
  profile.department,
  profile.batch_year,   // new param
)
```

### `auth/service.ts` — `peekInvitation`

Extend the query to join `universities` and return `universityName` alongside `role` and `email`:
```ts
return { role, email, universityName }
```

---

## 5. Backend — System Groups Service (`system-groups.service.ts`)

### `SystemGroupKind` — extended

```ts
type SystemGroupKind =
  | { role: 'admin' }
  | { role: 'faculty'; department: string }
  | { role: 'alumni'; batch: string }
  | { role: 'student'; batch: string }
```

### `addUserToSystemGroups` — extended signature

```ts
async addUserToSystemGroups(
  userId: string,
  universityId: string,
  role: UserRole,
  department: string | null,
  batchYear?: string | null,
): Promise<void>
```

Routing logic:
- `admin` → `findOrCreateGroup(universityId, { role: 'admin' })` → attach
- `faculty` + non-empty `department` → `findOrCreateGroup(universityId, { role: 'faculty', department })` → attach
- `alumni` + non-empty `batchYear` → `findOrCreateGroup(universityId, { role: 'alumni', batch: batchYear })` → attach
- `student` + non-empty `batchYear` → `findOrCreateGroup(universityId, { role: 'student', batch: batchYear })` → attach

Note: alumni are never added to faculty dept groups. Their `profiles.department` is used for mentorship search only.

### `removeUserFromSystemGroups` — extended signature

Same new `batchYear` param. Mirrors `addUserToSystemGroups` routing for removal.

### `syncUserMembership` — extended shape

```ts
previous: { role: UserRole; department: string | null; batchYear: string | null }
next:     { role: UserRole; department: string | null; batchYear: string | null }
```

Triggers removal + add when any of role, department, or batchYear changes.

### `findOrCreateGroup` — group naming

```ts
// admin
name: `Admins of ${universityName}`   // fetched from universities table
description: `Official auto-managed group for all administrators of ${universityName}.`
type: 'other'

// faculty
name: `${kind.department} Dept`
description: `Official auto-managed group for ${kind.department} faculty.`
type: 'department'

// alumni
name: `${kind.batch} Graduates`
description: `Official auto-managed group for ${kind.batch} graduates.`
type: 'batch'

// student
name: `${kind.batch}`
description: `Official auto-managed group for ${kind.batch} students.`
type: 'batch'
```

For `admin` kind, the method fetches `universities.name` using `universityId` before inserting the group.

### `findGroup` — extended discriminator

```ts
if (kind.role === 'faculty') {
  query.andWhere({ department: kind.department })
} else if (kind.role === 'alumni' || kind.role === 'student') {
  query.andWhere({ department: kind.batch })
} else {
  query.whereNull('department')   // admin
}
```

---

## 6. Backend — Users Service (`users/service.ts`)

### `updateCurrentUser` — extended sync trigger

Currently syncs only on `department` change. Extended to also sync on `batchYear` change:

```ts
const needsGroupSync =
  (input.department !== undefined && input.department !== existing.department) ||
  (input.batchYear !== undefined && input.batchYear !== existing.batchYear)

if (needsGroupSync) {
  await systemGroupsService.syncUserMembership(
    userId,
    universityId,
    { role: existing.role, department: existing.department, batchYear: existing.batchYear },
    {
      role: existing.role,
      department: input.department ?? existing.department,
      batchYear: input.batchYear ?? existing.batchYear,
    },
  )
}
```

The `existing` query is extended to also select `profiles.batch_year`.

---

## 6b. Backend — Admin Service (`admin/service.ts`)

`admin/service.ts` also calls `syncUserMembership` when an admin changes a user's role via the admin panel. That call must be extended to include `batchYear` in both `previous` and `next` shapes. The admin service query that fetches the user's current state before the change must also select `profiles.batch_year`.

---

## 7. Migration — `037_auto_groups_batch_and_rename.ts`

Five passes, all inside per-university loops:

### Pass 1 — Rename existing admin groups
```sql
UPDATE groups g
SET name = 'Admins of ' || u.name
FROM universities u
WHERE g.university_id = u.id
  AND g.is_system = true
  AND g.allowed_role = 'admin'
```

### Pass 2 — Rename existing faculty dept groups
```sql
UPDATE groups
SET name = department || ' Dept'
WHERE is_system = true
  AND allowed_role = 'faculty'
  AND department IS NOT NULL
```

### Pass 3 — Backfill alumni batch groups
- Query distinct `(university_id, batch_year)` from `profiles` joined to `users` where `role = 'alumni'` and `batch_year IS NOT NULL`
- For each pair: find-or-create group (`allowed_role = 'alumni'`, `department = batch_year`, name `"{batch} Graduates"`, type `'batch'`)
- Insert all matching alumni into `group_members` with `.onConflict(['group_id','user_id']).ignore()`

### Pass 4 — Backfill student batch groups
- Same as Pass 3 but for `role = 'student'`, group name is `"{batch}"`, `allowed_role = 'student'`

### Pass 5 — Resync member counts
```sql
UPDATE groups g
SET member_count = (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id)
WHERE g.is_system = true
```

### Down migration
- Revert admin group names back to `"All admins"`
- Revert faculty group names back to bare department
- Delete all `is_system = true, allowed_role IN ('alumni','student')` groups

---

## 8. Constraints & Invariants

- System groups cannot be joined, left, invited to, or deleted by users (enforced in `groups/service.ts` — already implemented).
- `department` is required on registration for faculty, alumni, and student. `batch_year` is required for alumni and student. Enforced in `auth/service.ts` after role is resolved.
- Alumni department (`profiles.department`) is used for mentorship search only. Alumni are never added to faculty dept system groups.
- Batch strings are always normalized to `"Semester YYYY"` format. No case normalization is applied server-side — the frontend sends exactly what the dropdowns produce, which is always title-case semester + 4-digit year.
- If `findOrCreateGroup` cannot find a `created_by` user (edge case on first user), it throws `SYSTEM_GROUP_NO_CREATOR` and the caller logs a warning without failing the registration.

---

## 9. Out of Scope

- Admin-triggered re-sync of all existing users (one-off migration covers backfill)
- UI to display which system groups a user belongs to (groups are already visible in the groups list)
- Removing the batch_year field from profile edit (users can still update it; sync runs automatically)
