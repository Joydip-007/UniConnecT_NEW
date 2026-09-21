import request from 'supertest'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { app, DOMAIN, loginAs, CREDENTIALS } from '../setup'
import { db } from '../../config/db'

describe('course-outline import — bulk invite + invite-match', () => {
  let admin: { accessToken: string }
  let faculty: { accessToken: string }
  let student: { accessToken: string }
  let studentUserId: string
  let groupId: string
  const auth = (token: string) => ({ Authorization: `Bearer ${token}`, 'x-university-domain': DOMAIN })

  beforeAll(async () => {
    admin = await loginAs(CREDENTIALS.admin.email, CREDENTIALS.admin.password)
    faculty = await loginAs(CREDENTIALS.faculty.email, CREDENTIALS.faculty.password)
    student = await loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password)

    const studentRow = await db('users')
      .where({ email: CREDENTIALS.student.email })
      .first<{ id: string }>()
    studentUserId = studentRow!.id
    await db('profiles').where({ user_id: studentUserId }).update({ department: 'CSE', batch_year: '2027' })

    const created = await request(app)
      .post('/api/v1/groups')
      .set(auth(admin.accessToken))
      .send({ name: 'Bulk Invite Test Group', description: 'A group used to test bulk invites', type: 'other', is_private: false })
    groupId = created.body.data.id
  })

  afterAll(async () => {
    await db('profiles').where({ user_id: studentUserId }).update({ department: null, batch_year: null })
    await db('notifications').where({ reference_id: groupId, reference_type: 'group' }).delete()
    if (groupId) await db('groups').where({ id: groupId }).delete()
  })

  it('GET /groups/invite-match counts students matching a department', async () => {
    const res = await request(app)
      .get('/api/v1/groups/invite-match')
      .set(auth(faculty.accessToken))
      .query({ department: 'CSE' })
    expect(res.status).toBe(200)
    expect(res.body.data.count).toBeGreaterThanOrEqual(1)
  })

  it('GET /groups/invite-match is faculty/admin only', async () => {
    const res = await request(app)
      .get('/api/v1/groups/invite-match')
      .set(auth(student.accessToken))
      .query({ department: 'CSE' })
    expect(res.status).toBe(403)
  })

  it('POST /groups/:id/invitations/bulk is admin-only', async () => {
    const res = await request(app)
      .post(`/api/v1/groups/${groupId}/invitations/bulk`)
      .set(auth(faculty.accessToken))
      .send({ department: 'CSE' })
    expect(res.status).toBe(403)
  })

  it('rejects a request with none of department, batch_year, or emails', async () => {
    const res = await request(app)
      .post(`/api/v1/groups/${groupId}/invitations/bulk`)
      .set(auth(admin.accessToken))
      .send({})
    expect(res.status).toBe(422)
  })

  it('invites matching students, persists the invite role, then skips them on a second call', async () => {
    const first = await request(app)
      .post(`/api/v1/groups/${groupId}/invitations/bulk`)
      .set(auth(admin.accessToken))
      .send({ department: 'CSE' })
    expect(first.status).toBe(200)
    expect(first.body.data).toEqual({ invited: 1, skipped: 0, mailed: 0 })

    const notification = await db('notifications')
      .where({ user_id: studentUserId, type: 'group_invite', reference_id: groupId, reference_type: 'group' })
      .first()
    expect(notification).toBeTruthy()
    expect(notification!.data).toMatchObject({ role: null })

    const second = await request(app)
      .post(`/api/v1/groups/${groupId}/invitations/bulk`)
      .set(auth(admin.accessToken))
      .send({ department: 'CSE' })
    expect(second.status).toBe(200)
    expect(second.body.data.invited).toBe(0)
    expect(second.body.data.skipped).toBeGreaterThanOrEqual(1)
  })

  it('queues an email for an email address that matches no existing account', async () => {
    const res = await request(app)
      .post(`/api/v1/groups/${groupId}/invitations/bulk`)
      .set(auth(admin.accessToken))
      .send({ emails: ['nobody-in-this-test@example.com'] })
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({ invited: 0, skipped: 0, mailed: 1 })
  })

  it('bulk-inviting an existing member is skipped, not re-invited', async () => {
    // The admin who created the group is already its owner/member.
    const res = await request(app)
      .post(`/api/v1/groups/${groupId}/invitations/bulk`)
      .set(auth(admin.accessToken))
      .send({ emails: [CREDENTIALS.admin.email] })
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({ invited: 0, skipped: 1, mailed: 0 })
  })
})
