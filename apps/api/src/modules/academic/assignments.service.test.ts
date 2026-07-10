import { describe, it, expect } from 'vitest'
import { db } from '../../config/db'
import { CREDENTIALS, TEST_UNIVERSITY_ID } from '../../__tests__/setup'
import { createGroupFixture } from '../../__tests__/factories/groups'
import { assignmentsService } from './assignments.service'

async function getFacultyContext() {
  const faculty = await db('users').where({ email: CREDENTIALS.faculty.email }).first('id')
  return { userId: faculty.id as string, universityId: TEST_UNIVERSITY_ID, role: 'faculty' as const }
}

async function getStudentContext() {
  const student = await db('users').where({ email: CREDENTIALS.student.email }).first('id')
  return { userId: student.id as string, universityId: TEST_UNIVERSITY_ID, role: 'student' as const }
}

async function addStudentToGroup(groupId: string, studentId: string) {
  await db('group_members')
    .insert({ group_id: groupId, user_id: studentId, role: 'member' })
    .onConflict(['group_id', 'user_id'])
    .ignore()
}

describe('assignmentsService', () => {
  it('students only see published assignments; faculty see all', async () => {
    const facultyCtx = await getFacultyContext()
    const studentCtx = await getStudentContext()
    const group = await createGroupFixture({ type: 'academic', creatorId: facultyCtx.userId })
    await addStudentToGroup(group.id, studentCtx.userId)

    await assignmentsService.create(facultyCtx, group.id, { title: 'Draft HW', maxScore: 100 })
    const published = await assignmentsService.create(facultyCtx, group.id, { title: 'HW1', maxScore: 100 })
    await assignmentsService.update(facultyCtx, group.id, published.id, { isPublished: true })

    expect((await assignmentsService.list(studentCtx, group.id)).map((a) => a.title)).toEqual(['HW1'])
    expect(await assignmentsService.list(facultyCtx, group.id)).toHaveLength(2)
  })

  it('rejects a duplicate submission from the same student for the same assignment', async () => {
    const facultyCtx = await getFacultyContext()
    const studentCtx = await getStudentContext()
    const group = await createGroupFixture({ type: 'academic', creatorId: facultyCtx.userId })
    await addStudentToGroup(group.id, studentCtx.userId)

    const assignment = await assignmentsService.create(facultyCtx, group.id, {
      title: 'HW1',
      maxScore: 100,
      isPublished: true,
    })

    await assignmentsService.submit(studentCtx, group.id, assignment.id, { textContent: 'first try' })
    await expect(
      assignmentsService.submit(studentCtx, group.id, assignment.id, { textContent: 'second try' }),
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  it('flags a submission as late when submitted after the deadline', async () => {
    const facultyCtx = await getFacultyContext()
    const studentCtx = await getStudentContext()
    const group = await createGroupFixture({ type: 'academic', creatorId: facultyCtx.userId })
    await addStudentToGroup(group.id, studentCtx.userId)

    const pastDeadline = new Date(Date.now() - 86400000).toISOString()
    const assignment = await assignmentsService.create(facultyCtx, group.id, {
      title: 'HW1',
      maxScore: 100,
      isPublished: true,
      deadline: pastDeadline,
    })

    const submission = await assignmentsService.submit(studentCtx, group.id, assignment.id, { textContent: 'late work' })
    expect(submission.isLate).toBe(true)
  })

  it('grades a submission and stores score/feedback', async () => {
    const facultyCtx = await getFacultyContext()
    const studentCtx = await getStudentContext()
    const group = await createGroupFixture({ type: 'academic', creatorId: facultyCtx.userId })
    await addStudentToGroup(group.id, studentCtx.userId)

    const assignment = await assignmentsService.create(facultyCtx, group.id, {
      title: 'HW1',
      maxScore: 100,
      isPublished: true,
    })
    const submission = await assignmentsService.submit(studentCtx, group.id, assignment.id, { textContent: 'work' })

    const graded = await assignmentsService.gradeSubmission(facultyCtx, group.id, assignment.id, submission.id, {
      score: 85,
      feedback: 'Good job',
    })
    expect(graded.score).toBe(85)
    expect(graded.feedback).toBe('Good job')
  })

  it('rejects assignment creation on a non-academic group', async () => {
    const facultyCtx = await getFacultyContext()
    const group = await createGroupFixture({ type: 'club', creatorId: facultyCtx.userId })

    await expect(
      assignmentsService.create(facultyCtx, group.id, { title: 'HW1', maxScore: 100 }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'ACADEMIC_GROUP_REQUIRED' })
  })

  it('rejects a disallowed content type on the assignment upload-url presign', async () => {
    const facultyCtx = await getFacultyContext()
    const group = await createGroupFixture({ type: 'academic', creatorId: facultyCtx.userId })

    await expect(
      assignmentsService.getUploadUrl(facultyCtx, group.id, 'malware.exe', 'application/x-msdownload'),
    ).rejects.toMatchObject({ statusCode: 400, code: 'UPLOAD_TYPE_NOT_ALLOWED' })
  })

  it('rejects an assignment fileUrl that does not point at our own upload bucket', async () => {
    const facultyCtx = await getFacultyContext()
    const group = await createGroupFixture({ type: 'academic', creatorId: facultyCtx.userId })

    await expect(
      assignmentsService.create(facultyCtx, group.id, {
        title: 'HW1',
        maxScore: 100,
        fileUrls: [{ name: 'evil.pdf', url: 'https://evil.example.com/evil.pdf', contentType: 'application/pdf', size: 100 }],
      }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'ATTACHMENT_URL_INVALID' })
  })
})
