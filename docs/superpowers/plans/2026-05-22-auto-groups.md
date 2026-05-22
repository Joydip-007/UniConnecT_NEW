# Auto-Groups: Role & Batch System Groups — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-place every user into the correct system group at registration (admin→university group, faculty→dept group, alumni→graduation-batch group, student→admission-batch group) and keep membership in sync when `department` or `batch_year` changes.

**Architecture:** Extend the existing `system-groups.service.ts` with two new `SystemGroupKind` variants (`alumni` and `student`), using the existing `groups.department` column as a batch discriminator key. Add `batch_year` to the registration schema (required for alumni/student), validate required fields by role in `auth/service.ts`, extend `users/service.ts` and `admin/service.ts` to pass `batchYear` through sync calls, and migrate existing groups to the new naming convention. The frontend adds structured batch dropdowns, required department fields, and a read-only university display for admin.

**Tech Stack:** Node.js, Express, TypeScript, Knex, PostgreSQL, React 18, Zod, Vitest, Supertest

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `apps/api/src/modules/groups/system-groups.service.ts` | **Rewrite** | Four `SystemGroupKind` variants; correct naming; university name fetch for admin |
| `apps/api/src/database/migrations/037_auto_groups_batch_and_rename.ts` | **Create** | Rename existing system groups; backfill alumni + student batch groups |
| `apps/api/src/modules/auth/schema.ts` | **Modify** | Add optional `batch_year` field to `RegisterSchema` |
| `apps/api/src/modules/auth/service.ts` | **Modify** | Role-based required-field validation; store `batch_year`; extend `peekInvitation` |
| `apps/api/src/modules/users/service.ts` | **Modify** | Select `batch_year` in existing query; add `batchYear` to sync trigger |
| `apps/api/src/modules/admin/service.ts` | **Modify** | Select `batch_year` and pass it in all three system-group call sites |
| `apps/web/src/pages/RegisterPage.tsx` | **Rewrite** | Batch dropdowns for alumni/student; required department; university display for admin |
| `apps/api/src/__tests__/system-groups.test.ts` | **Create** | Integration tests for all four group kinds and `syncUserMembership` |
| `apps/api/src/__tests__/auth.test.ts` | **Modify** | Add tests for role-based required-field validation and `peekInvitation` |

---

### Task 1: Write failing tests for system-groups service

**Files:**
- Create: `apps/api/src/__tests__/system-groups.test.ts`

- [ ] **Step 1: Create the test file**

```ts
// apps/api/src/__tests__/system-groups.test.ts
import { describe, it, expect, afterEach } from 'vitest'
import { app, DOMAIN, TEST_UNIVERSITY_ID, CREDENTIALS } from './setup'
import { db } from '../config/db'
import { systemGroupsService } from '../modules/groups/system-groups.service'

// Helpers
async function getUserId(role: keyof typeof CREDENTIALS): Promise<string> {
  const cred = CREDENTIALS[role]
  const row = await db('users')
    .where({ university_id: TEST_UNIVERSITY_ID, email: cred.email })
    .select<{ id: string }[]>('id')
    .first()
  if (!row) throw new Error(`Seed user ${role} not found`)
  return row.id
}

async function findSystemGroup(allowedRole: string, department: string | null) {
  const q = db('groups')
    .where({ university_id: TEST_UNIVERSITY_ID, is_system: true, allowed_role: allowedRole })
    .select<{ id: string; name: string; department: string | null }>(['id', 'name', 'department'])
  if (department === null) q.whereNull('department')
  else q.andWhere({ department })
  return q.first()
}

// Clean up system groups created during these tests
afterEach(async () => {
  await db('groups')
    .where({ university_id: TEST_UNIVERSITY_ID, is_system: true })
    .whereIn('allowed_role', ['alumni', 'student'])
    .delete()
})

describe('SystemGroupsService — group naming', () => {
  it('creates admin group named "Admins of {university name}"', async () => {
    const adminId = await getUserId('admin')
    await systemGroupsService.addUserToSystemGroups(adminId, TEST_UNIVERSITY_ID, 'admin', null)

    const group = await findSystemGroup('admin', null)
    expect(group).toBeDefined()
    expect(group!.name).toBe('Admins of United International University')
  })

  it('creates faculty group named "{dept} Dept"', async () => {
    const facultyId = await getUserId('faculty')
    await systemGroupsService.addUserToSystemGroups(facultyId, TEST_UNIVERSITY_ID, 'faculty', 'CSE')

    const group = await findSystemGroup('faculty', 'CSE')
    expect(group).toBeDefined()
    expect(group!.name).toBe('CSE Dept')
  })

  it('creates alumni group named "{batch} Graduates"', async () => {
    const alumniId = await getUserId('alumni')
    await systemGroupsService.addUserToSystemGroups(alumniId, TEST_UNIVERSITY_ID, 'alumni', 'CSE', 'Fall 2023')

    const group = await findSystemGroup('alumni', 'Fall 2023')
    expect(group).toBeDefined()
    expect(group!.name).toBe('Fall 2023 Graduates')
  })

  it('creates student group named just the batch string', async () => {
    const studentId = await getUserId('student')
    await systemGroupsService.addUserToSystemGroups(studentId, TEST_UNIVERSITY_ID, 'student', 'CSE', 'Spring 2024')

    const group = await findSystemGroup('student', 'Spring 2024')
    expect(group).toBeDefined()
    expect(group!.name).toBe('Spring 2024')
  })
})

describe('SystemGroupsService — membership', () => {
  it('adds alumni to the batch group as a member', async () => {
    const alumniId = await getUserId('alumni')
    await systemGroupsService.addUserToSystemGroups(alumniId, TEST_UNIVERSITY_ID, 'alumni', 'CSE', 'Fall 2023')

    const group = await findSystemGroup('alumni', 'Fall 2023')
    const membership = await db('group_members')
      .where({ group_id: group!.id, user_id: alumniId })
      .first()
    expect(membership).toBeDefined()
  })

  it('adds student to the batch group as a member', async () => {
    const studentId = await getUserId('student')
    await systemGroupsService.addUserToSystemGroups(studentId, TEST_UNIVERSITY_ID, 'student', 'CSE', 'Spring 2024')

    const group = await findSystemGroup('student', 'Spring 2024')
    const membership = await db('group_members')
      .where({ group_id: group!.id, user_id: studentId })
      .first()
    expect(membership).toBeDefined()
  })
})

describe('SystemGroupsService — syncUserMembership', () => {
  it('moves alumni from old batch group to new one when batch year changes', async () => {
    const alumniId = await getUserId('alumni')

    // Put them in Fall 2023
    await systemGroupsService.addUserToSystemGroups(alumniId, TEST_UNIVERSITY_ID, 'alumni', 'CSE', 'Fall 2023')
    const oldGroup = await findSystemGroup('alumni', 'Fall 2023')
    expect(oldGroup).toBeDefined()

    // Sync to Summer 2024
    await systemGroupsService.syncUserMembership(
      alumniId,
      TEST_UNIVERSITY_ID,
      { role: 'alumni', department: 'CSE', batchYear: 'Fall 2023' },
      { role: 'alumni', department: 'CSE', batchYear: 'Summer 2024' },
    )

    // No longer in old group
    const oldMembership = await db('group_members')
      .where({ group_id: oldGroup!.id, user_id: alumniId })
      .first()
    expect(oldMembership).toBeUndefined()

    // Now in new group
    const newGroup = await findSystemGroup('alumni', 'Summer 2024')
    expect(newGroup).toBeDefined()
    const newMembership = await db('group_members')
      .where({ group_id: newGroup!.id, user_id: alumniId })
      .first()
    expect(newMembership).toBeDefined()
  })

  it('does nothing when role, department, and batchYear are unchanged', async () => {
    const studentId = await getUserId('student')
    await systemGroupsService.addUserToSystemGroups(studentId, TEST_UNIVERSITY_ID, 'student', 'EEE', 'Fall 2024')

    const groupBefore = await findSystemGroup('student', 'Fall 2024')
    expect(groupBefore).toBeDefined()

    // Call sync with identical previous/next
    await systemGroupsService.syncUserMembership(
      studentId,
      TEST_UNIVERSITY_ID,
      { role: 'student', department: 'EEE', batchYear: 'Fall 2024' },
      { role: 'student', department: 'EEE', batchYear: 'Fall 2024' },
    )

    const membership = await db('group_members')
      .where({ group_id: groupBefore!.id, user_id: studentId })
      .first()
    expect(membership).toBeDefined()
  })
})
```

