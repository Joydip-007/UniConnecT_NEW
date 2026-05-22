import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { app, loginAs, TEST_UNIVERSITY_ID, CREDENTIALS } from '../setup'
import { db } from '../../config/db'

const api = supertest(app)
const FUTURE = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

async function createGroupWith2Members(universityId: string, ownerId: string, memberId: string) {
  const [group] = await db('groups')
    .insert({
      university_id: universityId,
      created_by: ownerId,
      name: `Session Test Group ${Date.now()}`,
      description: 'Test',
      type: 'other',
      is_private: false,
      member_count: 2,
    })
    .returning('*')
  await db('group_members').insert([
    { group_id: group.id, user_id: ownerId, role: 'owner' },
    { group_id: group.id, user_id: memberId, role: 'member' },
  ])
  return group as { id: string }
}

describe('Study sessions', () => {
  let adminToken: string
  let studentToken: string
  let alumniToken: string
  let adminUserId: string
  let studentUserId: string
  let alumniUserId: string

  beforeAll(async () => {
    const a = await loginAs(CREDENTIALS.admin.email, CREDENTIALS.admin.password)
    adminToken = a.accessToken
    adminUserId = (await db('users').where({ email: CREDENTIALS.admin.email }).select('id').first()).id

    const s = await loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password)
    studentToken = s.accessToken
    studentUserId = (await db('users').where({ email: CREDENTIALS.student.email }).select('id').first()).id

    const al = await loginAs(CREDENTIALS.alumni.email, CREDENTIALS.alumni.password)
    alumniToken = al.accessToken
    alumniUserId = (await db('users').where({ email: CREDENTIALS.alumni.email }).select('id').first()).id
  })

  afterAll(async () => {
    await db('groups').whereILike('name', 'Session Test Group%').delete()
  })

  it('create inserts RSVP row for creator and returns rsvpCount=1', async () => {
    const group = await createGroupWith2Members(TEST_UNIVERSITY_ID, adminUserId, studentUserId)

    const res = await api
      .post(`/api/v1/groups/${group.id}/study-sessions`)
      .set({ Authorization: `Bearer ${adminToken}`, 'x-university-domain': 'uiu.ac.bd' })
      .send({ title: 'Morning Study', starts_at: FUTURE, is_online: false })

    expect(res.status).toBe(201)
    expect(res.body.data.rsvpCount).toBe(1)
    expect(res.body.data.ownRsvp).toBe('going')

    const rsvp = await db('group_study_session_rsvps')
      .where({ session_id: res.body.data.id, user_id: adminUserId })
      .first()
    expect(rsvp).toBeTruthy()
    expect(rsvp.status).toBe('going')

    await db('groups').where({ id: group.id }).delete()
  })

  it('RSVP going increments rsvp_count', async () => {
    const group = await createGroupWith2Members(TEST_UNIVERSITY_ID, adminUserId, studentUserId)

    const createRes = await api
      .post(`/api/v1/groups/${group.id}/study-sessions`)
      .set({ Authorization: `Bearer ${adminToken}`, 'x-university-domain': 'uiu.ac.bd' })
      .send({ title: 'RSVP Test', starts_at: FUTURE, is_online: false })
    const sessionId = createRes.body.data.id

    const res = await api
      .post(`/api/v1/groups/${group.id}/study-sessions/${sessionId}/rsvp`)
      .set({ Authorization: `Bearer ${studentToken}`, 'x-university-domain': 'uiu.ac.bd' })
      .send({ status: 'going' })

    expect(res.status).toBe(200)
    expect(res.body.data.rsvpCount).toBe(2)

    await db('groups').where({ id: group.id }).delete()
  })

  it('RSVP not_going decrements rsvp_count', async () => {
    const group = await createGroupWith2Members(TEST_UNIVERSITY_ID, adminUserId, studentUserId)

    const createRes = await api
      .post(`/api/v1/groups/${group.id}/study-sessions`)
      .set({ Authorization: `Bearer ${adminToken}`, 'x-university-domain': 'uiu.ac.bd' })
      .send({ title: 'Decrement Test', starts_at: FUTURE, is_online: false })
    const sessionId = createRes.body.data.id

    // Student RSVPs going first
    await api
      .post(`/api/v1/groups/${group.id}/study-sessions/${sessionId}/rsvp`)
      .set({ Authorization: `Bearer ${studentToken}`, 'x-university-domain': 'uiu.ac.bd' })
      .send({ status: 'going' })

    // Then changes to not_going
    const res = await api
      .post(`/api/v1/groups/${group.id}/study-sessions/${sessionId}/rsvp`)
      .set({ Authorization: `Bearer ${studentToken}`, 'x-university-domain': 'uiu.ac.bd' })
      .send({ status: 'not_going' })

    expect(res.status).toBe(200)
    expect(res.body.data.rsvpCount).toBe(1) // back to just creator

    await db('groups').where({ id: group.id }).delete()
  })

  it('returns 409 SESSION_AT_CAPACITY when full', async () => {
    const group = await createGroupWith2Members(TEST_UNIVERSITY_ID, adminUserId, studentUserId)

    // Create session with capacity=1 (creator fills it)
    const createRes = await api
      .post(`/api/v1/groups/${group.id}/study-sessions`)
      .set({ Authorization: `Bearer ${adminToken}`, 'x-university-domain': 'uiu.ac.bd' })
      .send({ title: 'Full Session', starts_at: FUTURE, is_online: false, capacity: 1 })
    const sessionId = createRes.body.data.id

    const res = await api
      .post(`/api/v1/groups/${group.id}/study-sessions/${sessionId}/rsvp`)
      .set({ Authorization: `Bearer ${studentToken}`, 'x-university-domain': 'uiu.ac.bd' })
      .send({ status: 'going' })

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('SESSION_AT_CAPACITY')

    await db('groups').where({ id: group.id }).delete()
  })

  it('creator can delete their own session', async () => {
    const group = await createGroupWith2Members(TEST_UNIVERSITY_ID, adminUserId, studentUserId)

    const createRes = await api
      .post(`/api/v1/groups/${group.id}/study-sessions`)
      .set({ Authorization: `Bearer ${studentToken}`, 'x-university-domain': 'uiu.ac.bd' })
      .send({ title: 'Delete By Creator', starts_at: FUTURE, is_online: false })
    const sessionId = createRes.body.data.id

    const res = await api
      .delete(`/api/v1/groups/${group.id}/study-sessions/${sessionId}`)
      .set({ Authorization: `Bearer ${studentToken}`, 'x-university-domain': 'uiu.ac.bd' })

    expect(res.status).toBe(200)
    expect(res.body.data.deleted).toBe(true)

    await db('groups').where({ id: group.id }).delete()
  })

  it('group owner can delete any session', async () => {
    const group = await createGroupWith2Members(TEST_UNIVERSITY_ID, adminUserId, studentUserId)

    const createRes = await api
      .post(`/api/v1/groups/${group.id}/study-sessions`)
      .set({ Authorization: `Bearer ${studentToken}`, 'x-university-domain': 'uiu.ac.bd' })
      .send({ title: 'Owner Delete Test', starts_at: FUTURE, is_online: false })
    const sessionId = createRes.body.data.id

    const res = await api
      .delete(`/api/v1/groups/${group.id}/study-sessions/${sessionId}`)
      .set({ Authorization: `Bearer ${adminToken}`, 'x-university-domain': 'uiu.ac.bd' })

    expect(res.status).toBe(200)

    await db('groups').where({ id: group.id }).delete()
  })

  it('non-creator member cannot delete (403)', async () => {
    const group = await createGroupWith2Members(TEST_UNIVERSITY_ID, adminUserId, studentUserId)
    // Add alumni as a member
    await db('group_members').insert({ group_id: group.id, user_id: alumniUserId, role: 'member' })

    const createRes = await api
      .post(`/api/v1/groups/${group.id}/study-sessions`)
      .set({ Authorization: `Bearer ${studentToken}`, 'x-university-domain': 'uiu.ac.bd' })
      .send({ title: 'Non-Creator Test', starts_at: FUTURE, is_online: false })
    const sessionId = createRes.body.data.id

    const res = await api
      .delete(`/api/v1/groups/${group.id}/study-sessions/${sessionId}`)
      .set({ Authorization: `Bearer ${alumniToken}`, 'x-university-domain': 'uiu.ac.bd' })

    expect(res.status).toBe(403)

    await db('groups').where({ id: group.id }).delete()
  })
})
