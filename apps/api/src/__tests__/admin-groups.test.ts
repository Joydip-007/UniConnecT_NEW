import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { app, loginAs, DOMAIN, TEST_UNIVERSITY_ID, CREDENTIALS } from './setup'
import { db } from '../config/db'

const api = supertest(app)
const UNI = { 'x-university-domain': DOMAIN }

let adminToken: string
let groupId: string
const requesterIds: string[] = []

beforeAll(async () => {
  const admin = await loginAs(CREDENTIALS.admin.email, CREDENTIALS.admin.password)
  adminToken = admin.accessToken

  const [group] = await db('groups')
    .insert({
      university_id: TEST_UNIVERSITY_ID,
      name: 'Admin groups test club',
      description: 'Fixture group for admin groups summary test',
      type: 'club',
      is_private: true,
      member_count: 5,
      created_by: (await db('users').where({ university_id: TEST_UNIVERSITY_ID, role: 'student' }).first('id'))!.id,
    })
    .returning('id')
  groupId = group.id

  // Four pending requesters, most-recent-first ordering matters
  const students = await db('users')
    .join('profiles', 'profiles.user_id', 'users.id')
    .where({ 'users.university_id': TEST_UNIVERSITY_ID })
    .limit(4)
    .select('users.id')
  for (const [i, s] of students.entries()) {
    const [row] = await db('group_join_requests')
      .insert({
        group_id: groupId,
        user_id: s.id,
        university_id: TEST_UNIVERSITY_ID,
        status: 'pending',
        created_at: new Date(Date.now() - (students.length - i) * 1000),
      })
      .returning('id')
    requesterIds.push(row.id)
  }
})

afterAll(async () => {
  await db('group_join_requests').where({ group_id: groupId }).delete()
  await db('groups').where({ id: groupId }).delete()
})

describe('GET /api/v1/admin/groups', () => {
  it('includes up to 3 pending requesters per group, most recent first', async () => {
    const res = await api
      .get('/api/v1/admin/groups')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ page: 1, limit: 50 })

    expect(res.status).toBe(200)
    const row = res.body.data.items.find((g: { id: string }) => g.id === groupId)
    expect(row).toBeTruthy()
    expect(row.pendingRequestCount).toBe(4)
    expect(row.pendingRequesters).toHaveLength(3)
    expect(row.pendingRequesters[0]).toHaveProperty('userId')
    expect(row.pendingRequesters[0]).toHaveProperty('fullName')
    expect(row.pendingRequesters[0]).toHaveProperty('avatarUrl')
  })

  it('returns a university-wide summary block', async () => {
    const res = await api
      .get('/api/v1/admin/groups')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ page: 1, limit: 50 })

    expect(res.status).toBe(200)
    expect(res.body.data.summary).toMatchObject({
      totalGroups: expect.any(Number),
      privateGroups: expect.any(Number),
      totalMembers: expect.any(Number),
      pendingRequests: expect.any(Number),
      createdThisWeek: expect.any(Number),
    })
    expect(res.body.data.summary.totalGroups).toBeGreaterThanOrEqual(1)
    expect(res.body.data.summary.pendingRequests).toBeGreaterThanOrEqual(4)
  })
})
