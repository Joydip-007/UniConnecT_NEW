import { beforeAll, describe, expect, it } from 'vitest'
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
  // Make alumni visible to everyone for the lookup test.
  await api.put('/api/v1/users/me/privacy').set(auth(alumniToken)).send({ online_visibility: 'everyone' })
})

describe('GET /api/v1/presence', () => {
  it('returns an offline entry for a user with no active socket', async () => {
    const res = await api.get('/api/v1/presence').query({ userIds: alumniId }).set(auth(studentToken))
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([
      expect.objectContaining({ userId: alumniId, status: 'offline' }),
    ])
  })

  it('hides presence (always offline) when online_visibility = only_me', async () => {
    await api.put('/api/v1/users/me/privacy').set(auth(alumniToken)).send({ online_visibility: 'only_me' })
    const res = await api.get('/api/v1/presence').query({ userIds: alumniId }).set(auth(studentToken))
    expect(res.status).toBe(200)
    expect(res.body.data[0]).toMatchObject({ userId: alumniId, status: 'offline', lastSeenAt: null })
    // reset
    await api.put('/api/v1/users/me/privacy').set(auth(alumniToken)).send({ online_visibility: 'connections' })
  })

  it('rejects a malformed userIds query with 422', async () => {
    const res = await api.get('/api/v1/presence').query({ userIds: 'not-a-uuid' }).set(auth(studentToken))
    expect(res.status).toBe(422)
  })
})
