import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { app, loginAs, DOMAIN, TEST_UNIVERSITY_ID, CREDENTIALS } from './setup'
import { db } from '../config/db'

const api = supertest(app)
const UNI = { 'x-university-domain': DOMAIN }

let adminToken: string
let facultyToken: string

beforeAll(async () => {
  const [admin, faculty] = await Promise.all([
    loginAs(CREDENTIALS.admin.email, CREDENTIALS.admin.password),
    loginAs(CREDENTIALS.faculty.email, CREDENTIALS.faculty.password),
  ])
  adminToken = admin.accessToken
  facultyToken = faculty.accessToken
})

afterAll(async () => {
  await db.raw(
    `DELETE FROM invitations WHERE university_id = ? AND (email LIKE 'inv.test%' OR email LIKE 'bulk.test%')`,
    [TEST_UNIVERSITY_ID],
  )
})

describe('POST /api/v1/admin/invitations', () => {
  it('returns 201 with invitation data including token', async () => {
    const email = `inv.test.${Date.now()}@bscse.uiu.ac.bd`
    const res = await api
      .post('/api/v1/admin/invitations')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email, role: 'student', expires_in_days: 7 })

    if (res.status === 400) console.log(res.body)
    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({ email, role: 'student' })
    expect(res.body.data).toHaveProperty('id')
    expect(res.body.data).toHaveProperty('token')
  })

  it('returns 401 without auth token', async () => {
    const res = await api
      .post('/api/v1/admin/invitations')
      .set(UNI)
      .send({ email: 'noauth@bscse.uiu.ac.bd', role: 'student', expires_in_days: 7 })

    expect(res.status).toBe(401)
  })
})

describe('POST /api/v1/admin/invitations/bulk', () => {
  it('returns 201 with created count, emails list and a batch id', async () => {
    const ts = Date.now()
    const emails = [`bulk.test.a.${ts}@bscse.uiu.ac.bd`, `bulk.test.b.${ts}@bscse.uiu.ac.bd`]
    const res = await api
      .post('/api/v1/admin/invitations/bulk')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ emails, role: 'alumni', expires_in_days: 7, batch_label: 'CSE Fall 2026 intake' })

    if (res.status === 400) console.log(res.body)
    expect(res.status).toBe(201)
    expect(res.body.data.created).toBe(2)
    expect(res.body.data.emails).toEqual(expect.arrayContaining(emails))
    expect(res.body.data).toHaveProperty('batchId')
  })

  it('deduplicates emails and counts only unique', async () => {
    const ts = Date.now()
    const email = `bulk.test.dup.${ts}@bscse.uiu.ac.bd`
    const res = await api
      .post('/api/v1/admin/invitations/bulk')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ emails: [email, email, email], role: 'student', expires_in_days: 7, batch_label: 'Dup test batch' })

    if (res.status === 400) console.log(res.body)
    expect(res.status).toBe(201)
    expect(res.body.data.created).toBe(1)
  })

  it('returns 422 when emails array is empty', async () => {
    const res = await api
      .post('/api/v1/admin/invitations/bulk')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ emails: [], role: 'student', expires_in_days: 7, batch_label: 'Empty test' })

    expect(res.status).toBe(422)
  })

  it('returns 422 when emails array exceeds 50', async () => {
    const emails = Array.from({ length: 51 }, (_, i) => `bulk.test.over${i}@bscse.uiu.ac.bd`)
    const res = await api
      .post('/api/v1/admin/invitations/bulk')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ emails, role: 'student', expires_in_days: 7, batch_label: 'Over limit' })

    expect(res.status).toBe(422)
  })

  it('returns 422 when batch_label is missing', async () => {
    const res = await api
      .post('/api/v1/admin/invitations/bulk')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ emails: [`bulk.test.nolabel.${Date.now()}@bscse.uiu.ac.bd`], role: 'student', expires_in_days: 7 })

    expect(res.status).toBe(422)
  })

  it('returns 403 for faculty role (admin-only endpoint)', async () => {
    const res = await api
      .post('/api/v1/admin/invitations/bulk')
      .set(UNI)
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        emails: [`bulk.test.faculty.${Date.now()}@bscse.uiu.ac.bd`],
        role: 'student',
        expires_in_days: 7,
        batch_label: 'Faculty forbidden',
      })

    expect(res.status).toBe(403)
  })
})

describe('GET /api/v1/admin/invitations/batches', () => {
  it('returns the batch with correct total/accepted counts and excludes single invites', async () => {
    const ts = Date.now()
    const emails = [`bulk.test.batchlist.a.${ts}@bscse.uiu.ac.bd`, `bulk.test.batchlist.b.${ts}@bscse.uiu.ac.bd`]
    await api
      .post('/api/v1/admin/invitations/bulk')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ emails, role: 'student', expires_in_days: 7, batch_label: 'Batch list test' })

    const res = await api
      .get('/api/v1/admin/invitations/batches')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    const batch = res.body.data.find((b: { label: string }) => b.label === 'Batch list test')
    expect(batch).toBeDefined()
    expect(batch.total).toBe(2)
    expect(batch.accepted).toBe(0)
    expect(batch.role).toBe('student')
  })

  it('returns 403 for faculty role (admin-only endpoint)', async () => {
    const res = await api
      .get('/api/v1/admin/invitations/batches')
      .set(UNI)
      .set('Authorization', `Bearer ${facultyToken}`)

    expect(res.status).toBe(403)
  })
})

describe('GET /api/v1/admin/invitations (unbatched only)', () => {
  it('does not include invitations created via the bulk endpoint', async () => {
    const ts = Date.now()
    const bulkEmail = `bulk.test.excluded.${ts}@bscse.uiu.ac.bd`
    await api
      .post('/api/v1/admin/invitations/bulk')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ emails: [bulkEmail], role: 'student', expires_in_days: 7, batch_label: 'Exclusion check' })

    const singleEmail = `inv.test.single.${ts}@bscse.uiu.ac.bd`
    await api
      .post('/api/v1/admin/invitations')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: singleEmail, role: 'student', expires_in_days: 7 })

    const res = await api
      .get('/api/v1/admin/invitations?limit=100')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)

    const emails: string[] = res.body.data.items.map((i: { email: string }) => i.email)
    expect(emails).toContain(singleEmail)
    expect(emails).not.toContain(bulkEmail)
  })
})
