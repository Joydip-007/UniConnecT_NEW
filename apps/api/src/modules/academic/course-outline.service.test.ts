import { describe, it, expect } from 'vitest'
import { db } from '../../config/db'
import { CREDENTIALS, TEST_UNIVERSITY_ID } from '../../__tests__/setup'
import { createGroupFixture } from '../../__tests__/factories/groups'
import { courseOutlineService } from './course-outline.service'

async function getFacultyContext() {
  const faculty = await db('users').where({ email: CREDENTIALS.faculty.email }).first('id')
  return { userId: faculty.id as string, universityId: TEST_UNIVERSITY_ID, role: 'faculty' as const }
}

async function getStudentContext() {
  const student = await db('users').where({ email: CREDENTIALS.student.email }).first('id')
  return { userId: student.id as string, universityId: TEST_UNIVERSITY_ID, role: 'student' as const }
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

describe('courseOutlineService', () => {
  it('creates an outline with assessments summing weight to 100 and topics', async () => {
    const context = await getFacultyContext()
    const group = await createGroupFixture({ type: 'academic', creatorId: context.userId })

    const outline = await courseOutlineService.createOutline(context, group.id, {
      courseTitle: 'Data Structures',
      gradingScale: 'uiu',
      assessments: [
        { categoryName: 'Class Test', fullMarks: 20, weightPercent: 30, totalGiven: 4, bestNCounted: 3, displayOrder: 1 },
        { categoryName: 'Midterm', fullMarks: 30, weightPercent: 30, totalGiven: 1, bestNCounted: 1, displayOrder: 2 },
        { categoryName: 'Final', fullMarks: 40, weightPercent: 40, totalGiven: 1, bestNCounted: 1, displayOrder: 3 },
      ],
      topics: [{ weekNumber: 1, title: 'Arrays', description: 'Intro' }],
    })

    expect(outline.courseTitle).toBe('Data Structures')
    expect(outline.assessments).toHaveLength(3)
    expect(outline.topics).toHaveLength(1)

    const fetched = await courseOutlineService.getOutline(context, group.id)
    expect(fetched?.id).toBe(outline.id)
  })

  it('rejects getOutline for a caller who is not a group member', async () => {
    const context = await getFacultyContext()
    const group = await createGroupFixture({ type: 'academic', creatorId: context.userId })
    await courseOutlineService.createOutline(context, group.id, {
      courseTitle: 'Restricted Course',
      gradingScale: 'uiu',
      assessments: [{ categoryName: 'CT', fullMarks: 20, weightPercent: 100, totalGiven: 1, bestNCounted: 1, displayOrder: 1 }],
      topics: [],
    })

    const nonMember = await getStudentContext()
    await expect(courseOutlineService.getOutline(nonMember, group.id)).rejects.toMatchObject({ statusCode: 403 })
  })

  it('rejects createOutline on a non-academic group', async () => {
    const context = await getFacultyContext()
    const group = await createGroupFixture({ type: 'club', creatorId: context.userId })

    await expect(
      courseOutlineService.createOutline(context, group.id, {
        courseTitle: 'Not Allowed',
        gradingScale: 'uiu',
        assessments: [{ categoryName: 'CT', fullMarks: 20, weightPercent: 100, totalGiven: 1, bestNCounted: 1, displayOrder: 1 }],
        topics: [],
      }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'ACADEMIC_GROUP_REQUIRED' })
  })

  it('rejects assessments whose weight_percent does not sum to 100', async () => {
    const context = await getFacultyContext()
    const group = await createGroupFixture({ type: 'academic', creatorId: context.userId })

    await expect(
      courseOutlineService.createOutline(context, group.id, {
        courseTitle: 'Bad Course',
        gradingScale: 'uiu',
        assessments: [{ categoryName: 'CT', fullMarks: 20, weightPercent: 50, totalGiven: 1, bestNCounted: 1, displayOrder: 1 }],
        topics: [],
      }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rejects bestNCounted greater than totalGiven', async () => {
    const context = await getFacultyContext()
    const group = await createGroupFixture({ type: 'academic', creatorId: context.userId })

    await expect(
      courseOutlineService.createOutline(context, group.id, {
        courseTitle: 'Bad Course 2',
        gradingScale: 'uiu',
        assessments: [{ categoryName: 'CT', fullMarks: 20, weightPercent: 100, totalGiven: 2, bestNCounted: 3, displayOrder: 1 }],
        topics: [],
      }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })
})

describe('resolveAITopic', () => {
  it('returns the current-week topic when one exists', async () => {
    const context = await getFacultyContext()
    const group = await createGroupFixture({ type: 'academic', creatorId: context.userId })
    await db('groups').where({ id: group.id }).update({ ai_settings: { subject: 'Fallback Subject' } })

    await courseOutlineService.createOutline(context, group.id, {
      courseTitle: 'X',
      gradingScale: 'uiu',
      assessments: [{ categoryName: 'CT', fullMarks: 20, weightPercent: 100, totalGiven: 1, bestNCounted: 1, displayOrder: 1 }],
      topics: [{ weekNumber: getCurrentISOWeek(), title: 'This Week Topic' }],
    })

    const topic = await courseOutlineService.resolveAITopic(group.id, context.universityId)
    expect(topic).toBe('This Week Topic')
  })

  it('falls back to ai_settings.subject when no week topic exists', async () => {
    const context = await getFacultyContext()
    const group = await createGroupFixture({ type: 'academic', creatorId: context.userId })
    await db('groups').where({ id: group.id }).update({ ai_settings: { subject: 'Fallback Subject' } })

    const topic = await courseOutlineService.resolveAITopic(group.id, context.universityId)
    expect(topic).toBe('Fallback Subject')
  })
})
