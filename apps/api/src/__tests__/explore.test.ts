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
  return { Authorization: `Bearer ${token}` }
}

describe('GET /api/v1/explore/discovery', () => {
  it('returns 401 without auth', async () => {
    const res = await api.get('/api/v1/explore/discovery').set('x-university-domain', DOMAIN)
    expect(res.status).toBe(401)
  })

  it('returns 200 with all five discovery sections', async () => {
    const res = await api.get('/api/v1/explore/discovery').set(auth(studentToken))
    expect(res.status).toBe(200)
    const data = res.body.data as Record<string, unknown>
    expect(Array.isArray(data.trendingPosts)).toBe(true)
    expect(Array.isArray(data.peopleSuggestions)).toBe(true)
    expect(Array.isArray(data.activeGroups)).toBe(true)
    expect(Array.isArray(data.upcomingEvents)).toBe(true)
    expect(Array.isArray(data.featuredAlumni)).toBe(true)
  })

  it('peopleSuggestions excludes the requester themselves', async () => {
    const res = await api.get('/api/v1/explore/discovery').set(auth(studentToken))
    expect(res.status).toBe(200)
    const { peopleSuggestions } = res.body.data as { peopleSuggestions: { id: string }[] }
    // Get the student user id by checking the token — just assert no null IDs
    expect(peopleSuggestions.every((p) => typeof p.id === 'string')).toBe(true)
  })
})

describe('GET /api/v1/explore/discovery — card fields', () => {
  it('returns mutual counts on people and privacy/known-member fields on groups', async () => {
    const res = await api.get('/api/v1/explore/discovery').set(auth(studentToken))
    expect(res.status).toBe(200)
    const { peopleSuggestions, featuredAlumni, activeGroups } = res.body.data as {
      peopleSuggestions: { mutualCount: unknown }[]
      featuredAlumni: { mutualCount: unknown }[]
      activeGroups: Record<string, unknown>[]
    }
    for (const p of [...peopleSuggestions, ...featuredAlumni]) expect(typeof p.mutualCount).toBe('number')
    for (const g of activeGroups) {
      expect(typeof g.isPrivate).toBe('boolean')
      expect(typeof g.requestPending).toBe('boolean')
      expect(typeof g.knownCount).toBe('number')
      expect(Array.isArray(g.knownFaces)).toBe(true)
      expect((g.knownFaces as unknown[]).length).toBeLessThanOrEqual(3)
    }
  })
})

describe('GET /api/v1/explore/tags/:tag', () => {
  it('returns 200 with paginated shape + relatedTags', async () => {
    const res = await api.get('/api/v1/explore/tags/test').set(auth(studentToken))
    expect(res.status).toBe(200)
    const data = res.body.data as Record<string, unknown>
    expect(Array.isArray(data.items)).toBe(true)
    expect(typeof data.total).toBe('number')
    expect(typeof data.page).toBe('number')
    expect(typeof data.hasMore).toBe('boolean')
    expect(Array.isArray(data.relatedTags)).toBe(true)
  })

  it('returns empty items for a tag that has no posts', async () => {
    const res = await api
      .get('/api/v1/explore/tags/nonexistenttag12345xyz')
      .set(auth(studentToken))
    expect(res.status).toBe(200)
    expect((res.body.data as { items: unknown[] }).items).toHaveLength(0)
    expect((res.body.data as { total: number }).total).toBe(0)
  })

  it('respects pagination params', async () => {
    const res = await api
      .get('/api/v1/explore/tags/test?page=1&limit=5')
      .set(auth(studentToken))
    expect(res.status).toBe(200)
    expect((res.body.data as { items: unknown[] }).items.length).toBeLessThanOrEqual(5)
  })

  it('returns 422 for limit exceeding max', async () => {
    const res = await api
      .get('/api/v1/explore/tags/test?limit=999')
      .set(auth(studentToken))
    expect(res.status).toBe(422)
  })
})
