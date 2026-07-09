# UniConnecT Academic LMS — Part 2 (Phases 3–8, Tasks 12–31)

> **Continuation of** `docs/superpowers/plans/2026-07-09-academic-lms.md`. Read that file's header, Global Constraints, File Structure, and Interfaces Contract first — they apply here unchanged. Task numbering continues from Task 11.

---

# Phase 3 — Course Outline

### Task 12: Migration `093_create_course_outline.ts`

**Files:**
- Create: `apps/api/src/database/migrations/093_create_course_outline.ts`

**Interfaces:**
- Produces: tables `academic_course_outlines`, `course_outline_assessments`, `course_outline_topics` — consumed by Task 13, Task 16 (gradebook), Task 21 (assignments week linking).

- [ ] **Step 1: Write the migration**

```ts
// apps/api/src/database/migrations/093_create_course_outline.ts
import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('academic_course_outlines', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('group_id').notNullable().unique().references('id').inTable('groups').onDelete('CASCADE')
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.uuid('created_by').references('id').inTable('users').onDelete('SET NULL')
    table.string('course_code', 50)
    table.string('course_title', 255).notNullable()
    table.decimal('credit_hours', 3, 1)
    table.string('trimester', 100)
    table.text('description')
    table.string('grading_scale', 50).notNullable().defaultTo('uiu')
    table.jsonb('custom_scale_json')
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })

  await knex.schema.createTable('course_outline_assessments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('outline_id').notNullable().references('id').inTable('academic_course_outlines').onDelete('CASCADE')
    table.string('category_name', 100).notNullable()
    table.integer('full_marks').notNullable()
    table.decimal('weight_percent', 5, 2).notNullable()
    table.integer('total_given').notNullable().defaultTo(1)
    table.integer('best_n_counted').notNullable().defaultTo(1)
    table.integer('display_order').notNullable().defaultTo(1)
    table.check('best_n_counted <= total_given AND best_n_counted >= 1', [], 'best_n_valid')
  })
  await knex.schema.alterTable('course_outline_assessments', (table) => {
    table.index(['outline_id', 'display_order'], 'co_assessments_outline_idx')
  })

  await knex.schema.createTable('course_outline_topics', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('outline_id').notNullable().references('id').inTable('academic_course_outlines').onDelete('CASCADE')
    table.integer('week_number').notNullable()
    table.string('title', 255).notNullable()
    table.text('description')
    table.unique(['outline_id', 'week_number'])
  })
  await knex.schema.alterTable('course_outline_topics', (table) => {
    table.index(['outline_id', 'week_number'], 'co_topics_outline_idx')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('course_outline_topics')
  await knex.schema.dropTableIfExists('course_outline_assessments')
  await knex.schema.dropTableIfExists('academic_course_outlines')
}
```

- [ ] **Step 2: Run the migration**

```bash
npx pnpm --filter api db:migrate
```

Expected: `Batch N run: 1 migrations`.

- [ ] **Step 3: Verify rollback**

```bash
npx pnpm --filter api db:rollback && npx pnpm --filter api db:migrate
```

Expected: clean drop and recreate, no orphaned FK errors (drop order: topics → assessments → outlines, reverse of creation).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/database/migrations/093_create_course_outline.ts
git commit -m "feat(api): add course outline, assessments, and topics tables"
```

---

### Task 13: `modules/academic/` module scaffold + course-outline service/router

**Files:**
- Create: `apps/api/src/modules/academic/schema.ts`
- Create: `apps/api/src/modules/academic/course-outline.service.ts`
- Create: `apps/api/src/modules/academic/controller.ts`
- Create: `apps/api/src/modules/academic/router.ts`
- Create: `apps/api/src/modules/academic/index.ts`
- Modify: `apps/api/src/app.ts` (mount `academicRouter`)
- Test: `apps/api/src/modules/academic/course-outline.service.test.ts`

**Interfaces:**
- Consumes: tables from Task 12.
- Produces: `courseOutlineService.getOutline(groupId, universityId): Promise<CourseOutline | null>`, `courseOutlineService.createOutline(context, groupId, input)`, `courseOutlineService.replaceOutline(...)`, `resolveAITopic(groupId, universityId): Promise<string>` — consumed by Task 16 (gradebook 404-gate), Task 21 (module week linking), Task 24 (`runGroupPosting`).

- [ ] **Step 1: Read `groups/router.ts` and `groups/controller.ts` once more for the exact `asyncHandler`/`validate`/`sendSuccess` import paths to replicate in the new module**

- [ ] **Step 2: Write the failing test**

```ts
// apps/api/src/modules/academic/course-outline.service.test.ts
import { describe, it, expect } from 'vitest'
import { courseOutlineService } from './course-outline.service'
import { createUser } from '../../../tests/factories/user'
import { createUniversity } from '../../../tests/factories/university'
import { createGroupFixture } from '../../../tests/factories/group'

describe('courseOutlineService', () => {
  it('creates an outline with assessments summing weight to 100 and topics', async () => {
    const universityId = await createUniversity()
    const faculty = await createUser({ universityId, role: 'faculty' })
    const group = await createGroupFixture({ universityId, type: 'academic', ownerId: faculty.id })

    const outline = await courseOutlineService.createOutline(
      { userId: faculty.id, universityId, role: 'faculty' },
      group.id,
      {
        courseTitle: 'Data Structures',
        gradingScale: 'uiu',
        assessments: [
          { categoryName: 'Class Test', fullMarks: 20, weightPercent: 30, totalGiven: 4, bestNCounted: 3, displayOrder: 1 },
          { categoryName: 'Midterm', fullMarks: 30, weightPercent: 30, totalGiven: 1, bestNCounted: 1, displayOrder: 2 },
          { categoryName: 'Final', fullMarks: 40, weightPercent: 40, totalGiven: 1, bestNCounted: 1, displayOrder: 3 },
        ],
        topics: [{ weekNumber: 1, title: 'Arrays', description: 'Intro' }],
      }
    )

    expect(outline.courseTitle).toBe('Data Structures')
    expect(outline.assessments).toHaveLength(3)
    expect(outline.topics).toHaveLength(1)
  })

  it('rejects assessments whose weight_percent does not sum to 100', async () => {
    const universityId = await createUniversity()
    const faculty = await createUser({ universityId, role: 'faculty' })
    const group = await createGroupFixture({ universityId, type: 'academic', ownerId: faculty.id })

    await expect(
      courseOutlineService.createOutline(
        { userId: faculty.id, universityId, role: 'faculty' },
        group.id,
        {
          courseTitle: 'Bad Course',
          gradingScale: 'uiu',
          assessments: [{ categoryName: 'CT', fullMarks: 20, weightPercent: 50, totalGiven: 1, bestNCounted: 1, displayOrder: 1 }],
        }
      )
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rejects bestNCounted greater than totalGiven', async () => {
    const universityId = await createUniversity()
    const faculty = await createUser({ universityId, role: 'faculty' })
    const group = await createGroupFixture({ universityId, type: 'academic', ownerId: faculty.id })

    await expect(
      courseOutlineService.createOutline(
        { userId: faculty.id, universityId, role: 'faculty' },
        group.id,
        {
          courseTitle: 'Bad Course',
          gradingScale: 'uiu',
          assessments: [{ categoryName: 'CT', fullMarks: 20, weightPercent: 100, totalGiven: 2, bestNCounted: 3, displayOrder: 1 }],
        }
      )
    ).rejects.toMatchObject({ statusCode: 400 })
  })
})

describe('resolveAITopic', () => {
  it('returns the current-week topic when one exists', async () => {
    const universityId = await createUniversity()
    const faculty = await createUser({ universityId, role: 'faculty' })
    const group = await createGroupFixture({ universityId, type: 'academic', ownerId: faculty.id, aiSettings: { subject: 'Fallback Subject' } })
    const outline = await courseOutlineService.createOutline(
      { userId: faculty.id, universityId, role: 'faculty' },
      group.id,
      {
        courseTitle: 'X',
        gradingScale: 'uiu',
        assessments: [{ categoryName: 'CT', fullMarks: 20, weightPercent: 100, totalGiven: 1, bestNCounted: 1, displayOrder: 1 }],
        topics: [{ weekNumber: getCurrentISOWeek(), title: 'This Week Topic' }],
      }
    )

    const topic = await courseOutlineService.resolveAITopic(group.id, universityId)
    expect(topic).toBe('This Week Topic')
  })

  it('falls back to ai_settings.subject when no week topic exists', async () => {
    const universityId = await createUniversity()
    const faculty = await createUser({ universityId, role: 'faculty' })
    const group = await createGroupFixture({ universityId, type: 'academic', ownerId: faculty.id, aiSettings: { subject: 'Fallback Subject' } })

    const topic = await courseOutlineService.resolveAITopic(group.id, universityId)
    expect(topic).toBe('Fallback Subject')
  })
})

function getCurrentISOWeek(): number {
  const now = new Date()
  const target = new Date(now.valueOf())
  const dayNr = (now.getDay() + 6) % 7
  target.setDate(target.getDate() - dayNr + 3)
  const firstThursday = target.valueOf()
  target.setMonth(0, 1)
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7))
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000)
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx pnpm --filter api test src/modules/academic/course-outline.service.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 4: Write `academic/schema.ts`**