- [ ] **Step 2: Run to confirm tests fail**

```bash
npx pnpm --filter api test src/__tests__/system-groups.test.ts
```

Expected output: Tests fail — `addUserToSystemGroups` doesn't handle `'alumni'` or `'student'` yet, and admin/faculty group names are wrong.

---

### Task 2: Rewrite `system-groups.service.ts`

**Files:**
- Modify: `apps/api/src/modules/groups/system-groups.service.ts`

- [ ] **Step 1: Replace the entire file contents**

```ts
// apps/api/src/modules/groups/system-groups.service.ts
import type { Knex } from 'knex'
import type { UserRole } from '@uniconnect/shared'
import { db } from '../../config/db'
import { logger } from '../../utils/logger'

type SystemGroupKind =
  | { role: 'admin' }
  | { role: 'faculty'; department: string }
  | { role: 'alumni'; batch: string }
  | { role: 'student'; batch: string }

export class SystemGroupsService {
  async ensureSystemGroupsForUniversity(universityId: string, trx?: Knex): Promise<void> {
    const executor = trx ?? db
    const facultyDepts = (await executor('users')
      .join('profiles', 'profiles.user_id', 'users.id')
      .where({ 'users.university_id': universityId, 'users.role': 'faculty' })
      .whereNotNull('profiles.department')
      .select<{ department: string }[]>('profiles.department')
      .groupBy('profiles.department')) as { department: string }[]

    await this.findOrCreateGroup(universityId, { role: 'admin' }, executor)
    for (const { department } of facultyDepts) {
      const trimmed = department.trim()
      if (!trimmed) continue
      await this.findOrCreateGroup(universityId, { role: 'faculty', department: trimmed }, executor)
    }
  }

  async addUserToSystemGroups(
    userId: string,
    universityId: string,
    role: UserRole,
    department: string | null,
    batchYear?: string | null,
  ): Promise<void> {
    if (role === 'admin') {
      const groupId = await this.findOrCreateGroup(universityId, { role: 'admin' }, db, userId)
      await this.attachMember(groupId, userId)
      return
    }

    if (role === 'faculty' && department?.trim()) {
      const groupId = await this.findOrCreateGroup(
        universityId,
        { role: 'faculty', department: department.trim() },
        db,
        userId,
      )
      await this.attachMember(groupId, userId)
      return
    }

    if (role === 'alumni' && batchYear?.trim()) {
      const groupId = await this.findOrCreateGroup(
        universityId,
        { role: 'alumni', batch: batchYear.trim() },
        db,
        userId,
      )
      await this.attachMember(groupId, userId)
      return
    }

    if (role === 'student' && batchYear?.trim()) {
      const groupId = await this.findOrCreateGroup(
        universityId,
        { role: 'student', batch: batchYear.trim() },
        db,
        userId,
      )
      await this.attachMember(groupId, userId)
      return
    }
  }

  async removeUserFromSystemGroups(
    userId: string,
    universityId: string,
    role: UserRole,
    department: string | null,
    batchYear?: string | null,
  ): Promise<void> {
    if (role === 'admin') {
      const group = await this.findGroup(universityId, { role: 'admin' })
      if (group) await this.detachMember(group.id, userId)
      return
    }

    if (role === 'faculty' && department?.trim()) {
      const group = await this.findGroup(universityId, { role: 'faculty', department: department.trim() })
      if (group) await this.detachMember(group.id, userId)
      return
    }

    if (role === 'alumni' && batchYear?.trim()) {
      const group = await this.findGroup(universityId, { role: 'alumni', batch: batchYear.trim() })
      if (group) await this.detachMember(group.id, userId)
      return
    }

    if (role === 'student' && batchYear?.trim()) {
      const group = await this.findGroup(universityId, { role: 'student', batch: batchYear.trim() })
      if (group) await this.detachMember(group.id, userId)
      return
    }
  }

  async syncUserMembership(
    userId: string,
    universityId: string,
    previous: { role: UserRole; department: string | null; batchYear: string | null },
    next: { role: UserRole; department: string | null; batchYear: string | null },
  ): Promise<void> {
    if (
      previous.role === next.role &&
      (previous.department ?? null) === (next.department ?? null) &&
      (previous.batchYear ?? null) === (next.batchYear ?? null)
    ) {
      return
    }
    try {
      await this.removeUserFromSystemGroups(
        userId,
        universityId,
        previous.role,
        previous.department,
        previous.batchYear,
      )
      await this.addUserToSystemGroups(userId, universityId, next.role, next.department, next.batchYear)
    } catch (error) {
      logger.warn('System-groups sync failed', { error, userId, universityId })
    }
  }

  private async findOrCreateGroup(
    universityId: string,
    kind: SystemGroupKind,
    executor: Knex = db,
    creatorFallback?: string,
  ): Promise<string> {
    const existing = await this.findGroup(universityId, kind, executor)
    if (existing) return existing.id

    const createdBy = creatorFallback ?? (await this.firstUserOf(universityId, kind, executor))
    if (!createdBy) throw new Error('SYSTEM_GROUP_NO_CREATOR')

    let name: string
    let description: string
    let type: string
    let department: string | null

    if (kind.role === 'admin') {
      const uni = await executor('universities')
        .where({ id: universityId })
        .select<{ name: string }[]>('name')
        .first()
      const uniName = uni?.name ?? 'Unknown University'
      name = `Admins of ${uniName}`
      description = `Official auto-managed group for all administrators of ${uniName}.`
      type = 'other'
      department = null
    } else if (kind.role === 'faculty') {
      name = `${kind.department} Dept`
      description = `Official auto-managed group for ${kind.department} faculty.`
      type = 'department'
      department = kind.department
    } else if (kind.role === 'alumni') {
      name = `${kind.batch} Graduates`
      description = `Official auto-managed group for ${kind.batch} graduates.`
      type = 'batch'
      department = kind.batch
    } else {
      // student
      name = kind.batch
      description = `Official auto-managed group for ${kind.batch} students.`
      type = 'batch'
      department = kind.batch
    }

    const [row] = await executor('groups')
      .insert({
        university_id: universityId,
        created_by: createdBy,
        name,
        description,
        type,
        is_private: true,
        is_system: true,
        allowed_role: kind.role,
        department,
        member_count: 0,
      })
      .returning<{ id: string }[]>('id')

    return row.id
  }

  private async findGroup(universityId: string, kind: SystemGroupKind, executor: Knex = db) {
    const query = executor('groups')
      .where({ university_id: universityId, is_system: true, allowed_role: kind.role })
      .select<{ id: string }[]>('id')

    if (kind.role === 'faculty') {
      query.andWhere({ department: kind.department })
    } else if (kind.role === 'alumni' || kind.role === 'student') {
      query.andWhere({ department: kind.batch })
    } else {
      // admin
      query.whereNull('department')
    }

    return query.first()
  }

  private async firstUserOf(universityId: string, kind: SystemGroupKind, executor: Knex = db) {
    if (kind.role === 'admin') {
      return executor('users')
        .where({ university_id: universityId, role: 'admin' })
        .select<{ id: string }[]>('id')
        .orderBy('created_at', 'asc')
        .first()
        .then((r) => r?.id)
    }

    if (kind.role === 'faculty') {
      return executor('users')
        .join('profiles', 'profiles.user_id', 'users.id')
        .where({
          'users.university_id': universityId,
          'users.role': 'faculty',
          'profiles.department': kind.department,
        })
        .select<{ id: string }[]>('users.id')
        .orderBy('users.created_at', 'asc')
        .first()
        .then((r) => r?.id)
    }

    // alumni or student — look up by batch_year in profiles
    return executor('users')
      .join('profiles', 'profiles.user_id', 'users.id')
      .where({
        'users.university_id': universityId,
        'users.role': kind.role,
        'profiles.batch_year': kind.batch,
      })
      .select<{ id: string }[]>('users.id')
      .orderBy('users.created_at', 'asc')
      .first()
      .then((r) => r?.id)
  }

  private async attachMember(groupId: string, userId: string) {
    await db.transaction(async (trx) => {
      const inserted = await trx('group_members')
        .insert({ group_id: groupId, user_id: userId, role: 'member' })
        .onConflict(['group_id', 'user_id'])
        .ignore()
        .returning<{ group_id: string }[]>('group_id')

      if (inserted.length > 0) {
        await trx('groups').where({ id: groupId }).increment('member_count', 1)
      }
    })
  }

  private async detachMember(groupId: string, userId: string) {
    await db.transaction(async (trx) => {
      const deleted = await trx('group_members').where({ group_id: groupId, user_id: userId }).delete()
      if (deleted > 0) {
        await trx('groups').where({ id: groupId }).where('member_count', '>', 0).decrement('member_count', 1)
      }
    })
  }
}

export const systemGroupsService = new SystemGroupsService()
```

