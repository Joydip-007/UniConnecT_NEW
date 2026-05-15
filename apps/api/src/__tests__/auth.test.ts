import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { app, loginAs, DOMAIN, TEST_UNIVERSITY_ID, CREDENTIALS } from './setup'
import { db } from '../config/db'
import { otpService } from '../services/otp.service'

const api = supertest(app)
const UNI = { 'x-university-domain': DOMAIN }

// Track created users for cleanup
const createdUserEmails: string[] = []

afterAll(async () => {
  if (createdUserEmails.length > 0) {
    await db('users').whereIn('email', createdUserEmails).delete()
  }
})

describe('POST /api/v1/auth/register', () => {
  it('returns 201 with accessToken on success', async () => {
    const email = `reg.${Date.now()}@bscse.uiu.ac.bd`
    createdUserEmails.push(email)

    const res = await api.post('/api/v1/auth/register').set(UNI).send({
      email,
      password: 'TestPass@1234',
      full_name: 'Test Register',
      role: 'student',
    })

    if (res.status !== 201) console.log(res.body)

    expect(res.status).toBe(201)
    expect(res.body.data).toHaveProperty('accessToken')
    expect(res.body.data).toHaveProperty('message')
    expect(res.body.data).toHaveProperty('user')
    expect(res.body.data.user).toHaveProperty('id')
  })

  it('returns 409 when email already exists', async () => {
    const email = `dup.${Date.now()}@bscse.uiu.ac.bd`
    createdUserEmails.push(email)

    const payload = { email, password: 'TestPass@1234', full_name: 'Dup User', role: 'student' }
    await api.post('/api/v1/auth/register').set(UNI).send(payload)
    const res = await api.post('/api/v1/auth/register').set(UNI).send(payload)

    expect(res.status).toBe(409)
  })
})

describe('POST /api/v1/auth/verify-otp', () => {
  it('returns 422 with OTP_INVALID when OTP is wrong', async () => {
    // Register a fresh user so an OTP is stored in Redis
    const email = `otp.${Date.now()}@bscse.uiu.ac.bd`
    createdUserEmails.push(email)

    const reg = await api.post('/api/v1/auth/register').set(UNI).send({
      email,
      password: 'TestPass@1234',
      full_name: 'OTP Tester',
      role: 'student',
    })
    expect(reg.status).toBe(201)

    // Verify with wrong OTP
    const res = await api.post('/api/v1/auth/verify-otp').set(UNI).send({
      email,
      otp: '000000',
      purpose: 'verify',
    })

    expect(res.status).toBe(422)
    expect(res.body.code).toBe('OTP_INVALID')
  })
})

describe('POST /api/v1/auth/login', () => {
  it('returns 401 with wrong password', async () => {
    const res = await api.post('/api/v1/auth/login').set(UNI).send({
      email: CREDENTIALS.student.email,
      password: 'WrongPassword1!',
    })

    expect(res.status).toBe(401)
  })

  it('returns 200 with valid credentials', async () => {
    const res = await api.post('/api/v1/auth/login').set(UNI).send({
      email: CREDENTIALS.student.email,
      password: CREDENTIALS.student.password,
    })

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveProperty('accessToken')
    expect(res.body.data).toHaveProperty('user')
  })
})

describe('POST /api/v1/auth/refresh', () => {
  it('returns 200 with a new accessToken when cookie is valid', async () => {
    const { cookie } = await loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password)

    const res = await api
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie)
      .set(UNI)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveProperty('accessToken')
  })

  it('returns 401 when no cookie is sent', async () => {
    const res = await api.post('/api/v1/auth/refresh').set(UNI)

    expect(res.status).toBe(401)
  })
})

describe('POST /api/v1/auth/logout', () => {
  it('returns 204 and clears cookie', async () => {
    const { accessToken, cookie } = await loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password)

    const res = await api
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', cookie)
      .set(UNI)

    expect(res.status).toBe(204)
  })
})

describe('GET /api/v1/auth/me', () => {
  let accessToken: string

  beforeAll(async () => {
    const tokens = await loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password)
    accessToken = tokens.accessToken
  })

  it('returns 200 with user object when authenticated', async () => {
    const res = await api
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .set(UNI)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveProperty('id')
    expect(res.body.data).toHaveProperty('email')
    expect(res.body.data.email).toBe(CREDENTIALS.student.email)
  })

  it('returns 401 when no token is sent', async () => {
    const res = await api.get('/api/v1/auth/me').set(UNI)

    expect(res.status).toBe(401)
  })

  it('returns real profile data including department', async () => {
    const { accessToken: token } = await loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password)

    // Set department directly in DB so we can verify the field comes back
    const userRow = await db('users').where({ email: CREDENTIALS.student.email }).select('id').first()
    await db('profiles').where({ user_id: userRow.id }).update({ department: 'CSE', batch_year: '2025' })

    const res = await api.get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .set(UNI)

    expect(res.status).toBe(200)
    expect(res.body.data.profile.department).toBe('CSE')
    expect(res.body.data.profile.batchYear).toBe('2025')

    // Clean up
    await db('profiles').where({ user_id: userRow.id }).update({ department: null, batch_year: null })
  })
})