```ts
// apps/api/src/modules/academic/schema.ts
import { z } from 'zod'

export const GradingScaleTypeSchema = z.enum(['uiu', 'ugc', 'custom'])

export const GradingScaleEntrySchema = z.object({
  minPercent: z.number().min(0).max(100),
  letter: z.string().max(5),
  point: z.number().min(0).max(4),
})

export const CreateAssessmentSchema = z.object({
  categoryName: z.string().min(1).max(100),
  fullMarks: z.number().int().min(1),
  weightPercent: z.number().min(0).max(100),
  totalGiven: z.number().int().min(1),
  bestNCounted: z.number().int().min(1),
  displayOrder: z.number().int().min(1),
}).refine((a) => a.bestNCounted <= a.totalGiven, {
  message: 'bestNCounted must be <= totalGiven',
  path: ['bestNCounted'],
})

export const CreateTopicSchema = z.object({
  weekNumber: z.number().int().min(1),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
})

export const CreateCourseOutlineSchema = z.object({
  courseCode: z.string().max(50).optional(),
  courseTitle: z.string().min(1).max(255),
  creditHours: z.number().optional(),
  trimester: z.string().max(100).optional(),
  description: z.string().optional(),
  gradingScale: GradingScaleTypeSchema,
  customScaleJson: z.array(GradingScaleEntrySchema).optional(),
  assessments: z.array(CreateAssessmentSchema).min(1),
  topics: z.array(CreateTopicSchema).optional().default([]),
}).refine(
  (input) => Math.abs(input.assessments.reduce((sum, a) => sum + a.weightPercent, 0) - 100) < 0.01,
  { message: 'Sum of weightPercent across all assessments must equal 100', path: ['assessments'] }
).refine(
  (input) => new Set(input.topics.map((t) => t.weekNumber)).size === input.topics.length,
  { message: 'Week numbers in topics must be unique', path: ['topics'] }
)

export const UpdateAssessmentsSchema = z.object({
  assessments: z.array(CreateAssessmentSchema).min(1),
}).refine(
  (input) => Math.abs(input.assessments.reduce((sum, a) => sum + a.weightPercent, 0) - 100) < 0.01,
  { message: 'Sum of weightPercent across all assessments must equal 100', path: ['assessments'] }
)

export const UpdateTopicsSchema = z.object({
  topics: z.array(CreateTopicSchema),
}).refine(
  (input) => new Set(input.topics.map((t) => t.weekNumber)).size === input.topics.length,
  { message: 'Week numbers in topics must be unique', path: ['topics'] }
)
```

- [ ] **Step 5: Write `course-outline.service.ts`**

