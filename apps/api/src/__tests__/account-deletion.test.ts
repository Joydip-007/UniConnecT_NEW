import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import supertest from 'supertest'
import { app, CREDENTIALS, DOMAIN, loginAs } from './setup'
import { db } from '../config/db'

const api = supertest(app)

let studentToken: string
let facultyToken: string
let adminToken: string
let studentId: string
let facultyId: string

function auth(token: string) {
  return { Authorization: `Bearer ${token}`, 'x-university-domain': DOMAIN }
}

async function meId(token: string): Promise<string> {
  const res = await api.get('/api/v1/users/me').set(auth(token))
  return res.body.data.id as string
}

beforeAll(async () => {
  const [st, fa, ad] = await Promise.all([
    loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password),
    loginAs(CREDENTIALS.faculty.email, CREDENTIALS.faculty.password),
    loginAs(CREDENTIALS.admin.email, CREDENTIALS.admin.password),
  ])
  studentToken = st.accessToken
  facultyToken = fa.accessToken
  adminToken = ad.accessToken
  ;[studentId, facultyId] = await Promise.all([meId(studentToken), meId(facultyToken)])

  // Start clean — drop any leftover requests for the seed users.
  await db('account_deletion_requests').whereIn('user_id', [studentId, facultyId]).del()
})

afterAll(async () => {
  await db('account_deletion_requests').whereIn('user_id', [studentId, facultyId]).del()
  // Approving a request deactivates the user; restore the seed users for later suites.
  await db('users')
    .whereIn('id', [studentId, facultyId])
    .update({ is_active: true, deactivated_at: null })
})

describe('Account data export', () => {
  it('returns a portable bundle of the user\'s own data', async () => {
    const res = await api.get('/api/v1/users/me/export').set(auth(studentToken))
    expect(res.status).toBe(200)
    const bundle = res.body.data
    expect(bundle.account.id).toBe(studentId)
    expect(bundle.account).not.toHaveProperty('password_hash')
    expect(bundle).toHaveProperty('profile')
    expect(Array.isArray(bundle.posts)).toBe(true)
    expect(Array.isArray(bundle.connections)).toBe(true)
    expect(bundle).toHaveProperty('exportedAt')
  })
})

describe('Deletion request — user flow', () => {
  it('returns null when no request exists', async () => {
    const res = await api.get('/api/v1/users/me/deletion-request').set(auth(studentToken))
    expect(res.status).toBe(200)
    expect(res.body.data).toBeNull()
  })

  it('rejects a too-short reason (422)', async () => {
    const res = await api
      .post('/api/v1/users/me/deletion-request')
      .set(auth(studentToken))
      .send({ reason: 'bye' })
    expect(res.status).toBe(422)
  })

  it('creates a pending request (201)', async () => {
    const res = await api
      .post('/api/v1/users/me/deletion-request')
      .set(auth(studentToken))
      .send({ reason: 'I am graduating and no longer need the account.' })
    expect(res.status).toBe(201)
    expect(res.body.data.status).toBe('pending')
  })

  it('rejects a second pending request (400)', async () => {
    const res = await api
      .post('/api/v1/users/me/deletion-request')
      .set(auth(studentToken))
      .send({ reason: 'Another reason that is long enough.' })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('DELETION_REQUEST_EXISTS')
  })

  it('returns the pending request', async () => {
    const res = await api.get('/api/v1/users/me/deletion-request').set(auth(studentToken))
    expect(res.body.data.status).toBe('pending')
  })

  it('cancels the pending request', async () => {
    const cancel = await api.delete('/api/v1/users/me/deletion-request').set(auth(studentToken))
    expect(cancel.status).toBe(200)

    const after = await api.get('/api/v1/users/me/deletion-request').set(auth(studentToken))
    expect(after.body.data.status).toBe('cancelled')
  })

  it('cannot cancel when nothing is pending (404)', async () => {
    const res = await api.delete('/api/v1/users/me/deletion-request').set(auth(studentToken))
    expect(res.status).toBe(404)
  })
})

describe('Deletion request — admin flow', () => {
  let requestId: string

  it('surfaces the request in the admin queue', async () => {
    await api
      .post('/api/v1/users/me/deletion-request')
      .set(auth(facultyToken))
      .send({ reason: 'Leaving the university, please remove my account.' })

    const res = await api.get('/api/v1/admin/deletion-requests').set(auth(adminToken))
    expect(res.status).toBe(200)
    const mine = (res.body.data.items as { id: string; requesterId: string; status: string }[]).find(
      (r) => r.requesterId === facultyId && r.status === 'pending',
    )
    expect(mine).toBeTruthy()
    requestId = mine!.id
  })

  it('forbids a non-admin from resolving (403)', async () => {
    const res = await api
      .patch(`/api/v1/admin/deletion-requests/${requestId}`)
      .set(auth(facultyToken))
      .send({ status: 'approved' })
    expect(res.status).toBe(403)
  })

  it('approves the request and deactivates the account', async () => {
    const res = await api
      .patch(`/api/v1/admin/deletion-requests/${requestId}`)
      .set(auth(adminToken))
      .send({ status: 'approved', adminNote: 'Confirmed via email.' })
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('approved')

    const user = await db('users').where({ id: facultyId }).first<{ is_active: boolean }>('is_active')
    expect(user?.is_active).toBe(false)
  })

  it('cannot resolve an already-resolved request (400)', async () => {
    const res = await api
      .patch(`/api/v1/admin/deletion-requests/${requestId}`)
      .set(auth(adminToken))
      .send({ status: 'declined' })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('DELETION_REQUEST_ALREADY_RESOLVED')
  })
})