- [ ] **Step 2: Run tests to confirm they pass**

```bash
npx pnpm --filter api test src/__tests__/system-groups.test.ts
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/groups/system-groups.service.ts \
        apps/api/src/__tests__/system-groups.test.ts
git commit -m "feat(groups): extend system-groups service with alumni and student batch kinds"
```

---

### Task 3: Create migration `037_auto_groups_batch_and_rename.ts`

**Files:**
- Create: `apps/api/src/database/migrations/037_auto_groups_batch_and_rename.ts`

- [ ] **Step 1: Create the migration file**

```ts
// apps/api/src/database/migrations/037_auto_groups_batch_and_rename.ts
import type { Knex } from 'knex'

interface UniversityRow { id: string; name: string }
interface BatchRow { university_id: string; batch_year: string }

export async function up(knex: Knex) {
  // Pass 1 — rename admin groups: "All admins" → "Admins of {university name}"
  await knex.raw(`
    UPDATE groups g
    SET name = 'Admins of ' || u.name
    FROM universities u
    WHERE g.university_id = u.id
      AND g.is_system = true
      AND g.allowed_role = 'admin'
  `)

  // Pass 2 — rename faculty dept groups: "{dept}" → "{dept} Dept"
  await knex.raw(`
    UPDATE groups
    SET name = department || ' Dept'
    WHERE is_system = true
      AND allowed_role = 'faculty'
      AND department IS NOT NULL
  `)

  // Pass 3 — backfill alumni batch groups
  const alumniBatches = await knex('profiles')
    .join('users', 'users.id', 'profiles.user_id')
    .where({ 'users.role': 'alumni' })
    .whereNotNull('profiles.batch_year')
    .select<BatchRow[]>('users.university_id', 'profiles.batch_year as batch_year')
    .groupBy('users.university_id', 'profiles.batch_year')

  for (const { university_id, batch_year } of alumniBatches) {
    let group = await knex('groups')
      .where({ university_id, is_system: true, allowed_role: 'alumni', department: batch_year })
      .select<{ id: string }[]>('id')
      .first()

    if (!group) {
      const firstAlumnus = await knex('users')
        .join('profiles', 'profiles.user_id', 'users.id')
        .where({ 'users.university_id': university_id, 'users.role': 'alumni', 'profiles.batch_year': batch_year })
        .select<{ id: string }[]>('users.id')
        .orderBy('users.created_at', 'asc')
        .first()
      if (!firstAlumnus) continue

      const [row] = await knex('groups')
        .insert({
          university_id,
          created_by: firstAlumnus.id,
          name: `${batch_year} Graduates`,
          description: `Official auto-managed group for ${batch_year} graduates.`,
          type: 'batch',
          is_private: true,
          is_system: true,
          allowed_role: 'alumni',
          department: batch_year,
          member_count: 0,
        })
        .returning<{ id: string }[]>('id')
      group = row
    }

    const members = await knex('users')
      .join('profiles', 'profiles.user_id', 'users.id')
      .where({ 'users.university_id': university_id, 'users.role': 'alumni', 'profiles.batch_year': batch_year })
      .select<{ id: string }[]>('users.id')

    for (const member of members) {
      await knex('group_members')
        .insert({ group_id: group.id, user_id: member.id, role: 'member' })
        .onConflict(['group_id', 'user_id'])
        .ignore()
    }
  }

  // Pass 4 — backfill student batch groups
  const studentBatches = await knex('profiles')
    .join('users', 'users.id', 'profiles.user_id')
    .where({ 'users.role': 'student' })
    .whereNotNull('profiles.batch_year')
    .select<BatchRow[]>('users.university_id', 'profiles.batch_year as batch_year')
    .groupBy('users.university_id', 'profiles.batch_year')

  for (const { university_id, batch_year } of studentBatches) {
    let group = await knex('groups')
      .where({ university_id, is_system: true, allowed_role: 'student', department: batch_year })
      .select<{ id: string }[]>('id')
      .first()

    if (!group) {
      const firstStudent = await knex('users')
        .join('profiles', 'profiles.user_id', 'users.id')
        .where({ 'users.university_id': university_id, 'users.role': 'student', 'profiles.batch_year': batch_year })
        .select<{ id: string }[]>('users.id')
        .orderBy('users.created_at', 'asc')
        .first()
      if (!firstStudent) continue

      const [row] = await knex('groups')
        .insert({
          university_id,
          created_by: firstStudent.id,
          name: batch_year,
          description: `Official auto-managed group for ${batch_year} students.`,
          type: 'batch',
          is_private: true,
          is_system: true,
          allowed_role: 'student',
          department: batch_year,
          member_count: 0,
        })
        .returning<{ id: string }[]>('id')
      group = row
    }

    const members = await knex('users')
      .join('profiles', 'profiles.user_id', 'users.id')
      .where({ 'users.university_id': university_id, 'users.role': 'student', 'profiles.batch_year': batch_year })
      .select<{ id: string }[]>('users.id')

    for (const member of members) {
      await knex('group_members')
        .insert({ group_id: group.id, user_id: member.id, role: 'member' })
        .onConflict(['group_id', 'user_id'])
        .ignore()
    }
  }

  // Pass 5 — resync member counts on all system groups
  await knex.raw(`
    UPDATE groups g
    SET member_count = (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id)
    WHERE g.is_system = true
  `)
}

export async function down(knex: Knex) {
  // Revert admin group names
  await knex.raw(`
    UPDATE groups
    SET name = 'All admins'
    WHERE is_system = true AND allowed_role = 'admin'
  `)

  // Revert faculty group names: remove ' Dept' suffix
  await knex.raw(`
    UPDATE groups
    SET name = department
    WHERE is_system = true AND allowed_role = 'faculty' AND department IS NOT NULL
  `)

  // Delete alumni and student batch groups (cascade removes group_members)
  await knex('groups')
    .where({ is_system: true })
    .whereIn('allowed_role', ['alumni', 'student'])
    .delete()
}
```

