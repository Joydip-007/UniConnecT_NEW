import { db } from '../../config/db'
import type { AuthContext } from '../../types/auth'
import { notFound } from '../../utils/errors'
import { assertGroupAdminAccess, assertMemberAccess } from '../groups/service'
import { courseOutlineService, type CourseOutline } from './course-outline.service'

export function calculateBestN(marks: (number | null)[], bestN: number): number | null {
  const entered = marks.filter((m): m is number => m !== null)
  if (entered.length === 0) return null
  const sorted = [...entered].sort((a, b) => b - a)
  const top = sorted.slice(0, bestN)
  return top.reduce((sum, m) => sum + m, 0) / top.length
}

interface GradeScaleEntry {
  minPercent: number
  letter: string
  point: number
}

const UIU_SCALE: GradeScaleEntry[] = [
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

const UGC_SCALE: GradeScaleEntry[] = [
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
  scale: GradeScaleEntry[],
): { letter: string; point: number } | null {
  const sorted = [...scale].sort((a, b) => b.minPercent - a.minPercent)
  const match = sorted.find((entry) => percentage >= entry.minPercent)
  return match ? { letter: match.letter, point: match.point } : null
}

function resolveScale(outline: CourseOutline): GradeScaleEntry[] {
  if (outline.gradingScale === 'ugc') return UGC_SCALE
  if (outline.gradingScale === 'custom') {
    return (outline.customScaleJson as GradeScaleEntry[] | null) ?? UIU_SCALE
  }
  return UIU_SCALE
}

function buildColumns(outline: CourseOutline) {
  return outline.assessments.map((a) => ({
    assessmentId: a.id,
    categoryName: a.categoryName,
    fullMarks: a.fullMarks,
    bestNCounted: a.bestNCounted,
    totalGiven: a.totalGiven,
    label: `${a.categoryName} Avg (Best ${a.bestNCounted}/${a.totalGiven})`,
  }))
}

interface GradebookEntryRow {
  student_id: string
  assessment_id: string
  instance_number: number
  marks_obtained: string | null
}

function calculateOutcome(outline: CourseOutline, entries: GradebookEntryRow[]) {
  const calculated: Record<string, number | null> = {}
  let totalObtained = 0
  let anyEntered = false

  for (const assessment of outline.assessments) {
    const marksForAssessment = entries
      .filter((e) => e.assessment_id === assessment.id)
      .map((e) => (e.marks_obtained === null ? null : Number(e.marks_obtained)))
    const avg = calculateBestN(marksForAssessment, assessment.bestNCounted)
    calculated[`${assessment.categoryName}_avg`] = avg
    if (avg !== null) {
      anyEntered = true
      totalObtained += (avg / assessment.fullMarks) * assessment.weightPercent
    }
  }

  const percentage = anyEntered ? totalObtained : null
  const scale = resolveScale(outline)
  const grade = percentage !== null ? getLetterGrade(percentage, scale) : null

  return {
    calculated: {
      ...calculated,
      totalObtained: percentage,
      totalFullMarks: 100,
      percentage,
      letterGrade: grade?.letter ?? null,
      gradePoint: grade?.point ?? null,
    },
  }
}

export const gradebookService = {
  async autoPopulateGradebook(groupId: string, universityId: string, studentId: string) {
    const context: AuthContext = { userId: studentId, universityId, role: 'student' }
    const outline = await courseOutlineService.getOutline(context, groupId)
    if (!outline) return

    const rows: Record<string, unknown>[] = []
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
      await db('gradebook_entries')
        .insert(rows)
        .onConflict(['group_id', 'student_id', 'assessment_id', 'instance_number'])
        .ignore()
    }
  },

  async getGradebook(context: AuthContext, groupId: string) {
    await assertGroupAdminAccess(context, groupId)
    const outline = await courseOutlineService.getOutline(context, groupId)
    if (!outline) throw notFound('Course outline must be created before viewing the gradebook')

    const members = await db('group_members')
      .join('users', 'users.id', 'group_members.user_id')
      .join('profiles', 'profiles.user_id', 'users.id')
      .where({ 'group_members.group_id': groupId })
      .select('users.id', 'profiles.full_name', 'profiles.avatar_url', 'profiles.department')

    const entries = await db<GradebookEntryRow>('gradebook_entries').where({ group_id: groupId })

    const rows = members.map((student) => {
      const studentEntries = entries.filter((e) => e.student_id === student.id)
      const { calculated } = calculateOutcome(outline, studentEntries)

      return {
        student: {
          id: student.id,
          fullName: student.full_name,
          avatarUrl: student.avatar_url,
          department: student.department,
        },
        cells: Object.fromEntries(
          studentEntries.map((e) => [
            `${e.assessment_id}_${e.instance_number}`,
            {
              marksObtained: e.marks_obtained === null ? null : Number(e.marks_obtained),
              graded: e.marks_obtained !== null,
            },
          ]),
        ),
        calculated,
      }
    })

    return { outline, columns: buildColumns(outline), rows }
  },

  async upsertEntries(
    context: AuthContext,
    groupId: string,
    entries: Array<{
      studentId: string
      assessmentId: string
      instanceNumber: number
      marksObtained: number | null
      notes?: string
    }>,
  ) {
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
          .merge({
            marks_obtained: entry.marksObtained,
            notes: entry.notes,
            graded_by: context.userId,
            graded_at: entry.marksObtained !== null ? trx.fn.now() : null,
            updated_at: trx.fn.now(),
          })
      }
    })
    return this.getGradebook(context, groupId)
  },

  async getMyGradeCard(context: AuthContext, groupId: string) {
    return this.getStudentGradeCard(context, groupId, context.userId)
  },

  async getStudentGradeCard(context: AuthContext, groupId: string, studentId: string) {
    if (context.userId !== studentId) {
      await assertGroupAdminAccess(context, groupId)
    } else {
      await assertMemberAccess(context, groupId)
    }

    const outline = await courseOutlineService.getOutline(context, groupId)
    if (!outline) throw notFound('Course outline must be created before viewing a grade card')

    const entries = await db<GradebookEntryRow>('gradebook_entries').where({
      group_id: groupId,
      student_id: studentId,
    })

    return calculateOutcome(outline, entries)
  },
}
