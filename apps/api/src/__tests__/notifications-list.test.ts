import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import supertest from 'supertest'
import { app, CREDENTIALS, DOMAIN, loginAs } from './setup'
import { db } from '../config/db'

const api = supertest(app)
let studentToken: string
let studentId: string
let unreadId: string
let readId: string

function auth(token: string) {
  return { Authorization: `Bearer ${token}`, 'x-university-domain': DOMAIN }
}

beforeAll(async () => {
  const st = await loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password)
  studentToken = st.accessToken
  const me = await api.get('/api/v1/users/me').set(auth(studentToken))
  studentId = me.body.data.id

  // Isolate this suite from notifications left behind by other suites.
  await db('notifications').where({ user_id: studentId }).delete()

  const rows = await db('notifications')
    .insert([
      {
        user_id: studentId,
        type: 'group_invite',
        reference_id: '00000000-0000-4000-8000-0000000000aa',
        reference_type: 'group',
        content: 'Someone invited you to join "Test group"',
        is_read: false,
      },
      {
        user_id: studentId,
        type: 'group_invite',
        reference_id: '00000000-0000-4000-8000-0000000000bb',
        reference_type: 'group',
        content: 'Someone invited you to join "Old group"',
        is_read: true,
      },
    ])
    .returning<{ id: string; is_read: boolean }[]>(['id', 'is_read'])

  unreadId = rows.find((r) => !r.is_read)!.id
  readId = rows.find((r) => r.is_read)!.id
})

afterAll(async () => {
  await db('notifications').where({ user_id: studentId }).delete()
})

describe('GET /notifications — isRead filter', () => {
  // Regression: `z.coerce.boolean()` turned the query string "false" into `true`,
  // so the bell dropdown's unread-only fetch returned read notifications instead —
  // new group invites never showed up there.
  it('isRead=false returns only unread notifications', async () => {
    const res = await api
      .get('/api/v1/notifications')
      .query({ isRead: false, limit: 50 })
      .set(auth(studentToken))

    expect(res.status).toBe(200)
    const items = res.body.data.items as { id: string; isRead: boolean }[]
    expect(items.map((n) => n.id)).toContain(unreadId)
    expect(items.map((n) => n.id)).not.toContain(readId)
    expect(items.every((n) => n.isRead === false)).toBe(true)
    expect(res.body.data.total).toBe(1)
  })

  it('isRead=true returns only read notifications', async () => {
    const res = await api
      .get('/api/v1/notifications')
      .query({ isRead: true, limit: 50 })
      .set(auth(studentToken))

    expect(res.status).toBe(200)
    const items = res.body.data.items as { id: string; isRead: boolean }[]
    expect(items.map((n) => n.id)).toEqual([readId])
    expect(res.body.data.total).toBe(1)
  })

  it('omitting isRead returns both', async () => {
    const res = await api.get('/api/v1/notifications').query({ limit: 50 }).set(auth(studentToken))

    expect(res.status).toBe(200)
    const ids = (res.body.data.items as { id: string }[]).map((n) => n.id)
    expect(ids).toContain(unreadId)
    expect(ids).toContain(readId)
    expect(res.body.data.total).toBe(2)
    expect(res.body.data.unreadCount).toBe(1)
  })

  it('rejects a non-boolean isRead value (422)', async () => {
    const res = await api.get('/api/v1/notifications').query({ isRead: 'maybe' }).set(auth(studentToken))
    expect(res.status).toBe(422)
  })
})