- [ ] **Step 2: Run the migration**

```bash
npx pnpm --filter api db:migrate
```

Expected: Migration `037` runs with no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/database/migrations/037_auto_groups_batch_and_rename.ts
git commit -m "feat(db): migration 037 — rename system groups and backfill alumni/student batch groups"
```

---

### Task 4: Write failing tests for auth registration validation

**Files:**
- Modify: `apps/api/src/__tests__/auth.test.ts`

- [ ] **Step 1: Add the following tests inside `auth.test.ts`, appended after the existing `describe` blocks**

```ts
// Append to apps/api/src/__tests__/auth.test.ts

describe('POST /api/v1/auth/register — role-based required field validation', () => {
  it('returns 422 when faculty omits department', async () => {
    const res = await api
      .post('/api/v1/auth/register')
      .set(UNI)
      .send({
        email: `faculty.nodept.${Date.now()}@uiu.ac.bd`,
        password: 'TestPass@1234',
        full_name: 'No Dept Faculty',
        role: 'faculty',
        // no department
      })
    expect(res.status).toBe(422)
  })

  it('returns 422 when alumni omits department', async () => {
    const res = await api
      .post('/api/v1/auth/register')
      .set(UNI)
      .send({
        email: `alumni.nodept.${Date.now()}@uiu.ac.bd`,
        password: 'TestPass@1234',
        full_name: 'No Dept Alumni',
        role: 'alumni',
        batch_year: 'Fall 2023',
        // no department
      })
    expect(res.status).toBe(422)
  })

  it('returns 422 when alumni omits batch_year', async () => {
    const res = await api
      .post('/api/v1/auth/register')
      .set(UNI)
      .send({
        email: `alumni.nobatch.${Date.now()}@uiu.ac.bd`,
        password: 'TestPass@1234',
        full_name: 'No Batch Alumni',
        role: 'alumni',
        department: 'CSE',
        // no batch_year
      })
    expect(res.status).toBe(422)
  })

  it('returns 422 when student omits department', async () => {
    const res = await api
      .post('/api/v1/auth/register')
      .set(UNI)
      .send({
        email: `student.nodept.${Date.now()}@uiu.ac.bd`,
        password: 'TestPass@1234',
        full_name: 'No Dept Student',
        role: 'student',
        batch_year: 'Spring 2024',
        // no department
      })
    expect(res.status).toBe(422)
  })

  it('returns 422 when student omits batch_year', async () => {
    const res = await api
      .post('/api/v1/auth/register')
      .set(UNI)
      .send({
        email: `student.nobatch.${Date.now()}@uiu.ac.bd`,
        password: 'TestPass@1234',
        full_name: 'No Batch Student',
        role: 'student',
        department: 'EEE',
        // no batch_year
      })
    expect(res.status).toBe(422)
  })

  it('returns 201 when faculty provides department', async () => {
    const email = `faculty.valid.${Date.now()}@uiu.ac.bd`
    createdUserEmails.push(email)

    const res = await api
      .post('/api/v1/auth/register')
      .set(UNI)
      .send({
        email,
        password: 'TestPass@1234',
        full_name: 'Valid Faculty',
        role: 'faculty',
        department: 'CSE',
      })
    expect(res.status).toBe(201)
  })

  it('returns 201 when alumni provides both department and batch_year', async () => {
    const email = `alumni.valid.${Date.now()}@uiu.ac.bd`
    createdUserEmails.push(email)

    const res = await api
      .post('/api/v1/auth/register')
      .set(UNI)
      .send({
        email,
        password: 'TestPass@1234',
        full_name: 'Valid Alumni',
        role: 'alumni',
        department: 'CSE',
        batch_year: 'Fall 2023',
      })
    expect(res.status).toBe(201)
  })

  it('returns 201 when student provides both department and batch_year', async () => {
    const email = `student.valid.${Date.now()}@uiu.ac.bd`
    createdUserEmails.push(email)

    const res = await api
      .post('/api/v1/auth/register')
      .set(UNI)
      .send({
        email,
        password: 'TestPass@1234',
        full_name: 'Valid Student',
        role: 'student',
        department: 'EEE',
        batch_year: 'Spring 2024',
      })
    expect(res.status).toBe(201)
  })
})

