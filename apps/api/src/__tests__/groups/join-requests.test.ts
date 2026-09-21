import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { app, loginAs, DOMAIN, TEST_UNIVERSITY_ID, CREDENTIALS } from '../setup'
import { db } from '../../config/db'

const api = supertest(app)

// Helper to create a private group directly in DB
async function createPrivateGroup(universityId: string, createdBy: string) {
  const [group] = await db('groups')
    .insert({
      university_id: universityId,
      created_by: createdBy,
      name: `Test Private Group ${Date.now()}`,
      description: 'Test',
      type: 'other',
      is_private: true,
      member_count: 1,
    })
    .returning('*')
  // Insert creator as owner
  await db('group_members').insert({
    group_id: group.id,
    user_id: createdBy,
    role: 'owner',
  })
  return group as { id: string }
}

async function createPublicGroup(universityId: string, createdBy: string) {
  const [group] = await db('groups')
    .insert({
      university_id: universityId,
      created_by: createdBy,
      name: `Test Public Group ${Date.now()}`,
      description: 'Test',
      type: 'other',
      is_private: false,
      member_count: 1,
    })
    .returning('*')
  await db('group_members').insert({ group_id: group.id, user_id: createdBy, role: 'owner' })
  return group as { id: string }
}

describe('Join requests', () => {
  let adminToken: string
  let studentToken: string
  let alumniToken: string
  let adminUserId: string
  let studentUserId: string
  let alumniUserId: string

  beforeAll(async () => {
    const adminAuth = await loginAs(CREDENTIALS.admin.email, CREDENTIALS.admin.password)
    adminToken = adminAuth.accessToken
    adminUserId = (await db('users').where({ email: CREDENTIALS.admin.email }).select('id').first()).id

    const studentAuth = await loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password)
    studentToken = studentAuth.accessToken
    studentUserId = (await db('users').where({ email: CREDENTIALS.student.email }).select('id').first()).id

    const alumniAuth = await loginAs(CREDENTIALS.alumni.email, CREDENTIALS.alumni.password)
    alumniToken = alumniAuth.accessToken
    alumniUserId = (await db('users').where({ email: CREDENTIALS.alumni.email }).select('id').first()).id
  })

  afterAll(async () => {
    await db('group_join_requests').where({ university_id: TEST_UNIVERSITY_ID }).delete()
    await db('group_members').whereIn('user_id', [studentUserId, alumniUserId])
      .andWhere('role', 'member').delete()
  })

  it('returns 202 when requesting to join a private group', async () => {
    const group = await createPrivateGroup(TEST_UNIVERSITY_ID, adminUserId)

    const res = await api
      .post(`/api/v1/groups/${group.id}/members`)
      .set({ Authorization: `Bearer ${studentToken}` })
      .send({ message: 'Please let me in' })

    await db('groups').where({ id: group.id }).delete()

    expect(res.status).toBe(202)
    expect(res.body.data.requested).toBe(true)
    expect(res.body.data.requestId).toBeTruthy()
  })

  it('returns 409 JOIN_REQUEST_ALREADY_PENDING when duplicate pending request', async () => {
    const group = await createPrivateGroup(TEST_UNIVERSITY_ID, adminUserId)

    await api.post(`/api/v1/groups/${group.id}/members`).set({ Authorization: `Bearer ${studentToken}` }).send({})
    const res = await api
      .post(`/api/v1/groups/${group.id}/members`)
      .set({ Authorization: `Bearer ${studentToken}` })
      .send({})

    await db('groups').where({ id: group.id }).delete()

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('JOIN_REQUEST_ALREADY_PENDING')
  })

  it('returns 201 when joining a public group directly', async () => {
    const group = await createPublicGroup(TEST_UNIVERSITY_ID, adminUserId)

    const res = await api
      .post(`/api/v1/groups/${group.id}/members`)
      .set({ Authorization: `Bearer ${alumniToken}` })
      .send({})

    await db('groups').where({ id: group.id }).delete()

    expect(res.status).toBe(201)
  })

  it('approve: inserts member, increments member_count, returns { action: approved }', async () => {
    const group = await createPrivateGroup(TEST_UNIVERSITY_ID, adminUserId)

    // Give the requester a batch year so the list response can assert it's served
    await db('profiles').where({ user_id: studentUserId }).update({ batch_year: '2021' })

    // Submit request as student
    const reqRes = await api
      .post(`/api/v1/groups/${group.id}/members`)
      .set({ Authorization: `Bearer ${studentToken}` })
      .send({})
    expect(reqRes.status).toBe(202)
    const requestId = reqRes.body.data.requestId

    // List requests as admin
    const listRes = await api
      .get(`/api/v1/groups/${group.id}/join-requests`)
      .set({ Authorization: `Bearer ${adminToken}` })
    expect(listRes.status).toBe(200)
    expect(listRes.body.data.items.length).toBeGreaterThan(0)
    const requesterItem = listRes.body.data.items.find((item: { id: string }) => item.id === requestId)
    expect(requesterItem.requester.batch).toBe('2021')

    // Approve
    const approveRes = await api
      .patch(`/api/v1/groups/${group.id}/join-requests/${requestId}`)
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({ action: 'approve' })

    expect(approveRes.status).toBe(200)
    expect(approveRes.body.data.action).toBe('approved')

    // Verify member was inserted
    const member = await db('group_members').where({ group_id: group.id, user_id: studentUserId }).first()
    expect(member).toBeTruthy()

    // Verify member_count incremented
    const grp = await db('groups').where({ id: group.id }).select('member_count').first()
    expect(grp.member_count).toBe(2)

    await db('groups').where({ id: group.id }).delete()
  })

  it('decline: does not insert member', async () => {
    const group = await createPrivateGroup(TEST_UNIVERSITY_ID, adminUserId)

    const reqRes = await api
      .post(`/api/v1/groups/${group.id}/members`)
      .set({ Authorization: `Bearer ${studentToken}` })
      .send({})
    const requestId = reqRes.body.data.requestId

    const res = await api
      .patch(`/api/v1/groups/${group.id}/join-requests/${requestId}`)
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({ action: 'decline' })

    expect(res.status).toBe(200)
    expect(res.body.data.action).toBe('declined')

    const member = await db('group_members').where({ group_id: group.id, user_id: studentUserId }).first()
    expect(member).toBeUndefined()

    await db('groups').where({ id: group.id }).delete()
  })

  it('cancel: returns 200 and removes pending request', async () => {
    const group = await createPrivateGroup(TEST_UNIVERSITY_ID, adminUserId)

    await api.post(`/api/v1/groups/${group.id}/members`).set({ Authorization: `Bearer ${studentToken}` }).send({})

    const res = await api
      .delete(`/api/v1/groups/${group.id}/join-requests/me`)
      .set({ Authorization: `Bearer ${studentToken}` })

    expect(res.status).toBe(200)

    const request = await db('group_join_requests')
      .where({ group_id: group.id, user_id: studentUserId, status: 'pending' })
      .first()
    expect(request).toBeUndefined()

    await db('groups').where({ id: group.id }).delete()
  })

  it('returns 403 when non-admin tries to review requests', async () => {
    const group = await createPrivateGroup(TEST_UNIVERSITY_ID, adminUserId)

    const reqRes = await api
      .post(`/api/v1/groups/${group.id}/members`)
      .set({ Authorization: `Bearer ${alumniToken}` })
      .send({})
    const requestId = reqRes.body.data.requestId

    const res = await api
      .patch(`/api/v1/groups/${group.id}/join-requests/${requestId}`)
      .set({ Authorization: `Bearer ${studentToken}` })
      .send({ action: 'approve' })

    await db('groups').where({ id: group.id }).delete()
    expect(res.status).toBe(403)
  })
})
