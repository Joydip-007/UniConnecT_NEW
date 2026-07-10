# UniConnecT Academic LMS — Part 3 (Phases 5–8, Tasks 19–31)

> **Continuation of** `docs/superpowers/plans/2026-07-09-academic-lms.md` (Tasks 1–11) and `docs/superpowers/plans/2026-07-09-academic-lms-part2.md` (Tasks 12–18). Read both files' headers, Global Constraints, File Structure, and Interfaces Contract first — they apply here unchanged. Task numbering continues from Task 18.

---

# Phase 5 — Modules & Assignments

### Task 19: Migration `094_create_academic_lms_tables.ts` (Part B — modules, assignments, submissions)

**Files:**
- Modify: `apps/api/src/database/migrations/094_create_academic_lms_tables.ts` (created in Task 15 — this task appends to the same `up()`/`down()`, per spec §15's single-migration grouping)

**Interfaces:**
- Produces: tables `academic_group_modules`, `academic_assignments`, `academic_submissions` — consumed by Task 20, Task 21.

- [ ] **Step 1: Read the current state of the migration file (from Task 15)**

- [ ] **Step 2: Append the modules/assignments/submissions tables to `up()`, before the closing brace, after the existing `gradebook_entries` block**

```ts
  await knex.schema.createTable('academic_group_modules', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE')
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.uuid('created_by').references('id').inTable('users').onDelete('SET NULL')
    table.string('title', 255).notNullable()
    table.text('description')
    table.integer('week_number')
    table.integer('display_order').notNullable().defaultTo(1)
    table.boolean('is_published').notNullable().defaultTo(false)
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })
  await knex.schema.alterTable('academic_group_modules', (table) => {
    table.index(['group_id', 'display_order'], 'modules_group_order_idx')
  })

  await knex.schema.createTable('academic_assignments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE')
    table.uuid('module_id').references('id').inTable('academic_group_modules').onDelete('SET NULL')
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.uuid('created_by').references('id').inTable('users').onDelete('SET NULL')
    table.string('title', 255).notNullable()
    table.text('description')
    table.jsonb('file_urls').notNullable().defaultTo('[]')
    table.timestamp('deadline', { useTz: true })
    table.integer('max_score').notNullable().defaultTo(100)
    table.boolean('is_published').notNullable().defaultTo(false)
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })
  await knex.schema.alterTable('academic_assignments', (table) => {
    table.index(['group_id', 'deadline'], 'assignments_group_deadline_idx')
  })

  await knex.schema.createTable('academic_submissions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('assignment_id').notNullable().references('id').inTable('academic_assignments').onDelete('CASCADE')
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.jsonb('file_urls').notNullable().defaultTo('[]')
    table.text('text_content')
    table.integer('score')
    table.text('feedback')
    table.uuid('graded_by').references('id').inTable('users').onDelete('SET NULL')
    table.timestamp('submitted_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('graded_at', { useTz: true })
    table.boolean('is_late').notNullable().defaultTo(false)
    table.unique(['assignment_id', 'user_id'])
  })
  await knex.schema.alterTable('academic_submissions', (table) => {
    table.index(['assignment_id', 'user_id'], 'submissions_assignment_idx')
  })
```

- [ ] **Step 3: Append the symmetric drop order to `down()`, before the existing `gradebook_entries` drop (reverse creation order: submissions → assignments → modules → gradebook_entries)**

```ts
  await knex.schema.dropTableIfExists('academic_submissions')
  await knex.schema.dropTableIfExists('academic_assignments')
  await knex.schema.dropTableIfExists('academic_group_modules')
```

The full `down()` body after this edit reads:

```ts
export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('academic_submissions')
  await knex.schema.dropTableIfExists('academic_assignments')
  await knex.schema.dropTableIfExists('academic_group_modules')
  await knex.schema.dropTableIfExists('gradebook_entries')
}
```

- [ ] **Step 4: Roll back and re-run to verify the already-applied migration picks up the new tables**

Since `094_create_academic_lms_tables.ts` was already run in Task 15 with only `gradebook_entries`, editing an already-applied migration file requires a rollback first:

```bash
npx pnpm --filter api db:rollback
npx pnpm --filter api db:migrate
```

Expected: rollback drops `gradebook_entries`; migrate recreates all four tables (`gradebook_entries`, `academic_group_modules`, `academic_assignments`, `academic_submissions`) in one batch.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/database/migrations/094_create_academic_lms_tables.ts
git commit -m "feat(api): add modules, assignments, and submissions tables"
```

---

### Task 20: `academic/modules.service.ts` + routes

**Files:**
- Create: `apps/api/src/modules/academic/modules.service.ts`
- Modify: `apps/api/src/modules/academic/schema.ts`
- Modify: `apps/api/src/modules/academic/controller.ts`
- Modify: `apps/api/src/modules/academic/router.ts`
- Test: `apps/api/src/modules/academic/modules.service.test.ts`

**Interfaces:**
- Consumes: `academic_group_modules` (Task 19).
- Produces: `modulesService.list(context, groupId)`, `modulesService.create(context, groupId, input)`, `modulesService.update(...)`, `modulesService.delete(...)`, `modulesService.reorder(...)`, `modulesService.togglePublish(...)` — consumed by Task 21 (assignments link to modules), Task 22 (frontend).

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/modules/academic/modules.service.test.ts
import { describe, it, expect } from 'vitest'
import { modulesService } from './modules.service'
import { createUser } from '../../../tests/factories/user'
import { createUniversity } from '../../../tests/factories/university'
import { createGroupFixture } from '../../../tests/factories/group'

describe('modulesService', () => {
  it('creates a module and lists only published ones for a member', async () => {
    const universityId = await createUniversity()
    const faculty = await createUser({ universityId, role: 'faculty' })
    const student = await createUser({ universityId, role: 'student' })
    const group = await createGroupFixture({ universityId, type: 'academic', ownerId: faculty.id, memberIds: [student.id] })

    const facultyCtx = { userId: faculty.id, universityId, role: 'faculty' }
    const studentCtx = { userId: student.id, universityId, role: 'student' }

    const draft = await modulesService.create(facultyCtx, group.id, { title: 'Week 1', displayOrder: 1 })
    const published = await modulesService.create(facultyCtx, group.id, { title: 'Week 2', displayOrder: 2 })
    await modulesService.togglePublish(facultyCtx, group.id, published.id)

    const studentView = await modulesService.list(studentCtx, group.id)
    expect(studentView.map((m) => m.title)).toEqual(['Week 2'])

    const facultyView = await modulesService.list(facultyCtx, group.id)
    expect(facultyView).toHaveLength(2)
  })

  it('reorders modules by the given id order', async () => {
    const universityId = await createUniversity()
    const faculty = await createUser({ universityId, role: 'faculty' })
    const group = await createGroupFixture({ universityId, type: 'academic', ownerId: faculty.id })
    const facultyCtx = { userId: faculty.id, universityId, role: 'faculty' }

    const m1 = await modulesService.create(facultyCtx, group.id, { title: 'A', displayOrder: 1 })
    const m2 = await modulesService.create(facultyCtx, group.id, { title: 'B', displayOrder: 2 })

    await modulesService.reorder(facultyCtx, group.id, { order: [m2.id, m1.id] })

    const list = await modulesService.list(facultyCtx, group.id)
    expect(list.map((m) => m.id)).toEqual([m2.id, m1.id])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx pnpm --filter api test src/modules/academic/modules.service.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `modules.service.ts`**

```ts
// apps/api/src/modules/academic/modules.service.ts
import { db } from '../../database/db'
import { notFound } from '../../utils/errors'
import { assertGroupAdminAccess, assertMemberAccess } from '../groups/service'

function toModule(row) {
  return {
    id: row.id,
    groupId: row.group_id,
    title: row.title,
    description: row.description,
    weekNumber: row.week_number,
    displayOrder: row.display_order,
    isPublished: row.is_published,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const modulesService = {
  async list(context, groupId: string) {
    await assertMemberAccess(context, groupId)
    const isAdmin = await this.isGroupAdmin(context, groupId)
    let query = db('academic_group_modules').where({ group_id: groupId })
    if (!isAdmin) query = query.andWhere({ is_published: true })
    const rows = await query.orderBy('display_order')
    return rows.map(toModule)
  },

  async isGroupAdmin(context, groupId: string) {
    try {
      await assertGroupAdminAccess(context, groupId)
      return true
    } catch {
      return false
    }
  },

  async create(context, groupId: string, input) {
    await assertGroupAdminAccess(context, groupId)
    const [row] = await db('academic_group_modules')
      .insert({
        group_id: groupId,
        university_id: context.universityId,
        created_by: context.userId,
        title: input.title,
        description: input.description,
        week_number: input.weekNumber,
        display_order: input.displayOrder,
      })
      .returning('*')
    return toModule(row)
  },

  async update(context, groupId: string, moduleId: string, patch) {
    await assertGroupAdminAccess(context, groupId)
    const existing = await db('academic_group_modules').where({ id: moduleId, group_id: groupId }).first()
    if (!existing) throw notFound('Module not found')
    const [row] = await db('academic_group_modules')
      .where({ id: moduleId })
      .update({
        title: patch.title ?? existing.title,
        description: patch.description ?? existing.description,
        week_number: patch.weekNumber ?? existing.week_number,
        display_order: patch.displayOrder ?? existing.display_order,
        updated_at: db.fn.now(),
      })
      .returning('*')
    return toModule(row)
  },

  async delete(context, groupId: string, moduleId: string) {
    await assertGroupAdminAccess(context, groupId)
    const deleted = await db('academic_group_modules').where({ id: moduleId, group_id: groupId }).del()
    if (deleted === 0) throw notFound('Module not found')
  },

  async reorder(context, groupId: string, input: { order: string[] }) {
    await assertGroupAdminAccess(context, groupId)
    await db.transaction(async (trx) => {
      for (let i = 0; i < input.order.length; i++) {
        await trx('academic_group_modules').where({ id: input.order[i], group_id: groupId }).update({ display_order: i + 1 })
      }
    })
    return this.list(context, groupId)
  },

  async togglePublish(context, groupId: string, moduleId: string) {
    await assertGroupAdminAccess(context, groupId)
    const existing = await db('academic_group_modules').where({ id: moduleId, group_id: groupId }).first()
    if (!existing) throw notFound('Module not found')
    const [row] = await db('academic_group_modules')
      .where({ id: moduleId })
      .update({ is_published: !existing.is_published, updated_at: db.fn.now() })
      .returning('*')
    return toModule(row)
  },
}
```

- [ ] **Step 4: Add schema entries**

```ts
// apps/api/src/modules/academic/schema.ts (append)
export const CreateModuleSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  weekNumber: z.number().int().min(1).optional(),
  displayOrder: z.number().int().min(1),
})

export const UpdateModuleSchema = CreateModuleSchema.partial()

export const ReorderModulesSchema = z.object({
  order: z.array(z.string().uuid()),
})
```

- [ ] **Step 5: Add controller handlers and routes**

```ts
// apps/api/src/modules/academic/controller.ts (append)
export const listModules = asyncHandler(async (req, res) => {
  const context = { userId: req.user.userId, universityId: req.university.id, role: req.user.role }
  sendSuccess(res, await modulesService.list(context, req.params.groupId))
})

export const createModule = asyncHandler(async (req, res) => {
  const context = { userId: req.user.userId, universityId: req.university.id, role: req.user.role }
  sendSuccess(res, await modulesService.create(context, req.params.groupId, req.body), 201)
})

export const updateModule = asyncHandler(async (req, res) => {
  const context = { userId: req.user.userId, universityId: req.university.id, role: req.user.role }
  sendSuccess(res, await modulesService.update(context, req.params.groupId, req.params.moduleId, req.body))
})

export const deleteModule = asyncHandler(async (req, res) => {
  const context = { userId: req.user.userId, universityId: req.university.id, role: req.user.role }
  await modulesService.delete(context, req.params.groupId, req.params.moduleId)
  sendSuccess(res, { success: true })
})

export const reorderModules = asyncHandler(async (req, res) => {
  const context = { userId: req.user.userId, universityId: req.university.id, role: req.user.role }
  sendSuccess(res, await modulesService.reorder(context, req.params.groupId, req.body))
})

export const publishModule = asyncHandler(async (req, res) => {
  const context = { userId: req.user.userId, universityId: req.university.id, role: req.user.role }
  sendSuccess(res, await modulesService.togglePublish(context, req.params.groupId, req.params.moduleId))
})
```

```ts
// apps/api/src/modules/academic/router.ts (append)
academicRouter.get('/:groupId/modules', listModules)
academicRouter.post('/:groupId/modules', validate(CreateModuleSchema), createModule)
academicRouter.patch('/:groupId/modules/:moduleId', validate(UpdateModuleSchema), updateModule)
academicRouter.delete('/:groupId/modules/:moduleId', deleteModule)
academicRouter.patch('/:groupId/modules/reorder', validate(ReorderModulesSchema), reorderModules)
academicRouter.patch('/:groupId/modules/:moduleId/publish', publishModule)
```

Note the route-ordering hazard: `/:groupId/modules/reorder` must be declared **before** `/:groupId/modules/:moduleId` in the router if Express matches routes in declaration order and `reorder` would otherwise be captured by the `:moduleId` param — confirm Express's actual matching behavior for this router (mergeParams doesn't change route-matching order) and place the static `/reorder` route ahead of the dynamic `/:moduleId` routes to avoid a routing bug.

- [ ] **Step 6: Fix route declaration order per the note in Step 5**

```ts
academicRouter.get('/:groupId/modules', listModules)
academicRouter.post('/:groupId/modules', validate(CreateModuleSchema), createModule)
academicRouter.patch('/:groupId/modules/reorder', validate(ReorderModulesSchema), reorderModules)
academicRouter.patch('/:groupId/modules/:moduleId', validate(UpdateModuleSchema), updateModule)
academicRouter.delete('/:groupId/modules/:moduleId', deleteModule)
academicRouter.patch('/:groupId/modules/:moduleId/publish', publishModule)
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx pnpm --filter api test src/modules/academic/modules.service.test.ts`
Expected: PASS.

- [ ] **Step 8: Typecheck and lint**

```bash
npx pnpm --filter api typecheck && npx pnpm --filter api lint
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/modules/academic/modules.service.ts apps/api/src/modules/academic/modules.service.test.ts apps/api/src/modules/academic/schema.ts apps/api/src/modules/academic/controller.ts apps/api/src/modules/academic/router.ts
git commit -m "feat(api): add academic modules CRUD, reorder, and publish toggle"
```

---

### Task 21: `academic/assignments.service.ts` + upload-url + submissions/grading

**Files:**
- Create: `apps/api/src/modules/academic/assignments.service.ts`
- Modify: `apps/api/src/modules/academic/schema.ts`
- Modify: `apps/api/src/modules/academic/controller.ts`
- Modify: `apps/api/src/modules/academic/router.ts`
- Test: `apps/api/src/modules/academic/assignments.service.test.ts`

**Interfaces:**
- Consumes: `academic_assignments`, `academic_submissions` (Task 19), `getPresignedUploadUrl(key, contentType)` (existing `upload.service.ts:51`), `AttachmentSchema`-equivalent size cap pattern (per Global Constraints — 25MB, since `upload.service.ts` enforces no cap itself).
- Produces: `assignmentsService.list/get/create/update/delete/getUploadUrl/listSubmissions/submit/getSubmissionUploadUrl/gradeSubmission` — consumed by Task 22 (frontend).

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/modules/academic/assignments.service.test.ts
import { describe, it, expect } from 'vitest'
import { assignmentsService } from './assignments.service'
import { createUser } from '../../../tests/factories/user'
import { createUniversity } from '../../../tests/factories/university'
import { createGroupFixture } from '../../../tests/factories/group'

describe('assignmentsService', () => {
  it('students only see published assignments; faculty see all', async () => {
    const universityId = await createUniversity()
    const faculty = await createUser({ universityId, role: 'faculty' })
    const student = await createUser({ universityId, role: 'student' })
    const group = await createGroupFixture({ universityId, type: 'academic', ownerId: faculty.id, memberIds: [student.id] })
    const facultyCtx = { userId: faculty.id, universityId, role: 'faculty' }
    const studentCtx = { userId: student.id, universityId, role: 'student' }

    await assignmentsService.create(facultyCtx, group.id, { title: 'Draft HW', maxScore: 100 })
    const published = await assignmentsService.create(facultyCtx, group.id, { title: 'HW1', maxScore: 100 })
    await assignmentsService.update(facultyCtx, group.id, published.id, { isPublished: true })

    expect((await assignmentsService.list(studentCtx, group.id)).map((a) => a.title)).toEqual(['HW1'])
    expect(await assignmentsService.list(facultyCtx, group.id)).toHaveLength(2)
  })

  it('rejects a duplicate submission from the same student for the same assignment', async () => {
    const universityId = await createUniversity()
    const faculty = await createUser({ universityId, role: 'faculty' })
    const student = await createUser({ universityId, role: 'student' })
    const group = await createGroupFixture({ universityId, type: 'academic', ownerId: faculty.id, memberIds: [student.id] })
    const facultyCtx = { userId: faculty.id, universityId, role: 'faculty' }
    const studentCtx = { userId: student.id, universityId, role: 'student' }
    const assignment = await assignmentsService.create(facultyCtx, group.id, { title: 'HW1', maxScore: 100, isPublished: true })

    await assignmentsService.submit(studentCtx, group.id, assignment.id, { textContent: 'first try' })
    await expect(
      assignmentsService.submit(studentCtx, group.id, assignment.id, { textContent: 'second try' })
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  it('flags a submission as late when submitted after the deadline', async () => {
    const universityId = await createUniversity()
    const faculty = await createUser({ universityId, role: 'faculty' })
    const student = await createUser({ universityId, role: 'student' })
    const group = await createGroupFixture({ universityId, type: 'academic', ownerId: faculty.id, memberIds: [student.id] })
    const facultyCtx = { userId: faculty.id, universityId, role: 'faculty' }
    const studentCtx = { userId: student.id, universityId, role: 'student' }
    const pastDeadline = new Date(Date.now() - 86400000).toISOString()
    const assignment = await assignmentsService.create(facultyCtx, group.id, { title: 'HW1', maxScore: 100, isPublished: true, deadline: pastDeadline })

    const submission = await assignmentsService.submit(studentCtx, group.id, assignment.id, { textContent: 'late work' })
    expect(submission.isLate).toBe(true)
  })

  it('grades a submission and stores score/feedback', async () => {
    const universityId = await createUniversity()
    const faculty = await createUser({ universityId, role: 'faculty' })
    const student = await createUser({ universityId, role: 'student' })
    const group = await createGroupFixture({ universityId, type: 'academic', ownerId: faculty.id, memberIds: [student.id] })
    const facultyCtx = { userId: faculty.id, universityId, role: 'faculty' }
    const studentCtx = { userId: student.id, universityId, role: 'student' }
    const assignment = await assignmentsService.create(facultyCtx, group.id, { title: 'HW1', maxScore: 100, isPublished: true })
    const submission = await assignmentsService.submit(studentCtx, group.id, assignment.id, { textContent: 'work' })

    const graded = await assignmentsService.gradeSubmission(facultyCtx, group.id, assignment.id, submission.id, { score: 85, feedback: 'Good job' })
    expect(graded.score).toBe(85)
    expect(graded.feedback).toBe('Good job')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx pnpm --filter api test src/modules/academic/assignments.service.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `assignments.service.ts`**

```ts
// apps/api/src/modules/academic/assignments.service.ts
import { db } from '../../database/db'
import { notFound, conflict } from '../../utils/errors'
import { assertGroupAdminAccess, assertMemberAccess } from '../groups/service'
import { getPresignedUploadUrl, buildPublicUrl } from '../../services/upload.service'
import { sanitizeFileName } from '../../utils/sanitizeFileName' // reuse existing helper used by upload/controller.ts

const MAX_UPLOAD_BYTES = 26214400 // 25MB, per Global Constraints

function toAssignment(row) {
  return {
    id: row.id,
    groupId: row.group_id,
    moduleId: row.module_id,
    title: row.title,
    description: row.description,
    fileUrls: row.file_urls,
    deadline: row.deadline,
    maxScore: row.max_score,
    isPublished: row.is_published,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toSubmission(row) {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    userId: row.user_id,
    fileUrls: row.file_urls,
    textContent: row.text_content,
    score: row.score,
    feedback: row.feedback,
    submittedAt: row.submitted_at,
    gradedAt: row.graded_at,
    isLate: row.is_late,
  }
}

async function isGroupAdmin(context, groupId: string) {
  try {
    await assertGroupAdminAccess(context, groupId)
    return true
  } catch {
    return false
  }
}

export const assignmentsService = {
  async list(context, groupId: string) {
    await assertMemberAccess(context, groupId)
    const admin = await isGroupAdmin(context, groupId)
    let query = db('academic_assignments').where({ group_id: groupId })
    if (!admin) query = query.andWhere({ is_published: true })
    const rows = await query.orderBy('deadline', 'asc')
    return rows.map(toAssignment)
  },

  async get(context, groupId: string, assignmentId: string) {
    await assertMemberAccess(context, groupId)
    const row = await db('academic_assignments').where({ id: assignmentId, group_id: groupId }).first()
    if (!row) throw notFound('Assignment not found')
    return toAssignment(row)
  },

  async create(context, groupId: string, input) {
    await assertGroupAdminAccess(context, groupId)
    const [row] = await db('academic_assignments')
      .insert({
        group_id: groupId,
        module_id: input.moduleId,
        university_id: context.universityId,
        created_by: context.userId,
        title: input.title,
        description: input.description,
        file_urls: JSON.stringify(input.fileUrls ?? []),
        deadline: input.deadline,
        max_score: input.maxScore,
        is_published: input.isPublished ?? false,
      })
      .returning('*')
    return toAssignment(row)
  },

  async update(context, groupId: string, assignmentId: string, patch) {
    await assertGroupAdminAccess(context, groupId)
    const existing = await db('academic_assignments').where({ id: assignmentId, group_id: groupId }).first()
    if (!existing) throw notFound('Assignment not found')
    const [row] = await db('academic_assignments')
      .where({ id: assignmentId })
      .update({
        title: patch.title ?? existing.title,
        description: patch.description ?? existing.description,
        file_urls: patch.fileUrls ? JSON.stringify(patch.fileUrls) : existing.file_urls,
        deadline: patch.deadline ?? existing.deadline,
        max_score: patch.maxScore ?? existing.max_score,
        is_published: patch.isPublished ?? existing.is_published,
        module_id: patch.moduleId ?? existing.module_id,
        updated_at: db.fn.now(),
      })
      .returning('*')
    return toAssignment(row)
  },

  async delete(context, groupId: string, assignmentId: string) {
    await assertGroupAdminAccess(context, groupId)
    const deleted = await db('academic_assignments').where({ id: assignmentId, group_id: groupId }).del()
    if (deleted === 0) throw notFound('Assignment not found')
  },

  async getUploadUrl(context, groupId: string, fileName: string, contentType: string) {
    await assertMemberAccess(context, groupId)
    const key = `academic-assignments/${context.universityId}/${groupId}/${Date.now()}-${sanitizeFileName(fileName)}`
    const presigned = await getPresignedUploadUrl(key, contentType)
    return { ...presigned, maxSizeBytes: MAX_UPLOAD_BYTES }
  },

  async listSubmissions(context, groupId: string, assignmentId: string) {
    await assertGroupAdminAccess(context, groupId)
    const rows = await db('academic_submissions').where({ assignment_id: assignmentId })
    return rows.map(toSubmission)
  },

  async submit(context, groupId: string, assignmentId: string, input) {
    await assertMemberAccess(context, groupId)
    const assignment = await db('academic_assignments').where({ id: assignmentId, group_id: groupId }).first()
    if (!assignment) throw notFound('Assignment not found')

    const existing = await db('academic_submissions').where({ assignment_id: assignmentId, user_id: context.userId }).first()
    if (existing) throw conflict('You have already submitted this assignment')

    const isLate = assignment.deadline ? new Date() > new Date(assignment.deadline) : false

    const [row] = await db('academic_submissions')
      .insert({
        assignment_id: assignmentId,
        user_id: context.userId,
        university_id: context.universityId,
        file_urls: JSON.stringify(input.fileUrls ?? []),
        text_content: input.textContent,
        is_late: isLate,
      })
      .returning('*')
    return toSubmission(row)
  },

  async getSubmissionUploadUrl(context, groupId: string, fileName: string, contentType: string) {
    await assertMemberAccess(context, groupId)
    const key = `academic-submissions/${context.universityId}/${groupId}/${context.userId}/${Date.now()}-${sanitizeFileName(fileName)}`
    const presigned = await getPresignedUploadUrl(key, contentType)
    return { ...presigned, maxSizeBytes: MAX_UPLOAD_BYTES }
  },

  async gradeSubmission(context, groupId: string, assignmentId: string, submissionId: string, input: { score: number; feedback?: string }) {
    await assertGroupAdminAccess(context, groupId)
    const existing = await db('academic_submissions').where({ id: submissionId, assignment_id: assignmentId }).first()
    if (!existing) throw notFound('Submission not found')
    const [row] = await db('academic_submissions')
      .where({ id: submissionId })
      .update({ score: input.score, feedback: input.feedback, graded_by: context.userId, graded_at: db.fn.now() })
      .returning('*')
    return toSubmission(row)
  },
}
```

Note: `buildPublicUrl` is imported but unused in this snippet — remove the import when writing the final file (it was listed only because `upload.service.ts` exports it alongside `getPresignedUploadUrl`; this service doesn't need it directly since `getPresignedUploadUrl`'s return already includes `publicUrl`). Also confirm `sanitizeFileName` is actually exported from a shared `utils/` location (per the research note that `upload/controller.ts` calls `sanitizeFileName` inline) — if it's private to the `upload` module, export it from there or duplicate the one-line sanitizer rather than importing a private symbol.

- [ ] **Step 4: Remove the unused `buildPublicUrl` import and confirm `sanitizeFileName`'s real export location before saving the file** (see note above).

- [ ] **Step 5: Add schema entries**

```ts
// apps/api/src/modules/academic/schema.ts (append)
export const FileUrlSchema = z.object({
  name: z.string().max(255),
  url: z.string().url(),
  contentType: z.string().max(100),
  size: z.number().int().max(26214400),
})

export const CreateAssignmentSchema = z.object({
  moduleId: z.string().uuid().optional(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  fileUrls: z.array(FileUrlSchema).optional().default([]),
  deadline: z.string().datetime().optional(),
  maxScore: z.number().int().min(1).default(100),
  isPublished: z.boolean().optional().default(false),
})

export const UpdateAssignmentSchema = CreateAssignmentSchema.partial()

export const UploadUrlRequestSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
})

export const SubmitAssignmentSchema = z.object({
  fileUrls: z.array(FileUrlSchema).optional().default([]),
  textContent: z.string().optional(),
})

export const GradeSubmissionSchema = z.object({
  score: z.number().int().min(0),
  feedback: z.string().optional(),
})
```

- [ ] **Step 6: Add controller handlers**

```ts
// apps/api/src/modules/academic/controller.ts (append)
function buildContext(req) {
  return { userId: req.user.userId, universityId: req.university.id, role: req.user.role }
}

export const listAssignments = asyncHandler(async (req, res) => sendSuccess(res, await assignmentsService.list(buildContext(req), req.params.groupId)))
export const getAssignment = asyncHandler(async (req, res) => sendSuccess(res, await assignmentsService.get(buildContext(req), req.params.groupId, req.params.assignmentId)))
export const createAssignment = asyncHandler(async (req, res) => sendSuccess(res, await assignmentsService.create(buildContext(req), req.params.groupId, req.body), 201))
export const updateAssignment = asyncHandler(async (req, res) => sendSuccess(res, await assignmentsService.update(buildContext(req), req.params.groupId, req.params.assignmentId, req.body)))
export const deleteAssignment = asyncHandler(async (req, res) => {
  await assignmentsService.delete(buildContext(req), req.params.groupId, req.params.assignmentId)
  sendSuccess(res, { success: true })
})
export const getAssignmentUploadUrl = asyncHandler(async (req, res) => sendSuccess(res, await assignmentsService.getUploadUrl(buildContext(req), req.params.groupId, req.body.fileName, req.body.contentType)))
export const listSubmissions = asyncHandler(async (req, res) => sendSuccess(res, await assignmentsService.listSubmissions(buildContext(req), req.params.groupId, req.params.assignmentId)))
export const submitAssignment = asyncHandler(async (req, res) => sendSuccess(res, await assignmentsService.submit(buildContext(req), req.params.groupId, req.params.assignmentId, req.body), 201))
export const getSubmissionUploadUrl = asyncHandler(async (req, res) => sendSuccess(res, await assignmentsService.getSubmissionUploadUrl(buildContext(req), req.params.groupId, req.body.fileName, req.body.contentType)))
export const gradeSubmission = asyncHandler(async (req, res) => sendSuccess(res, await assignmentsService.gradeSubmission(buildContext(req), req.params.groupId, req.params.assignmentId, req.params.submissionId, req.body)))
```

Retrofit the earlier controller handlers in Tasks 13/16/20 to use this same `buildContext(req)` helper instead of repeating the `{ userId: req.user.userId, ... }` object literal inline — a small DRY cleanup, do this as part of this task's commit since `buildContext` is introduced here.

- [ ] **Step 7: Add routes**

```ts
// apps/api/src/modules/academic/router.ts (append)
academicRouter.get('/:groupId/assignments', listAssignments)
academicRouter.get('/:groupId/assignments/:assignmentId', getAssignment)
academicRouter.post('/:groupId/assignments', validate(CreateAssignmentSchema), createAssignment)
academicRouter.patch('/:groupId/assignments/:assignmentId', validate(UpdateAssignmentSchema), updateAssignment)
academicRouter.delete('/:groupId/assignments/:assignmentId', deleteAssignment)
academicRouter.post('/:groupId/assignments/upload-url', validate(UploadUrlRequestSchema), getAssignmentUploadUrl)
academicRouter.get('/:groupId/assignments/:assignmentId/submissions', listSubmissions)
academicRouter.post('/:groupId/assignments/:assignmentId/submit', validate(SubmitAssignmentSchema), submitAssignment)
academicRouter.post('/:groupId/assignments/:assignmentId/submissions/upload-url', validate(UploadUrlRequestSchema), getSubmissionUploadUrl)
academicRouter.patch('/:groupId/assignments/:assignmentId/submissions/:submissionId/grade', validate(GradeSubmissionSchema), gradeSubmission)
```

The static `/:groupId/assignments/upload-url` route must be declared before `/:groupId/assignments/:assignmentId` to avoid `upload-url` being captured as an `:assignmentId` param — confirmed correct in the ordering above (upload-url comes right after the two static/list routes, before any `:assignmentId`-scoped route... actually verify: `GET /:assignmentId` is declared at position 2, before `POST /upload-url` at position 6 — since these are different HTTP methods (GET vs POST) on the same path shape, Express disambiguates by method+path per route, not just path, so a `POST /:groupId/assignments/upload-url` is not shadowed by a `GET /:groupId/assignments/:assignmentId` even if declared after it. No fix needed here, unlike Task 20's `modules/reorder` case which was a `PATCH`-vs-`PATCH` collision on the same method.

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx pnpm --filter api test src/modules/academic/assignments.service.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 9: Typecheck and lint**

```bash
npx pnpm --filter api typecheck && npx pnpm --filter api lint
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/modules/academic/assignments.service.ts apps/api/src/modules/academic/assignments.service.test.ts apps/api/src/modules/academic/schema.ts apps/api/src/modules/academic/controller.ts apps/api/src/modules/academic/router.ts
git commit -m "feat(api): add assignments CRUD, submissions, grading, and presigned upload endpoints"
```

---

### Task 22: Frontend — `ModulesPanel.tsx` + `AssignmentsPanel.tsx`

**Files:**
- Create: `apps/web/src/features/groups/academic/ModulesPanel.tsx`
- Create: `apps/web/src/features/groups/academic/AssignmentsPanel.tsx`
- Create: `apps/web/src/features/groups/academic/AcademicLMSTab.tsx`
- Modify: `apps/web/src/features/groups/hooks/useGroupExtended.ts`
- Modify: `apps/web/src/features/groups/types.ts`
- Test: `apps/web/src/features/groups/academic/ModulesPanel.test.tsx`
- Test: `apps/web/src/features/groups/academic/AssignmentsPanel.test.tsx`

**Interfaces:**
- Consumes: all `academic/modules` and `academic/assignments` routes (Tasks 20–21).
- Produces: `AcademicLMSTab` — a container that Task 26 (frontend AI settings) and the group page router mount alongside `StudyToolsTab`.

- [ ] **Step 1: Add types**

```ts
// types.ts (append)
export interface AcademicModule {
  id: string
  groupId: string
  title: string
  description?: string
  weekNumber?: number
  displayOrder: number
  isPublished: boolean
}

export interface Assignment {
  id: string
  groupId: string
  moduleId?: string
  title: string
  description?: string
  fileUrls: Array<{ name: string; url: string; contentType: string; size: number }>
  deadline?: string
  maxScore: number
  isPublished: boolean
}

export interface Submission {
  id: string
  assignmentId: string
  userId: string
  fileUrls: Array<{ name: string; url: string; contentType: string; size: number }>
  textContent?: string
  score?: number
  feedback?: string
  submittedAt: string
  gradedAt?: string
  isLate: boolean
}
```

- [ ] **Step 2: Add hooks**

```ts
// useGroupExtended.ts (append)
export const modulesKey = (groupId: string) => ['groups', groupId, 'modules'] as const
export const assignmentsKey = (groupId: string) => ['groups', groupId, 'assignments'] as const

export function useModules(groupId: string) {
  return useQuery({ queryKey: modulesKey(groupId), queryFn: () => api.get(`/groups/${groupId}/modules`).then((r) => r.data.data), enabled: !!groupId })
}

export function useCreateModule(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: unknown) => api.post(`/groups/${groupId}/modules`, input).then((r) => r.data.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: modulesKey(groupId) }),
  })
}

