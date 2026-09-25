import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import supertest from 'supertest'
import { app, CREDENTIALS, DOMAIN, loginAs } from './setup'
import { db } from '../config/db'
import { PROBLEM_REPORTS_PER_HOUR } from '../modules/users/problem-reports.service'

const api = supertest(app)

let studentToken: string
let facultyToken: string
let adminToken: string
let studentId: string

function auth(token: string) {
  return { Authorization: `Bearer ${token}`, 'x-university-domain': DOMAIN }
}

let seq = 0
function report(overrides: Record<string, unknown> = {}) {
  seq += 1
  return {
    errorId: `uc-${seq.toString(16).padStart(6, '0')}`,
    errorMessage: "TypeError: Cannot read properties of undefined (reading 'map')",
    pageUrl: 'http://localhost:5173/events/abc',
    userAgent: 'vitest',
    ...overrides,
  }
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
  const me = await api.get('/api/v1/users/me').set(auth(studentToken))
  studentId = me.body.data.id as string
})

beforeEach(async () => {
  await db('problem_reports').where({ user_id: studentId }).del()
})

afterAll(async () => {
  await db('problem_reports').where({ user_id: studentId }).del()
})

describe('Problem reports — member', () => {
  it('files a report with the error id the user saw', async () => {
    const body = report({ description: 'Opened the event from a shared link' })
    const res = await api.post('/api/v1/users/me/problem-reports').set(auth(studentToken)).send(body)
    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({
      errorId: body.errorId,
      description: 'Opened the event from a shared link',
      status: 'open',
    })
  })

  it('treats a resend of the same error id as a retry, keeping one row and adding the description', async () => {
    const body = report()
    await api.post('/api/v1/users/me/problem-reports').set(auth(studentToken)).send(body).expect(201)
    const res = await api
      .post('/api/v1/users/me/problem-reports')
      .set(auth(studentToken))
      .send({ ...body, description: 'Second try' })
    expect(res.status).toBe(201)
    const rows = await db('problem_reports').where({ user_id: studentId, error_id: body.errorId })
    expect(rows).toHaveLength(1)
    expect(rows[0].description).toBe('Second try')
  })

  it('rejects a malformed error id', async () => {
    const res = await api
      .post('/api/v1/users/me/problem-reports')
      .set(auth(studentToken))
      .send(report({ errorId: 'not-an-id' }))
    expect(res.status).toBe(422)
  })

  it('rate-limits a crash loop', async () => {
    for (let i = 0; i < PROBLEM_REPORTS_PER_HOUR; i += 1) {
      await api.post('/api/v1/users/me/problem-reports').set(auth(studentToken)).send(report()).expect(201)
    }
    const res = await api.post('/api/v1/users/me/problem-reports').set(auth(studentToken)).send(report())
    expect(res.status).toBe(429)
  })
})

describe('Problem reports — admin queue', () => {
  it('lists reports with the reporter, open first, and resolves one with an audit entry', async () => {
    const body = report()
    const created = await api.post('/api/v1/users/me/problem-reports').set(auth(studentToken)).send(body)
    const id = created.body.data.id as string

    const list = await api.get('/api/v1/admin/problem-reports?status=open').set(auth(adminToken))
    expect(list.status).toBe(200)
    const item = list.body.data.items.find((r: { id: string }) => r.id === id)
    expect(item).toMatchObject({ errorId: body.errorId, reporterId: studentId, status: 'open' })

    const resolved = await api
      .patch(`/api/v1/admin/problem-reports/${id}`)
      .set(auth(adminToken))
      .send({ status: 'resolved' })
    expect(resolved.status).toBe(200)
    const row = await db('problem_reports').where({ id }).first()
    expect(row.status).toBe('resolved')
    expect(row.resolved_at).not.toBeNull()

    const audit = await db('university_audit_logs').where({ action: 'problem_report.resolved' }).orderBy('created_at', 'desc').first()
    expect(JSON.parse(typeof audit.payload === 'string' ? audit.payload : JSON.stringify(audit.payload))).toMatchObject({ reportId: id })

    const reopened = await api
      .patch(`/api/v1/admin/problem-reports/${id}`)
      .set(auth(adminToken))
      .send({ status: 'open' })
    expect(reopened.status).toBe(200)
    expect((await db('problem_reports').where({ id }).first()).resolved_at).toBeNull()
  })

  it('keeps the queue admin-only', async () => {
    const res = await api.get('/api/v1/admin/problem-reports').set(auth(facultyToken))
    expect(res.status).toBe(403)
  })

  it('404s a report from another id', async () => {
    const res = await api
      .patch('/api/v1/admin/problem-reports/00000000-0000-0000-0000-000000000000')
      .set(auth(adminToken))
      .send({ status: 'resolved' })
    expect(res.status).toBe(404)
  })
})
