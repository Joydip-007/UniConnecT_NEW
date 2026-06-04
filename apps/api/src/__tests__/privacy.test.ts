import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import supertest from 'supertest'
import { app, CREDENTIALS, DOMAIN, loginAs } from './setup'

const api = supertest(app)
let studentToken: string
let alumniToken: string
let alumniId: string

function auth(token: string) {
  return { Authorization: `Bearer ${token}`, 'x-university-domain': DOMAIN }
}

beforeAll(async () => {
  const st = await loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password)
  const al = await loginAs(CREDENTIALS.alumni.email, CREDENTIALS.alumni.password)
  studentToken = st.accessToken
  alumniToken = al.accessToken
  const me = await api.get('/api/v1/users/me').set(auth(alumniToken))
  alumniId = me.body.data.id
})

afterAll(async () => {
  // Reset alumni privacy to defaults so other suites are unaffected.
  await api
    .put('/api/v1/users/me/privacy')
    .set(auth(alumniToken))
    .send({
      sections: { contact_info: 'connections' },
      discoverable: true,
      connection_requests: 'everyone',
    })
})

describe('Privacy preferences API', () => {
  it('GET returns the full default object when no row exists', async () => {
    const res = await api.get('/api/v1/users/me/privacy').set(auth(studentToken))
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      sections: { contact_info: expect.any(String) },
      discoverable: true,
      connection_requests: 'everyone',
    })
  })

  it('PUT partial update merges over current prefs', async () => {
    const res = await api
      .put('/api/v1/users/me/privacy')
      .set(auth(studentToken))
      .send({ sections: { experience: 'only_me' } })
    expect(res.status).toBe(200)
    expect(res.body.data.sections.experience).toBe('only_me')
    // unrelated keys preserved
    expect(res.body.data.discoverable).toBe(true)
  })
})

describe('Privacy enforcement', () => {
  it('contact_info=only_me hides contact info from a non-connection', async () => {
    await api
      .put('/api/v1/users/me/privacy')
      .set(auth(alumniToken))
      .send({ sections: { contact_info: 'only_me' } })

    const res = await api.get(`/api/v1/users/${alumniId}`).set(auth(studentToken))
    expect(res.status).toBe(200)
    expect(res.body.data.profile.websiteUrl).toBeNull()
    expect(res.body.data.profile.phone).toBeNull()
    expect(res.body.data.visibility.contact_info).toBe('hidden')
  })

  it('discoverable=false removes the user from suggestions', async () => {
    await api.put('/api/v1/users/me/privacy').set(auth(alumniToken)).send({ discoverable: false })

    const res = await api.get('/api/v1/users/suggestions').set(auth(studentToken))
    expect(res.status).toBe(200)
    const ids = (res.body.data as { id: string }[]).map((u) => u.id)
    expect(ids).not.toContain(alumniId)
  })

  it('connection_requests=only_me rejects an incoming request with 403', async () => {
    await api
      .put('/api/v1/users/me/privacy')
      .set(auth(alumniToken))
      .send({ connection_requests: 'only_me' })

    const res = await api
      .post(`/api/v1/connections/request/${alumniId}`)
      .set(auth(studentToken))
      .send({})
    expect(res.status).toBe(403)
  })
})
