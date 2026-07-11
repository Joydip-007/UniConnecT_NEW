import { describe, it, expect, beforeAll } from 'vitest'
import supertest from 'supertest'
import { app, loginAs, CREDENTIALS, DOMAIN } from './setup'

const api = supertest(app)

let studentToken: string

beforeAll(async () => {
  const st = await loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password)
  studentToken = st.accessToken
})

function auth(token: string) {
  return { Authorization: `Bearer ${token}`, 'x-university-domain': DOMAIN }
}

describe('GET /api/v1/search', () => {
  it('returns 422 when q is missing', async () => {
    const res = await api.get('/api/v1/search').set(auth(studentToken))
    expect(res.status).toBe(422)
  })

  it('returns 422 when q is less than 2 characters', async () => {
    const res = await api.get('/api/v1/search?q=a').set(auth(studentToken))
    expect(res.status).toBe(422)
  })

  it('returns 200 with all five category arrays', async () => {
    const res = await api.get('/api/v1/search?q=user').set(auth(studentToken))
    expect(res.status).toBe(200)
    const data = res.body.data as Record<string, unknown>
    expect(data).toHaveProperty('people')
    expect(data).toHaveProperty('posts')
    expect(data).toHaveProperty('jobs')
    expect(data).toHaveProperty('events')
    expect(data).toHaveProperty('groups')
    expect(Array.isArray(data.people)).toBe(true)
    expect(Array.isArray(data.posts)).toBe(true)
    expect(Array.isArray(data.jobs)).toBe(true)
    expect(Array.isArray(data.events)).toBe(true)
    expect(Array.isArray(data.groups)).toBe(true)
  })

  it('returns 401 without auth token', async () => {
    const res = await api.get('/api/v1/search?q=user').set('x-university-domain', DOMAIN)
    expect(res.status).toBe(401)
  })
})

describe('GET /api/v1/search/people', () => {
  it('returns 200 with paginated shape', async () => {
    const res = await api.get('/api/v1/search/people?q=user').set(auth(studentToken))
    expect(res.status).toBe(200)
    const data = res.body.data as Record<string, unknown>
    expect(data).toHaveProperty('items')
    expect(data).toHaveProperty('total')
    expect(data).toHaveProperty('page')
    expect(data).toHaveProperty('hasMore')
    expect(Array.isArray(data.items)).toBe(true)
  })

  it('people items have expected fields', async () => {
    const res = await api.get('/api/v1/search/people?q=student').set(auth(studentToken))
    expect(res.status).toBe(200)
    const items = (res.body.data as { items: Record<string, unknown>[] }).items
    if (items.length > 0) {
      const item = items[0]!
      expect(item).toHaveProperty('id')
      expect(item).toHaveProperty('fullName')
      expect(item).toHaveProperty('role')
    }
  })
})

describe('GET /api/v1/search/posts', () => {
  it('returns 200 with paginated shape', async () => {
    const res = await api.get('/api/v1/search/posts?q=test').set(auth(studentToken))
    expect(res.status).toBe(200)
    const data = res.body.data as Record<string, unknown>
    expect(data).toHaveProperty('items')
    expect(data).toHaveProperty('total')
    expect(Array.isArray(data.items)).toBe(true)
  })
})

describe('GET /api/v1/search/jobs', () => {
  it('returns 200 with paginated shape', async () => {
    const res = await api.get('/api/v1/search/jobs?q=engineer').set(auth(studentToken))
    expect(res.status).toBe(200)
    const data = res.body.data as Record<string, unknown>
    expect(data).toHaveProperty('items')
    expect(Array.isArray(data.items)).toBe(true)
  })
})

describe('GET /api/v1/search/events', () => {
  it('returns 200 with paginated shape', async () => {
    const res = await api.get('/api/v1/search/events?q=tech').set(auth(studentToken))
    expect(res.status).toBe(200)
    const data = res.body.data as Record<string, unknown>
    expect(data).toHaveProperty('items')
    expect(Array.isArray(data.items)).toBe(true)
  })
})

describe('GET /api/v1/search/groups', () => {
  it('returns 200 with paginated shape', async () => {
    const res = await api.get('/api/v1/search/groups?q=club').set(auth(studentToken))
    expect(res.status).toBe(200)
    const data = res.body.data as Record<string, unknown>
    expect(data).toHaveProperty('items')
    expect(Array.isArray(data.items)).toBe(true)
  })
})
