import { db } from '../../config/db'
import type { AuthContext } from '../../types/auth'
import { badRequest, forbidden, notFound } from '../../utils/errors'
import { assertGroupAdminAccess, assertMemberAccess } from '../groups/service'
import { areWeekNumbersUnique, isWeightSumValid } from './schema'
import type { CreateCourseOutlineInput, UpdateAssessmentsInput, UpdateTopicsInput } from './schema'

interface OutlineRow {
  id: string
  group_id: string
  university_id: string
  created_by: string | null
  course_code: string | null
  course_title: string
  credit_hours: string | null
  trimester: string | null
  description: string | null
  grading_scale: string
  custom_scale_json: unknown
  created_at: Date
  updated_at: Date
}

interface AssessmentRow {
  id: string
  outline_id: string
  category_name: string
  full_marks: number
  weight_percent: string
  total_given: number
  best_n_counted: number
  display_order: number
}

interface TopicRow {
  id: string
  outline_id: string
  week_number: number
  title: string
  description: string | null
}

export interface CourseOutline {
  id: string
  groupId: string
  courseCode: string | null
  courseTitle: string
  creditHours: number | null
  trimester: string | null
  description: string | null
  gradingScale: string
  customScaleJson: unknown
  assessments: {
    id: string
    categoryName: string
    fullMarks: number
    weightPercent: number
    totalGiven: number
    bestNCounted: number
    displayOrder: number
  }[]
  topics: {
    id: string
    weekNumber: number
    title: string
    description: string | null
  }[]
}

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

function validateAssessments(assessments: { weightPercent: number; totalGiven: number; bestNCounted: number }[]) {
  if (!isWeightSumValid(assessments)) {
    throw badRequest('Sum of weightPercent across all assessments must equal 100')
  }
  for (const a of assessments) {
    if (a.bestNCounted > a.totalGiven) {
      throw badRequest('bestNCounted must be <= totalGiven')
    }
  }
}

function validateTopics(topics: { weekNumber: number }[]) {
  if (!areWeekNumbersUnique(topics)) {
    throw badRequest('Week numbers in topics must be unique')
  }
}

async function assertAcademicGroup(universityId: string, groupId: string) {
  const group = await db<{ type: string }>('groups').select('type').where({ id: groupId, university_id: universityId }).first()
  if (!group) throw notFound('Group not found')
  if (group.type !== 'academic') {
    throw forbidden('Course outlines are only available on academic groups', 'ACADEMIC_GROUP_REQUIRED')
  }
}

async function fetchOutlineRow(groupId: string, universityId: string): Promise<CourseOutline | null> {
  const row = await db<OutlineRow>('academic_course_outlines')
    .where({ group_id: groupId, university_id: universityId })
    .first()
  if (!row) return null
  const assessments = await db<AssessmentRow>('course_outline_assessments')
    .where({ outline_id: row.id })
    .orderBy('display_order')
  const topics = await db<TopicRow>('course_outline_topics').where({ outline_id: row.id }).orderBy('week_number')
  return toOutline(row, assessments, topics)
}

function toOutline(row: OutlineRow, assessments: AssessmentRow[], topics: TopicRow[]): CourseOutline {
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
    topics: topics.map((t) => ({
      id: t.id,
      weekNumber: t.week_number,
      title: t.title,
      description: t.description,
    })),
  }
}