describe('GET /api/v1/auth/invitation/:token', () => {
  it('returns universityName in response', async () => {
    // Use dev-invite token (seeded in db:seed — token: 'dev-invite')
    // If not available, this test will return 404 and can be skipped in CI
    const res = await api
      .get('/api/v1/auth/invitation/dev-invite')
      .set(UNI)
    if (res.status === 404) return // token already used or not present — skip
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveProperty('universityName')
    expect(typeof res.body.data.universityName).toBe('string')
    expect(res.body.data.universityName.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run to confirm the new tests fail**

```bash
npx pnpm --filter api test src/__tests__/auth.test.ts
```

Expected: The validation tests return 201 (instead of 422) and `universityName` is missing from the invitation response.

---

### Task 5: Extend `auth/schema.ts` and `auth/service.ts`

**Files:**
- Modify: `apps/api/src/modules/auth/schema.ts`
- Modify: `apps/api/src/modules/auth/service.ts`

- [ ] **Step 1: Add `batch_year` to `RegisterSchema` in `auth/schema.ts`**

Find the `RegisterSchema` object and add `batch_year` to the field list:

```ts
// In apps/api/src/modules/auth/schema.ts
// Find the .object({ ... }) block inside RegisterSchema and add this line:
batch_year: z.string().trim().min(1).max(20).optional().nullable(),
```

Then add `batch_year` to the `.transform(...)` output:

```ts
// Inside the .transform((value) => ({ ... })) block, add:
batch_year: value.batch_year ?? null,
```

Final `RegisterSchema` after edit:

```ts
export const RegisterSchema = z
  .object({
    email: z.string().trim().email('Valid email is required').transform((value) => value.toLowerCase()).optional(),
    password: z.string().min(8, 'Password must be at least 8 characters').optional(),
    full_name: z.string().trim().min(1, 'Full name is required').optional(),
    fullName: z.string().trim().min(1, 'Full name is required').optional(),
    role: AuthRoleSchema.optional(),
    invitation_token: z.string().trim().min(1).optional(),
    token: z.string().trim().min(1).optional(),
    department: z.string().trim().min(1).max(100).optional().nullable(),
    batch_year: z.string().trim().min(1).max(20).optional().nullable(),
  })
  .transform((value) => ({
    email: value.email,
    password: value.password,
    full_name: value.full_name ?? value.fullName,
    role: value.role,
    invitation_token: value.invitation_token ?? value.token,
    department: value.department ?? null,
    batch_year: value.batch_year ?? null,
  }))
  .refine((value) => Boolean(value.full_name), {
    message: 'Full name is required',
  })

export type RegisterInput = z.infer<typeof RegisterSchema>
```

- [ ] **Step 2: Add role-based validation in `auth/service.ts` — `register` method**

Locate the block after the email-domain check and before the existing-user check. Add this validation immediately after the `if (!email || !role || !data.full_name)` guard:

```ts
// After the existing guard at the top of register():
if (role === 'faculty' || role === 'alumni' || role === 'student') {
  if (!data.department?.trim()) {
    throw new AppError('Department is required for this role', 422, 'VALIDATION_ERROR')
  }
}

if (role === 'alumni' || role === 'student') {
  if (!data.batch_year?.trim()) {
    throw new AppError('Batch year is required for this role', 422, 'VALIDATION_ERROR')
  }
}
```

- [ ] **Step 3: Store `batch_year` in `profiles` during the registration transaction**

Find the `trx('profiles').insert({ ... })` call inside the `db.transaction` block and add `batch_year`:

```ts
await trx('profiles').insert({
  user_id: createdUser.id,
  full_name: data.full_name,
  department: data.department ?? null,
  batch_year: data.batch_year ?? null,   // ADD THIS LINE
})
```

- [ ] **Step 4: Pass `batch_year` to `addUserToSystemGroups` in `verifyAccount`**

Find the `systemGroupsService.addUserToSystemGroups(...)` call and add the fifth argument:

```ts
await systemGroupsService
  .addUserToSystemGroups(user.id, user.university_id, user.role, profile.department, profile.batch_year)
  .catch((error: unknown) => logger.warn('System-groups add failed on verify', { error, userId: user.id }))
```

- [ ] **Step 5: Extend `peekInvitation` to return `universityName`**

Replace the existing `peekInvitation` implementation:

```ts
async peekInvitation(token: string, universityId: string) {
  const inv = await db('invitations')
    .join('universities', 'universities.id', 'invitations.university_id')
    .where({
      'invitations.token': token,
      'invitations.university_id': universityId,
      'invitations.is_used': false,
    })
    .where('invitations.expires_at', '>', db.fn.now())
    .select(
      'invitations.role',
      'invitations.email',
      'universities.name as university_name',
    )
    .first<{ role: string; email: string; university_name: string } | undefined>()

  if (!inv) throw new AppError('Invitation not found', 404, 'NOT_FOUND')
  return { role: inv.role as UserRole, email: inv.email, universityName: inv.university_name }
}
```

- [ ] **Step 6: Run tests to confirm they pass**

```bash
npx pnpm --filter api test src/__tests__/auth.test.ts
```

Expected: All validation tests pass and `universityName` appears in invitation response.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/auth/schema.ts \
        apps/api/src/modules/auth/service.ts \
        apps/api/src/__tests__/auth.test.ts
git commit -m "feat(auth): require department/batch_year by role; store batch_year on register; add universityName to invite peek"
```

---

### Task 6: Extend `users/service.ts` — batch year sync

**Files:**
- Modify: `apps/api/src/modules/users/service.ts`

- [ ] **Step 1: Extend the `existing` query to select `profiles.batch_year`**

Find `updateCurrentUser`. The query that reads the current user state selects `users.role` and `profiles.department`. Add `profiles.batch_year`:

```ts
const existing = await db('users')
  .join('profiles', 'profiles.user_id', 'users.id')
  .where({ 'users.id': userId, 'users.university_id': universityId })
  .select<{ role: UserRole; department: string | null; batch_year: string | null }[]>(
    'users.role',
    'profiles.department',
    'profiles.batch_year',   // ADD THIS
  )
  .first()
```

- [ ] **Step 2: Replace the existing sync-trigger block**

Find the block:
```ts
if (input.department !== undefined && input.department !== existing.department) {
  await systemGroupsService.syncUserMembership(
    userId,
    universityId,
    { role: existing.role, department: existing.department },
    { role: existing.role, department: input.department },
  )
}
```

Replace it with:
```ts
const departmentChanged = input.department !== undefined && input.department !== existing.department
const batchYearChanged =
  input.batchYear !== undefined && input.batchYear !== (existing.batch_year ?? null)

if (departmentChanged || batchYearChanged) {
  await systemGroupsService.syncUserMembership(
    userId,
    universityId,
    {
      role: existing.role,
      department: existing.department,
      batchYear: existing.batch_year ?? null,
    },
    {
      role: existing.role,
      department: input.department !== undefined ? input.department : existing.department,
      batchYear: input.batchYear !== undefined ? input.batchYear : (existing.batch_year ?? null),
    },
  )
}
```

- [ ] **Step 3: Run the full backend test suite to confirm no regressions**

```bash
npx pnpm --filter api test
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/users/service.ts
git commit -m "feat(users): trigger system-group sync on batchYear profile change"
```

---

### Task 7: Extend `admin/service.ts` — pass `batchYear` in all three call sites

**Files:**
- Modify: `apps/api/src/modules/admin/service.ts`

There are three methods that call system-group functions. Each query currently selects `users.role` and `profiles.department` — all three need `profiles.batch_year` added, and all calls need the `batchYear` argument passed through.

- [ ] **Step 1: Fix `updateUserRole`**

Find the `previous` query:
```ts
const previous = await db('users')
  .join('profiles', 'profiles.user_id', 'users.id')
  .where({ 'users.id': userId, 'users.university_id': universityId })
  .select<{ role: import('@uniconnect/shared').UserRole; department: string | null }[]>(
    'users.role',
    'profiles.department',
  )
  .first()
```

Replace with:
```ts
const previous = await db('users')
  .join('profiles', 'profiles.user_id', 'users.id')
  .where({ 'users.id': userId, 'users.university_id': universityId })
  .select<{ role: import('@uniconnect/shared').UserRole; department: string | null; batch_year: string | null }[]>(
    'users.role',
    'profiles.department',
    'profiles.batch_year',
  )
  .first()
```

Find the `syncUserMembership` call:
```ts
await systemGroupsService.syncUserMembership(
  userId,
  universityId,
  { role: previous.role, department: previous.department },
  { role: input.role, department: previous.department },
)
```

Replace with:
```ts
await systemGroupsService.syncUserMembership(
  userId,
  universityId,
  { role: previous.role, department: previous.department, batchYear: previous.batch_year ?? null },
  { role: input.role, department: previous.department, batchYear: previous.batch_year ?? null },
)
```

- [ ] **Step 2: Fix `deleteUser`**

Find the `user` query inside `deleteUser`:
```ts
const user = await db('users')
  .join('profiles', 'profiles.user_id', 'users.id')
  .where({ 'users.id': userId, 'users.university_id': universityId, 'users.is_deleted': false })
  .select<{ role: import('@uniconnect/shared').UserRole; department: string | null }[]>(
    'users.role',
    'profiles.department',
  )
  .first()
```

Replace with:
```ts
const user = await db('users')
  .join('profiles', 'profiles.user_id', 'users.id')
  .where({ 'users.id': userId, 'users.university_id': universityId, 'users.is_deleted': false })
  .select<{ role: import('@uniconnect/shared').UserRole; department: string | null; batch_year: string | null }[]>(
    'users.role',
    'profiles.department',
    'profiles.batch_year',
  )
  .first()
```

Find the `removeUserFromSystemGroups` call:
```ts
await systemGroupsService.removeUserFromSystemGroups(userId, universityId, user.role, user.department)
```

Replace with:
```ts
await systemGroupsService.removeUserFromSystemGroups(
  userId,
  universityId,
  user.role,
  user.department,
  user.batch_year ?? null,
)
```

- [ ] **Step 3: Fix `updateUserStatus`**

Find the `previous` query inside `updateUserStatus`:
```ts
const previous = await db('users')
  .join('profiles', 'profiles.user_id', 'users.id')
  .where({ 'users.id': userId, 'users.university_id': universityId })
  .select<{ role: import('@uniconnect/shared').UserRole; department: string | null }[]>(
    'users.role',
    'profiles.department',
  )
  .first()
```

Replace with:
```ts
const previous = await db('users')
  .join('profiles', 'profiles.user_id', 'users.id')
  .where({ 'users.id': userId, 'users.university_id': universityId })
  .select<{ role: import('@uniconnect/shared').UserRole; department: string | null; batch_year: string | null }[]>(
    'users.role',
    'profiles.department',
    'profiles.batch_year',
  )
  .first()
```

Find the `removeUserFromSystemGroups` call in the `!input.is_active` branch:
```ts
await systemGroupsService.removeUserFromSystemGroups(
  userId,
  universityId,
  previous.role,
  previous.department,
)
```

Replace with:
```ts
await systemGroupsService.removeUserFromSystemGroups(
  userId,
  universityId,
  previous.role,
  previous.department,
  previous.batch_year ?? null,
)
```

Find the `addUserToSystemGroups` call in the `else` branch:
```ts
await systemGroupsService.addUserToSystemGroups(
  userId,
  universityId,
  previous.role,
  previous.department,
)
```

Replace with:
```ts
await systemGroupsService.addUserToSystemGroups(
  userId,
  universityId,
  previous.role,
  previous.department,
  previous.batch_year ?? null,
)
```

- [ ] **Step 4: Run the full backend test suite**

```bash
npx pnpm --filter api test
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/admin/service.ts
git commit -m "feat(admin): pass batchYear in all system-group sync and add/remove calls"
```

---

### Task 8: Rewrite `RegisterPage.tsx`

**Files:**
- Modify: `apps/web/src/pages/RegisterPage.tsx`

- [ ] **Step 1: Replace the entire file**

```tsx
// apps/web/src/pages/RegisterPage.tsx
import { FormEvent, useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { isAxiosError } from 'axios'
import { api } from '@/lib/axios'
import { PrimaryBtn } from '@/components/Button'
import { BrandLogo } from '@/components/BrandLogo'
import { PATHS } from '@/router/paths'
import { MinimalPageFooter } from '@/components/MinimalPageFooter'
import type { User, UserRole } from '@uniconnect/shared/types'

interface RegisterResponse {
  data: {
    message: string
    user: User
    accessToken: string
  }
}

interface InvitePreview {
  role: UserRole
  email: string
  universityName?: string
}

interface InvitePreviewResponse {
  data: InvitePreview
}

const SEMESTERS = ['Fall', 'Spring', 'Summer'] as const
const BATCH_YEARS = Array.from({ length: 11 }, (_, i) => String(2020 + i)) // 2020–2030

function isBatchRequired(role: UserRole | null) {
  return role === 'alumni' || role === 'student'
}

function isDeptRequired(role: UserRole | null) {
  return role === 'faculty' || role === 'alumni' || role === 'student'
}

function validate(
  fullName: string,
  password: string,
  confirmPassword: string,
  role: UserRole | null,
  department: string,
  batchSemester: string,
  batchYear: string,
) {
  const errs: Record<string, string> = {}
  if (!fullName.trim()) errs.fullName = 'Full name is required'
  if (!/^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/.test(password))
    errs.password = 'Must be 8+ chars with a number, uppercase, and symbol.'
  if (password !== confirmPassword) errs.confirmPassword = 'Passwords do not match'
  if (isDeptRequired(role) && !department.trim()) errs.department = 'Department is required'
  if (isBatchRequired(role) && !batchSemester) errs.batchSemester = 'Select a semester'
  if (isBatchRequired(role) && !batchYear) errs.batchYear = 'Select a year'
  return errs
}

export default function RegisterPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()

  const [fullName, setFullName]               = useState('')
  const [password, setPassword]               = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [inviteToken, setInviteToken]         = useState('')
  const [fieldErrors, setFieldErrors]         = useState<Record<string, string>>({})
  const [serverError, setServerError]         = useState<string | null>(null)
  const [loading, setLoading]                 = useState(false)

  const [inviteData, setInviteData]         = useState<InvitePreview | null>(null)
  const [inviteLoading, setInviteLoading]   = useState(false)
  const [inviteError, setInviteError]       = useState<string | null>(null)

  const [department, setDepartment]         = useState('')
  const [batchSemester, setBatchSemester]   = useState('')
  const [batchYear, setBatchYear]           = useState('')

  useEffect(() => {
    if (!token || token === 'invite') return
    setInviteLoading(true)
    api.get<InvitePreviewResponse>(`/auth/invitation/${token}`)
      .then(({ data }) => setInviteData(data.data))
      .catch(() => setInviteError('Invitation is invalid or has already been used.'))
      .finally(() => setInviteLoading(false))
  }, [token])

  if (!token || token === 'invite') {
    return (
      <RegisterShell>
        <div style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-xl)',
          padding: '32px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.3 }}>
              Create your account
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Enter your invitation code to continue registration.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              const nextToken = inviteToken.trim()
              if (nextToken) navigate(PATHS.REGISTER.replace(':token', nextToken))
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <Field label="Invite code">
              <input
                type="text"
                autoComplete="off"
                required
                value={inviteToken}
                onChange={(e) => setInviteToken(e.target.value)}
                placeholder="dev-invite"
                style={inputStyle}
              />
            </Field>

            <PrimaryBtn
              type="submit"
              disabled={!inviteToken.trim()}
              style={{ width: '100%', marginTop: 4, justifyContent: 'center' }}
            >
              Continue
            </PrimaryBtn>
          </form>
        </div>

        <p style={{ margin: 0, textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <a href={PATHS.LOGIN} style={{ color: 'var(--uc-indigo-l)', textDecoration: 'none' }}>
            Sign in
          </a>
        </p>
      </RegisterShell>
    )
  }

  if (inviteLoading) {
    return (
      <RegisterShell>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
          Checking invitation…
        </p>
      </RegisterShell>
    )
  }

  if (inviteError) {
    return (
      <RegisterShell>
        <div style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-xl)',
          padding: '32px 28px',
          textAlign: 'center',
        }}>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--uc-orange-l)' }}>{inviteError}</p>
        </div>
      </RegisterShell>
    )
  }

  const role = inviteData?.role ?? null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    setServerError(null)

    const errs = validate(fullName, password, confirmPassword, role, department, batchSemester, batchYear)
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      return
    }

    const batchYearString =
      isBatchRequired(role) ? `${batchSemester} ${batchYear}` : undefined

    setLoading(true)
    try {
      const { data } = await api.post<RegisterResponse>('/auth/register', {
        token,
        password,
        fullName: fullName.trim(),
        ...(isDeptRequired(role) && department.trim() ? { department: department.trim() } : {}),
        ...(batchYearString ? { batch_year: batchYearString } : {}),
      })
      navigate(`${PATHS.VERIFY_OTP}?purpose=verify`, {
        state: { email: data.data.user.email },
        replace: true,
      })
    } catch (err) {
      if (isAxiosError(err)) {
        const status = err.response?.status
        const code: string = err.response?.data?.code ?? ''
        if (status === 409 || code === 'CONFLICT') {
          setServerError('An account already exists for this invitation.')
        } else if (status === 404 || code === 'NOT_FOUND') {
          setServerError('Invitation token is invalid or expired.')
        } else if (status === 422) {
          setServerError('Please check your details and try again.')
        } else {
          setServerError('Something went wrong. Please try again.')
        }
      } else {
        setServerError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <RegisterShell>
      <div style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-xl)',
        padding: '32px 28px',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.3 }}>
            Create your account
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            You're registering with invitation code{' '}
            <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{token}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Full name" error={fieldErrors.fullName}>
            <input
              type="text"
              autoComplete="name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Joydip Datta"
              style={inputStyle}
            />
          </Field>

          <Field label="Password" error={fieldErrors.password}>
            <input
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 characters"
              style={inputStyle}
            />
          </Field>

          <Field label="Confirm password" error={fieldErrors.confirmPassword}>
            <input
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              style={inputStyle}
            />
          </Field>

          {/* University display — admin only */}
          {role === 'admin' && inviteData?.universityName && (
            <div style={{
              background: 'var(--surface-raised)',
              border: '0.5px solid var(--border-default)',
              borderRadius: 'var(--r-sm)',
              padding: '10px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>University</span>
              <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{inviteData.universityName}</span>
            </div>
          )}

          {/* Department — required for faculty, alumni, student */}
          {isDeptRequired(role) && (
            <Field label="Department" error={fieldErrors.department}>
              <input
                type="text"
                autoComplete="off"
                required
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. CSE"
                maxLength={100}
                style={inputStyle}
              />
            </Field>
          )}

          {/* Batch dropdowns — alumni (graduation) and student (admission) */}
          {isBatchRequired(role) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                {role === 'alumni' ? 'Graduation trimester' : 'Admission trimester'}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <select
                    value={batchSemester}
                    onChange={(e) => setBatchSemester(e.target.value)}
                    required
                    style={selectStyle}
                  >
                    <option value="">Semester</option>
                    {SEMESTERS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  {fieldErrors.batchSemester && (
                    <span style={{ fontSize: 12, color: 'var(--uc-orange-l)' }}>{fieldErrors.batchSemester}</span>
                  )}
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <select
                    value={batchYear}
                    onChange={(e) => setBatchYear(e.target.value)}
                    required
                    style={selectStyle}
                  >
                    <option value="">Year</option>
                    {BATCH_YEARS.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  {fieldErrors.batchYear && (
                    <span style={{ fontSize: 12, color: 'var(--uc-orange-l)' }}>{fieldErrors.batchYear}</span>
                  )}
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {role === 'alumni'
                  ? 'Enter the trimester you graduated. This determines which batch group you'll be added to.'
                  : 'Enter the trimester you were admitted. This determines which batch group you'll be added to.'}
              </p>
            </div>
          )}

          {serverError && (
            <p style={{
              margin: 0,
              fontSize: 13,
              color: 'var(--uc-orange-l)',
              background: 'var(--uc-orange-bg)',
              border: '0.5px solid var(--uc-orange-bdr)',
              borderRadius: 'var(--r-sm)',
              padding: '8px 12px',
            }}>
              {serverError}
            </p>
          )}

          <PrimaryBtn
            type="submit"
            disabled={loading}
            style={{ width: '100%', marginTop: 4, justifyContent: 'center' }}
          >
            {loading ? 'Creating account…' : 'Create account'}
          </PrimaryBtn>
        </form>
      </div>

      <p style={{ margin: 0, textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
        Already have an account?{' '}
        <a href={PATHS.LOGIN} style={{ color: 'var(--uc-indigo-l)', textDecoration: 'none' }}>
          Sign in
        </a>
      </p>
    </RegisterShell>
  )
}

function RegisterShell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{
      minHeight: '100dvh',
      background: 'var(--surface-page)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      position: 'relative',
    }}>
      <div style={{ position: 'absolute', top: 24, left: 24 }}>
        <Link
          to="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 500,
            padding: '8px 12px',
            borderRadius: 'var(--r-pill)',
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text-primary)'
            e.currentTarget.style.background = 'var(--surface-raised)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-secondary)'
            e.currentTarget.style.background = 'var(--surface-card)'
          }}
        >
          <ArrowLeft size={16} />
          Back to home
        </Link>
      </div>

      <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <BrandLogo height={40} />
        </div>
        {children}
      </div>
      <MinimalPageFooter />
    </main>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</span>
      {children}
      {error && <span style={{ fontSize: 12, color: 'var(--uc-orange-l)' }}>{error}</span>}
    </label>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-raised)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-sm)',
  padding: '10px 14px',
  fontSize: 14,
  color: 'var(--text-primary)',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  transition: 'border-color 0.15s',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  paddingRight: 32,
}
```

- [ ] **Step 2: Verify the frontend builds without TypeScript errors**

```bash
npx pnpm --filter web build
```

Expected: Build succeeds with no type errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/RegisterPage.tsx
git commit -m "feat(web): add batch dropdowns, required dept, and university display to registration form"
```

---

### Task 9: Final typecheck and lint

**Files:** All modified files

- [ ] **Step 1: Run typecheck across all workspaces**

```bash
npx pnpm typecheck
```

Expected: Zero type errors across `apps/api`, `apps/web`, and `packages/shared`.

- [ ] **Step 2: Run lint across all workspaces**

```bash
npx pnpm lint
```

Expected: Zero lint errors or warnings.

- [ ] **Step 3: Run the full backend test suite one final time**

```bash
npx pnpm --filter api test
```

Expected: All tests pass.

- [ ] **Step 4: Commit final cleanup if any lint auto-fixes were needed**

```bash
git add -A
git commit -m "chore: typecheck and lint fixes for auto-groups feature"
```