```ts
// apps/api/src/modules/academic/course-outline.service.ts
import { db } from '../../database/db'
import { badRequest, notFound } from '../../utils/errors'
import { assertGroupAdminAccess, assertMemberAccess } from '../groups/service' // export these helpers from groups/service.ts if not already exported

function getCurrentISOWeek(): number {
  const now = new Date()
  const target = new Date(now.valueOf())
  const dayNr = (now.getDay() + 6) % 7
  target.setDate(target.getDate() - dayNr + 3)
  const firstThursday = target.valueOf()
  target.setMonth(0, 1)
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7))
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000)
}

function toOutline(row, assessments, topics) {
  return {
    id: row.id,
    groupId: row.group_id,
    courseCode: row.course_code,
    courseTitle: row.course_title,
    creditHours: row.credit_hours ? Number(row.credit_hours) : null,
    trimester: row.trimester,
    description: row.description,
    gradingScale: row.grading_scale,
    customScaleJson: row.custom_scale_json,
    assessments: assessments.map((a) => ({
      id: a.id,
      categoryName: a.category_name,
      fullMarks: a.full_marks,
      weightPercent: Number(a.weight_percent),
      totalGiven: a.total_given,
      bestNCounted: a.best_n_counted,
      displayOrder: a.display_order,
    })),
    topics: topics.map((t) => ({ id: t.id, weekNumber: t.week_number, title: t.title, description: t.description })),
  }
}

export const courseOutlineService = {
  async getOutline(groupId: string, universityId: string) {
    const row = await db('academic_course_outlines').where({ group_id: groupId, university_id: universityId }).first()
    if (!row) return null
    const assessments = await db('course_outline_assessments').where({ outline_id: row.id }).orderBy('display_order')
    const topics = await db('course_outline_topics').where({ outline_id: row.id }).orderBy('week_number')
    return toOutline(row, assessments, topics)
  },

  async createOutline(context, groupId: string, input) {
    await assertGroupAdminAccess(context, groupId)
    const existing = await db('academic_course_outlines').where({ group_id: groupId }).first()
    if (existing) throw badRequest('Course outline already exists for this group; use PUT to replace it')

    return db.transaction(async (trx) => {
      const [outline] = await trx('academic_course_outlines')
        .insert({
          group_id: groupId,
          university_id: context.universityId,
          created_by: context.userId,
          course_code: input.courseCode,
          course_title: input.courseTitle,
          credit_hours: input.creditHours,
          trimester: input.trimester,
          description: input.description,
          grading_scale: input.gradingScale,
          custom_scale_json: input.customScaleJson ? JSON.stringify(input.customScaleJson) : null,
        })
        .returning('*')

      await trx('course_outline_assessments').insert(
        input.assessments.map((a) => ({
          outline_id: outline.id,
          category_name: a.categoryName,
          full_marks: a.fullMarks,
          weight_percent: a.weightPercent,
          total_given: a.totalGiven,
          best_n_counted: a.bestNCounted,
          display_order: a.displayOrder,
        }))
      )

      if (input.topics.length > 0) {
        await trx('course_outline_topics').insert(
          input.topics.map((t) => ({ outline_id: outline.id, week_number: t.weekNumber, title: t.title, description: t.description }))
        )
      }

      const assessments = await trx('course_outline_assessments').where({ outline_id: outline.id }).orderBy('display_order')
      const topics = await trx('course_outline_topics').where({ outline_id: outline.id }).orderBy('week_number')
      return toOutline(outline, assessments, topics)
    })
  },

  async replaceOutline(context, groupId: string, input) {
    const existing = await db('academic_course_outlines').where({ group_id: groupId, university_id: context.universityId }).first()
    if (!existing) throw notFound('Course outline not found')
    await assertGroupAdminAccess(context, groupId)

    return db.transaction(async (trx) => {
      await trx('academic_course_outlines').where({ id: existing.id }).update({
        course_code: input.courseCode,
        course_title: input.courseTitle,
        credit_hours: input.creditHours,
        trimester: input.trimester,
        description: input.description,
        grading_scale: input.gradingScale,
        custom_scale_json: input.customScaleJson ? JSON.stringify(input.customScaleJson) : null,
        updated_at: trx.fn.now(),
      })
      await trx('course_outline_assessments').where({ outline_id: existing.id }).del()
      await trx('course_outline_assessments').insert(
        input.assessments.map((a) => ({
          outline_id: existing.id,
          category_name: a.categoryName,
          full_marks: a.fullMarks,
          weight_percent: a.weightPercent,
          total_given: a.totalGiven,
          best_n_counted: a.bestNCounted,
          display_order: a.displayOrder,
        }))
      )
      await trx('course_outline_topics').where({ outline_id: existing.id }).del()
      if (input.topics.length > 0) {
        await trx('course_outline_topics').insert(
          input.topics.map((t) => ({ outline_id: existing.id, week_number: t.weekNumber, title: t.title, description: t.description }))
        )
      }
      return this.getOutline(groupId, context.universityId)
    })
  },

  async updateAssessments(context, groupId: string, input) {
    const existing = await db('academic_course_outlines').where({ group_id: groupId, university_id: context.universityId }).first()
    if (!existing) throw notFound('Course outline not found')
    await assertGroupAdminAccess(context, groupId)

    await db.transaction(async (trx) => {
      await trx('course_outline_assessments').where({ outline_id: existing.id }).del()
      await trx('course_outline_assessments').insert(
        input.assessments.map((a) => ({
          outline_id: existing.id,
          category_name: a.categoryName,
          full_marks: a.fullMarks,
          weight_percent: a.weightPercent,
          total_given: a.totalGiven,
          best_n_counted: a.bestNCounted,
          display_order: a.displayOrder,
        }))
      )
    })
    return this.getOutline(groupId, context.universityId)
  },

  async updateTopics(context, groupId: string, input) {
    const existing = await db('academic_course_outlines').where({ group_id: groupId, university_id: context.universityId }).first()
    if (!existing) throw notFound('Course outline not found')
    await assertGroupAdminAccess(context, groupId)

    await db.transaction(async (trx) => {
      await trx('course_outline_topics').where({ outline_id: existing.id }).del()
      if (input.topics.length > 0) {
        await trx('course_outline_topics').insert(
          input.topics.map((t) => ({ outline_id: existing.id, week_number: t.weekNumber, title: t.title, description: t.description }))
        )
      }
    })
    return this.getOutline(groupId, context.universityId)
  },

  async resolveAITopic(groupId: string, universityId: string): Promise<string> {
    const outline = await this.getOutline(groupId, universityId)
    if (outline) {
      const currentWeek = getCurrentISOWeek()
      const weekTopic = outline.topics.find((t) => t.weekNumber === currentWeek)
      if (weekTopic) return weekTopic.title
    }
    const group = await db('groups').where({ id: groupId, university_id: universityId }).first()
    return group?.ai_settings?.subject ?? group?.name ?? 'General Studies'
  },
}
```

Note: `assertGroupAdminAccess`/`assertMemberAccess` are imported from `groups/service.ts` — if these helpers are private (not exported) in the current file, add `export` to their declarations as part of this task rather than duplicating the logic.

- [ ] **Step 6: Write `academic/controller.ts` and `academic/router.ts`**

```ts
// apps/api/src/modules/academic/controller.ts
import { asyncHandler } from '../../utils/asyncHandler'
import { sendSuccess } from '../../utils/response'
import { courseOutlineService } from './course-outline.service'

export const getCourseOutline = asyncHandler(async (req, res) => {
  const outline = await courseOutlineService.getOutline(req.params.groupId, req.university.id)
  sendSuccess(res, outline)
})

export const createCourseOutline = asyncHandler(async (req, res) => {
  const context = { userId: req.user.userId, universityId: req.university.id, role: req.user.role }
  const outline = await courseOutlineService.createOutline(context, req.params.groupId, req.body)
  sendSuccess(res, outline, 201)
})

export const replaceCourseOutline = asyncHandler(async (req, res) => {
  const context = { userId: req.user.userId, universityId: req.university.id, role: req.user.role }
  const outline = await courseOutlineService.replaceOutline(context, req.params.groupId, req.body)
  sendSuccess(res, outline)
})

export const updateAssessments = asyncHandler(async (req, res) => {
  const context = { userId: req.user.userId, universityId: req.university.id, role: req.user.role }
  const outline = await courseOutlineService.updateAssessments(context, req.params.groupId, req.body)
  sendSuccess(res, outline)
})

export const updateTopics = asyncHandler(async (req, res) => {
  const context = { userId: req.user.userId, universityId: req.university.id, role: req.user.role }
  const outline = await courseOutlineService.updateTopics(context, req.params.groupId, req.body)
  sendSuccess(res, outline)
})
```

Match `req.user`/`req.university` field access to whatever shape `groups/controller.ts` actually uses (confirm by reading it) — the snippet above assumes `req.user.userId` and `req.user.role` per the JWT payload documented in `CLAUDE.md` (`{ userId, universityId, role }`), and `req.university.id` per the `resolveUniversity` middleware convention.

```ts
// apps/api/src/modules/academic/router.ts
import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { resolveUniversity } from '../../middleware/resolveUniversity'
import { validate, validateRequest } from '../../middleware/validate'
import {
  CreateCourseOutlineSchema, UpdateAssessmentsSchema, UpdateTopicsSchema,
} from './schema'
import {
  getCourseOutline, createCourseOutline, replaceCourseOutline, updateAssessments, updateTopics,
} from './controller'

export const academicRouter = Router({ mergeParams: true })
academicRouter.use(requireAuth, resolveUniversity)

academicRouter.get('/:groupId/course-outline', getCourseOutline)
academicRouter.post('/:groupId/course-outline', validate(CreateCourseOutlineSchema), createCourseOutline)
academicRouter.put('/:groupId/course-outline', validate(CreateCourseOutlineSchema), replaceCourseOutline)
academicRouter.patch('/:groupId/course-outline/assessments', validate(UpdateAssessmentsSchema), updateAssessments)
academicRouter.patch('/:groupId/course-outline/topics', validate(UpdateTopicsSchema), updateTopics)
```

