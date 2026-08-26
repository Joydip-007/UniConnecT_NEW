import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import supertest from 'supertest'
import { app, loginAs, TEST_UNIVERSITY_ID, CREDENTIALS, DOMAIN } from './setup'
import { db } from '../config/db'

const api = supertest(app)

interface DirectoryRow {
  id: string
  role: string
  mutualConnections: number
  connectionStatus: 'none' | 'connected' | 'pending_sent' | 'pending_received'
}

describe('People directory (GET /users)', () => {
  let studentToken: string
  let studentId: string
  let facultyId: string
  let alumniId: string
  let adminId: string

  beforeAll(async () => {
    const s = await loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password)
    studentToken = s.accessToken
    studentId = (await db('users').where({ email: CREDENTIALS.student.email }).select('id').first()).id
    facultyId = (await db('users').where({ email: CREDENTIALS.faculty.email }).select('id').first()).id
    alumniId = (await db('users').where({ email: CREDENTIALS.alumni.email }).select('id').first()).id
    adminId = (await db('users').where({ email: CREDENTIALS.admin.email }).select('id').first()).id
  })

  afterEach(async () => {
    await db('connections').where({ university_id: TEST_UNIVERSITY_ID }).delete()
  })

  async function list(query: Record<string, unknown> = {}) {
    const res = await api
      .get('/api/v1/users')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${studentToken}`)
      .query({ limit: 100, ...query })
    expect(res.status).toBe(200)
    return res.body.data.items as DirectoryRow[]
  }

  // A directory is other people. Listing yourself gives a row whose only action
  // ("Connect") is impossible.
  it('never lists the caller', async () => {
    const rows = await list()
    expect(rows.some((r) => r.id === studentId)).toBe(false)
  })

  it('filters by role', async () => {
    const rows = await list({ role: 'faculty' })
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((r) => r.role === 'faculty')).toBe(true)
  })

  it('labels each row with the caller’s connection state, in the right direction', async () => {
    await db('connections').insert([
      { university_id: TEST_UNIVERSITY_ID, requester_id: studentId, addressee_id: facultyId, status: 'accepted' },
      { university_id: TEST_UNIVERSITY_ID, requester_id: studentId, addressee_id: alumniId, status: 'pending' },
      { university_id: TEST_UNIVERSITY_ID, requester_id: adminId, addressee_id: studentId, status: 'pending' },
    ])

    const byId = new Map((await list()).map((r) => [r.id, r]))
    expect(byId.get(facultyId)?.connectionStatus).toBe('connected')
    expect(byId.get(alumniId)?.connectionStatus).toBe('pending_sent')
    expect(byId.get(adminId)?.connectionStatus).toBe('pending_received')
  })

  it('counts shared connections, and excludes pending ones', async () => {
    // student ↔ faculty accepted, alumni ↔ faculty accepted → faculty is a mutual of alumni.
    await db('connections').insert([
      { university_id: TEST_UNIVERSITY_ID, requester_id: studentId, addressee_id: facultyId, status: 'accepted' },
      { university_id: TEST_UNIVERSITY_ID, requester_id: alumniId, addressee_id: facultyId, status: 'accepted' },
      // Pending on the caller's side, so admin must not count as a shared connection.
      { university_id: TEST_UNIVERSITY_ID, requester_id: studentId, addressee_id: adminId, status: 'pending' },
      { university_id: TEST_UNIVERSITY_ID, requester_id: alumniId, addressee_id: adminId, status: 'accepted' },
    ])

    const byId = new Map((await list()).map((r) => [r.id, r]))
    expect(byId.get(alumniId)?.mutualConnections).toBe(1)
  })

  it('resolves same_department against the caller’s own profile', async () => {
    const me = await db('profiles').where({ user_id: studentId }).select('department').first()

    const rows = await list({ same_department: true })

    if (!me?.department) {
      // No department on the profile means the filter cannot match — an empty page is
      // the honest answer, not the unfiltered directory.
      expect(rows).toHaveLength(0)
      return
    }

    const departments = await db('profiles')
      .whereIn(
        'user_id',
        rows.map((r) => r.id),
      )
      .select('department')
    expect(departments.every((d) => d.department === me.department)).toBe(true)
  })
})
