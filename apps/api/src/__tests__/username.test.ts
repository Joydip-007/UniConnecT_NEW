import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import supertest from 'supertest'
import bcrypt from 'bcryptjs'
import { app, loginAs, CREDENTIALS, TEST_UNIVERSITY_ID } from './setup'
import { db } from '../config/db'

const api = supertest(app)

function auth(token: string) {
  return { Authorization: `Bearer ${token}` }
}

let studentToken: string
let alumniToken: string
let studentUsername: string
let alumniUsername: string

// A throwaway second tenant + user, used to prove username lookup is tenant-scoped.
const OTHER_UNI_ID = '00000000-0000-4000-8000-0000000000ff'
const OTHER_USER_ID = '00000000-0000-4000-8000-0000000000fe'
const SHARED_USERNAME = 'sharedhandle'

beforeAll(async () => {
  const [st, al] = await Promise.all([
    loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password),
    loginAs(CREDENTIALS.alumni.email, CREDENTIALS.alumni.password),
  ])
  studentToken = st.accessToken
  alumniToken = al.accessToken

  const [stMe, alMe] = await Promise.all([
    api.get('/api/v1/users/me').set(auth(studentToken)),
    api.get('/api/v1/users/me').set(auth(alumniToken)),
  ])
  studentUsername = (stMe.body as { data: { username: string } }).data.username
  alumniUsername = (alMe.body as { data: { username: string } }).data.username

  // Second university with a user that shares a username with a user we'll create
  // under the primary tenant — to assert lookups never cross the tenant boundary.
  await db('universities')
    .insert({ id: OTHER_UNI_ID, name: 'Other U', domain: 'other.test', plan: 'starter' })
    .onConflict('id')
    .merge({ is_active: true })
  await db('users')
    .insert({
      id: OTHER_USER_ID,
      university_id: OTHER_UNI_ID,
      username: SHARED_USERNAME,
      email: 'someone@other.test',
      password_hash: await bcrypt.hash('x', 4),
      role: 'student',
      is_verified: true,
      is_active: true,
    })
    .onConflict('id')
    .merge({ username: SHARED_USERNAME })
  await db('profiles')
    .insert({ user_id: OTHER_USER_ID, full_name: 'Other Tenant User' })
    .onConflict('user_id')
    .ignore()
})

afterAll(async () => {
  await db('profiles').where({ user_id: OTHER_USER_ID }).delete()
  await db('users').where({ id: OTHER_USER_ID }).delete()
  await db('universities').where({ id: OTHER_UNI_ID }).delete()
})

describe('GET /api/v1/users/me', () => {
  it('includes a username', () => {
    expect(typeof studentUsername).toBe('string')
    expect(studentUsername.length).toBeGreaterThanOrEqual(3)
  })
})

describe('GET /api/v1/users/by-username/:username', () => {
  it('resolves a username to the same payload as /users/:id', async () => {
    const res = await api.get(`/api/v1/users/by-username/${studentUsername}`).set(auth(alumniToken))
    expect(res.status).toBe(200)
    expect(res.body.data.username).toBe(studentUsername)
    expect(res.body.data.profile).toHaveProperty('fullName')
  })

  it('is case-insensitive', async () => {
    const res = await api
      .get(`/api/v1/users/by-username/${studentUsername.toUpperCase()}`)
      .set(auth(alumniToken))
    expect(res.status).toBe(200)
    expect(res.body.data.username).toBe(studentUsername)
  })

  it('returns 404 for an unknown username', async () => {
    const res = await api.get('/api/v1/users/by-username/nobody_here_xyz').set(auth(studentToken))
    expect(res.status).toBe(404)
  })

  it('does not resolve a username belonging to another university', async () => {
    // Give the primary-tenant student the same handle the other-tenant user has…
    await db('users').where({ id: OTHER_USER_ID }).update({ username: SHARED_USERNAME })
    const primaryRes = await api
      .patch('/api/v1/users/me')
      .set(auth(studentToken))
      .send({ username: SHARED_USERNAME })
    expect(primaryRes.status).toBe(200)

    // …and confirm the lookup under the primary tenant returns the primary user.
    const res = await api.get(`/api/v1/users/by-username/${SHARED_USERNAME}`).set(auth(alumniToken))
    expect(res.status).toBe(200)
    expect(res.body.data.username).toBe(SHARED_USERNAME)
    expect(res.body.data.id).not.toBe(OTHER_USER_ID)

    // Restore the student's username so later assertions stay stable.
    await api.patch('/api/v1/users/me').set(auth(studentToken)).send({ username: studentUsername })
  })
})

describe('GET /api/v1/users/username-available', () => {
  it('reports a free username as available', async () => {
    const res = await api
      .get('/api/v1/users/username-available')
      .query({ username: 'totally_free_handle_42' })
      .set(auth(studentToken))
    expect(res.status).toBe(200)
    expect(res.body.data.available).toBe(true)
  })

  it('reports a taken username as unavailable', async () => {
    const res = await api
      .get('/api/v1/users/username-available')
      .query({ username: alumniUsername })
      .set(auth(studentToken))
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({ available: false, reason: 'taken' })
  })

  it('treats the caller’s own username as available', async () => {
    const res = await api
      .get('/api/v1/users/username-available')
      .query({ username: studentUsername })
      .set(auth(studentToken))
    expect(res.status).toBe(200)
    expect(res.body.data.available).toBe(true)
  })

  it('flags reserved usernames', async () => {
    const res = await api
      .get('/api/v1/users/username-available')
      .query({ username: 'admin' })
      .set(auth(studentToken))
    expect(res.body.data).toEqual({ available: false, reason: 'reserved' })
  })

  it('flags malformed usernames', async () => {
    const res = await api
      .get('/api/v1/users/username-available')
      .query({ username: 'a' })
      .set(auth(studentToken))
    expect(res.body.data).toEqual({ available: false, reason: 'invalid' })
  })
})

describe('PATCH /api/v1/users/me (username)', () => {
  it('changes the username and reflects it on /me', async () => {
    const next = 'student_renamed_1'
    const res = await api.patch('/api/v1/users/me').set(auth(studentToken)).send({ username: next })
    expect(res.status).toBe(200)
    expect(res.body.data.username).toBe(next)
    // restore
    await api.patch('/api/v1/users/me').set(auth(studentToken)).send({ username: studentUsername })
  })

  it('rejects a username already taken within the tenant with 409', async () => {
    const res = await api
      .patch('/api/v1/users/me')
      .set(auth(studentToken))
      .send({ username: alumniUsername })
    expect(res.status).toBe(409)
  })

  it('rejects a malformed username with a validation error', async () => {
    const res = await api.patch('/api/v1/users/me').set(auth(studentToken)).send({ username: 'no' })
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)
  })
})