```ts
// apps/api/src/modules/academic/index.ts
export { academicRouter } from './router'
```

- [ ] **Step 7: Mount the router in `app.ts`**

Read `apps/api/src/app.ts` to find where `groupsRouter` is mounted (e.g. `app.use('/api/v1/groups', groupsRouter)`), and mount `academicRouter` at the same base path so `:groupId` params line up:

```ts
import { academicRouter } from './modules/academic'
app.use('/api/v1/groups', academicRouter)
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx pnpm --filter api test src/modules/academic/course-outline.service.test.ts`
Expected: PASS.

- [ ] **Step 9: Typecheck and lint**

```bash
npx pnpm --filter api typecheck && npx pnpm --filter api lint
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/modules/academic apps/api/src/app.ts
git commit -m "feat(api): add academic module with course outline CRUD and AI topic resolution"
```

---

### Task 14: Frontend — `CourseOutlineForm.tsx`

**Files:**
- Create: `apps/web/src/features/groups/academic/CourseOutlineForm.tsx`
- Modify: `apps/web/src/features/groups/hooks/useGroupExtended.ts`
- Modify: `apps/web/src/features/groups/types.ts`
- Test: `apps/web/src/features/groups/academic/CourseOutlineForm.test.tsx`

**Interfaces:**
- Consumes: `GET/POST/PUT /api/v1/groups/:groupId/course-outline` (Task 13).

- [ ] **Step 1: Add TS types to `types.ts`**

```ts
export interface CourseOutlineAssessment {
  id?: string
  categoryName: string
  fullMarks: number
  weightPercent: number
  totalGiven: number
  bestNCounted: number
  displayOrder: number
}

export interface CourseOutlineTopic {
  id?: string
  weekNumber: number
  title: string
  description?: string
}

export interface CourseOutline {
  id: string
  groupId: string
  courseCode?: string
  courseTitle: string
  creditHours?: number | null
  trimester?: string
  description?: string
  gradingScale: 'uiu' | 'ugc' | 'custom'
  customScaleJson?: unknown
  assessments: CourseOutlineAssessment[]
  topics: CourseOutlineTopic[]
}
```

- [ ] **Step 2: Add query/mutation hooks to `useGroupExtended.ts`**

Following the exact `useSharedNotes`/`useCreateSharedNote` pattern (query key builder + `useQuery` + `useMutation` with `invalidateQueries` in `onSuccess`):

```ts
export const courseOutlineKey = (groupId: string) => ['groups', groupId, 'course-outline'] as const

export function useCourseOutline(groupId: string) {
  return useQuery({
    queryKey: courseOutlineKey(groupId),
    queryFn: () => api.get(`/groups/${groupId}/course-outline`).then((r) => r.data.data),
    enabled: !!groupId,
  })
}

export function useSaveCourseOutline(groupId: string, mode: 'create' | 'replace') {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: unknown) =>
      mode === 'create'
        ? api.post(`/groups/${groupId}/course-outline`, input).then((r) => r.data.data)
        : api.put(`/groups/${groupId}/course-outline`, input).then((r) => r.data.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: courseOutlineKey(groupId) }),
  })
}
```

- [ ] **Step 3: Write the failing test**

```tsx
// apps/web/src/features/groups/academic/CourseOutlineForm.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { CourseOutlineForm } from './CourseOutlineForm'
import { renderWithQueryClient } from '@/tests/renderWithQueryClient' // existing test util per repo MSW/RTL conventions

describe('CourseOutlineForm', () => {
  it('shows a red weight-sum indicator when assessments do not sum to 100', async () => {
    renderWithQueryClient(<CourseOutlineForm groupId="g1" />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/course title/i), 'Data Structures')
    await user.click(screen.getByRole('button', { name: /add assessment/i }))
    await user.type(screen.getByLabelText(/weight percent/i), '50')

    expect(screen.getByText(/50%/)).toHaveStyle({ color: expect.stringContaining('var(--') })
    expect(screen.getByTestId('weight-sum-indicator')).toHaveAttribute('data-valid', 'false')
  })

  it('enables submit only when weight sums to 100', async () => {
    renderWithQueryClient(<CourseOutlineForm groupId="g1" />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/course title/i), 'Data Structures')
    await user.click(screen.getByRole('button', { name: /add assessment/i }))
    await user.type(screen.getByLabelText(/weight percent/i), '100')

    expect(screen.getByRole('button', { name: /save course outline/i })).toBeEnabled()
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx pnpm --filter web test src/features/groups/academic/CourseOutlineForm.test.tsx`
Expected: FAIL — component doesn't exist.

- [ ] **Step 5: Implement `CourseOutlineForm.tsx`**

```tsx
// apps/web/src/features/groups/academic/CourseOutlineForm.tsx
import { useState } from 'react'
import { useCourseOutline, useSaveCourseOutline } from '../hooks/useGroupExtended'
import type { CourseOutlineAssessment, CourseOutlineTopic } from '../types'

interface CourseOutlineFormProps {
  groupId: string
}

export function CourseOutlineForm({ groupId }: CourseOutlineFormProps) {
  const { data: outline } = useCourseOutline(groupId)
  const save = useSaveCourseOutline(groupId, outline ? 'replace' : 'create')

  const [courseTitle, setCourseTitle] = useState(outline?.courseTitle ?? '')
  const [gradingScale, setGradingScale] = useState<'uiu' | 'ugc' | 'custom'>(outline?.gradingScale ?? 'uiu')
  const [assessments, setAssessments] = useState<CourseOutlineAssessment[]>(outline?.assessments ?? [])
  const [topics, setTopics] = useState<CourseOutlineTopic[]>(outline?.topics ?? [])

  const weightSum = assessments.reduce((sum, a) => sum + (a.weightPercent || 0), 0)
  const weightValid = Math.abs(weightSum - 100) < 0.01

  function addAssessment() {
    setAssessments((prev) => [
      ...prev,
      { categoryName: '', fullMarks: 0, weightPercent: 0, totalGiven: 1, bestNCounted: 1, displayOrder: prev.length + 1 },
    ])
  }

  function updateAssessment(index: number, patch: Partial<CourseOutlineAssessment>) {
    setAssessments((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)))
  }

  function removeAssessment(index: number) {
    setAssessments((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit() {
    await save.mutateAsync({ courseTitle, gradingScale, assessments, topics })
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); void handleSubmit() }} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span>Course title</span>
        <input
          aria-label="Course title"
          value={courseTitle}
          onChange={(e) => setCourseTitle(e.target.value)}
          className="rounded-[var(--r-md)] border-[0.5px] px-3 py-2"
          style={{ borderColor: 'var(--border-default)', background: 'var(--surface-card)' }}
        />
      </label>

      <div className="flex flex-col gap-2">
        {assessments.map((a, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input
              aria-label="Category name"
              value={a.categoryName}
              onChange={(e) => updateAssessment(i, { categoryName: e.target.value })}
            />
            <input
              aria-label="Weight percent"
              type="number"
              value={a.weightPercent}
              onChange={(e) => updateAssessment(i, { weightPercent: Number(e.target.value) })}
            />
            <span>Count best {a.bestNCounted} of {a.totalGiven} given</span>
            <button type="button" onClick={() => removeAssessment(i)}>Remove</button>
          </div>
        ))}
        <button type="button" onClick={addAssessment}>Add assessment</button>
      </div>

      <div
        data-testid="weight-sum-indicator"
        data-valid={weightValid}
        style={{ color: weightValid ? 'var(--uc-green)' : 'var(--uc-red)' }}
      >
        Total weight: {weightSum}%
      </div>

      <button type="submit" disabled={!weightValid || !courseTitle} className="rounded-[var(--r-pill)] px-4 py-2">
        Save course outline
      </button>
    </form>
  )
}
```