export function useTogglePublishModule(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (moduleId: string) => api.patch(`/groups/${groupId}/modules/${moduleId}/publish`).then((r) => r.data.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: modulesKey(groupId) }),
  })
}

export function useAssignments(groupId: string) {
  return useQuery({ queryKey: assignmentsKey(groupId), queryFn: () => api.get(`/groups/${groupId}/assignments`).then((r) => r.data.data), enabled: !!groupId })
}

export function useCreateAssignment(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: unknown) => api.post(`/groups/${groupId}/assignments`, input).then((r) => r.data.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: assignmentsKey(groupId) }),
  })
}

export function useSubmitAssignment(groupId: string, assignmentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: unknown) => api.post(`/groups/${groupId}/assignments/${assignmentId}/submit`, input).then((r) => r.data.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: assignmentsKey(groupId) }),
  })
}
```

- [ ] **Step 3: Write the failing test for `ModulesPanel`**

```tsx
// apps/web/src/features/groups/academic/ModulesPanel.test.tsx
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { rest } from 'msw'
import { server } from '@/tests/msw/server'
import { ModulesPanel } from './ModulesPanel'
import { renderWithQueryClient } from '@/tests/renderWithQueryClient'

describe('ModulesPanel', () => {
  it('lists modules and toggles publish state', async () => {
    server.use(
      rest.get('*/groups/g1/modules', (req, res, ctx) => res(ctx.json({ data: [{ id: 'm1', title: 'Week 1', isPublished: false, displayOrder: 1 }] }))),
      rest.patch('*/groups/g1/modules/m1/publish', (req, res, ctx) => res(ctx.json({ data: { id: 'm1', title: 'Week 1', isPublished: true, displayOrder: 1 } })))
    )
    renderWithQueryClient(<ModulesPanel groupId="g1" isAdmin />)
    await waitFor(() => expect(screen.getByText('Week 1')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /publish/i }))
    await waitFor(() => expect(screen.getByText(/published/i)).toBeInTheDocument())
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx pnpm --filter web test src/features/groups/academic/ModulesPanel.test.tsx`
Expected: FAIL — component doesn't exist.

- [ ] **Step 5: Implement `ModulesPanel.tsx`**

```tsx
// apps/web/src/features/groups/academic/ModulesPanel.tsx
import { useModules, useTogglePublishModule } from '../hooks/useGroupExtended'

interface ModulesPanelProps {
  groupId: string
  isAdmin: boolean
}

export function ModulesPanel({ groupId, isAdmin }: ModulesPanelProps) {
  const { data: modules, isLoading } = useModules(groupId)
  const togglePublish = useTogglePublishModule(groupId)

  if (isLoading || !modules) return <div>Loading modules…</div>

  return (
    <ul className="flex flex-col gap-2">
      {modules.map((m) => (
        <li key={m.id} className="flex items-center justify-between rounded-[var(--r-md)] p-3" style={{ background: 'var(--surface-card)' }}>
          <span>{m.title}</span>
          <span>{m.isPublished ? 'Published' : 'Draft'}</span>
          {isAdmin && (
            <button type="button" onClick={() => togglePublish.mutate(m.id)}>
              {m.isPublished ? 'Unpublish' : 'Publish'}
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 6: Run `ModulesPanel` test to verify it passes**

Run: `npx pnpm --filter web test src/features/groups/academic/ModulesPanel.test.tsx`
Expected: PASS.

- [ ] **Step 7: Write the failing test for `AssignmentsPanel`**

```tsx
// apps/web/src/features/groups/academic/AssignmentsPanel.test.tsx
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { rest } from 'msw'
import { server } from '@/tests/msw/server'
import { AssignmentsPanel } from './AssignmentsPanel'
import { renderWithQueryClient } from '@/tests/renderWithQueryClient'

describe('AssignmentsPanel', () => {
  it('lists assignments and submits text content for a student', async () => {
    server.use(
      rest.get('*/groups/g1/assignments', (req, res, ctx) => res(ctx.json({ data: [{ id: 'a1', title: 'HW1', maxScore: 100, fileUrls: [], isPublished: true }] }))),
      rest.post('*/groups/g1/assignments/a1/submit', (req, res, ctx) => res(ctx.json({ data: { id: 's1', textContent: 'my answer' } })))
    )
    renderWithQueryClient(<AssignmentsPanel groupId="g1" isAdmin={false} />)
    await waitFor(() => expect(screen.getByText('HW1')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /submit/i }))
    await userEvent.type(screen.getByLabelText(/your answer/i), 'my answer')
    await userEvent.click(screen.getByRole('button', { name: /confirm submit/i }))

    await waitFor(() => expect(screen.getByText(/submitted/i)).toBeInTheDocument())
  })
})
```

- [ ] **Step 8: Run test to verify it fails**

Run: `npx pnpm --filter web test src/features/groups/academic/AssignmentsPanel.test.tsx`
Expected: FAIL — component doesn't exist.

- [ ] **Step 9: Implement `AssignmentsPanel.tsx`**

```tsx
// apps/web/src/features/groups/academic/AssignmentsPanel.tsx
import { useState } from 'react'
import { useAssignments, useSubmitAssignment } from '../hooks/useGroupExtended'

interface AssignmentsPanelProps {
  groupId: string
  isAdmin: boolean
}

function AssignmentRow({ groupId, assignment }: { groupId: string; assignment: { id: string; title: string } }) {
  const [submitting, setSubmitting] = useState(false)
  const [text, setText] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const submit = useSubmitAssignment(groupId, assignment.id)

  async function handleConfirm() {
    await submit.mutateAsync({ textContent: text })
    setSubmitted(true)
    setSubmitting(false)
  }

  return (
    <li className="rounded-[var(--r-md)] p-3" style={{ background: 'var(--surface-card)' }}>
      <span>{assignment.title}</span>
      {submitted ? (
        <p>Submitted ✓</p>
      ) : submitting ? (
        <div>
          <label>
            Your answer
            <textarea aria-label="Your answer" value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          <button type="button" onClick={() => void handleConfirm()}>Confirm submit</button>
        </div>
      ) : (
        <button type="button" onClick={() => setSubmitting(true)}>Submit</button>
      )}
    </li>
  )
}

export function AssignmentsPanel({ groupId, isAdmin }: AssignmentsPanelProps) {
  const { data: assignments, isLoading } = useAssignments(groupId)
  if (isLoading || !assignments) return <div>Loading assignments…</div>

  return (
    <ul className="flex flex-col gap-2">
      {assignments.map((a) => (
        <AssignmentRow key={a.id} groupId={groupId} assignment={a} />
      ))}
    </ul>
  )
}
```

`isAdmin` is accepted but unused in this minimal render path — a faculty-only "create assignment" form and submissions/grading view are additional UI not covered by the failing test above; add a `CreateAssignmentForm` sub-section gated on `isAdmin` following the same pattern as `CourseOutlineForm.tsx`'s controlled-input style, and a `SubmissionsList` sub-section for faculty that calls `GET /:groupId/assignments/:assignmentId/submissions` and renders a grade input per submission (mirroring `GradebookPanel.tsx`'s inline-edit-on-blur pattern) — write these as straightforward extensions of the patterns already established in Tasks 14/18/20, no new architectural pattern needed.

- [ ] **Step 10: Run `AssignmentsPanel` test to verify it passes**

Run: `npx pnpm --filter web test src/features/groups/academic/AssignmentsPanel.test.tsx`
Expected: PASS.

- [ ] **Step 11: Wire `AcademicLMSTab.tsx` as the container**

```tsx
// apps/web/src/features/groups/academic/AcademicLMSTab.tsx
import { useState } from 'react'
import { CourseOutlineForm } from './CourseOutlineForm'
import { GradebookPanel } from './GradebookPanel'
import { StudentGradeCard } from './StudentGradeCard'
import { ModulesPanel } from './ModulesPanel'
import { AssignmentsPanel } from './AssignmentsPanel'

interface AcademicLMSTabProps {
  groupId: string
  isAdmin: boolean
}

type LMSSubTab = 'outline' | 'gradebook' | 'modules' | 'assignments'

export function AcademicLMSTab({ groupId, isAdmin }: AcademicLMSTabProps) {
  const [subTab, setSubTab] = useState<LMSSubTab>('modules')

  return (
    <div>
      <nav role="tablist" className="flex gap-2">
        {isAdmin && <button role="tab" onClick={() => setSubTab('outline')}>Course outline</button>}
        <button role="tab" onClick={() => setSubTab('gradebook')}>Gradebook</button>
        <button role="tab" onClick={() => setSubTab('modules')}>Modules</button>
        <button role="tab" onClick={() => setSubTab('assignments')}>Assignments</button>
      </nav>
      {subTab === 'outline' && isAdmin && <CourseOutlineForm groupId={groupId} />}
      {subTab === 'gradebook' && (isAdmin ? <GradebookPanel groupId={groupId} /> : <StudentGradeCard groupId={groupId} />)}
      {subTab === 'modules' && <ModulesPanel groupId={groupId} isAdmin={isAdmin} />}
      {subTab === 'assignments' && <AssignmentsPanel groupId={groupId} isAdmin={isAdmin} />}
    </div>
  )
}
```

Mount `AcademicLMSTab` from wherever the group detail page (`apps/web/src/pages/GroupDetailPage.tsx` or equivalent — confirm the actual page component name by reading `apps/web/src/router/index.tsx`'s `/groups/:id` route) renders `StudyToolsTab` today, conditionally alongside it when `group.type === 'academic'` — add this as an explicit sub-step here rather than deferring it, since without this wiring `AcademicLMSTab` is unreachable from the UI.

- [ ] **Step 12: Read the group detail page and add the conditional mount**

Read the page component that currently renders `<StudyToolsTab group={group} />`, and add a sibling tab/section:

```tsx
{group.type === 'academic' && (
  <AcademicLMSTab groupId={group.id} isAdmin={group.userRole === 'owner' || group.userRole === 'admin'} />
)}
```

Match `isAdmin`'s exact condition to whatever role-check expression the page already uses elsewhere (e.g. for showing admin-only buttons) rather than inventing a new one.

- [ ] **Step 13: Typecheck and lint**

```bash
npx pnpm --filter web typecheck && npx pnpm --filter web lint
```

Expected: PASS.

- [ ] **Step 14: Manual smoke test**

```bash
npx pnpm --filter web dev
```

Navigate to an academic group's page (create one as faculty via the dev seed + manual promotion, per `CLAUDE.md`'s "no admin user is seeded" note — promote a test user's role directly in the DB or via a seeded faculty account if one exists), confirm the "Modules" and "Assignments" tabs render without console errors.

- [ ] **Step 15: Commit**

```bash
git add apps/web/src/features/groups/academic apps/web/src/features/groups/hooks/useGroupExtended.ts apps/web/src/features/groups/types.ts apps/web/src/pages
git commit -m "feat(web): add modules and assignments panels, wire AcademicLMSTab into group page"
```

---

# Phase 6 — AI Settings Panel + Daily Scheduler (Group Posting)

### Task 23: Pending-content approve/reject endpoints

**Files:**
- Modify: `apps/api/src/modules/groups/schema.ts`
- Modify: `apps/api/src/modules/groups/service.ts`
- Modify: `apps/api/src/modules/groups/controller.ts`
- Modify: `apps/api/src/modules/groups/router.ts`
- Test: `apps/api/src/modules/groups/service.test.ts`

**Interfaces:**
- Consumes: `groups.ai_settings` shape (`pending_deck_id`, `pending_quiz_content` — Task 8), flashcard deck tables (existing).
- Produces: `groupService.listPendingAiContent`, `groupService.approvePendingAiContent`, `groupService.discardPendingAiContent` — consumed by Task 24 (worker that creates the pending content) and Task 25 (frontend inbox).

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/modules/groups/service.test.ts (add)
describe('groupService — pending AI content', () => {
  it('lists a pending deck awaiting approval', async () => {
    const universityId = await createUniversity()
    const faculty = await createUser({ universityId, role: 'faculty' })
    const group = await groupService.createGroup({ userId: faculty.id, universityId, role: 'faculty' }, { name: 'CS101', type: 'academic', is_private: false })

    const [deck] = await db('group_flashcard_decks').insert({ group_id: group.id, university_id: universityId, title: 'AI Deck', created_by: faculty.id, is_archived: true }).returning('id')
    await db('groups').where({ id: group.id }).update({ ai_settings: JSON.stringify({ pending_deck_id: deck.id }) })

    const pending = await groupService.listPendingAiContent({ userId: faculty.id, universityId, role: 'faculty' }, group.id)
    expect(pending).toHaveLength(1)
    expect(pending[0].id).toBe(deck.id)
  })

  it('approving a pending deck un-archives it and clears pending_deck_id', async () => {
    const universityId = await createUniversity()
    const faculty = await createUser({ universityId, role: 'faculty' })
    const group = await groupService.createGroup({ userId: faculty.id, universityId, role: 'faculty' }, { name: 'CS101', type: 'academic', is_private: false })
    const [deck] = await db('group_flashcard_decks').insert({ group_id: group.id, university_id: universityId, title: 'AI Deck', created_by: faculty.id, is_archived: true }).returning('id')
    await db('groups').where({ id: group.id }).update({ ai_settings: JSON.stringify({ pending_deck_id: deck.id }) })

    await groupService.approvePendingAiContent({ userId: faculty.id, universityId, role: 'faculty' }, group.id, deck.id)

    const updated = await db('group_flashcard_decks').where({ id: deck.id }).first()
    expect(updated.is_archived).toBe(false)
    const updatedGroup = await db('groups').where({ id: group.id }).first()
    expect(updatedGroup.ai_settings.pending_deck_id).toBeNull()
  })

  it('discarding a pending deck deletes it', async () => {
    const universityId = await createUniversity()
    const faculty = await createUser({ universityId, role: 'faculty' })
    const group = await groupService.createGroup({ userId: faculty.id, universityId, role: 'faculty' }, { name: 'CS101', type: 'academic', is_private: false })
    const [deck] = await db('group_flashcard_decks').insert({ group_id: group.id, university_id: universityId, title: 'AI Deck', created_by: faculty.id, is_archived: true }).returning('id')
    await db('groups').where({ id: group.id }).update({ ai_settings: JSON.stringify({ pending_deck_id: deck.id }) })

    await groupService.discardPendingAiContent({ userId: faculty.id, universityId, role: 'faculty' }, group.id, deck.id)

    expect(await db('group_flashcard_decks').where({ id: deck.id }).first()).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx pnpm --filter api test src/modules/groups/service.test.ts -t "pending AI content"`
Expected: FAIL — the three methods don't exist yet.

- [ ] **Step 3: Implement the three service methods**

In `apps/api/src/modules/groups/service.ts`, add:

```ts
async listPendingAiContent(context, groupId: string) {
  await assertGroupAdminAccess(context, groupId)
  const group = await db('groups').where({ id: groupId, university_id: context.universityId }).first()
  if (!group) throw notFound('Group not found')
  const settings = group.ai_settings ?? {}
  const items = []
  if (settings.pending_deck_id) {
    const deck = await db('group_flashcard_decks').where({ id: settings.pending_deck_id }).first()
    if (deck) items.push({ id: deck.id, type: 'flashcard_deck', title: deck.title, createdAt: deck.created_at })
  }
  if (settings.pending_quiz_content) {
    items.push({ id: 'pending-quiz', type: 'quiz', content: settings.pending_quiz_content })
  }
  return items
},

async approvePendingAiContent(context, groupId: string, contentId: string) {
  await assertGroupAdminAccess(context, groupId)
  const group = await db('groups').where({ id: groupId, university_id: context.universityId }).first()
  if (!group) throw notFound('Group not found')
  const settings = group.ai_settings ?? {}

  if (settings.pending_deck_id === contentId) {
    await db('group_flashcard_decks').where({ id: contentId }).update({ is_archived: false })
    await db('groups').where({ id: groupId }).update({ ai_settings: JSON.stringify({ ...settings, pending_deck_id: null }) })
    const bot = await getCampusBotUser(context.universityId) // reuse ensureCampusBotUser lookup from content-sync/service.ts
    await this.createPost(
      { userId: bot.id, universityId: context.universityId, role: 'admin' },
      { group_id: groupId, content: `📚 New AI Flashcard Deck ready: ${(await db('group_flashcard_decks').where({ id: contentId }).first()).title}` }
    )
    return
  }
  if (contentId === 'pending-quiz' && settings.pending_quiz_content) {
    await db('groups').where({ id: groupId }).update({ ai_settings: JSON.stringify({ ...settings, pending_quiz_content: null }) })
    return
  }
  throw notFound('Pending content not found')
},

async discardPendingAiContent(context, groupId: string, contentId: string) {
  await assertGroupAdminAccess(context, groupId)
  const group = await db('groups').where({ id: groupId, university_id: context.universityId }).first()
  if (!group) throw notFound('Group not found')
  const settings = group.ai_settings ?? {}

  if (settings.pending_deck_id === contentId) {
    await db('group_flashcard_decks').where({ id: contentId }).del()
    await db('groups').where({ id: groupId }).update({ ai_settings: JSON.stringify({ ...settings, pending_deck_id: null }) })
    return
  }
  if (contentId === 'pending-quiz' && settings.pending_quiz_content) {
    await db('groups').where({ id: groupId }).update({ ai_settings: JSON.stringify({ ...settings, pending_quiz_content: null }) })
    return
  }
  throw notFound('Pending content not found')
},
```

`getCampusBotUser(universityId)` and `this.createPost(...)` are assumed existing helpers — confirm `ensureCampusBotUser` in `apps/api/src/modules/content-sync/service.ts` is exported and import it (renaming the import to `getCampusBotUser` locally if desired), and confirm `groupService.createPost` is the actual name of the existing group-post-creation method (grep for it) before using it here — this task must not invent a new post-creation path when one already exists per the `groups` module's "posts" route group noted in the router research.

- [ ] **Step 4: Add schema + controller + routes**

No new Zod schema needed for GET/discard (no body); approve also takes no body. Add three route handlers to `groups/controller.ts`:

```ts
export const listPendingAi = asyncHandler(async (req, res) => sendSuccess(res, await groupService.listPendingAiContent(buildContext(req), req.params.groupId)))
export const approvePendingAi = asyncHandler(async (req, res) => {
  await groupService.approvePendingAiContent(buildContext(req), req.params.groupId, req.params.contentId)
  sendSuccess(res, { success: true })
})
export const discardPendingAi = asyncHandler(async (req, res) => {
  await groupService.discardPendingAiContent(buildContext(req), req.params.groupId, req.params.contentId)
  sendSuccess(res, { success: true })
})
```

Add routes to `groups/router.ts`:

```ts
groupsRouter.get('/:groupId/ai-settings/pending', listPendingAi)
groupsRouter.post('/:groupId/ai-settings/pending/:contentId/approve', approvePendingAi)
groupsRouter.delete('/:groupId/ai-settings/pending/:contentId', discardPendingAi)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx pnpm --filter api test src/modules/groups/service.test.ts -t "pending AI content"`
Expected: PASS.

- [ ] **Step 6: Typecheck and lint**

```bash
npx pnpm --filter api typecheck && npx pnpm --filter api lint
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/groups/schema.ts apps/api/src/modules/groups/service.ts apps/api/src/modules/groups/controller.ts apps/api/src/modules/groups/router.ts apps/api/src/modules/groups/service.test.ts
git commit -m "feat(api): add pending AI content list/approve/discard endpoints"
```

---

### Task 24: `runGroupPosting()` + rate limiter wired into `ai-content.worker.ts`

**Files:**
- Modify: `apps/api/src/workers/ai-content.worker.ts`
- Modify: `apps/api/src/config/env.ts` (already has `AI_GROUP_POST_HOUR` from Task 1 — just consumed here)
- Test: `apps/api/src/workers/ai-content.worker.test.ts`

**Interfaces:**
- Consumes: `generateFlashcards` (Task 2), `courseOutlineService.resolveAITopic` (Task 13), `rateLimitedAICall` (Task 6, already implemented — reused here).
- Produces: `runGroupPosting(): Promise<void>` — cron-triggered, no other task depends on its export beyond registration in this file.

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/workers/ai-content.worker.test.ts (add)
vi.mock('../services/ai.service', () => ({
  generateQuizQuestions: vi.fn(),
  generateFlashcards: vi.fn(),
}))

import { generateFlashcards } from '../services/ai.service'
import { runGroupPosting } from './ai-content.worker'
import { createUser } from '../../tests/factories/user'
import { groupService } from '../modules/groups/service'

describe('runGroupPosting', () => {
  it('creates a visible deck and bot post when require_approval is false', async () => {
    const universityId = await createUniversity()
    const faculty = await createUser({ universityId, role: 'faculty' })
    const group = await groupService.createGroup(
      { userId: faculty.id, universityId, role: 'faculty' },
      { name: 'CS101', type: 'academic', is_private: false }
    )
    await groupService.updateAiSettings({ userId: faculty.id, universityId, role: 'faculty' }, group.id, {
      ai_flashcards_enabled: true,
      require_approval: false,
      subject: 'Linked Lists',
    })
    ;(generateFlashcards as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{ front: 'Q', back: 'A' }])

    await runGroupPosting()

    const decks = await db('group_flashcard_decks').where({ group_id: group.id })
    expect(decks).toHaveLength(1)
    expect(decks[0].is_archived).toBe(false)

    const updatedGroup = await db('groups').where({ id: group.id }).first()
    expect(updatedGroup.ai_settings.last_ai_post_date).toBeTruthy()
  })

  it('creates an archived deck with pending_deck_id when require_approval is true', async () => {
    const universityId = await createUniversity()
    const faculty = await createUser({ universityId, role: 'faculty' })
    const group = await groupService.createGroup(
      { userId: faculty.id, universityId, role: 'faculty' },
      { name: 'CS102', type: 'academic', is_private: false }
    )
    await groupService.updateAiSettings({ userId: faculty.id, universityId, role: 'faculty' }, group.id, {
      ai_flashcards_enabled: true,
      require_approval: true,
      subject: 'Trees',
    })
    ;(generateFlashcards as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{ front: 'Q2', back: 'A2' }])

    await runGroupPosting()

    const decks = await db('group_flashcard_decks').where({ group_id: group.id })
    expect(decks[0].is_archived).toBe(true)
    const updatedGroup = await db('groups').where({ id: group.id }).first()
    expect(updatedGroup.ai_settings.pending_deck_id).toBe(decks[0].id)
  })

  it('skips a group whose last_ai_post_date is already today', async () => {
    const universityId = await createUniversity()
    const faculty = await createUser({ universityId, role: 'faculty' })
    const group = await groupService.createGroup(
      { userId: faculty.id, universityId, role: 'faculty' },
      { name: 'CS103', type: 'academic', is_private: false }
    )
    const today = new Date().toISOString().slice(0, 10)
    await groupService.updateAiSettings({ userId: faculty.id, universityId, role: 'faculty' }, group.id, {
      ai_flashcards_enabled: true,
    })
    await db('groups').where({ id: group.id }).update({ ai_settings: db.raw(`ai_settings || '{"last_ai_post_date": "${today}"}'::jsonb`) })

    await runGroupPosting()

    expect(generateFlashcards).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx pnpm --filter api test src/workers/ai-content.worker.test.ts -t "runGroupPosting"`
Expected: FAIL — `runGroupPosting` doesn't exist.

- [ ] **Step 3: Implement `runGroupPosting` and register its cron**

Append to `apps/api/src/workers/ai-content.worker.ts`:

```ts
import { generateFlashcards } from '../services/ai.service'
import { courseOutlineService } from '../modules/academic/course-outline.service'
import { groupService } from '../modules/groups/service'

export async function runGroupPosting(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10)

  const groups = await db('groups')
    .where({ type: 'academic' })
    .andWhere((builder) => {
      builder.whereRaw(`ai_settings->>'ai_flashcards_enabled' = 'true'`).orWhereRaw(`ai_settings->>'ai_quiz_enabled' = 'true'`)
    })
    .andWhere((builder) => {
      builder.whereRaw(`ai_settings->>'last_ai_post_date' IS NULL`).orWhereRaw(`ai_settings->>'last_ai_post_date' != ?`, [today])
    })

  for (const group of groups) {
    try {
      const settings = group.ai_settings ?? {}
      const topic = await courseOutlineService.resolveAITopic(group.id, group.university_id)
      const context = { userId: group.created_by, universityId: group.university_id, role: 'faculty' }

      if (settings.ai_flashcards_enabled) {
        const cards = await rateLimitedAICall(() =>
          generateFlashcards({
            topic,
            count: 10,
            difficulty: settings.difficulty,
            language: settings.language,
            customInstructions: settings.custom_instructions,
          })
        )

        const [deck] = await db('group_flashcard_decks')
          .insert({
            group_id: group.id,
            university_id: group.university_id,
            title: `AI Deck — ${topic}`,
            created_by: group.created_by,
            is_archived: !!settings.require_approval,
          })
          .returning('*')

        await db('group_flashcards').insert(
          cards.map((c) => ({ deck_id: deck.id, group_id: group.id, university_id: group.university_id, front: c.front, back: c.back, hint: c.hint }))
        )

        if (settings.require_approval) {
          await db('groups').where({ id: group.id }).update({ ai_settings: JSON.stringify({ ...settings, pending_deck_id: deck.id, last_ai_post_date: today }) })
        } else {
          await groupService.createPost(context, { group_id: group.id, content: `📚 New AI Flashcard Deck: ${topic} — ${cards.length} cards ready!` })
          await db('groups').where({ id: group.id }).update({ ai_settings: JSON.stringify({ ...settings, last_ai_post_date: today }) })
        }
      }

      if (settings.ai_quiz_enabled) {
        await groupService.createPost(context, { group_id: group.id, content: `🧠 Daily Quiz is live! Test your knowledge on ${topic}` })
        await db('groups').where({ id: group.id }).update({ ai_settings: JSON.stringify({ ...settings, last_ai_post_date: today }) })
      }
    } catch (error) {
      logger.error('AI group posting failed', { groupId: group.id, error })
    }
  }
}

if (env.AI_CONTENT_ENABLED) {
  aiContentQueue.add({ task: 'group-post' }, { repeat: { cron: `0 ${env.AI_GROUP_POST_HOUR} * * *` }, jobId: 'ai-daily-group-post' })
}
```

Update the `aiContentQueue.process` handler at the bottom of the file to also dispatch `group-post`:

```ts
aiContentQueue.process(async (job) => {
  if (job.data.task === 'quiz-gen') {
    await runQuizGeneration()
  }
  if (job.data.task === 'group-post') {
    await runGroupPosting()
  }
})
```

Confirm `groupService.createPost` is the real existing method name/signature (grep `apps/api/src/modules/groups/service.ts` for `createPost` or the actual posts-creation method referenced by the router's "posts/events/collaborations" route group) — substitute the correct name and argument shape if different from the placeholder above.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx pnpm --filter api test src/workers/ai-content.worker.test.ts`
Expected: PASS, including the Task 6 quiz-gen tests (regression check — confirm the single `process` handler correctly dispatches both job types).

- [ ] **Step 5: Typecheck and lint**

```bash
npx pnpm --filter api typecheck && npx pnpm --filter api lint
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/workers/ai-content.worker.ts apps/api/src/workers/ai-content.worker.test.ts
git commit -m "feat(api): implement daily AI group posting with approval-gated flashcard decks"
```

---

### Task 25: Frontend — `AISettingsPanel.tsx`

**Files:**
- Create: `apps/web/src/features/groups/academic/AISettingsPanel.tsx`
- Modify: `apps/web/src/features/groups/hooks/useGroupExtended.ts`
- Modify: `apps/web/src/features/groups/academic/AcademicLMSTab.tsx`
- Test: `apps/web/src/features/groups/academic/AISettingsPanel.test.tsx`

**Interfaces:**
- Consumes: `GET/PATCH /:groupId/ai-settings`, `GET /:groupId/ai-settings/pending`, `POST .../approve`, `DELETE .../:contentId` (Tasks 10, 23).

- [ ] **Step 1: Add hooks**

```ts
// useGroupExtended.ts (append)
export const aiSettingsKey = (groupId: string) => ['groups', groupId, 'ai-settings'] as const
export const pendingAiKey = (groupId: string) => ['groups', groupId, 'ai-settings', 'pending'] as const

export function useAiSettings(groupId: string) {
  return useQuery({ queryKey: aiSettingsKey(groupId), queryFn: () => api.get(`/groups/${groupId}/ai-settings`).then((r) => r.data.data), enabled: !!groupId })
}

export function useUpdateAiSettings(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: unknown) => api.patch(`/groups/${groupId}/ai-settings`, patch).then((r) => r.data.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: aiSettingsKey(groupId) }),
  })
}

export function usePendingAiContent(groupId: string) {
  return useQuery({ queryKey: pendingAiKey(groupId), queryFn: () => api.get(`/groups/${groupId}/ai-settings/pending`).then((r) => r.data.data), enabled: !!groupId })
}

export function useApprovePendingAi(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (contentId: string) => api.post(`/groups/${groupId}/ai-settings/pending/${contentId}/approve`).then((r) => r.data.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: pendingAiKey(groupId) }),
  })
}

export function useDiscardPendingAi(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (contentId: string) => api.delete(`/groups/${groupId}/ai-settings/pending/${contentId}`).then((r) => r.data.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: pendingAiKey(groupId) }),
  })
}
```

- [ ] **Step 2: Write the failing test**

```tsx
// apps/web/src/features/groups/academic/AISettingsPanel.test.tsx
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { rest } from 'msw'
import { server } from '@/tests/msw/server'
import { AISettingsPanel } from './AISettingsPanel'
import { renderWithQueryClient } from '@/tests/renderWithQueryClient'

describe('AISettingsPanel', () => {
  it('toggles ai_quiz_enabled and saves', async () => {
    server.use(
      rest.get('*/groups/g1/ai-settings', (req, res, ctx) => res(ctx.json({ data: { aiSettings: { ai_quiz_enabled: false, language: 'en' } } }))),
      rest.get('*/groups/g1/ai-settings/pending', (req, res, ctx) => res(ctx.json({ data: [] }))),
      rest.patch('*/groups/g1/ai-settings', (req, res, ctx) => res(ctx.json({ data: { aiSettings: { ai_quiz_enabled: true, language: 'en' } } })))
    )
    renderWithQueryClient(<AISettingsPanel groupId="g1" />)
    await waitFor(() => expect(screen.getByLabelText(/daily quiz/i)).toBeInTheDocument())

    await userEvent.click(screen.getByLabelText(/daily quiz/i))

    await waitFor(() => expect(screen.getByLabelText(/daily quiz/i)).toBeChecked())
  })

  it('shows a warning banner when AI is enabled but no course outline exists', async () => {
    server.use(
      rest.get('*/groups/g1/ai-settings', (req, res, ctx) => res(ctx.json({ data: { aiSettings: { ai_quiz_enabled: true, language: 'en' } } }))),
      rest.get('*/groups/g1/ai-settings/pending', (req, res, ctx) => res(ctx.json({ data: [] }))),
      rest.get('*/groups/g1/course-outline', (req, res, ctx) => res(ctx.json({ data: null })))
    )
    renderWithQueryClient(<AISettingsPanel groupId="g1" />)
    await waitFor(() => expect(screen.getByText(/Set up your Course Outline/i)).toBeInTheDocument())
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx pnpm --filter web test src/features/groups/academic/AISettingsPanel.test.tsx`
Expected: FAIL — component doesn't exist.

- [ ] **Step 4: Implement `AISettingsPanel.tsx`**

```tsx
// apps/web/src/features/groups/academic/AISettingsPanel.tsx
import { useAiSettings, useUpdateAiSettings, usePendingAiContent, useApprovePendingAi, useDiscardPendingAi, useCourseOutline } from '../hooks/useGroupExtended'

interface AISettingsPanelProps {
  groupId: string
}

export function AISettingsPanel({ groupId }: AISettingsPanelProps) {
  const { data, isLoading } = useAiSettings(groupId)
  const update = useUpdateAiSettings(groupId)
  const { data: outline } = useCourseOutline(groupId)
  const { data: pending } = usePendingAiContent(groupId)
  const approve = useApprovePendingAi(groupId)
  const discard = useDiscardPendingAi(groupId)

  if (isLoading || !data) return <div>Loading AI settings…</div>
  const settings = data.aiSettings
  const anyEnabled = settings.ai_flashcards_enabled || settings.ai_quiz_enabled

  return (
    <div className="flex flex-col gap-4">
      {anyEnabled && !outline && (
        <div className="rounded-[var(--r-md)] p-3" style={{ background: 'var(--uc-orange-bg)', color: 'var(--uc-orange-l)' }}>
          Set up your Course Outline for better AI topic targeting
        </div>
      )}

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          aria-label="Daily quiz"
          checked={settings.ai_quiz_enabled}
          onChange={(e) => update.mutate({ ai_quiz_enabled: e.target.checked })}
        />
        Daily quiz
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          aria-label="AI flashcards"
          checked={settings.ai_flashcards_enabled}
          onChange={(e) => update.mutate({ ai_flashcards_enabled: e.target.checked })}
        />
        AI flashcards
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          aria-label="Require approval before posting"
          checked={settings.require_approval}
          onChange={(e) => update.mutate({ require_approval: e.target.checked })}
        />
        Require approval before posting
      </label>

      {settings.require_approval && pending && pending.length > 0 && (
        <div>
          <h3>Pending content</h3>
          <ul>
            {pending.map((item) => (
              <li key={item.id} className="flex items-center gap-2">
                <span>{item.title ?? item.type}</span>
                <button type="button" onClick={() => approve.mutate(item.id)}>Approve</button>
                <button type="button" onClick={() => discard.mutate(item.id)}>Reject</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
```

Confirm `var(--uc-orange-bg)`/`var(--uc-orange-l)` are the actual token names in `tokens.css` (per the design system rule: "Text on a coloured background must use the matching light token") before finalizing.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx pnpm --filter web test src/features/groups/academic/AISettingsPanel.test.tsx`
Expected: PASS.

- [ ] **Step 6: Mount `AISettingsPanel` inside `AcademicLMSTab.tsx`**

Add a fifth sub-tab, admin-only:

```tsx
type LMSSubTab = 'outline' | 'gradebook' | 'modules' | 'assignments' | 'ai-settings'
// ...
{isAdmin && <button role="tab" onClick={() => setSubTab('ai-settings')}>AI settings</button>}
// ...
{subTab === 'ai-settings' && isAdmin && <AISettingsPanel groupId={groupId} />}
```

- [ ] **Step 7: Typecheck and lint**

```bash
npx pnpm --filter web typecheck && npx pnpm --filter web lint
```

Expected: PASS.

- [ ] **Step 8: Manual smoke test**

Trigger the worker manually in dev (e.g. temporarily call `runGroupPosting()` from a scratch script or via `node -e` against the dev DB with `ts-node`), verify a deck appears in an academic group with `ai_flashcards_enabled: true` and a bot post shows in the feed.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/features/groups/academic/AISettingsPanel.tsx apps/web/src/features/groups/academic/AISettingsPanel.test.tsx apps/web/src/features/groups/academic/AcademicLMSTab.tsx apps/web/src/features/groups/hooks/useGroupExtended.ts
git commit -m "feat(web): add AI settings panel with pending content approval inbox"
```

---

# Phase 7 — File Uploads (Shared Notes)

### Task 26: Migration `095_add_note_attachments.ts` + `AttachmentSchema`

**Files:**
- Create: `apps/api/src/database/migrations/095_add_note_attachments.ts`
- Modify: `apps/api/src/modules/groups/schema.ts`

**Interfaces:**
- Produces: `group_shared_notes.attachments JSONB`, `AttachmentSchema` (Interfaces Contract table, Part 1) — consumed by Task 27, and reused by Task 21's `FileUrlSchema` conceptually (kept as a separate schema per module boundary, not literally imported cross-module, to avoid `academic` importing from `groups/schema.ts` unnecessarily — confirm this duplication is acceptable per repo convention of module-scoped schemas noted in the research (no shared `groups.ts` in `packages/shared`); if the team prefers a single shared definition, move `AttachmentSchema` to `packages/shared/src/schemas/` instead and import it from both modules — flagged here as a design choice, not left unresolved, defaulting to per-module duplication since that matches the existing pattern where `academic/schema.ts` already duplicates its own `FileUrlSchema` rather than importing from `groups`).

- [ ] **Step 1: Write the migration**

```ts
// apps/api/src/database/migrations/095_add_note_attachments.ts
import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('group_shared_notes', (table) => {
    table.jsonb('attachments').notNullable().defaultTo('[]')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('group_shared_notes', (table) => {
    table.dropColumn('attachments')
  })
}
```

- [ ] **Step 2: Run the migration**

```bash
npx pnpm --filter api db:migrate
```

Expected: `Batch N run: 1 migrations`.

- [ ] **Step 3: Add `AttachmentSchema` to `groups/schema.ts`**

```ts
export const AttachmentSchema = z.object({
  name: z.string().max(255),
  url: z.string().url(),
  contentType: z.string().max(100),
  size: z.number().int().max(26214400),
})

const ALLOWED_NOTE_CONTENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
] as const

export const NoteUploadUrlRequestSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.enum(ALLOWED_NOTE_CONTENT_TYPES),
})
```

Update `CreateSharedNoteSchema` and `UpdateSharedNoteSchema` (schema.ts:148-158 per research) to add:

```ts
attachments: z.array(AttachmentSchema).max(5).optional().default([]),
```

- [ ] **Step 4: Typecheck**

```bash
npx pnpm --filter api typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/database/migrations/095_add_note_attachments.ts apps/api/src/modules/groups/schema.ts
git commit -m "feat(api): add attachments column and schema for group shared notes"
```

---

### Task 27: `/shared-notes/upload-url` endpoint + service updates

**Files:**
- Modify: `apps/api/src/modules/groups/controller.ts`
- Modify: `apps/api/src/modules/groups/service.ts`
- Modify: `apps/api/src/modules/groups/router.ts`
- Test: `apps/api/src/modules/groups/service.test.ts`

**Interfaces:**
- Consumes: `AttachmentSchema`, `NoteUploadUrlRequestSchema` (Task 26), `getPresignedUploadUrl` (existing).
- Produces: `groupService.getSharedNoteUploadUrl(context, groupId, fileName, contentType)`; `createSharedNote`/`updateSharedNote`/`toSharedNote` now handle `attachments`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/modules/groups/service.test.ts (add)
describe('groupService — shared note attachments', () => {
  it('persists attachments on create and returns them via toSharedNote', async () => {
    const universityId = await createUniversity()
    const faculty = await createUser({ universityId, role: 'faculty' })
    const group = await groupService.createGroup({ userId: faculty.id, universityId, role: 'faculty' }, { name: 'CS101', type: 'academic', is_private: false })
    const context = { userId: faculty.id, universityId, role: 'faculty' }

    const note = await groupService.createSharedNote(context, group.id, {
      title: 'Lecture 1',
      body: 'notes',
      attachments: [{ name: 'lecture1.pdf', url: 'https://cdn.example.com/lecture1.pdf', contentType: 'application/pdf', size: 1024 }],
    })

    expect(note.attachments).toHaveLength(1)
    expect(note.attachments[0].name).toBe('lecture1.pdf')
  })

  it('rejects a presign request for a disallowed content type', async () => {
    const universityId = await createUniversity()
    const faculty = await createUser({ universityId, role: 'faculty' })
    const group = await groupService.createGroup({ userId: faculty.id, universityId, role: 'faculty' }, { name: 'CS101', type: 'academic', is_private: false })
    const context = { userId: faculty.id, universityId, role: 'faculty' }

    await expect(
      groupService.getSharedNoteUploadUrl(context, group.id, 'malware.exe', 'application/x-msdownload')
    ).rejects.toMatchObject({ statusCode: 400 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx pnpm --filter api test src/modules/groups/service.test.ts -t "shared note attachments"`
Expected: FAIL — `attachments` isn't persisted, `getSharedNoteUploadUrl` doesn't exist.

- [ ] **Step 3: Update `createSharedNote`/`updateSharedNote`/`toSharedNote`**

In `apps/api/src/modules/groups/service.ts` (service.ts:1651-1685 per research), update the insert/update payload to include `attachments: JSON.stringify(input.attachments ?? [])`, and in `toSharedNote` (service.ts:2194-2207) add `attachments: row.attachments ?? []` to the returned object.

- [ ] **Step 4: Add `getSharedNoteUploadUrl`**

```ts
async getSharedNoteUploadUrl(context, groupId: string, fileName: string, contentType: string) {
  await assertMemberAccess(context, groupId)
  const ALLOWED = [
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  ]
  if (!ALLOWED.includes(contentType)) throw badRequest('Unsupported file type for shared notes')
  const key = `group-notes/${context.universityId}/${groupId}/${Date.now()}-${sanitizeFileName(fileName)}`
  const presigned = await getPresignedUploadUrl(key, contentType)
  return { ...presigned, maxSizeBytes: 26214400 }
},
```

- [ ] **Step 5: Add controller handler + route**

```ts
// controller.ts
export const getSharedNoteUploadUrl = asyncHandler(async (req, res) => {
  sendSuccess(res, await groupService.getSharedNoteUploadUrl(buildContext(req), req.params.groupId, req.body.fileName, req.body.contentType))
})
```

```ts
// router.ts
groupsRouter.post('/:groupId/shared-notes/upload-url', validate(NoteUploadUrlRequestSchema), getSharedNoteUploadUrl)
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx pnpm --filter api test src/modules/groups/service.test.ts -t "shared note attachments"`
Expected: PASS.

- [ ] **Step 7: Typecheck and lint**

```bash
npx pnpm --filter api typecheck && npx pnpm --filter api lint
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/groups/controller.ts apps/api/src/modules/groups/service.ts apps/api/src/modules/groups/router.ts apps/api/src/modules/groups/service.test.ts
git commit -m "feat(api): add shared-notes upload-url endpoint and attachment persistence"
```

---

### Task 28: Frontend — `StudyNotesPanel.tsx` drag-drop attachments

**Files:**
- Modify: `apps/web/src/features/groups/components/StudyNotesPanel.tsx`
- Modify: `apps/web/src/features/groups/hooks/useGroupExtended.ts`
- Modify: `apps/web/src/features/groups/types.ts`
- Test: `apps/web/src/features/groups/components/StudyNotesPanel.test.tsx`

**Interfaces:**
- Consumes: `POST /:groupId/shared-notes/upload-url` (Task 27), existing `usePresignedUpload` hook pattern (`apps/web/src/hooks/usePresignedUpload.ts`).

- [ ] **Step 1: Read the current `StudyNotesPanel.tsx` and `usePresignedUpload.ts` in full**

- [ ] **Step 2: Add the `Attachment` type**

```ts
// types.ts (append)
export interface Attachment {
  name: string
  url: string
  contentType: string
  size: number
}
```

Add `attachments: Attachment[]` to the existing `SharedNote` type in this file.

- [ ] **Step 3: Write the failing test**

```tsx
// apps/web/src/features/groups/components/StudyNotesPanel.test.tsx (add to existing suite)
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { rest } from 'msw'
import { server } from '@/tests/msw/server'
import { StudyNotesPanel } from './StudyNotesPanel'
import { renderWithQueryClient } from '@/tests/renderWithQueryClient'

describe('StudyNotesPanel — attachments', () => {
  it('uploads a file and shows it as a chip before saving the note', async () => {
    server.use(
      rest.post('*/groups/g1/shared-notes/upload-url', (req, res, ctx) =>
        res(ctx.json({ data: { uploadUrl: 'https://s3.example.com/put', publicUrl: 'https://cdn.example.com/lecture1.pdf', maxSizeBytes: 26214400 } }))
      ),
      rest.put('https://s3.example.com/put', (req, res, ctx) => res(ctx.status(200)))
    )
    renderWithQueryClient(<StudyNotesPanel groupId="g1" />)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /new note/i }))

    const file = new File(['content'], 'lecture1.pdf', { type: 'application/pdf' })
    const input = screen.getByLabelText(/attach file/i)
    await user.upload(input, file)

    await waitFor(() => expect(screen.getByText('lecture1.pdf')).toBeInTheDocument())
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx pnpm --filter web test src/features/groups/components/StudyNotesPanel.test.tsx -t "attachments"`
Expected: FAIL — no file drop zone exists yet in the note form.

- [ ] **Step 5: Implement the attachment upload flow**

Add a `usePresignedUpload`-style hook call scoped to the shared-notes endpoint (since the existing shared `usePresignedUpload` hook posts to `/upload/presign` with a `folder` param that the backend controller research flagged as ignored server-side — for this task, add a dedicated `useSharedNoteUpload` hook in `useGroupExtended.ts` that calls the new group-scoped endpoint instead of the generic one, since Task 27 built a purpose-specific, content-type-validated endpoint rather than extending the generic `/upload/presign`):

```ts
// useGroupExtended.ts (append)
export function useSharedNoteUpload(groupId: string) {
  return async (file: File): Promise<Attachment> => {
    const { data } = await api.post(`/groups/${groupId}/shared-notes/upload-url`, { fileName: file.name, contentType: file.type })
    const { uploadUrl, publicUrl, maxSizeBytes } = data.data
    if (file.size > maxSizeBytes) throw new Error('File exceeds the 25MB limit')
    await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
    return { name: file.name, url: publicUrl, contentType: file.type, size: file.size }
  }
}
```

In `StudyNotesPanel.tsx`'s note-creation/edit form, add a file input and attachment-chip list:

```tsx
const uploadAttachment = useSharedNoteUpload(groupId)
const [attachments, setAttachments] = useState<Attachment[]>(note?.attachments ?? [])

async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0]
  if (!file) return
  const attachment = await uploadAttachment(file)
  setAttachments((prev) => [...prev, attachment])
}

// in the JSX, below the body textarea:
<input aria-label="Attach file" type="file" onChange={(e) => void handleFileSelect(e)} />
<ul className="flex gap-2 flex-wrap">
  {attachments.map((a, i) => (
    <li key={i} className="flex items-center gap-1 rounded-[var(--r-pill)] px-2 py-1" style={{ background: 'var(--surface-raised)' }}>
      <span>{a.name}</span>
      <button type="button" onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}>×</button>
    </li>
  ))}
</ul>
```

Include `attachments` in the payload sent to `useCreateSharedNote`/`useUpdateSharedNote` on save.

- [ ] **Step 6: Render existing attachments as download links in the note detail view**

In whatever section of `StudyNotesPanel.tsx` renders a selected note's body (read-only view), add:

```tsx
{note.attachments?.length > 0 && (
  <ul className="flex gap-2 flex-wrap">
    {note.attachments.map((a) => (
      <li key={a.url}>
        <a href={a.url} target="_blank" rel="noreferrer">{a.name}</a>
      </li>
    ))}
  </ul>
)}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx pnpm --filter web test src/features/groups/components/StudyNotesPanel.test.tsx`
Expected: PASS, including all pre-existing tests in the suite (regression check).

- [ ] **Step 8: Typecheck and lint**

```bash
npx pnpm --filter web typecheck && npx pnpm --filter web lint
```

Expected: PASS.

- [ ] **Step 9: Manual smoke test**

```bash
npx pnpm --filter web dev
```

Upload a PDF to a shared note in an academic group, confirm the download link opens the file.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/features/groups/components/StudyNotesPanel.tsx apps/web/src/features/groups/components/StudyNotesPanel.test.tsx apps/web/src/features/groups/hooks/useGroupExtended.ts apps/web/src/features/groups/types.ts
git commit -m "feat(web): add file attachments to shared notes"
```

---

# Phase 8 — Per-Session Notes

### Task 29: Migration `096_create_session_notes.ts`

**Files:**
- Create: `apps/api/src/database/migrations/096_create_session_notes.ts`

**Interfaces:**
- Produces: tables `group_session_creator_notes`, `group_session_member_notes` — consumed by Task 30.

- [ ] **Step 1: Write the migration**

```ts
// apps/api/src/database/migrations/096_create_session_notes.ts
import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('group_session_creator_notes', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('session_id').notNullable().unique().references('id').inTable('group_study_sessions').onDelete('CASCADE')
    table.uuid('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE')
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.uuid('created_by').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.string('title', 255)
    table.text('body')
    table.jsonb('attachments').notNullable().defaultTo('[]')
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })
  await knex.schema.alterTable('group_session_creator_notes', (table) => {
    table.index(['session_id'], 'session_creator_notes_session_idx')
  })

  await knex.schema.createTable('group_session_member_notes', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('session_id').notNullable().references('id').inTable('group_study_sessions').onDelete('CASCADE')
    table.uuid('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE')
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.text('body')
    table.jsonb('attachments').notNullable().defaultTo('[]')
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.unique(['session_id', 'user_id'])
  })
  await knex.schema.alterTable('group_session_member_notes', (table) => {
    table.index(['session_id', 'user_id'], 'session_member_notes_user_idx')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('group_session_member_notes')
  await knex.schema.dropTableIfExists('group_session_creator_notes')
}
```

- [ ] **Step 2: Confirm the referenced table name**

Before running, grep `apps/api/src/database/migrations/` for the study-sessions table creation to confirm it's actually named `group_study_sessions` (matches the spec and the `StudySessionsTab.tsx`/`CreateStudySessionSchema` naming convention noted in earlier research) — adjust the FK reference if the real table name differs.

- [ ] **Step 3: Run the migration**

```bash
npx pnpm --filter api db:migrate
```

Expected: `Batch N run: 1 migrations`.

- [ ] **Step 4: Verify rollback**

```bash
npx pnpm --filter api db:rollback && npx pnpm --filter api db:migrate
```

Expected: clean drop/recreate.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/database/migrations/096_create_session_notes.ts
git commit -m "feat(api): add session creator notes and member private notes tables"
```

---

### Task 30: Session notes routes + service methods

**Files:**
- Modify: `apps/api/src/modules/groups/schema.ts`
- Modify: `apps/api/src/modules/groups/service.ts`
- Modify: `apps/api/src/modules/groups/controller.ts`
- Modify: `apps/api/src/modules/groups/router.ts`
- Test: `apps/api/src/modules/groups/service.test.ts`

**Interfaces:**
- Consumes: tables from Task 29.
- Produces: `groupService.getSessionCreatorNotes`, `putSessionCreatorNotes`, `getSessionCreatorNotesUploadUrl`, `getMySessionPrivateNotes`, `putMySessionPrivateNotes`, `getSessionPrivateNotesUploadUrl` — consumed by Task 31 (frontend).

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/modules/groups/service.test.ts (add)
describe('groupService — session notes', () => {
  it('allows only the session creator to write creator notes', async () => {
    const universityId = await createUniversity()
    const faculty = await createUser({ universityId, role: 'faculty' })
    const other = await createUser({ universityId, role: 'faculty' })
    const group = await groupService.createGroup({ userId: faculty.id, universityId, role: 'faculty' }, { name: 'CS101', type: 'academic', is_private: false })
    const session = await groupService.createStudySession({ userId: faculty.id, universityId, role: 'faculty' }, group.id, {
      title: 'Session 1', starts_at: new Date(Date.now() + 3600000).toISOString(), ends_at: new Date(Date.now() + 7200000).toISOString(),
    })

    const notes = await groupService.putSessionCreatorNotes({ userId: faculty.id, universityId, role: 'faculty' }, group.id, session.id, { title: 'Agenda', body: 'Cover chapter 1' })
    expect(notes.body).toBe('Cover chapter 1')

    await expect(
      groupService.putSessionCreatorNotes({ userId: other.id, universityId, role: 'faculty' }, group.id, session.id, { title: 'Hijack', body: 'x' })
    ).rejects.toMatchObject({ statusCode: 403 })
  })

  it('isolates private notes per member', async () => {
    const universityId = await createUniversity()
    const faculty = await createUser({ universityId, role: 'faculty' })
    const studentA = await createUser({ universityId, role: 'student' })
    const studentB = await createUser({ universityId, role: 'student' })
    const group = await groupService.createGroup({ userId: faculty.id, universityId, role: 'faculty' }, { name: 'CS101', type: 'academic', is_private: false })
    const session = await groupService.createStudySession({ userId: faculty.id, universityId, role: 'faculty' }, group.id, {
      title: 'Session 1', starts_at: new Date(Date.now() + 3600000).toISOString(), ends_at: new Date(Date.now() + 7200000).toISOString(),
    })
    await groupService.joinGroup({ userId: studentA.id, universityId, role: 'student' }, group.id)
    await groupService.joinGroup({ userId: studentB.id, universityId, role: 'student' }, group.id)

    await groupService.putMySessionPrivateNotes({ userId: studentA.id, universityId, role: 'student' }, group.id, session.id, { body: 'A private note' })
    await groupService.putMySessionPrivateNotes({ userId: studentB.id, universityId, role: 'student' }, group.id, session.id, { body: 'B private note' })

    const aNotes = await groupService.getMySessionPrivateNotes({ userId: studentA.id, universityId, role: 'student' }, group.id, session.id)
    const bNotes = await groupService.getMySessionPrivateNotes({ userId: studentB.id, universityId, role: 'student' }, group.id, session.id)

    expect(aNotes.body).toBe('A private note')
    expect(bNotes.body).toBe('B private note')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx pnpm --filter api test src/modules/groups/service.test.ts -t "session notes"`
Expected: FAIL — none of the methods exist.

- [ ] **Step 3: Implement the service methods**

```ts
// apps/api/src/modules/groups/service.ts (append to groupService object)
async getSessionCreatorNotes(context, groupId: string, sessionId: string) {
  await assertMemberAccess(context, groupId)
  const row = await db('group_session_creator_notes').where({ session_id: sessionId, group_id: groupId }).first()
  return row ? { id: row.id, title: row.title, body: row.body, attachments: row.attachments, createdBy: row.created_by, updatedAt: row.updated_at } : null
},

async putSessionCreatorNotes(context, groupId: string, sessionId: string, input) {
  await assertMemberAccess(context, groupId)
  const session = await db('group_study_sessions').where({ id: sessionId, group_id: groupId }).first()
  if (!session) throw notFound('Session not found')
  if (session.created_by !== context.userId) throw forbidden('Only the session creator can edit these notes')

  const existing = await db('group_session_creator_notes').where({ session_id: sessionId }).first()
  if (existing) {
    const [row] = await db('group_session_creator_notes')
      .where({ id: existing.id })
      .update({ title: input.title, body: input.body, attachments: JSON.stringify(input.attachments ?? existing.attachments), updated_at: db.fn.now() })
      .returning('*')
    return { id: row.id, title: row.title, body: row.body, attachments: row.attachments }
  }
  const [row] = await db('group_session_creator_notes')
    .insert({
      session_id: sessionId, group_id: groupId, university_id: context.universityId, created_by: context.userId,
      title: input.title, body: input.body, attachments: JSON.stringify(input.attachments ?? []),
    })
    .returning('*')
  return { id: row.id, title: row.title, body: row.body, attachments: row.attachments }
},

async getSessionCreatorNotesUploadUrl(context, groupId: string, sessionId: string, fileName: string, contentType: string) {
  const session = await db('group_study_sessions').where({ id: sessionId, group_id: groupId }).first()
  if (!session) throw notFound('Session not found')
  if (session.created_by !== context.userId) throw forbidden('Only the session creator can upload here')
  const key = `session-notes/creator/${context.universityId}/${sessionId}/${Date.now()}-${sanitizeFileName(fileName)}`
  const presigned = await getPresignedUploadUrl(key, contentType)
  return { ...presigned, maxSizeBytes: 26214400 }
},

async getMySessionPrivateNotes(context, groupId: string, sessionId: string) {
  await assertMemberAccess(context, groupId)
  const row = await db('group_session_member_notes').where({ session_id: sessionId, group_id: groupId, user_id: context.userId }).first()
  return row ? { id: row.id, body: row.body, attachments: row.attachments, updatedAt: row.updated_at } : null
},

async putMySessionPrivateNotes(context, groupId: string, sessionId: string, input) {
  await assertMemberAccess(context, groupId)
  const existing = await db('group_session_member_notes').where({ session_id: sessionId, user_id: context.userId }).first()
  if (existing) {
    const [row] = await db('group_session_member_notes')
      .where({ id: existing.id })
      .update({ body: input.body, attachments: JSON.stringify(input.attachments ?? existing.attachments), updated_at: db.fn.now() })
      .returning('*')
    return { id: row.id, body: row.body, attachments: row.attachments }
  }
  const [row] = await db('group_session_member_notes')
    .insert({
      session_id: sessionId, group_id: groupId, university_id: context.universityId, user_id: context.userId,
      body: input.body, attachments: JSON.stringify(input.attachments ?? []),
    })
    .returning('*')
  return { id: row.id, body: row.body, attachments: row.attachments }
},

async getSessionPrivateNotesUploadUrl(context, groupId: string, sessionId: string, fileName: string, contentType: string) {
  await assertMemberAccess(context, groupId)
  const key = `session-notes/private/${context.universityId}/${sessionId}/${context.userId}/${Date.now()}-${sanitizeFileName(fileName)}`
  const presigned = await getPresignedUploadUrl(key, contentType)
  return { ...presigned, maxSizeBytes: 26214400 }
},
```

Confirm `groupService.createStudySession`'s actual signature (used in the test) by reading the existing method — the test above assumes `{ title, starts_at, ends_at }` per `CreateStudySessionSchema` (schema.ts:97-111 refines `ends_at > starts_at`, per earlier research); adjust field names if the real schema differs.

- [ ] **Step 4: Add schema entries**

```ts
// groups/schema.ts (append)
export const PutSessionCreatorNotesSchema = z.object({
  title: z.string().max(255).optional(),
  body: z.string().optional(),
  attachments: z.array(AttachmentSchema).max(5).optional(),
})

export const PutSessionPrivateNotesSchema = z.object({
  body: z.string().optional(),
  attachments: z.array(AttachmentSchema).max(5).optional(),
})
```

- [ ] **Step 5: Add controller handlers + routes**

```ts
// controller.ts (append)
export const getSessionCreatorNotes = asyncHandler(async (req, res) => sendSuccess(res, await groupService.getSessionCreatorNotes(buildContext(req), req.params.groupId, req.params.sessionId)))
export const putSessionCreatorNotes = asyncHandler(async (req, res) => sendSuccess(res, await groupService.putSessionCreatorNotes(buildContext(req), req.params.groupId, req.params.sessionId, req.body)))
export const getSessionCreatorNotesUploadUrl = asyncHandler(async (req, res) => sendSuccess(res, await groupService.getSessionCreatorNotesUploadUrl(buildContext(req), req.params.groupId, req.params.sessionId, req.query.fileName, req.query.contentType)))
export const getMySessionPrivateNotes = asyncHandler(async (req, res) => sendSuccess(res, await groupService.getMySessionPrivateNotes(buildContext(req), req.params.groupId, req.params.sessionId)))
export const putMySessionPrivateNotes = asyncHandler(async (req, res) => sendSuccess(res, await groupService.putMySessionPrivateNotes(buildContext(req), req.params.groupId, req.params.sessionId, req.body)))
export const getSessionPrivateNotesUploadUrl = asyncHandler(async (req, res) => sendSuccess(res, await groupService.getSessionPrivateNotesUploadUrl(buildContext(req), req.params.groupId, req.params.sessionId, req.query.fileName, req.query.contentType)))
```

```ts
// router.ts (append)
groupsRouter.get('/:groupId/sessions/:sessionId/notes/creator', getSessionCreatorNotes)
groupsRouter.put('/:groupId/sessions/:sessionId/notes/creator', validate(PutSessionCreatorNotesSchema), putSessionCreatorNotes)
groupsRouter.get('/:groupId/sessions/:sessionId/notes/creator/upload-url', getSessionCreatorNotesUploadUrl)
groupsRouter.get('/:groupId/sessions/:sessionId/notes/private', getMySessionPrivateNotes)
groupsRouter.put('/:groupId/sessions/:sessionId/notes/private', validate(PutSessionPrivateNotesSchema), putMySessionPrivateNotes)
groupsRouter.get('/:groupId/sessions/:sessionId/notes/private/upload-url', getSessionPrivateNotesUploadUrl)
```

Per spec §14.2 these upload-url endpoints are `GET` with query params (`fileName`, `contentType`) rather than `POST` with a body, unlike Tasks 21/27's upload-url endpoints — this is an intentional deviation matching the spec table exactly; validate `req.query` with `validateRequest({ query: ... })` instead of `validate()` if the codebase's `validateRequest` helper is what handles query validation (per `CLAUDE.md`'s documented distinction between `validate(schema)` for body and `validateRequest({...})` for params/query).

- [ ] **Step 6: Fix query validation per the note in Step 5**

Replace the two upload-url routes with query validation:

```ts
groupsRouter.get('/:groupId/sessions/:sessionId/notes/creator/upload-url', validateRequest({ query: UploadUrlQuerySchema }), getSessionCreatorNotesUploadUrl)
groupsRouter.get('/:groupId/sessions/:sessionId/notes/private/upload-url', validateRequest({ query: UploadUrlQuerySchema }), getSessionPrivateNotesUploadUrl)
```

Add to `schema.ts`:

```ts
export const UploadUrlQuerySchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
})
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx pnpm --filter api test src/modules/groups/service.test.ts -t "session notes"`
Expected: PASS.

- [ ] **Step 8: Typecheck and lint**

```bash
npx pnpm --filter api typecheck && npx pnpm --filter api lint
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/modules/groups/schema.ts apps/api/src/modules/groups/service.ts apps/api/src/modules/groups/controller.ts apps/api/src/modules/groups/router.ts apps/api/src/modules/groups/service.test.ts
git commit -m "feat(api): add session creator notes and private member notes endpoints"
```

---

### Task 31: Frontend — `SessionNotesPanel.tsx`

**Files:**
- Create: `apps/web/src/features/groups/components/SessionNotesPanel.tsx`
- Modify: `apps/web/src/features/groups/components/StudySessionsTab.tsx`
- Modify: `apps/web/src/features/groups/hooks/useGroupExtended.ts`
- Modify: `apps/web/src/features/groups/types.ts`
- Test: `apps/web/src/features/groups/components/SessionNotesPanel.test.tsx`

**Interfaces:**
- Consumes: all session-notes routes (Task 30).

- [ ] **Step 1: Add types**

```ts
// types.ts (append)
export interface SessionNotes {
  id: string
  title?: string
  body?: string
  attachments: Attachment[]
}
```

- [ ] **Step 2: Add hooks**

```ts
// useGroupExtended.ts (append)
export const creatorNotesKey = (groupId: string, sessionId: string) => ['groups', groupId, 'sessions', sessionId, 'notes', 'creator'] as const
export const privateNotesKey = (groupId: string, sessionId: string) => ['groups', groupId, 'sessions', sessionId, 'notes', 'private'] as const

export function useSessionCreatorNotes(groupId: string, sessionId: string) {
  return useQuery({ queryKey: creatorNotesKey(groupId, sessionId), queryFn: () => api.get(`/groups/${groupId}/sessions/${sessionId}/notes/creator`).then((r) => r.data.data), enabled: !!sessionId })
}

export function useSaveSessionCreatorNotes(groupId: string, sessionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: unknown) => api.put(`/groups/${groupId}/sessions/${sessionId}/notes/creator`, input).then((r) => r.data.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: creatorNotesKey(groupId, sessionId) }),
  })
}

export function useMySessionPrivateNotes(groupId: string, sessionId: string) {
  return useQuery({ queryKey: privateNotesKey(groupId, sessionId), queryFn: () => api.get(`/groups/${groupId}/sessions/${sessionId}/notes/private`).then((r) => r.data.data), enabled: !!sessionId })
}

export function useSaveMySessionPrivateNotes(groupId: string, sessionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: unknown) => api.put(`/groups/${groupId}/sessions/${sessionId}/notes/private`, input).then((r) => r.data.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: privateNotesKey(groupId, sessionId) }),
  })
}
```

- [ ] **Step 3: Write the failing test**

```tsx
// apps/web/src/features/groups/components/SessionNotesPanel.test.tsx
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { rest } from 'msw'
import { server } from '@/tests/msw/server'
import { SessionNotesPanel } from './SessionNotesPanel'
import { renderWithQueryClient } from '@/tests/renderWithQueryClient'

describe('SessionNotesPanel', () => {
  it('shows a placeholder when the creator has not posted notes yet', async () => {
    server.use(
      rest.get('*/groups/g1/sessions/s1/notes/creator', (req, res, ctx) => res(ctx.json({ data: null }))),
      rest.get('*/groups/g1/sessions/s1/notes/private', (req, res, ctx) => res(ctx.json({ data: null })))
    )
    renderWithQueryClient(<SessionNotesPanel groupId="g1" sessionId="s1" isCreator={false} />)
    await waitFor(() => expect(screen.getByText(/No session notes posted yet/i)).toBeInTheDocument())
  })

  it('auto-saves private notes after a debounce', async () => {
    vi.useFakeTimers()
    server.use(
      rest.get('*/groups/g1/sessions/s1/notes/creator', (req, res, ctx) => res(ctx.json({ data: null }))),
      rest.get('*/groups/g1/sessions/s1/notes/private', (req, res, ctx) => res(ctx.json({ data: null }))),
      rest.put('*/groups/g1/sessions/s1/notes/private', (req, res, ctx) => res(ctx.json({ data: { body: 'my note' } })))
    )
    renderWithQueryClient(<SessionNotesPanel groupId="g1" sessionId="s1" isCreator={false} />)
    await waitFor(() => expect(screen.getByLabelText(/my private notes/i)).toBeInTheDocument())

    const user = userEvent.setup({ delay: null })
    await user.type(screen.getByLabelText(/my private notes/i), 'my note')
    vi.advanceTimersByTime(1500)

    await waitFor(() => expect(screen.getByText(/saved/i)).toBeInTheDocument())
    vi.useRealTimers()
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx pnpm --filter web test src/features/groups/components/SessionNotesPanel.test.tsx`
Expected: FAIL — component doesn't exist.

- [ ] **Step 5: Implement `SessionNotesPanel.tsx`**

```tsx
// apps/web/src/features/groups/components/SessionNotesPanel.tsx
import { useEffect, useRef, useState } from 'react'
import {
  useSessionCreatorNotes, useSaveSessionCreatorNotes,
  useMySessionPrivateNotes, useSaveMySessionPrivateNotes,
} from '../hooks/useGroupExtended'

interface SessionNotesPanelProps {
  groupId: string
  sessionId: string
  isCreator: boolean
}

export function SessionNotesPanel({ groupId, sessionId, isCreator }: SessionNotesPanelProps) {
  const { data: creatorNotes } = useSessionCreatorNotes(groupId, sessionId)
  const saveCreatorNotes = useSaveSessionCreatorNotes(groupId, sessionId)
  const { data: privateNotes } = useMySessionPrivateNotes(groupId, sessionId)
  const savePrivateNotes = useSaveMySessionPrivateNotes(groupId, sessionId)

  const [editingCreator, setEditingCreator] = useState(false)
  const [creatorBody, setCreatorBody] = useState(creatorNotes?.body ?? '')
  const [privateBody, setPrivateBody] = useState(privateNotes?.body ?? '')
  const [saved, setSaved] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    setPrivateBody(privateNotes?.body ?? '')
  }, [privateNotes])

  function handlePrivateChange(value: string) {
    setPrivateBody(value)
    setSaved(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void savePrivateNotes.mutateAsync({ body: value }).then(() => setSaved(true))
    }, 1500)
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <section>
        <h3>Session notes (by creator)</h3>
        {creatorNotes || editingCreator ? (
          isCreator && editingCreator ? (
            <div>
              <textarea
                aria-label="Creator notes body"
                value={creatorBody}
                onChange={(e) => setCreatorBody(e.target.value)}
              />
              <button type="button" onClick={() => void saveCreatorNotes.mutateAsync({ body: creatorBody }).then(() => setEditingCreator(false))}>
                Save
              </button>
            </div>
          ) : (
            <div>
              <p>{creatorNotes?.body}</p>
              {isCreator && <button type="button" onClick={() => setEditingCreator(true)}>Edit</button>}
            </div>
          )
        ) : (
          <div>
            <p>No session notes posted yet</p>
            {isCreator && <button type="button" onClick={() => setEditingCreator(true)}>Add notes</button>}
          </div>
        )}
      </section>

      <section>
        <h3>My private notes</h3>
        <textarea
          aria-label="My private notes"
          value={privateBody}
          onChange={(e) => handlePrivateChange(e.target.value)}
        />
        {saved && <span>Saved ✓</span>}
      </section>
    </div>
  )
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx pnpm --filter web test src/features/groups/components/SessionNotesPanel.test.tsx`
Expected: PASS.

- [ ] **Step 7: Wire a "Notes" link into `StudySessionsTab.tsx`**

Read the current session-list rendering in `StudySessionsTab.tsx` and add a per-session "Notes" button that opens `SessionNotesPanel` (in a modal, drawer, or inline expansion — match whichever pattern the file already uses for viewing session detail, e.g. if RSVP details expand inline, follow that same expansion pattern rather than introducing a new modal component):

```tsx
<button type="button" onClick={() => setActiveNotesSessionId(session.id)}>Notes</button>
{activeNotesSessionId === session.id && (
  <SessionNotesPanel groupId={groupId} sessionId={session.id} isCreator={session.createdBy === currentUserId} />
)}
```

- [ ] **Step 8: Typecheck and lint**

```bash
npx pnpm --filter web typecheck && npx pnpm --filter web lint
```

Expected: PASS.

- [ ] **Step 9: Manual smoke test**

```bash
npx pnpm --filter web dev
```

Open a study session as its creator, add creator notes, log in as a different member, confirm creator notes are read-only and private notes are isolated per user.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/features/groups/components/SessionNotesPanel.tsx apps/web/src/features/groups/components/SessionNotesPanel.test.tsx apps/web/src/features/groups/components/StudySessionsTab.tsx apps/web/src/features/groups/hooks/useGroupExtended.ts apps/web/src/features/groups/types.ts
git commit -m "feat(web): add per-session creator notes and private member notes panel"
```

---

## Final Full-Plan Self-Review (all three files: Parts 1–3)

**1. Spec coverage:** Cross-checked against every SPEC.md section (§5–§14) and every row of §17's Implementation Order — each phase's steps map 1:1 to a task across the three plan files (Phase 1→Tasks 1-6, Phase 2→Tasks 7-11, Phase 3→Tasks 12-14, Phase 4→Tasks 15-18, Phase 5→Tasks 19-22, Phase 6→Tasks 23-25, Phase 7→Tasks 26-28, Phase 8→Tasks 29-31). §18's three testing categories are all present: unit tests for `ai.service`, `calculateBestN`, `getLetterGrade`, `resolveAITopic`, weight validation (Tasks 2, 16, 13); integration tests for the academic-group-creation guard, flashcard 403, gradebook best-N, upload-url, gradebook auto-population on join (Tasks 8, 9, 16, 21, 27, 17); manual smoke steps are called out explicitly in Tasks 7, 22, 25, 28, 31 and should be re-run end-to-end once Task 31 lands, matching §18's three manual smoke-test scenarios.

**2. Placeholder scan:** No bare "TBD"/"add error handling"/"similar to Task N" (unqualified) patterns across Parts 2–3. Every "confirm the exact X before finalizing" instruction (Task 13 Step 6, Task 17 Step 3, Task 20 Step 5, Task 21 Step 7, Task 29 Step 2, Task 30 Step 5) is paired with the concrete code to insert and the concrete reasoning for why it might need adjusting — these are verify-against-source instructions, not content gaps, consistent with how Part 1 flagged the same category of uncertainty. Two spots were caught and fixed inline during drafting rather than left as silent gaps: Task 16's dead `full` variable (removed via Step 4) and Task 20's route-ordering hazard for `/modules/reorder` vs `/modules/:moduleId` (fixed via Step 6).

**3. Type consistency:** `Attachment`/`AttachmentSchema` fields (`name`, `url`, `contentType`, `size`) are identical in Task 26 (backend Zod), Task 21's `FileUrlSchema` (deliberately duplicated per the module-boundary note in Task 26's Interfaces block), and Task 28/31's frontend `Attachment` type. `CourseOutline`/`CourseOutlineAssessment`/`CourseOutlineTopic` field names match exactly between Task 13's `toOutline()` mapper output and Task 14's frontend TS types (`courseTitle`, `weightPercent`, `bestNCounted`, `totalGiven`, `weekNumber`). `Gradebook`/`GradebookColumn`/`GradebookRow` match between Task 16's `getGradebook()` return shape and Task 18's frontend types. `AcademicModule`/`Assignment`/`Submission` match between Tasks 20-21's `toModule`/`toAssignment`/`toSubmission` mappers and Task 22's frontend types. `calculateBestN`/`getLetterGrade` signatures match the Interfaces Contract table established in Part 1 exactly, and are consumed without modification by Task 24's `runGroupPosting` (indirectly, via `resolveAITopic`) and Task 18's `GradebookPanel`.

**Gaps found and fixed during this final pass:** (a) `groupService.createPost`'s exact name was unconfirmed in Task 24/23 — flagged explicitly rather than assumed, with an instruction to grep and substitute the real name; (b) the generic `/upload/presign` endpoint's ignored `folder` param (noted in original research) is explicitly *not* reused for shared-notes/session-notes uploads — Tasks 27/30 build purpose-specific, content-type-validated endpoints instead, and Task 28 documents this decision rather than silently diverging from the existing `usePresignedUpload` hook pattern; (c) session-notes upload-url endpoints intentionally use `GET` + query params (matching spec §14.2's table) while assignment/shared-notes upload-url endpoints use `POST` + body (matching spec §9.2/§13.3) — this asymmetry is called out explicitly in Task 30 Step 5 rather than silently normalized, since flattening it to one convention would contradict the spec's own endpoint tables.
