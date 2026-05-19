import { describe, it, expect, beforeAll } from 'vitest'
import supertest from 'supertest'
import { app, loginAs, CREDENTIALS } from './setup'

const api = supertest(app)
let studentToken: string

beforeAll(async () => {
  const st = await loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password)
  studentToken = st.accessToken
})

function auth(token: string) {
  return { Authorization: `Bearer ${token}` }
}

describe('PATCH /api/v1/users/me/preferences', () => {
  it('persists a valid theme preference and returns it on GET /me', async () => {
    const patch = await api
      .patch('/api/v1/users/me/preferences')
      .set(auth(studentToken))
      .send({ themePreference: 'light' })

    expect(patch.status).toBe(200)
    expect(patch.body.data.themePreference).toBe('light')

    const me = await api.get('/api/v1/users/me').set(auth(studentToken))
    expect(me.status).toBe(200)
    expect(me.body.data.themePreference).toBe('light')
  })

  it('accepts dark and system', async () => {
    for (const value of ['dark', 'system'] as const) {
      const res = await api
        .patch('/api/v1/users/me/preferences')
        .set(auth(studentToken))
        .send({ themePreference: value })
      expect(res.status).toBe(200)
      expect(res.body.data.themePreference).toBe(value)
    }
  })

  it('rejects an invalid theme value with 400', async () => {
    const res = await api
      .patch('/api/v1/users/me/preferences')
      .set(auth(studentToken))
      .send({ themePreference: 'purple' })

    expect(res.status).toBe(422)
  })

  it('returns 401 without a token', async () => {
    const res = await api
      .patch('/api/v1/users/me/preferences')
      .send({ themePreference: 'dark' })
    expect(res.status).toBe(401)
  })
})