Confirm `var(--uc-green)`/`var(--uc-red)` are the actual token names in `apps/web/src/styles/tokens.css` before using them — substitute the real semantic-color token names if different, since the design system rule forbids raw hex.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx pnpm --filter web test src/features/groups/academic/CourseOutlineForm.test.tsx`
Expected: PASS.

- [ ] **Step 7: Typecheck and lint**

```bash
npx pnpm --filter web typecheck && npx pnpm --filter web lint
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/features/groups/academic/CourseOutlineForm.tsx apps/web/src/features/groups/academic/CourseOutlineForm.test.tsx apps/web/src/features/groups/hooks/useGroupExtended.ts apps/web/src/features/groups/types.ts
git commit -m "feat(web): add course outline form with weight-sum validation"
```

---

# Phase 4 — Gradebook

### Task 15: Migration `094_create_academic_lms_tables.ts` (Part A — Gradebook)

**Files:**
- Create: `apps/api/src/database/migrations/094_create_academic_lms_tables.ts`

**Interfaces:**
- Produces: table `gradebook_entries` — consumed by Task 16, Task 17.

- [ ] **Step 1: Write the migration (gradebook portion only — modules/assignments are appended in Task 19 within the same file since the spec treats them as one migration)**

```ts
// apps/api/src/database/migrations/094_create_academic_lms_tables.ts
import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('gradebook_entries', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE')
    table.uuid('university_id').notNullable().references('id').inTable('universities').onDelete('CASCADE')
    table.uuid('student_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.uuid('assessment_id').notNullable().references('id').inTable('course_outline_assessments').onDelete('CASCADE')
    table.integer('instance_number').notNullable().defaultTo(1)
    table.decimal('marks_obtained', 6, 2)
    table.uuid('graded_by').references('id').inTable('users').onDelete('SET NULL')
    table.timestamp('graded_at', { useTz: true })
    table.text('notes')
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.unique(['group_id', 'student_id', 'assessment_id', 'instance_number'])
  })

  await knex.schema.alterTable('gradebook_entries', (table) => {
    table.index(['group_id', 'student_id'], 'gradebook_group_student_idx')
    table.index(['assessment_id', 'instance_number'], 'gradebook_assessment_idx')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('gradebook_entries')
}
```

- [ ] **Step 2: Run the migration**

```bash
npx pnpm --filter api db:migrate
```

Expected: `Batch N run: 1 migrations`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/database/migrations/094_create_academic_lms_tables.ts
git commit -m "feat(api): add gradebook_entries table"
```

(Task 19 will `git add` further changes to this same migration file to append modules/assignments/submissions tables — do not create a separate migration number for them, per spec §15's single-migration grouping.)

---

### Task 16: `calculateBestN`, `getLetterGrade`, `gradebook.service.ts` + routes

**Files:**
- Create: `apps/api/src/modules/academic/gradebook.service.ts`
- Modify: `apps/api/src/modules/academic/controller.ts`
- Modify: `apps/api/src/modules/academic/router.ts`
- Modify: `apps/api/src/modules/academic/schema.ts`
- Test: `apps/api/src/modules/academic/gradebook.service.test.ts`

**Interfaces:**
- Consumes: `gradebook_entries` (Task 15), `courseOutlineService.getOutline` (Task 13).
- Produces: `calculateBestN(marks, bestN)`, `getLetterGrade(percentage, scale)`, `gradebookService.getGradebook(context, groupId)`, `gradebookService.upsertEntries(context, groupId, entries)`, `gradebookService.getMyGradeCard(context, groupId)`, `gradebookService.getStudentGradeCard(context, groupId, studentId)` — consumed by Task 18 (frontend).

- [ ] **Step 1: Write the failing test for the pure calculation functions**

```ts
// apps/api/src/modules/academic/gradebook.service.test.ts
import { describe, it, expect } from 'vitest'
import { calculateBestN, getLetterGrade } from './gradebook.service'

describe('calculateBestN', () => {
  it('returns null when all marks are null', () => {
    expect(calculateBestN([null, null], 1)).toBeNull()
  })

  it('returns the average of the top N when fewer entries than N', () => {
    expect(calculateBestN([10, 15], 3)).toBe(12.5)
  })

  it('returns the average of the top N ignoring nulls', () => {
    expect(calculateBestN([10, null, 20, 15, null], 2)).toBe(17.5)
  })

  it('handles all-equal marks', () => {
    expect(calculateBestN([10, 10, 10, 10], 2)).toBe(10)
  })
})

const UIU_SCALE = [
  { minPercent: 90, letter: 'A', point: 4.0 },
  { minPercent: 86, letter: 'A-', point: 3.67 },
  { minPercent: 82, letter: 'B+', point: 3.33 },
  { minPercent: 0, letter: 'F', point: 0 },
]

describe('getLetterGrade', () => {
  it('returns the correct boundary grade at exactly 90', () => {
    expect(getLetterGrade(90, UIU_SCALE)).toEqual({ letter: 'A', point: 4.0 })
  })

  it('returns the next-lower grade at 89.99', () => {
    expect(getLetterGrade(89.99, UIU_SCALE)).toEqual({ letter: 'A-', point: 3.67 })
  })

  it('returns F for very low percentages', () => {
    expect(getLetterGrade(10, UIU_SCALE)).toEqual({ letter: 'F', point: 0 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx pnpm --filter api test src/modules/academic/gradebook.service.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement pure functions + service**

```ts
// apps/api/src/modules/academic/gradebook.service.ts
import { db } from '../../database/db'
import { notFound, forbidden } from '../../utils/errors'
import { assertGroupAdminAccess, assertMemberAccess } from '../groups/service'
import { courseOutlineService } from './course-outline.service'

export function calculateBestN(marks: (number | null)[], bestN: number): number | null {
  const entered = marks.filter((m): m is number => m !== null)
  if (entered.length === 0) return null
  const sorted = [...entered].sort((a, b) => b - a)
  const top = sorted.slice(0, bestN)
  return top.reduce((sum, m) => sum + m, 0) / top.length
}

const UIU_SCALE = [
  { minPercent: 90, letter: 'A', point: 4.0 },
  { minPercent: 86, letter: 'A-', point: 3.67 },
  { minPercent: 82, letter: 'B+', point: 3.33 },
  { minPercent: 78, letter: 'B', point: 3.0 },
  { minPercent: 74, letter: 'B-', point: 2.67 },
  { minPercent: 70, letter: 'C+', point: 2.33 },
  { minPercent: 66, letter: 'C', point: 2.0 },
  { minPercent: 62, letter: 'C-', point: 1.67 },
  { minPercent: 58, letter: 'D+', point: 1.33 },
  { minPercent: 55, letter: 'D', point: 1.0 },
  { minPercent: 0, letter: 'F', point: 0 },
]

const UGC_SCALE = [
  { minPercent: 80, letter: 'A+', point: 4.0 },
  { minPercent: 75, letter: 'A', point: 3.75 },
  { minPercent: 70, letter: 'A-', point: 3.5 },
  { minPercent: 65, letter: 'B+', point: 3.25 },
  { minPercent: 60, letter: 'B', point: 3.0 },
  { minPercent: 55, letter: 'B-', point: 2.75 },
  { minPercent: 50, letter: 'C+', point: 2.5 },
  { minPercent: 45, letter: 'C', point: 2.25 },
  { minPercent: 40, letter: 'D', point: 2.0 },
  { minPercent: 0, letter: 'F', point: 0 },
]

export function getLetterGrade(
  percentage: number,
  scale: Array<{ minPercent: number; letter: string; point: number }>
): { letter: string; point: number } | null {
  const sorted = [...scale].sort((a, b) => b.minPercent - a.minPercent)
  const match = sorted.find((entry) => percentage >= entry.minPercent)
  return match ? { letter: match.letter, point: match.point } : null
}

function resolveScale(outline: { gradingScale: string; customScaleJson: unknown }) {
  if (outline.gradingScale === 'ugc') return UGC_SCALE
  if (outline.gradingScale === 'custom') return (outline.customScaleJson as typeof UIU_SCALE) ?? UIU_SCALE
  return UIU_SCALE
}

async function buildColumns(outline) {
  return outline.assessments.map((a) => ({
    assessmentId: a.id,
    categoryName: a.categoryName,
    fullMarks: a.fullMarks,
    bestNCounted: a.bestNCounted,
    totalGiven: a.totalGiven,
    label: `${a.categoryName} Avg (Best ${a.bestNCounted}/${a.totalGiven})`,
  }))
}

export const gradebookService = {
  async autoPopulateGradebook(groupId: string, universityId: string, studentId: string) {
    const outline = await courseOutlineService.getOutline(groupId, universityId)
    if (!outline) return
    const rows = []
    for (const assessment of outline.assessments) {
      for (let instance = 1; instance <= assessment.totalGiven; instance++) {
        rows.push({
          group_id: groupId,
          university_id: universityId,
          student_id: studentId,
          assessment_id: assessment.id,
          instance_number: instance,
        })
      }
    }
    if (rows.length > 0) {
      await db('gradebook_entries').insert(rows).onConflict(['group_id', 'student_id', 'assessment_id', 'instance_number']).ignore()
    }
  },

  async getGradebook(context, groupId: string) {
    await assertGroupAdminAccess(context, groupId)
    const outline = await courseOutlineService.getOutline(groupId, context.universityId)
    if (!outline) throw notFound('Course outline must be created before viewing the gradebook')

    const members = await db('group_members')
      .join('users', 'users.id', 'group_members.user_id')
      .join('profiles', 'profiles.user_id', 'users.id')
      .where({ 'group_members.group_id': groupId })
      .select('users.id', 'users.full_name', 'users.avatar_url', 'profiles.department')

    const entries = await db('gradebook_entries').where({ group_id: groupId })
    const scale = resolveScale(outline)

    const rows = members.map((student) => {
      const studentEntries = entries.filter((e) => e.student_id === student.id)
      const calculated: Record<string, number | null> = {}
      let totalObtained = 0
      let totalFullMarks = 0
      let anyEntered = false

      for (const assessment of outline.assessments) {
        const marksForAssessment = studentEntries
          .filter((e) => e.assessment_id === assessment.id)
          .map((e) => (e.marks_obtained === null ? null : Number(e.marks_obtained)))
        const avg = calculateBestN(marksForAssessment, assessment.bestNCounted)
        calculated[`${assessment.categoryName}_avg`] = avg
        if (avg !== null) {
          anyEntered = true
          totalObtained += (avg / assessment.fullMarks) * assessment.weightPercent
        }
        totalFullMarks += assessment.weightPercent
      }

      const percentage = anyEntered ? totalObtained : null
      const grade = percentage !== null ? getLetterGrade(percentage, scale) : null

      return {
        student: { id: student.id, fullName: student.full_name, avatarUrl: student.avatar_url, department: student.department },
        cells: Object.fromEntries(
          studentEntries.map((e) => [
            `${e.assessment_id}_${e.instance_number}`,
            { marksObtained: e.marks_obtained === null ? null : Number(e.marks_obtained), graded: e.marks_obtained !== null },
          ])
        ),
        calculated: {
          ...calculated,
          totalObtained: percentage,
          totalFullMarks: 100,
          percentage,
          letterGrade: grade?.letter ?? null,
          gradePoint: grade?.point ?? null,
        },
      }
    })

    return { outline, columns: await buildColumns(outline), rows }
  },

  async upsertEntries(context, groupId: string, entries: Array<{ studentId: string; assessmentId: string; instanceNumber: number; marksObtained: number | null; notes?: string }>) {
    await assertGroupAdminAccess(context, groupId)
    await db.transaction(async (trx) => {
      for (const entry of entries) {
        await trx('gradebook_entries')
          .insert({
            group_id: groupId,
            university_id: context.universityId,
            student_id: entry.studentId,
            assessment_id: entry.assessmentId,
            instance_number: entry.instanceNumber,
            marks_obtained: entry.marksObtained,
            notes: entry.notes,
            graded_by: context.userId,
            graded_at: entry.marksObtained !== null ? trx.fn.now() : null,
          })
          .onConflict(['group_id', 'student_id', 'assessment_id', 'instance_number'])
          .merge({ marks_obtained: entry.marksObtained, notes: entry.notes, graded_by: context.userId, graded_at: entry.marksObtained !== null ? trx.fn.now() : null, updated_at: trx.fn.now() })
      }
    })
    return this.getGradebook(context, groupId)
  },

  async getMyGradeCard(context, groupId: string) {
    return this.getStudentGradeCard(context, groupId, context.userId)
  },

  async getStudentGradeCard(context, groupId: string, studentId: string) {
    if (context.userId !== studentId) {
      await assertGroupAdminAccess(context, groupId)
    } else {
      await assertMemberAccess(context, groupId)
    }
    const full = await this.getGradebook({ ...context, userId: context.userId, role: 'faculty' }, groupId).catch(() => null)
    // Reuse getGradebook's row-building by fetching directly rather than bypassing the admin check twice:
    const outline = await courseOutlineService.getOutline(groupId, context.universityId)
    if (!outline) throw notFound('Course outline must be created before viewing a grade card')
    const entries = await db('gradebook_entries').where({ group_id: groupId, student_id: studentId })
    const scale = resolveScale(outline)
    const calculated: Record<string, number | null> = {}
    let totalObtained = 0
    let anyEntered = false
    for (const assessment of outline.assessments) {
      const marks = entries.filter((e) => e.assessment_id === assessment.id).map((e) => (e.marks_obtained === null ? null : Number(e.marks_obtained)))
      const avg = calculateBestN(marks, assessment.bestNCounted)
      calculated[`${assessment.categoryName}_avg`] = avg
      if (avg !== null) {
        anyEntered = true
        totalObtained += (avg / assessment.fullMarks) * assessment.weightPercent
      }
    }
    const percentage = anyEntered ? totalObtained : null
    const grade = percentage !== null ? getLetterGrade(percentage, scale) : null
    return { calculated: { ...calculated, percentage, letterGrade: grade?.letter ?? null, gradePoint: grade?.point ?? null } }
  },
}
```

The `getMyGradeCard`/`getStudentGradeCard` implementation deliberately does not reuse `getGradebook`'s admin-gated row loop (the unused `full` variable above should be removed) — delete that dead line during Step 3, it was left in only to show the reasoning; the final file must not contain unused variables (would fail lint's no-unused-vars rule).

- [ ] **Step 4: Remove the dead `full` variable before saving the file** (see note above — clean this up as part of writing the file, not a separate step in the running plan).

- [ ] **Step 5: Add schema + routes**

In `academic/schema.ts`, add:

```ts
export const UpsertGradebookEntriesSchema = z.object({
  entries: z.array(z.object({
    studentId: z.string().uuid(),
    assessmentId: z.string().uuid(),
    instanceNumber: z.number().int().min(1),
    marksObtained: z.number().nullable(),
    notes: z.string().optional(),
  })),
})
```

In `academic/controller.ts`, add handlers for `getGradebook`, `upsertGradebookEntries`, `getMyGradeCard`, `getStudentGradeCard`, following the same `asyncHandler` + `sendSuccess` pattern as Task 13's handlers.

In `academic/router.ts`, add:

```ts
academicRouter.get('/:groupId/gradebook', getGradebook)
academicRouter.put('/:groupId/gradebook/entries', validate(UpsertGradebookEntriesSchema), upsertGradebookEntries)
academicRouter.get('/:groupId/gradebook/me', getMyGradeCard)
academicRouter.get('/:groupId/gradebook/students/:studentId', getStudentGradeCard)
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx pnpm --filter api test src/modules/academic/gradebook.service.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 7: Typecheck and lint**

```bash
npx pnpm --filter api typecheck && npx pnpm --filter api lint
```

Expected: PASS — confirm no unused-variable lint errors from the `full` cleanup in Step 4.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/academic/gradebook.service.ts apps/api/src/modules/academic/gradebook.service.test.ts apps/api/src/modules/academic/schema.ts apps/api/src/modules/academic/controller.ts apps/api/src/modules/academic/router.ts
git commit -m "feat(api): add gradebook service with best-N calculation and letter grades"
```

---

### Task 17: Auto-populate gradebook on group join

**Files:**
- Modify: `apps/api/src/modules/groups/service.ts`
- Test: `apps/api/src/modules/groups/service.test.ts`

**Interfaces:**
- Consumes: `gradebookService.autoPopulateGradebook` (Task 16).
- Produces: no new exports — wires the existing join/approve flows to the gradebook.

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/modules/groups/service.test.ts (add)
import { gradebookService } from '../academic/gradebook.service'
import { courseOutlineService } from '../academic/course-outline.service'

describe('groupService — gradebook auto-population on join', () => {
  it('creates gradebook_entries rows when a student joins an academic group with a course outline', async () => {
    const universityId = await createUniversity()
    const faculty = await createUser({ universityId, role: 'faculty' })
    const student = await createUser({ universityId, role: 'student' })
    const group = await groupService.createGroup(
      { userId: faculty.id, universityId, role: 'faculty' },
      { name: 'CS101', type: 'academic', is_private: false }
    )
    await courseOutlineService.createOutline(
      { userId: faculty.id, universityId, role: 'faculty' },
      group.id,
      {
        courseTitle: 'X',
        gradingScale: 'uiu',
        assessments: [{ categoryName: 'CT', fullMarks: 20, weightPercent: 100, totalGiven: 2, bestNCounted: 1, displayOrder: 1 }],
      }
    )

    await groupService.joinGroup({ userId: student.id, universityId, role: 'student' }, group.id)

    const entries = await db('gradebook_entries').where({ group_id: group.id, student_id: student.id })
    expect(entries).toHaveLength(2) // totalGiven = 2 instances
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx pnpm --filter api test src/modules/groups/service.test.ts -t "gradebook auto-population"`
Expected: FAIL — no rows created, since the join flow doesn't call `autoPopulateGradebook` yet.

- [ ] **Step 3: Wire the hook into `joinOrRequest` (direct-join path) and the approve path**

In `apps/api/src/modules/groups/service.ts`, import `gradebookService` at the top (from `../academic/gradebook.service` — this creates a dependency from `groups` → `academic`; confirm this doesn't create a circular import back from `academic` into `groups/service.ts` beyond the already-planned `assertGroupAdminAccess`/`assertMemberAccess` imports, which is a one-directional `academic → groups` edge, safe alongside the new `groups → academic` edge for this specific call since neither module imports the other's default export cyclically at the top level — if the bundler complains, use a dynamic `await import('../academic/gradebook.service')` inside the hook call instead):

```ts
import { gradebookService } from '../academic/gradebook.service'
```

At the end of the direct-join transaction (service.ts:388-406, after the `group_members` insert commits), add:

```ts
const group = await db('groups').where({ id: groupId }).first('type')
if (group?.type === 'academic') {
  await gradebookService.autoPopulateGradebook(groupId, context.universityId, context.userId)
}
```

At the end of the `reviewJoinRequest` approve branch (service.ts:466-494, after the `group_members` insert and before/after the `notificationQueue.add` call), add the same pattern using the request's target user ID and the group's `type`/`university_id`:

```ts
const group = await db('groups').where({ id: groupId }).first('type', 'university_id')
if (group?.type === 'academic') {
  await gradebookService.autoPopulateGradebook(groupId, group.university_id, request.user_id)
}
```

Confirm the exact variable name holding the join-request's target user ID (likely `request.user_id` or similar) by reading the `reviewJoinRequest` method body directly before finalizing this edit.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx pnpm --filter api test src/modules/groups/service.test.ts`
Expected: PASS, including all pre-existing tests (regression check for `joinGroup`/`reviewJoinRequest`).

- [ ] **Step 5: Typecheck and lint**

```bash
npx pnpm --filter api typecheck && npx pnpm --filter api lint
```

Expected: PASS — verify no circular-import warning from the `groups → academic → groups` edge; switch to the dynamic-import fallback noted in Step 3 if one appears.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/groups/service.ts apps/api/src/modules/groups/service.test.ts
git commit -m "feat(api): auto-populate gradebook entries when a student joins an academic group"
```

---

### Task 18: Frontend — `GradebookPanel.tsx` + `StudentGradeCard.tsx`

**Files:**
- Create: `apps/web/src/features/groups/academic/GradebookPanel.tsx`
- Create: `apps/web/src/features/groups/academic/StudentGradeCard.tsx`
- Modify: `apps/web/src/features/groups/hooks/useGroupExtended.ts`
- Modify: `apps/web/src/features/groups/types.ts`
- Test: `apps/web/src/features/groups/academic/GradebookPanel.test.tsx`

**Interfaces:**
- Consumes: `GET/PUT /api/v1/groups/:groupId/gradebook*` (Task 16).

- [ ] **Step 1: Add types to `types.ts`**

```ts
export interface GradebookColumn {
  assessmentId: string
  categoryName: string
  fullMarks: number
  bestNCounted: number
  totalGiven: number
  label: string
}

export interface GradebookCell {
  marksObtained: number | null
  graded: boolean
}

export interface GradebookRow {
  student: { id: string; fullName: string; avatarUrl?: string; department?: string }
  cells: Record<string, GradebookCell>
  calculated: Record<string, number | string | null>
}

export interface Gradebook {
  outline: CourseOutline
  columns: GradebookColumn[]
  rows: GradebookRow[]
}
```

- [ ] **Step 2: Add hooks**

```ts
export const gradebookKey = (groupId: string) => ['groups', groupId, 'gradebook'] as const
export const myGradeCardKey = (groupId: string) => ['groups', groupId, 'gradebook', 'me'] as const

export function useGradebook(groupId: string) {
  return useQuery({
    queryKey: gradebookKey(groupId),
    queryFn: () => api.get(`/groups/${groupId}/gradebook`).then((r) => r.data.data),
    enabled: !!groupId,
  })
}

export function useUpsertGradebookEntries(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (entries: unknown[]) => api.put(`/groups/${groupId}/gradebook/entries`, { entries }).then((r) => r.data.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: gradebookKey(groupId) }),
  })
}