export const courseOutlineService = {
  async getOutline(context: AuthContext, groupId: string): Promise<CourseOutline | null> {
    await assertAcademicGroup(context.universityId, groupId)
    await assertMemberAccess(context, groupId)
    return fetchOutlineRow(groupId, context.universityId)
  },

  async createOutline(
    context: AuthContext,
    groupId: string,
    input: CreateCourseOutlineInput,
  ): Promise<CourseOutline> {
    validateAssessments(input.assessments)
    validateTopics(input.topics)
    await assertAcademicGroup(context.universityId, groupId)
    await assertGroupAdminAccess(context, groupId)
    const existing = await db('academic_course_outlines').where({ group_id: groupId }).first()
    if (existing) throw badRequest('Course outline already exists for this group; use PUT to replace it')

    return db.transaction(async (trx) => {
      const [outline] = await trx<OutlineRow>('academic_course_outlines')
        .insert({
          group_id: groupId,
          university_id: context.universityId,
          created_by: context.userId,
          course_code: input.courseCode,
          course_title: input.courseTitle,
          credit_hours: input.creditHours != null ? String(input.creditHours) : null,
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
        })),
      )

      if (input.topics.length > 0) {
        await trx('course_outline_topics').insert(
          input.topics.map((t) => ({
            outline_id: outline.id,
            week_number: t.weekNumber,
            title: t.title,
            description: t.description,
          })),
        )
      }

      const assessments = await trx<AssessmentRow>('course_outline_assessments')
        .where({ outline_id: outline.id })
        .orderBy('display_order')
      const topics = await trx<TopicRow>('course_outline_topics')
        .where({ outline_id: outline.id })
        .orderBy('week_number')
      return toOutline(outline, assessments, topics)
    })
  },

  async replaceOutline(
    context: AuthContext,
    groupId: string,
    input: CreateCourseOutlineInput,
  ): Promise<CourseOutline | null> {
    validateAssessments(input.assessments)
    validateTopics(input.topics)
    await assertAcademicGroup(context.universityId, groupId)
    await assertGroupAdminAccess(context, groupId)
    const existing = await db<OutlineRow>('academic_course_outlines')
      .where({ group_id: groupId, university_id: context.universityId })
      .first()
    if (!existing) throw notFound('Course outline not found')

    await db.transaction(async (trx) => {
      await trx('academic_course_outlines')
        .where({ id: existing.id })
        .update({
          course_code: input.courseCode,
          course_title: input.courseTitle,
          credit_hours: input.creditHours != null ? String(input.creditHours) : null,
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
        })),
      )
      await trx('course_outline_topics').where({ outline_id: existing.id }).del()
      if (input.topics.length > 0) {
        await trx('course_outline_topics').insert(
          input.topics.map((t) => ({
            outline_id: existing.id,
            week_number: t.weekNumber,
            title: t.title,
            description: t.description,
          })),
        )
      }
    })
    return this.getOutline(context, groupId)
  },

  async updateAssessments(
    context: AuthContext,
    groupId: string,
    input: UpdateAssessmentsInput,
  ): Promise<CourseOutline | null> {
    validateAssessments(input.assessments)
    await assertAcademicGroup(context.universityId, groupId)
    await assertGroupAdminAccess(context, groupId)
    const existing = await db<OutlineRow>('academic_course_outlines')
      .where({ group_id: groupId, university_id: context.universityId })
      .first()
    if (!existing) throw notFound('Course outline not found')

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
        })),
      )
    })
    return this.getOutline(context, groupId)
  },

  async updateTopics(context: AuthContext, groupId: string, input: UpdateTopicsInput): Promise<CourseOutline | null> {
    validateTopics(input.topics)
    await assertAcademicGroup(context.universityId, groupId)
    await assertGroupAdminAccess(context, groupId)
    const existing = await db<OutlineRow>('academic_course_outlines')
      .where({ group_id: groupId, university_id: context.universityId })
      .first()
    if (!existing) throw notFound('Course outline not found')

    await db.transaction(async (trx) => {
      await trx('course_outline_topics').where({ outline_id: existing.id }).del()
      if (input.topics.length > 0) {
        await trx('course_outline_topics').insert(
          input.topics.map((t) => ({
            outline_id: existing.id,
            week_number: t.weekNumber,
            title: t.title,
            description: t.description,
          })),
        )
      }
    })
    return this.getOutline(context, groupId)
  },

  async resolveAITopic(groupId: string, universityId: string): Promise<string> {
    const outline = await fetchOutlineRow(groupId, universityId)
    if (outline) {
      const currentWeek = getCurrentISOWeek()
      const weekTopic = outline.topics.find((t) => t.weekNumber === currentWeek)
      if (weekTopic) return weekTopic.title
    }
    const group = await db<{ ai_settings: Record<string, unknown> | null; name: string }>('groups')
      .where({ id: groupId, university_id: universityId })
      .first()
    const subject = group?.ai_settings?.subject
    if (typeof subject === 'string' && subject.length > 0) return subject
    return group?.name ?? 'General Studies'
  },
}
