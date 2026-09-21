import request from 'supertest'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { app, DOMAIN, loginAs, CREDENTIALS } from '../setup'
import { db } from '../../config/db'

describe('single invite with role → accept → membership role', () => {
  let admin: { accessToken: string }
  let student: { accessToken: string }
  let alumni: { accessToken: string }
  let studentUserId: string
  let alumniUserId: string
  let groupId: string
  const auth = (token: string) => ({ Authorization: `Bearer ${token}`, 'x-university-domain': DOMAIN })

  beforeAll(async () => {
    admin = await loginAs(CREDENTIALS.admin.email, CREDENTIALS.admin.password)
    student = await loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password)
    alumni = await loginAs(CREDENTIALS.alumni.email, CREDENTIALS.alumni.password)

    studentUserId = (await db('users').where({ email: CREDENTIALS.student.email }).first<{ id: string }>())!.id
    alumniUserId = (await db('users').where({ email: CREDENTIALS.alumni.email }).first<{ id: string }>())!.id

    const created = await request(app)
      .post('/api/v1/groups')
      .set(auth(admin.accessToken))
      .send({ name: 'Invite Role Test Group', description: 'Invite role test', type: 'other', is_private: false })
    groupId = created.body.data.id
  })

  afterAll(async () => {
    await db('notifications').where({ reference_id: groupId, reference_type: 'group' }).delete()
    if (groupId) await db('groups').where({ id: groupId }).delete()
  })

  it('rejects an unknown role with 422', async () => {
    const res = await request(app)
      .post(`/api/v1/groups/${groupId}/invitations`)
      .set(auth(admin.accessToken))
      .send({ userId: studentUserId, role: 'owner' })
    expect(res.status).toBe(422)
  })

  it('persists data.role on the invite and applies it on accept', async () => {
    const invite = await request(app)
      .post(`/api/v1/groups/${groupId}/invitations`)
      .set(auth(admin.accessToken))
      .send({ userId: studentUserId, role: 'moderator' })
    expect(invite.status).toBe(201)
    const notificationId = invite.body.data.notificationId as string

    const row = await db('notifications').where({ id: notificationId }).first()
    expect(row!.data).toMatchObject({ role: 'moderator' })

    const accept = await request(app)
      .post(`/api/v1/notifications/${notificationId}/accept`)
      .set(auth(student.accessToken))
    expect(accept.status).toBe(200)

    const membership = await db('group_members').where({ group_id: groupId, user_id: studentUserId }).first()
    expect(membership!.role).toBe('moderator')
  })

  it('defaults to member when no role is sent', async () => {
    const invite = await request(app)
      .post(`/api/v1/groups/${groupId}/invitations`)
      .set(auth(admin.accessToken))
      .send({ userId: alumniUserId })
    expect(invite.status).toBe(201)
    const row = await db('notifications').where({ id: invite.body.data.notificationId }).first()
    expect(row!.data).toMatchObject({ role: 'member' })

    const accept = await request(app)
      .post(`/api/v1/notifications/${invite.body.data.notificationId}/accept`)
      .set(auth(alumni.accessToken))
    expect(accept.status).toBe(200)

    const membership = await db('group_members').where({ group_id: groupId, user_id: alumniUserId }).first()
    expect(membership!.role).toBe('member')
  })
})
