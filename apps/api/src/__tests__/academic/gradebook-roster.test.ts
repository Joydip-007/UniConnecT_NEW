import request from 'supertest'
import { describe, it, expect, beforeAll } from 'vitest'

import { app, DOMAIN, loginAs, CREDENTIALS } from '../setup'

const DRAFT = {
  courseCode: 'CSE 3422',
  courseTitle: 'Software Engineering Laboratory',
  section: 'B',
  gradingScale: 'uiu',
  assessments: [
    { categoryName: 'Class tests', weightPercent: 100, fullMarks: 20, totalGiven: 1, bestNCounted: 1, displayOrder: 1 },
  ],
  topics: [{ weekNumber: 1, title: 'Introduction to SE' }],
  assignments: [],
}

describe('gradebook roster', () => {
  let faculty: { accessToken: string }
  let student: { accessToken: string }
  let facultyId: string
  let studentId: string
  let groupId: string
  const auth = (token: string) => ({ Authorization: `Bearer ${token}`, 'x-university-domain': DOMAIN })

  beforeAll(async () => {
    faculty = await loginAs(CREDENTIALS.faculty.email, CREDENTIALS.faculty.password)
    student = await loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password)
    facultyId = (await request(app).get('/api/v1/users/me').set(auth(faculty.accessToken))).body.data.id
    studentId = (await request(app).get('/api/v1/users/me').set(auth(student.accessToken))).body.data.id

    const created = await request(app)
      .post('/api/v1/groups/from-outline')
      .set(auth(faculty.accessToken))
      .send({ name: 'CSE 3422 Section B (gradebook roster)', section: 'B', draft: DRAFT, is_private: false })
    expect(created.status).toBe(201)
    groupId = created.body.data.id

    const joined = await request(app).post(`/api/v1/groups/${groupId}/join`).set(auth(student.accessToken)).send({})
    expect(joined.status).toBe(201)
  })

  it('GET /groups/:id/gradebook lists only student members — never the owning faculty', async () => {
    const res = await request(app).get(`/api/v1/groups/${groupId}/gradebook`).set(auth(faculty.accessToken))
    expect(res.status).toBe(200)
    const ids = (res.body.data.rows as { student: { id: string } }[]).map((r) => r.student.id)
    expect(ids).toContain(studentId)
    expect(ids).not.toContain(facultyId)
  })

  it('PUT /groups/:id/gradebook/entries refuses to grade a non-student member', async () => {
    const assessmentId = (
      await request(app).get(`/api/v1/groups/${groupId}/course-outline`).set(auth(faculty.accessToken))
    ).body.data.assessments[0].id
    const res = await request(app)
      .put(`/api/v1/groups/${groupId}/gradebook/entries`)
      .set(auth(faculty.accessToken))
      .send({ entries: [{ studentId: facultyId, assessmentId, instanceNumber: 1, marksObtained: 10 }] })
    expect(res.status).toBe(400)
  })
})
