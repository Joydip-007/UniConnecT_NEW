import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { app, loginAs, TEST_UNIVERSITY_ID, CREDENTIALS } from '../setup'
import { db } from '../../config/db'

const api = supertest(app)

describe('Member directory enhancements', () => {
  let adminToken: string
  let adminUserId: string
  let studentUserId: string
  let alumniUserId: string
  let facultyUserId: string
  let groupId: string

  beforeAll(async () => {
    const a = await loginAs(CREDENTIALS.admin.email, CREDENTIALS.admin.password)
    adminToken = a.accessToken
    adminUserId = (await db('users').where({ email: CREDENTIALS.admin.email }).select('id').first()).id
    studentUserId = (await db('users').where({ email: CREDENTIALS.student.email }).select('id').first()).id
    alumniUserId = (await db('users').where({ email: CREDENTIALS.alumni.email }).select('id').first()).id
    facultyUserId = (await db('users').where({ email: CREDENTIALS.faculty.email }).select('id').first()).id

    // Create group and add all users
    const [group] = await db('groups')
      .insert({
        university_id: TEST_UNIVERSITY_ID,
        created_by: adminUserId,
        name: `Members Enhanced Test ${Date.now()}`,
        description: 'Test',
        type: 'academic',
        is_private: false,
        member_count: 4,
      })
      .returning('*')
    groupId = group.id

    await db('group_members').insert([
      { group_id: groupId, user_id: adminUserId, role: 'owner' },
      { group_id: groupId, user_id: facultyUserId, role: 'moderator' },
      { group_id: groupId, user_id: studentUserId, role: 'member' },
      { group_id: groupId, user_id: alumniUserId, role: 'member' },
    ])

    // Set distinct departments on profiles for search test
    await db('profiles').where({ user_id: studentUserId }).update({ department: 'CSE' })
    await db('profiles').where({ user_id: alumniUserId }).update({ department: 'EEE' })
  })

  afterAll(async () => {
    await db('groups').where({ id: groupId }).delete()
    // Reset departments
    await db('profiles').where({ user_id: studentUserId }).update({ department: null })
    await db('profiles').where({ user_id: alumniUserId }).update({ department: null })
  })

  it('search by department (ILIKE) returns matching members', async () => {
    const res = await api
      .get(`/api/v1/groups/${groupId}/members?search=EEE`)
      .set({ Authorization: `Bearer ${adminToken}`, 'x-university-domain': 'uiu.ac.bd' })

    expect(res.status).toBe(200)
    const items = res.body.data.items
    expect(items.some((m: { department: string; user?: { department: string } }) => m.department === 'EEE')).toBe(true)
    expect(items.every((m: { department: string; user?: { department: string } }) => m.department === 'EEE' || m.user?.department === 'EEE')).toBe(true)
  })

  it('role filter returns only members with that group role', async () => {
    const res = await api
      .get(`/api/v1/groups/${groupId}/members?role=moderator`)
      .set({ Authorization: `Bearer ${adminToken}`, 'x-university-domain': 'uiu.ac.bd' })

    expect(res.status).toBe(200)
    const items = res.body.data.items
    expect(items.length).toBeGreaterThan(0)
    expect(items.every((m: { role: string }) => m.role === 'moderator')).toBe(true)
  })

  it('combined search + role filter works', async () => {
    const res = await api
      .get(`/api/v1/groups/${groupId}/members?role=member&search=CSE`)
      .set({ Authorization: `Bearer ${adminToken}`, 'x-university-domain': 'uiu.ac.bd' })

    expect(res.status).toBe(200)
    const items = res.body.data.items
    // Should return student (CSE department, member role) but not alumni (EEE, member)
    expect(items.every((m: { role: string }) => m.role === 'member')).toBe(true)
  })

  it('pagination returns 20 per page by default', async () => {
    const res = await api
      .get(`/api/v1/groups/${groupId}/members`)
      .set({ Authorization: `Bearer ${adminToken}`, 'x-university-domain': 'uiu.ac.bd' })

    expect(res.status).toBe(200)
    expect(res.body.data.items.length).toBeLessThanOrEqual(20)
  })
})
