import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import supertest from 'supertest'
import { app, loginAs, CREDENTIALS, DOMAIN } from './setup'
import { db } from '../config/db'

// Jobs redesign (Jobs Page.dc.html): "Who can apply" rules, scheduled publishing,
// withdrawing an application, and the owner-only CGPA / resume profile fields.

const api = supertest(app)

let alumniToken: string
let studentToken: string
let studentId: string
let savedProfile: { department: string | null; batch_year: string | null; cgpa: string | null; resume_url: string | null }

const createdJobIds: string[] = []
const deadline = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

const base = {
  title: 'Junior backend engineer',
  company: 'Brain Station 23',
  location: 'Dhaka',
  type: 'full_time',
  description: 'Build REST services.',
  requirements: ['Node.js', 'PostgreSQL'],
  deadline,
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}`, 'x-university-domain': DOMAIN }
}

async function createJob(extra: Record<string, unknown>) {
  const res = await api.post('/api/v1/jobs').set(auth(alumniToken)).send({ ...base, ...extra })
  expect(res.status).toBe(201)
  createdJobIds.push(res.body.data.id as string)
  return res.body.data as { id: string; isScheduled: boolean; eligibleDepartments: string[] | null; minCgpa: number | null }
}

async function setStudentProfile(patch: Record<string, unknown>) {
  await db('profiles').where({ user_id: studentId }).update(patch)
}

beforeAll(async () => {
  const [al, st] = await Promise.all([
    loginAs(CREDENTIALS.alumni.email, CREDENTIALS.alumni.password),
    loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password),
  ])
  alumniToken = al.accessToken
  studentToken = st.accessToken
  const user = await db('users').where({ email: CREDENTIALS.student.email }).first<{ id: string }>('id')
  studentId = user!.id
  savedProfile = await db('profiles')
    .where({ user_id: studentId })
    .first('department', 'batch_year', 'cgpa', 'resume_url')
})

afterEach(async () => {
  if (createdJobIds.length > 0) await db('job_applications').whereIn('job_id', createdJobIds).delete()
})

afterAll(async () => {
  await setStudentProfile(savedProfile)
  if (createdJobIds.length > 0) {
    await db('job_applications').whereIn('job_id', createdJobIds).delete()
    await db('jobs').whereIn('id', createdJobIds).delete()
  }
})

describe('Who can apply', () => {
  it('stores eligibility rules, normalising empty lists and zero CGPA to unrestricted', async () => {
    const open = await createJob({ eligibleDepartments: [], minCgpa: 0 })
    expect(open.eligibleDepartments).toBeNull()
    expect(open.minCgpa).toBeNull()

    const gated = await createJob({ eligibleDepartments: ['CSE'], eligibleBatches: ['2026'], minCgpa: 3.25 })
    expect(gated.eligibleDepartments).toEqual(['CSE'])
    expect(gated.minCgpa).toBe(3.25)
  })

  it('rejects a student outside the department with 403 NOT_ELIGIBLE', async () => {
    await setStudentProfile({ department: 'EEE', batch_year: '2026', cgpa: 3.8 })
    const job = await createJob({ eligibleDepartments: ['CSE'] })

    const res = await api.post(`/api/v1/jobs/${job.id}/apply`).set(auth(studentToken)).send({})
    expect(res.status).toBe(403)
    expect(res.body.code).toBe('NOT_ELIGIBLE')
  })

  it('rejects a student below the minimum CGPA', async () => {
    await setStudentProfile({ department: 'CSE', batch_year: '2026', cgpa: 3.0 })
    const job = await createJob({ minCgpa: 3.5 })

    const res = await api.post(`/api/v1/jobs/${job.id}/apply`).set(auth(studentToken)).send({})
    expect(res.status).toBe(403)
  })

  it('lets a student with no CGPA on file through a CGPA rule, and a matching student apply', async () => {
    await setStudentProfile({ department: 'cse', batch_year: '2026', cgpa: null })
    const job = await createJob({ eligibleDepartments: ['CSE'], eligibleBatches: ['2026'], minCgpa: 3.5 })

    const res = await api.post(`/api/v1/jobs/${job.id}/apply`).set(auth(studentToken)).send({})
    expect(res.status).toBe(201)
  })
})

describe('Withdraw', () => {
  it('marks the application withdrawn, blocks re-apply, and locks the poster out of changing it', async () => {
    await setStudentProfile({ department: 'CSE', batch_year: '2026', cgpa: 3.6 })
    const job = await createJob({})

    const applied = await api.post(`/api/v1/jobs/${job.id}/apply`).set(auth(studentToken)).send({})
    expect(applied.status).toBe(201)

    const wd = await api.post(`/api/v1/jobs/${job.id}/withdraw`).set(auth(studentToken))
    expect(wd.status).toBe(200)
    expect(wd.body.data.status).toBe('withdrawn')

    const again = await api.post(`/api/v1/jobs/${job.id}/withdraw`).set(auth(studentToken))
    expect(again.status).toBe(409)

    const reapply = await api.post(`/api/v1/jobs/${job.id}/apply`).set(auth(studentToken)).send({})
    expect(reapply.status).toBe(409)

    const detail = await api.get(`/api/v1/jobs/${job.id}`).set(auth(studentToken))
    expect(detail.body.data.myApplication).toEqual({ status: 'withdrawn' })

    const poster = await api
      .patch(`/api/v1/jobs/${job.id}/applications/${applied.body.data.id}`)
      .set(auth(alumniToken))
      .send({ status: 'shortlisted' })
    expect(poster.status).toBe(409)
  })

  it('returns 404 when there is nothing to withdraw', async () => {
    const job = await createJob({})
    const res = await api.post(`/api/v1/jobs/${job.id}/withdraw`).set(auth(studentToken))
    expect(res.status).toBe(404)
  })

  it('does not let a poster set withdrawn (422)', async () => {
    await setStudentProfile({ department: 'CSE', batch_year: '2026', cgpa: 3.6 })
    const job = await createJob({})
    const applied = await api.post(`/api/v1/jobs/${job.id}/apply`).set(auth(studentToken)).send({})
    const res = await api
      .patch(`/api/v1/jobs/${job.id}/applications/${applied.body.data.id}`)
      .set(auth(alumniToken))
      .send({ status: 'withdrawn' })
    expect(res.status).toBe(422)
  })
})

describe('Scheduled publishing', () => {
  it('hides a scheduled job from the board and from other users until publish_at', async () => {
    const publishAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
    const job = await createJob({ publishAt })
    expect(job.isScheduled).toBe(true)

    const board = await api.get('/api/v1/jobs').query({ limit: 100 }).set(auth(studentToken))
    expect((board.body.data.items as { id: string }[]).some((j) => j.id === job.id)).toBe(false)

    const asStudent = await api.get(`/api/v1/jobs/${job.id}`).set(auth(studentToken))
    expect(asStudent.status).toBe(404)

    const apply = await api.post(`/api/v1/jobs/${job.id}/apply`).set(auth(studentToken)).send({})
    expect(apply.status).toBe(404)

    const mine = await api.get('/api/v1/jobs/my').set(auth(alumniToken))
    const own = (mine.body.data.items as { id: string; isScheduled: boolean }[]).find((j) => j.id === job.id)
    expect(own?.isScheduled).toBe(true)
  })

  it('shows a job whose publish time has passed', async () => {
    const job = await createJob({})
    await db('jobs').where({ id: job.id }).update({ publish_at: new Date(Date.now() - 60_000) })
    const board = await api.get('/api/v1/jobs').query({ limit: 100 }).set(auth(studentToken))
    expect((board.body.data.items as { id: string }[]).some((j) => j.id === job.id)).toBe(true)
  })
})

describe('Profile CGPA and resume', () => {
  it('saves both on PATCH /users/me and returns them to the owner only', async () => {
    const patch = await api
      .patch('/api/v1/users/me')
      .set(auth(studentToken))
      .send({ cgpa: 3.42, resumeUrl: 'https://cdn.example.com/cv.pdf', resumeName: 'cv.pdf' })
    expect(patch.status).toBe(200)

    const me = await api.get('/api/v1/users/me').set(auth(studentToken))
    expect(me.body.data.profile.cgpa).toBe(3.42)
    expect(me.body.data.profile.resumeName).toBe('cv.pdf')
    expect(me.body.data.profile.resumeUpdatedAt).toBeTruthy()

    const other = await api.get(`/api/v1/users/${studentId}`).set(auth(alumniToken))
    expect(other.body.data.profile.cgpa).toBeNull()
    expect(other.body.data.profile.resumeUrl).toBeNull()
  })

  it('rejects a CGPA above 4 with 422', async () => {
    const res = await api.patch('/api/v1/users/me').set(auth(studentToken)).send({ cgpa: 4.5 })
    expect(res.status).toBe(422)
  })
})
