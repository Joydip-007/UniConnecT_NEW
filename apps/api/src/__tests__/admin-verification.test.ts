import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { app, loginAs, DOMAIN, TEST_UNIVERSITY_ID, CREDENTIALS } from './setup'
import { db } from '../config/db'

const api = supertest(app)
const UNI = { 'x-university-domain': DOMAIN }

let adminToken: string
let facultyToken: string
let unverifiedUserId: string

beforeAll(async () => {
  const [admin, faculty] = await Promise.all([
    loginAs(CREDENTIALS.admin.email, CREDENTIALS.admin.password),
    loginAs(CREDENTIALS.faculty.email, CREDENTIALS.faculty.password),
  ])
  adminToken = admin.accessToken
  facultyToken = faculty.accessToken

  const email = `unverified.test.${Date.now()}@bscse.uiu.ac.bd`
  const [user] = await db('users')
    .insert({
      university_id: TEST_UNIVERSITY_ID,
      email,
      username: `unverified_test_${Date.now()}`,
      password_hash: 'x',
      role: 'student',
      is_verified: false,
      is_active: true,
    })
    .returning<{ id: string }[]>('id')
  unverifiedUserId = user.id
  await db('profiles').insert({ user_id: unverifiedUserId, full_name: 'Unverified Test User' })
})

afterAll(async () => {
  await db('profiles').where({ user_id: unverifiedUserId }).delete()
  await db('users').where({ id: unverifiedUserId }).delete()
})

describe('GET /api/v1/admin/stats — no verification counters', () => {
  // Registration is OTP-gated, so nothing ever waits on an admin to verify; the stats
  // counters were removed in 0bac35cc. Unverified users stay reachable via the users
  // list filter and the mark-verified action below.
  it('does not report verification counts, even with an unverified user present', async () => {
    const res = await api
      .get('/api/v1/admin/stats')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data).not.toHaveProperty('verificationsByRole')
    expect(res.body.data).not.toHaveProperty('verificationRequests')
  })
})

describe('GET /api/v1/admin/users?verified=unverified', () => {
  it('returns only unverified users', async () => {
    const res = await api
      .get('/api/v1/admin/users?verified=unverified&limit=100')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    const ids: string[] = res.body.data.items.map((u: { id: string }) => u.id)
    expect(ids).toContain(unverifiedUserId)
    expect(res.body.data.items.every((u: { isVerified: boolean }) => u.isVerified === false)).toBe(true)
  })
})

describe('PATCH /api/v1/admin/users/:userId/verify', () => {
  it('marks the user verified', async () => {
    const res = await api
      .patch(`/api/v1/admin/users/${unverifiedUserId}/verify`)
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({ userId: unverifiedUserId, isVerified: true })

    const row = await db('users').where({ id: unverifiedUserId }).first<{ is_verified: boolean }>('is_verified')
    expect(row?.is_verified).toBe(true)
  })

  it('returns 400 when the user is already verified', async () => {
    const res = await api
      .patch(`/api/v1/admin/users/${unverifiedUserId}/verify`)
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(400)
  })

  it('returns 403 for faculty role (admin-only endpoint)', async () => {
    const res = await api
      .patch(`/api/v1/admin/users/${unverifiedUserId}/verify`)
      .set(UNI)
      .set('Authorization', `Bearer ${facultyToken}`)

    expect(res.status).toBe(403)
  })

  it('returns 404 for a non-existent user', async () => {
    const res = await api
      .patch('/api/v1/admin/users/00000000-0000-0000-0000-000000000000/verify')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(404)
  })
})
