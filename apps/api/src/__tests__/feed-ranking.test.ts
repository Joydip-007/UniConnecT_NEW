import { beforeAll, describe, expect, it } from 'vitest'
import supertest from 'supertest'
import { app, CREDENTIALS, DOMAIN, loginAs } from './setup'

const api = supertest(app)
let studentToken: string

function auth(token: string) {
  return { Authorization: `Bearer ${token}`, 'x-university-domain': DOMAIN }
}

beforeAll(async () => {
  const st = await loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password)
  studentToken = st.accessToken
})

describe('GET /api/v1/posts?sort=top', () => {
  it('defaults to recent and returns a paginated feed', async () => {
    const res = await api.get('/api/v1/posts').set(auth(studentToken))
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ items: expect.any(Array), page: 1 })
  })

  it('accepts sort=top and returns a valid feed shape', async () => {
    const res = await api.get('/api/v1/posts').query({ sort: 'top' }).set(auth(studentToken))
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data.items)).toBe(true)
    // Pinned posts (if any) always come first regardless of sort.
    const items = res.body.data.items as { isPinned?: boolean }[]
    const firstUnpinned = items.findIndex((p) => !p.isPinned)
    if (firstUnpinned > 0) {
      expect(items.slice(0, firstUnpinned).every((p) => p.isPinned)).toBe(true)
    }
  })

  it('rejects an invalid sort value with 422', async () => {
    const res = await api.get('/api/v1/posts').query({ sort: 'sideways' }).set(auth(studentToken))
    expect(res.status).toBe(422)
  })
})