export function useMyGradeCard(groupId: string) {
  return useQuery({
    queryKey: myGradeCardKey(groupId),
    queryFn: () => api.get(`/groups/${groupId}/gradebook/me`).then((r) => r.data.data),
    enabled: !!groupId,
  })
}
```

- [ ] **Step 3: Write the failing test**

```tsx
// apps/web/src/features/groups/academic/GradebookPanel.test.tsx
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { GradebookPanel } from './GradebookPanel'
import { renderWithQueryClient } from '@/tests/renderWithQueryClient'
import { server } from '@/tests/msw/server'
import { rest } from 'msw'

describe('GradebookPanel', () => {
  it('renders student rows with editable cells and saves on blur', async () => {
    server.use(
      rest.get('*/groups/g1/gradebook', (req, res, ctx) =>
        res(ctx.json({ data: {
          outline: { gradingScale: 'uiu' },
          columns: [{ assessmentId: 'a1', categoryName: 'CT', fullMarks: 20, bestNCounted: 1, totalGiven: 1, label: 'CT-1' }],
          rows: [{ student: { id: 's1', fullName: 'Jane Doe' }, cells: { a1_1: { marksObtained: null, graded: false } }, calculated: { percentage: null, letterGrade: null } }],
        } }))
      ),
      rest.put('*/groups/g1/gradebook/entries', (req, res, ctx) => res(ctx.json({ data: {} })))
    )

    renderWithQueryClient(<GradebookPanel groupId="g1" />)
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument())

    const cell = screen.getByLabelText(/CT-1 for Jane Doe/i)
    await userEvent.click(cell)
    await userEvent.type(cell, '18')
    await userEvent.tab()

    await waitFor(() => expect(cell).toHaveValue(18))
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx pnpm --filter web test src/features/groups/academic/GradebookPanel.test.tsx`
Expected: FAIL — component doesn't exist.

- [ ] **Step 5: Implement `GradebookPanel.tsx`**

```tsx
// apps/web/src/features/groups/academic/GradebookPanel.tsx
import { useState } from 'react'
import { useGradebook, useUpsertGradebookEntries } from '../hooks/useGroupExtended'

interface GradebookPanelProps {
  groupId: string
}

export function GradebookPanel({ groupId }: GradebookPanelProps) {
  const { data: gradebook, isLoading } = useGradebook(groupId)
  const upsert = useUpsertGradebookEntries(groupId)
  const [pendingValue, setPendingValue] = useState<{ studentId: string; assessmentId: string; value: string } | null>(null)

  if (isLoading || !gradebook) return <div>Loading gradebook…</div>

  async function commitCell(studentId: string, assessmentId: string, value: string) {
    const marksObtained = value === '' ? null : Number(value)
    await upsert.mutateAsync([{ studentId, assessmentId, instanceNumber: 1, marksObtained }])
    setPendingValue(null)
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr>
            <th className="sticky left-0" style={{ background: 'var(--surface-card)' }}>Student</th>
            {gradebook.columns.map((col) => (
              <th key={col.assessmentId}>{col.label}</th>
            ))}
            <th>Grade</th>
          </tr>
        </thead>
        <tbody>
          {gradebook.rows.map((row) => (
            <tr key={row.student.id}>
              <td className="sticky left-0" style={{ background: 'var(--surface-card)' }}>{row.student.fullName}</td>
              {gradebook.columns.map((col) => {
                const cellKey = `${col.assessmentId}_1`
                const cell = row.cells[cellKey]
                const isPending = pendingValue?.studentId === row.student.id && pendingValue?.assessmentId === col.assessmentId
                return (
                  <td key={col.assessmentId}>
                    <input
                      aria-label={`${col.label} for ${row.student.fullName}`}
                      type="number"
                      defaultValue={cell?.marksObtained ?? ''}
                      onChange={(e) => setPendingValue({ studentId: row.student.id, assessmentId: col.assessmentId, value: e.target.value })}
                      onBlur={(e) => void commitCell(row.student.id, col.assessmentId, isPending ? pendingValue!.value : e.target.value)}
                    />
                  </td>
                )
              })}
              <td>{row.calculated.letterGrade ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 6: Implement `StudentGradeCard.tsx`**

```tsx
// apps/web/src/features/groups/academic/StudentGradeCard.tsx
import { useMyGradeCard } from '../hooks/useGroupExtended'

interface StudentGradeCardProps {
  groupId: string
}

export function StudentGradeCard({ groupId }: StudentGradeCardProps) {
  const { data, isLoading } = useMyGradeCard(groupId)
  if (isLoading || !data) return <div>Loading grade card…</div>

  return (
    <div className="rounded-[var(--r-lg)] p-4" style={{ background: 'var(--surface-raised)' }}>
      <p>Percentage: {data.calculated.percentage ?? '—'}%</p>
      <p>Letter grade: {data.calculated.letterGrade ?? '—'}</p>
      <p>Grade point: {data.calculated.gradePoint ?? '—'}</p>
    </div>
  )
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx pnpm --filter web test src/features/groups/academic/GradebookPanel.test.tsx`
Expected: PASS.

- [ ] **Step 8: Typecheck and lint**

```bash
npx pnpm --filter web typecheck && npx pnpm --filter web lint
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/features/groups/academic/GradebookPanel.tsx apps/web/src/features/groups/academic/StudentGradeCard.tsx apps/web/src/features/groups/academic/GradebookPanel.test.tsx apps/web/src/features/groups/hooks/useGroupExtended.ts apps/web/src/features/groups/types.ts
git commit -m "feat(web): add gradebook panel and student grade card"
```

---

**Continued in `docs/superpowers/plans/2026-07-09-academic-lms-part3.md` (Tasks 19–31: Modules & Assignments, AI Settings Panel + Scheduler, File Uploads, Session Notes) — must be read and executed as part of this same plan.**
