import { describe, it, expect, beforeAll } from 'vitest'
import supertest from 'supertest'
import { app, loginAs, CREDENTIALS } from './setup'
import { db } from '../config/db'

const api = supertest(app)

let studentToken: string
let alumniToken: string
let studentId: string
let alumniId: string

beforeAll(async () => {
  const [st, al] = await Promise.all([
    loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password),
    loginAs(CREDENTIALS.alumni.email, CREDENTIALS.alumni.password),
  ])
  studentToken = st.accessToken
  alumniToken = al.accessToken

  // Resolve user IDs from /me
  const [stMe, alMe] = await Promise.all([
    api.get('/api/v1/users/me').set('Authorization', `Bearer ${studentToken}`),
    api.get('/api/v1/users/me').set('Authorization', `Bearer ${alumniToken}`),
  ])
  studentId = (stMe.body as { data: { id: string } }).data.id
  alumniId = (alMe.body as { data: { id: string } }).data.id
})

function auth(token: string) {
  return { Authorization: `Bearer ${token}` }
}

describe('GET /api/v1/users/me', () => {
  it('returns 200 with the current user profile', async () => {
    const res = await api.get('/api/v1/users/me').set(auth(studentToken))

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveProperty('id')
    expect(res.body.data.email).toBe(CREDENTIALS.student.email)
  })
})

describe('PATCH /api/v1/users/me', () => {
  it('returns 200 with updated profile data', async () => {
    const res = await api
      .patch('/api/v1/users/me')
      .set(auth(studentToken))
      .send({ bio: 'Integration test bio', headline: 'Test Student' })

    expect(res.status).toBe(200)
    expect(res.body.data.profile.bio).toBe('Integration test bio')
  })
})

describe('POST /api/v1/users/:userId/follow', () => {
  it('returns 200 when student follows alumni', async () => {
    // Ensure not already following
    await db('follows').where({ follower_id: studentId, following_id: alumniId }).delete()

    const res = await api
      .post(`/api/v1/users/${alumniId}/follow`)
      .set(auth(studentToken))

    expect(res.status).toBe(200)
    expect(res.body.data.following).toBe(true)
  })

  it('returns 400 when user tries to follow themselves', async () => {
    const res = await api
      .post(`/api/v1/users/${studentId}/follow`)
      .set(auth(studentToken))

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('SELF_FOLLOW_NOT_ALLOWED')
  })
})

describe('DELETE /api/v1/users/:userId/follow', () => {
  it('returns 200 when student unfollows alumni', async () => {
    // Ensure following first
    await db('follows')
      .insert({ follower_id: studentId, following_id: alumniId })
      .onConflict(['follower_id', 'following_id'])
      .ignore()

    const res = await api
      .delete(`/api/v1/users/${alumniId}/follow`)
      .set(auth(studentToken))

    expect(res.status).toBe(200)
    expect(res.body.data.following).toBe(false)
  })
})

describe('GET /api/v1/users/suggestions', () => {
  it('returns 200 with an array of suggestions', async () => {
    const res = await api.get('/api/v1/users/suggestions').set(auth(studentToken))

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  })
})
