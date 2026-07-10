import { describe, it, expect } from 'vitest'
import { db } from '../../config/db'
import { CREDENTIALS, TEST_UNIVERSITY_ID } from '../../__tests__/setup'
import { createGroupFixture } from '../../__tests__/factories/groups'
import { modulesService } from './modules.service'

async function getFacultyContext() {
  const faculty = await db('users').where({ email: CREDENTIALS.faculty.email }).first('id')
  return { userId: faculty.id as string, universityId: TEST_UNIVERSITY_ID, role: 'faculty' as const }
}

async function getStudentContext() {
  const student = await db('users').where({ email: CREDENTIALS.student.email }).first('id')
  return { userId: student.id as string, universityId: TEST_UNIVERSITY_ID, role: 'student' as const }
}

describe('modulesService', () => {
  it('creates a module and lists only published ones for a member', async () => {
    const facultyCtx = await getFacultyContext()
    const studentCtx = await getStudentContext()
    const group = await createGroupFixture({ type: 'academic', creatorId: facultyCtx.userId })

    await db('group_members')
      .insert({ group_id: group.id, user_id: studentCtx.userId, role: 'member' })
      .onConflict(['group_id', 'user_id'])
      .ignore()

    await modulesService.create(facultyCtx, group.id, { title: 'Week 1', displayOrder: 1 })
    const published = await modulesService.create(facultyCtx, group.id, { title: 'Week 2', displayOrder: 2 })
    await modulesService.togglePublish(facultyCtx, group.id, published.id)

    const studentView = await modulesService.list(studentCtx, group.id)
    expect(studentView.map((m) => m.title)).toEqual(['Week 2'])

    const facultyView = await modulesService.list(facultyCtx, group.id)
    expect(facultyView).toHaveLength(2)
  })

  it('reorders modules by the given id order', async () => {
    const facultyCtx = await getFacultyContext()
    const group = await createGroupFixture({ type: 'academic', creatorId: facultyCtx.userId })

    const m1 = await modulesService.create(facultyCtx, group.id, { title: 'A', displayOrder: 1 })
    const m2 = await modulesService.create(facultyCtx, group.id, { title: 'B', displayOrder: 2 })

    await modulesService.reorder(facultyCtx, group.id, { order: [m2.id, m1.id] })

    const list = await modulesService.list(facultyCtx, group.id)
    expect(list.map((m) => m.id)).toEqual([m2.id, m1.id])
  })
})
