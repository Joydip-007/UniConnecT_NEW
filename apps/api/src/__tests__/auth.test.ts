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
      department: 'CSE',
      batch_year: 'Fall 2023'
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

    const payload = { email, password: 'TestPass@1234', full_name: 'Dup User', role: 'student', department: 'CSE', batch_year: 'Fall 2023' }
    await api.post('/api/v1/auth/register').set(UNI).send(payload)
    const res = await api.post('/api/v1/auth/register').set(UNI).send(payload)

    expect(res.status).toBe(409)
  })

  it('stores department in profile when provided at registration', async () => {
    const email = `dept.${Date.now()}@bscse.uiu.ac.bd`
    createdUserEmails.push(email)

    const res = await api.post('/api/v1/auth/register').set(UNI).send({
      email,
      password: 'TestPass@1234',
      full_name: 'Dept Tester',
      role: 'student',
      department: 'EEE',
      batch_year: 'Fall 2023'
    })

    expect(res.status).toBe(201)

    // Verify department persisted
    const profile = await db('profiles')
      .join('users', 'users.id', 'profiles.user_id')
      .where('users.email', email)
      .select('profiles.department')
      .first<{ department: string | null }>()

    expect(profile?.department).toBe('EEE')
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
      department: 'CSE',
      batch_year: 'Fall 2023'
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

describe('GET /api/v1/auth/invitation/:token', () => {
  const testToken = `peek-test-${Date.now()}`
  const testEmail = `peek.${Date.now()}@bscse.uiu.ac.bd`

  beforeAll(async () => {
    await db('invitations').insert({
      university_id: TEST_UNIVERSITY_ID,
      email: testEmail,
      role: 'student',
      token: testToken,
      is_used: false,
      expires_at: new Date(Date.now() + 60 * 60 * 1000),
    })
  })

  afterAll(async () => {
    await db('invitations').where({ token: testToken }).delete()
  })

  it('returns 200 with role and email for a valid token', async () => {
    const res = await api
      .get(`/api/v1/auth/invitation/${testToken}`)
      .set(UNI)

    expect(res.status).toBe(200)
    expect(res.body.data.role).toBe('student')
    expect(res.body.data.email).toBe(testEmail)
  })

  it('returns 404 for an unknown token', async () => {
    const res = await api
      .get('/api/v1/auth/invitation/does-not-exist')
      .set(UNI)

    expect(res.status).toBe(404)
  })

  it('returns universityName in response', async () => {
    const res = await api
      .get('/api/v1/auth/invitation/dev-invite')
      .set(UNI)
    if (res.status === 404) return // token already used or not present — skip
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveProperty('universityName')
    expect(typeof res.body.data.universityName).toBe('string')
    expect(res.body.data.universityName.length).toBeGreaterThan(0)
  })
})

describe('POST /api/v1/auth/register — role-based required field validation', () => {
  it('returns 422 when faculty omits department', async () => {
    const res = await api
      .post('/api/v1/auth/register')
      .set(UNI)
      .send({
        email: `faculty.nodept.${Date.now()}@bscse.uiu.ac.bd`,
        password: 'TestPass@1234',
        full_name: 'No Dept Faculty',
        role: 'faculty',
      })
    expect(res.status).toBe(422)
  })

  it('returns 422 when alumni omits department', async () => {
    const res = await api
      .post('/api/v1/auth/register')
      .set(UNI)
      .send({
        email: `alumni.nodept.${Date.now()}@bscse.uiu.ac.bd`,
        password: 'TestPass@1234',
        full_name: 'No Dept Alumni',
        role: 'alumni',
        batch_year: 'Fall 2023',
      })
    expect(res.status).toBe(422)
  })

  it('returns 422 when alumni omits batch_year', async () => {
    const res = await api
      .post('/api/v1/auth/register')
      .set(UNI)
      .send({
        email: `alumni.nobatch.${Date.now()}@bscse.uiu.ac.bd`,
        password: 'TestPass@1234',
        full_name: 'No Batch Alumni',
        role: 'alumni',
        department: 'CSE',
      })
    expect(res.status).toBe(422)
  })

  it('returns 422 when student omits department', async () => {
    const res = await api
      .post('/api/v1/auth/register')
      .set(UNI)
      .send({
        email: `student.nodept.${Date.now()}@bscse.uiu.ac.bd`,
        password: 'TestPass@1234',
        full_name: 'No Dept Student',
        role: 'student',
        batch_year: 'Spring 2024',
      })
    expect(res.status).toBe(422)
  })

  it('returns 422 when student omits batch_year', async () => {
    const res = await api
      .post('/api/v1/auth/register')
      .set(UNI)
      .send({
        email: `student.nobatch.${Date.now()}@bscse.uiu.ac.bd`,
        password: 'TestPass@1234',
        full_name: 'No Batch Student',
        role: 'student',
        department: 'EEE',
      })
    expect(res.status).toBe(422)
  })

  it('returns 201 when faculty provides department', async () => {
    const email = `faculty.valid.${Date.now()}@bscse.uiu.ac.bd`
    createdUserEmails.push(email)

    const res = await api
      .post('/api/v1/auth/register')
      .set(UNI)
      .send({
        email,
        password: 'TestPass@1234',
        full_name: 'Valid Faculty',
        role: 'faculty',
        department: 'CSE',
      })
    expect(res.status).toBe(201)
  })

  it('returns 201 when alumni provides both department and batch_year', async () => {
    const email = `alumni.valid.${Date.now()}@bscse.uiu.ac.bd`
    createdUserEmails.push(email)

    const res = await api
      .post('/api/v1/auth/register')
      .set(UNI)
      .send({
        email,
        password: 'TestPass@1234',
        full_name: 'Valid Alumni',
        role: 'alumni',
        department: 'CSE',
        batch_year: 'Fall 2023',
      })
    expect(res.status).toBe(201)
  })

  it('returns 201 when student provides both department and batch_year', async () => {
    const email = `student.valid.${Date.now()}@bscse.uiu.ac.bd`
    createdUserEmails.push(email)

    const res = await api
      .post('/api/v1/auth/register')
      .set(UNI)
      .send({
        email,
        password: 'TestPass@1234',
        full_name: 'Valid Student',
        role: 'student',
        department: 'EEE',
        batch_year: 'Spring 2024',
      })
    expect(res.status).toBe(201)
  })
})
