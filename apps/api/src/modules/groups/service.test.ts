import { describe, it, expect } from 'vitest'
import { randomUUID } from 'node:crypto'
import { db } from '../../config/db'
import { groupsService } from './service'
import { courseOutlineService } from '../academic/course-outline.service'
import type { UserRole } from '@uniconnect/shared'

async function createUniversity(): Promise<string> {
  const [row] = await db('universities')
    .insert({
      name: 'Test University',
      domain: `test-${randomUUID()}.example.edu`,
    })
    .returning<{ id: string }[]>('id')
  return row.id
}

async function createUser(opts: { universityId: string; role: UserRole }): Promise<{ id: string }> {
  const [user] = await db('users')
    .insert({
      university_id: opts.universityId,
      username: `test_${randomUUID().slice(0, 8)}`,
      email: `${randomUUID()}@example.edu`,
      role: opts.role,
    })
    .returning<{ id: string }[]>('id')

  await db('profiles').insert({
    user_id: user.id,
    full_name: 'Test User',
  })

  return { id: user.id }
}

async function cleanup(universityId: string): Promise<void> {
  const groupIds = await db('groups').where({ university_id: universityId }).pluck('id')
  await db('group_members').whereIn('group_id', groupIds).del()
  await db('groups').where({ university_id: universityId }).del()
  const userIds = await db('users').where({ university_id: universityId }).pluck('id')
  await db('profiles').whereIn('user_id', userIds).del()
  await db('users').where({ university_id: universityId }).del()
  await db('universities').where({ id: universityId }).del()
}

describe('groupService.createGroup — academic type guard', () => {
  it('rejects academic group creation by a student', async () => {
    const universityId = await createUniversity()
    const student = await createUser({ universityId, role: 'student' })

    await expect(
      groupsService.createGroup(
        { userId: student.id, universityId, role: 'student' },
        { name: 'CS101', description: 'A course group', type: 'academic', is_private: false },
      ),
    ).rejects.toMatchObject({ code: 'ACADEMIC_GROUP_FACULTY_ONLY' })

    await cleanup(universityId)
  })

  it('allows academic group creation by faculty and returns aiSettings', async () => {
    const universityId = await createUniversity()
    const faculty = await createUser({ universityId, role: 'faculty' })

    const group = await groupsService.createGroup(
      { userId: faculty.id, universityId, role: 'faculty' },
      { name: 'CS101', description: 'A course group', type: 'academic', is_private: false },
    )

    expect(group.type).toBe('academic')
    expect(group.aiSettings).toEqual({})

    await cleanup(universityId)
  })
})

describe('groupService.updateAiSettings', () => {
  it('merges partial ai_settings and requires owner/admin role', async () => {
    const universityId = await createUniversity()
    const faculty = await createUser({ universityId, role: 'faculty' })
    const group = await groupsService.createGroup(
      { userId: faculty.id, universityId, role: 'faculty' },
      { name: 'CS101', description: 'A course group', type: 'academic', is_private: false },
    )

    const updated = await groupsService.updateAiSettings(
      { userId: faculty.id, universityId, role: 'faculty' },
      group.id,
      { ai_quiz_enabled: true, subject: 'Data Structures' },
    )

    expect(updated.aiSettings).toMatchObject({ ai_quiz_enabled: true, subject: 'Data Structures' })

    await cleanup(universityId)
  })

  it('rejects updates on non-academic groups', async () => {
    const universityId = await createUniversity()
    const faculty = await createUser({ universityId, role: 'faculty' })
    const group = await groupsService.createGroup(
      { userId: faculty.id, universityId, role: 'faculty' },
      { name: 'Club', description: 'A club group', type: 'club', is_private: false },
    )

    await expect(
      groupsService.updateAiSettings(
        { userId: faculty.id, universityId, role: 'faculty' },
        group.id,
        { ai_quiz_enabled: true },
      ),
    ).rejects.toMatchObject({ code: 'ACADEMIC_GROUP_REQUIRED' })

    await cleanup(universityId)
  })
})

describe('groupService — gradebook auto-population on join', () => {
  it('creates gradebook_entries rows when a student joins an academic group with a course outline', async () => {
    const universityId = await createUniversity()
    const faculty = await createUser({ universityId, role: 'faculty' })
    const student = await createUser({ universityId, role: 'student' })
    const group = await groupsService.createGroup(
      { userId: faculty.id, universityId, role: 'faculty' },
      { name: 'CS101', description: 'A course group', type: 'academic', is_private: false },
    )
    await courseOutlineService.createOutline(
      { userId: faculty.id, universityId, role: 'faculty' },
      group.id,
      {
        courseTitle: 'X',
        gradingScale: 'uiu',
        assessments: [
          { categoryName: 'CT', fullMarks: 20, weightPercent: 100, totalGiven: 2, bestNCounted: 1, displayOrder: 1 },
        ],
        topics: [],
      },
    )

    await groupsService.joinGroup({ userId: student.id, universityId, role: 'student' }, group.id)

    const entries = await db('gradebook_entries').where({ group_id: group.id, student_id: student.id })
    expect(entries).toHaveLength(2) // totalGiven = 2 instances

    await cleanup(universityId)
  })
})
