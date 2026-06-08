import { beforeAll, describe, expect, it } from 'vitest'
import supertest from 'supertest'
import { app, CREDENTIALS, DOMAIN, loginAs } from './setup'

const api = supertest(app)
let token: string

function auth(t: string) {
  return { Authorization: `Bearer ${t}`, 'x-university-domain': DOMAIN }
}

beforeAll(async () => {
  const st = await loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password)
  token = st.accessToken
})

describe('GET /users/me/progress', () => {
  it('returns the granular onboarding flags consistent with the profile', async () => {
    const [progressRes, meRes] = await Promise.all([
      api.get('/api/v1/users/me/progress').set(auth(token)),
      api.get('/api/v1/users/me').set(auth(token)),
    ])
    expect(progressRes.status).toBe(200)
    expect(meRes.status).toBe(200)

    const p = progressRes.body.data
    const profile = meRes.body.data.profile

    // New granular flags exist and are booleans.
    expect(typeof p.hasAvatar).toBe('boolean')
    expect(typeof p.hasBio).toBe('boolean')
    expect(typeof p.hasHeadline).toBe('boolean')

    // …and reflect the actual profile state.
    expect(p.hasAvatar).toBe(Boolean(profile.avatarUrl))
    expect(p.hasBio).toBe(Boolean(profile.bio))
    expect(p.hasHeadline).toBe(Boolean(profile.headline))

    // Existing fields still present and sane.
    expect(p.profileScore).toBeGreaterThanOrEqual(0)
    expect(p.profileScore).toBeLessThanOrEqual(100)
    expect(typeof p.hasMadePost).toBe('boolean')
    expect(typeof p.connectionCount).toBe('number')
  })

  it('requires authentication', async () => {
    const res = await api.get('/api/v1/users/me/progress').set('x-university-domain', DOMAIN)
    expect(res.status).toBe(401)
  })
})
