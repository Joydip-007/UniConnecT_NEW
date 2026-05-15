import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { app, loginAs, CREDENTIALS } from './setup'
import { db } from '../config/db'

const api = supertest(app)

let alumniToken: string
let studentToken: string
let facultyToken: string
let createdJobId: string

const createdJobIds: string[] = []

const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

const jobPayload = {
  title: 'Software Engineer',
  company: 'UIU Tech',
  location: 'Dhaka',
  type: 'full_time',
  description: 'Join our engineering team.',
  requirements: ['TypeScript', 'Node.js'],
  deadline,
}

beforeAll(async () => {
  const [al, st, sf] = await Promise.all([
    loginAs(CREDENTIALS.alumni.email, CREDENTIALS.alumni.password),
    loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password),
    loginAs(CREDENTIALS.faculty.email, CREDENTIALS.faculty.password),
  ])
  alumniToken = al.accessToken
  studentToken = st.accessToken
  facultyToken = sf.accessToken
})

afterAll(async () => {
  if (createdJobIds.length > 0) {
    // Delete applications first (FK dependency)
    await db('job_applications').whereIn('job_id', createdJobIds).delete()
    await db('saved_jobs').whereIn('job_id', createdJobIds).delete()
    await db('jobs').whereIn('id', createdJobIds).delete()
  }
})

function auth(token: string) {
  return { Authorization: `Bearer ${token}` }
}

describe('POST /api/v1/jobs', () => {
  it('returns 201 when alumni creates a job', async () => {
    const res = await api.post('/api/v1/jobs').set(auth(alumniToken)).send(jobPayload)

    expect(res.status).toBe(201)
    expect(res.body.data).toHaveProperty('id')
    expect(res.body.data.title).toBe('Software Engineer')

    createdJobId = res.body.data.id as string
    createdJobIds.push(createdJobId)
  })

  it('returns 403 when student tries to create a job', async () => {
    const res = await api.post('/api/v1/jobs').set(auth(studentToken)).send(jobPayload)

    expect(res.status).toBe(403)
  })
})

describe('GET /api/v1/jobs', () => {
  it('returns 200 with paginated items', async () => {
    const res = await api.get('/api/v1/jobs').set(auth(studentToken))

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveProperty('items')
    expect(Array.isArray(res.body.data.items)).toBe(true)
    expect(res.body.data).toHaveProperty('total')
  })
})

describe('POST /api/v1/jobs/:jobId/apply', () => {
  it('returns 201 when student applies', async () => {
    const res = await api
      .post(`/api/v1/jobs/${createdJobId}/apply`)
      .set(auth(studentToken))
      .send({ cover_letter: 'I am very interested.' })

    expect(res.status).toBe(201)
    expect(res.body.data).toHaveProperty('id')
  })

  it('returns 409 when same student applies again', async () => {
    const res = await api
      .post(`/api/v1/jobs/${createdJobId}/apply`)
      .set(auth(studentToken))
      .send({ cover_letter: 'Applying again.' })

    expect(res.status).toBe(409)
    expect(res.body.code).toBe('ALREADY_APPLIED')
  })
})

describe('GET /api/v1/jobs/:jobId/applications', () => {
  it('returns 200 for the job poster', async () => {
    const res = await api
      .get(`/api/v1/jobs/${createdJobId}/applications`)
      .set(auth(alumniToken))

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveProperty('items')
  })

  it('returns 403 for a different user who is not the poster', async () => {
    // facultyToken belongs to a different user who did not post this job
    const res = await api
      .get(`/api/v1/jobs/${createdJobId}/applications`)
      .set(auth(facultyToken))

    expect(res.status).toBe(403)
  })
})

describe('POST /api/v1/jobs/:jobId/save', () => {
  it('returns 201 when student saves a job', async () => {
    const res = await api
      .post(`/api/v1/jobs/${createdJobId}/save`)
      .set(auth(studentToken))

    expect(res.status).toBe(201)
  })
})

describe('GET /api/v1/jobs/saved', () => {
  it('returns 200 with saved jobs list', async () => {
    const res = await api.get('/api/v1/jobs/saved').set(auth(studentToken))

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveProperty('items')
  })
})
