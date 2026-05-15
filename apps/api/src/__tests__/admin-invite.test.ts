import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { app, loginAs, DOMAIN, TEST_UNIVERSITY_ID, CREDENTIALS } from './setup'
import { db } from '../config/db'

const api = supertest(app)
const UNI = { 'x-university-domain': DOMAIN }

let adminToken: string
let staffToken: string

beforeAll(async () => {
  const [admin, staff] = await Promise.all([
    loginAs(CREDENTIALS.admin.email, CREDENTIALS.admin.password),
    loginAs(CREDENTIALS.staff.email, CREDENTIALS.staff.password),
  ])
  adminToken = admin.accessToken
  staffToken = staff.accessToken
})

afterAll(async () => {
  await db.raw(
    `DELETE FROM invitations WHERE university_id = ? AND (email LIKE 'inv.test%' OR email LIKE 'bulk.test%')`,
    [TEST_UNIVERSITY_ID],
  )
})

describe('POST /api/v1/admin/invitations', () => {
  it('returns 201 with invitation data including token', async () => {
    const email = `inv.test.${Date.now()}@uiu.ac.bd`
    const res = await api
      .post('/api/v1/admin/invitations')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email, role: 'student', expires_in_days: 7 })

    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({ email, role: 'student' })
    expect(res.body.data).toHaveProperty('id')
    expect(res.body.data).toHaveProperty('token')
  })

  it('returns 401 without auth token', async () => {
    const res = await api
      .post('/api/v1/admin/invitations')
      .set(UNI)
      .send({ email: 'noauth@uiu.ac.bd', role: 'student', expires_in_days: 7 })

    expect(res.status).toBe(401)
  })
})

describe('POST /api/v1/admin/invitations/bulk', () => {
  it('returns 201 with created count and emails list', async () => {
    const ts = Date.now()
    const emails = [`bulk.test.a.${ts}@uiu.ac.bd`, `bulk.test.b.${ts}@uiu.ac.bd`]
    const res = await api
      .post('/api/v1/admin/invitations/bulk')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ emails, role: 'alumni', expires_in_days: 7 })

    expect(res.status).toBe(201)
    expect(res.body.data.created).toBe(2)
    expect(res.body.data.emails).toEqual(expect.arrayContaining(emails))
  })

  it('deduplicates emails and counts only unique', async () => {
    const ts = Date.now()
    const email = `bulk.test.dup.${ts}@uiu.ac.bd`
    const res = await api
      .post('/api/v1/admin/invitations/bulk')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ emails: [email, email, email], role: 'student', expires_in_days: 7 })

    expect(res.status).toBe(201)
    expect(res.body.data.created).toBe(1)
  })

  it('returns 422 when emails array is empty', async () => {
    const res = await api
      .post('/api/v1/admin/invitations/bulk')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ emails: [], role: 'student', expires_in_days: 7 })

    expect(res.status).toBe(422)
  })

  it('returns 422 when emails array exceeds 50', async () => {
    const emails = Array.from({ length: 51 }, (_, i) => `bulk.test.over${i}@uiu.ac.bd`)
    const res = await api
      .post('/api/v1/admin/invitations/bulk')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ emails, role: 'student', expires_in_days: 7 })

    expect(res.status).toBe(422)
  })

  it('returns 403 for staff role (admin-only endpoint)', async () => {
    const res = await api
      .post('/api/v1/admin/invitations/bulk')
      .set(UNI)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ emails: [`bulk.test.staff.${Date.now()}@uiu.ac.bd`], role: 'student', expires_in_days: 7 })

    expect(res.status).toBe(403)
  })
})
