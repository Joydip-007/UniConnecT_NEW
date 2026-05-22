import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { app, loginAs, TEST_UNIVERSITY_ID, CREDENTIALS } from '../setup'
import { db } from '../../config/db'

const api = supertest(app)

async function createGroupWithRoles(universityId: string, ownerId: string, moderatorId: string, memberId: string) {
  const [group] = await db('groups')
    .insert({
      university_id: universityId,
      created_by: ownerId,
      name: `Stats Test Group ${Date.now()}`,
      description: 'Test',
      type: 'other',
      is_private: false,
      member_count: 3,
    })
    .returning('*')
  await db('group_members').insert([
    { group_id: group.id, user_id: ownerId, role: 'owner' },
    { group_id: group.id, user_id: moderatorId, role: 'moderator' },
    { group_id: group.id, user_id: memberId, role: 'member' },
  ])
  return group as { id: string }
}

describe('Group stats', () => {
  let adminToken: string
  let facultyToken: string
  let studentToken: string
  let adminUserId: string
  let facultyUserId: string
  let studentUserId: string

  beforeAll(async () => {
    const a = await loginAs(CREDENTIALS.admin.email, CREDENTIALS.admin.password)
    adminToken = a.accessToken
    adminUserId = (await db('users').where({ email: CREDENTIALS.admin.email }).select('id').first()).id

    const f = await loginAs(CREDENTIALS.faculty.email, CREDENTIALS.faculty.password)
    facultyToken = f.accessToken
    facultyUserId = (await db('users').where({ email: CREDENTIALS.faculty.email }).select('id').first()).id

    const s = await loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password)
    studentToken = s.accessToken
    studentUserId = (await db('users').where({ email: CREDENTIALS.student.email }).select('id').first()).id
  })

  afterAll(async () => {
    await db('groups').whereILike('name', 'Stats Test Group%').delete()
  })

  it('group admin (owner) gets stats object with all 5 keys', async () => {
    const group = await createGroupWithRoles(TEST_UNIVERSITY_ID, adminUserId, facultyUserId, studentUserId)

    const res = await api
      .get(`/api/v1/groups/${group.id}/stats`)
      .set({ Authorization: `Bearer ${adminToken}`, 'x-university-domain': 'uiu.ac.bd' })

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveProperty('newMembersThisWeek')
    expect(res.body.data).toHaveProperty('postsThisWeek')
    expect(res.body.data).toHaveProperty('activeContributors')
    expect(res.body.data).toHaveProperty('pendingJoinRequests')
    expect(res.body.data).toHaveProperty('upcomingStudySessions')
    expect(typeof res.body.data.newMembersThisWeek).toBe('number')
  })

  it('moderator can view stats', async () => {
    const group = await createGroupWithRoles(TEST_UNIVERSITY_ID, adminUserId, facultyUserId, studentUserId)

    const res = await api
      .get(`/api/v1/groups/${group.id}/stats`)
      .set({ Authorization: `Bearer ${facultyToken}`, 'x-university-domain': 'uiu.ac.bd' })

    expect(res.status).toBe(200)
  })

  it('regular member gets 403', async () => {
    const group = await createGroupWithRoles(TEST_UNIVERSITY_ID, adminUserId, facultyUserId, studentUserId)

    const res = await api
      .get(`/api/v1/groups/${group.id}/stats`)
      .set({ Authorization: `Bearer ${studentToken}`, 'x-university-domain': 'uiu.ac.bd' })

    expect(res.status).toBe(403)
  })
})
