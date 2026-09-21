import request from 'supertest'
import { describe, it, expect, beforeAll } from 'vitest'
import { app } from '../setup'
import { DOMAIN, loginAs, CREDENTIALS } from '../setup'

describe('group settings + moderation log', () => {
  let admin: { accessToken: string }
  let student: { accessToken: string }
  let groupId: string

  beforeAll(async () => {
    admin = await loginAs(CREDENTIALS.faculty.email, CREDENTIALS.faculty.password)
    student = await loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password)
    const res = await request(app)
      .post('/api/v1/groups')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ name: 'Mod test', description: 'x', type: 'club', is_private: true })
    groupId = res.body.data.id
  })

  it('exposes approval toggles and logs a settings change', async () => {
    const res = await request(app)
      .patch(`/api/v1/groups/${groupId}/settings`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ require_post_approval: true })
    expect(res.status).toBe(200)
    expect(res.body.data.requirePostApproval).toBe(true)

    const log = await request(app)
      .get(`/api/v1/groups/${groupId}/moderation-log?kind=settings`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${admin.accessToken}`)
    expect(log.status).toBe(200)
    expect(log.body.data.items[0].action).toBe('Post approval turned on')
  })

  it('non-admins get 403 on settings and the log', async () => {
    const res = await request(app)
      .patch(`/api/v1/groups/${groupId}/settings`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${student.accessToken}`)
      .send({ require_post_approval: false })
    expect(res.status).toBe(403)
  })

  it('lists declined join requests and can undo', async () => {
    await request(app)
      .post(`/api/v1/groups/${groupId}/members`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${student.accessToken}`)
      .send({ message: 'let me in' })
    const pending = await request(app)
      .get(`/api/v1/groups/${groupId}/join-requests`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${admin.accessToken}`)
    const reqId = pending.body.data.items[0].id

    await request(app)
      .patch(`/api/v1/groups/${groupId}/join-requests/${reqId}`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ action: 'decline' })

    const declined = await request(app)
      .get(`/api/v1/groups/${groupId}/join-requests?status=declined`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${admin.accessToken}`)
    expect(declined.body.data.items.map((r: { id: string }) => r.id)).toContain(reqId)

    const undo = await request(app)
      .patch(`/api/v1/groups/${groupId}/join-requests/${reqId}`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ action: 'undo' })
    expect(undo.status).toBe(200)
    expect(undo.body.data.status).toBe('pending')
  })
})
