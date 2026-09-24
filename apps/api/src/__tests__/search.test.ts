import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { app, loginAs, CREDENTIALS, DOMAIN, TEST_UNIVERSITY_ID } from './setup'
import { db } from '../config/db'

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

  it('returns per-category totals that cover the preview rows', async () => {
    const res = await api.get('/api/v1/search?q=user&limit=2').set(auth(studentToken))
    expect(res.status).toBe(200)
    const data = res.body.data as Record<string, unknown[]> & { counts: Record<string, number> }
    for (const key of ['people', 'posts', 'jobs', 'events', 'groups']) {
      expect(typeof data.counts[key]).toBe('number')
      expect(data.counts[key]).toBeGreaterThanOrEqual(data[key].length)
    }
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

describe('GET /api/v1/search/groups — private groups', () => {
  let privateGroupId: string

  beforeAll(async () => {
    const creator = await db('users').where({ university_id: TEST_UNIVERSITY_ID, role: 'faculty' }).first('id')
    const [row] = await db('groups')
      .insert({
        university_id: TEST_UNIVERSITY_ID,
        name: 'Zephyrquill private circle',
        description: 'Fixture for the private-group search flag',
        type: 'club',
        is_private: true,
        created_by: creator!.id,
      })
      .returning('id')
    privateGroupId = row.id
  })

  afterAll(async () => {
    if (privateGroupId) await db('groups').where({ id: privateGroupId }).delete()
  })

  // Explore uses the flag to explain the lock instead of linking a non-member to "Group not found".
  it('flags a private group the viewer is not a member of', async () => {
    const res = await api.get('/api/v1/search/groups?q=Zephyrquill').set(auth(studentToken))
    expect(res.status).toBe(200)
    const item = (res.body.data.items as { id: string; isPrivate: boolean; isMember: boolean }[])
      .find((g) => g.id === privateGroupId)
    expect(item).toMatchObject({ isPrivate: true, isMember: false })
  })
})

describe('GET /api/v1/search/posts — author role', () => {
  let postId: string

  beforeAll(async () => {
    const author = await db('users').where({ university_id: TEST_UNIVERSITY_ID, role: 'faculty' }).first('id')
    const [row] = await db('posts')
      .insert({ university_id: TEST_UNIVERSITY_ID, author_id: author!.id, content: 'Quibblewort lecture notes', type: 'post' })
      .returning('id')
    postId = row.id
  })

  afterAll(async () => {
    if (postId) await db('posts').where({ id: postId }).delete()
  })

  // The role badge is part of every author's identity, so search must carry it like the feed does.
  it('returns the author role with each post', async () => {
    const res = await api.get('/api/v1/search/posts?q=Quibblewort').set(auth(studentToken))
    expect(res.status).toBe(200)
    const item = (res.body.data.items as { id: string; author: { role: string } }[]).find((p) => p.id === postId)
    expect(item?.author.role).toBe('faculty')
  })
})
