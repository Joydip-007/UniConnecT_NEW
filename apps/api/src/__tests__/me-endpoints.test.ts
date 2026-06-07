import { describe, it, expect, beforeAll } from 'vitest'
import supertest from 'supertest'
import { app, loginAs, DOMAIN, CREDENTIALS } from './setup'

const api = supertest(app)
const UNI = { 'x-university-domain': DOMAIN }

let token: string

beforeAll(async () => {
  const student = await loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password)
  token = student.accessToken
})

// Regression: both endpoints used columns that don't exist —
// analytics joined the polymorphic `reactions` on a non-existent `post_id`,
// and drafts selected `events.updated_at` (events has no such column) — both 500'd.
describe('me endpoints', () => {
  it('GET /me/analytics returns profile-view and post-reach counts', async () => {
    const res = await api.get('/api/v1/users/me/analytics').set(UNI).set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      profileViews: expect.any(Object),
      postReach: expect.objectContaining({ reactions: expect.any(Number), comments: expect.any(Number) }),
    })
  })

  it('GET /me/drafts returns drafts unified across content types (incl. events)', async () => {
    const res = await api.get('/api/v1/me/drafts').set(UNI).set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data.items)).toBe(true)
    expect(res.body.data.counts).toMatchObject({ post: expect.any(Number), event: expect.any(Number) })
  })
})
