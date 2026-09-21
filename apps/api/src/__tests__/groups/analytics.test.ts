import request from 'supertest'
import { describe, it, expect, beforeAll } from 'vitest'
import { app, DOMAIN, loginAs, CREDENTIALS } from '../setup'

describe('group analytics, suggestions, chat, ask-teacher', () => {
  let faculty: { accessToken: string }
  let student: { accessToken: string }
  let admin: { accessToken: string }
  let academicGroupId: string
  let clubGroupId: string

  beforeAll(async () => {
    faculty = await loginAs(CREDENTIALS.faculty.email, CREDENTIALS.faculty.password)
    student = await loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password)
    admin = await loginAs(CREDENTIALS.admin.email, CREDENTIALS.admin.password)

    const academic = await request(app)
      .post('/api/v1/groups')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${faculty.accessToken}`)
      .send({ name: 'CSE Analytics Section', description: 'x', type: 'academic', is_private: false })
    academicGroupId = academic.body.data.id

    await request(app)
      .post(`/api/v1/groups/${academicGroupId}/members`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${student.accessToken}`)
      .send({})

    const club = await request(app)
      .post('/api/v1/groups')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${faculty.accessToken}`)
      .send({ name: 'Non Academic Club', description: 'x', type: 'club', is_private: false })
    clubGroupId = club.body.data.id

    await request(app)
      .post(`/api/v1/groups/${clubGroupId}/members`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${student.accessToken}`)
      .send({})
  })

  it('returns 5 postsPerWeek buckets for a moderator and 403 for a plain member', async () => {
    const asFaculty = await request(app)
      .get(`/api/v1/groups/${academicGroupId}/analytics`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${faculty.accessToken}`)

    expect(asFaculty.status).toBe(200)
    expect(asFaculty.body.data.postsPerWeek).toHaveLength(5)
    expect(asFaculty.body.data.postsPerWeek[4].label).toBe('This week')
    expect(typeof asFaculty.body.data.members).toBe('number')
    expect(typeof asFaculty.body.data.activePct).toBe('number')
    expect(Array.isArray(asFaculty.body.data.topMembers)).toBe(true)

    const asMember = await request(app)
      .get(`/api/v1/groups/${academicGroupId}/analytics`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${student.accessToken}`)

    expect(asMember.status).toBe(403)
  })

  it('excludes already-joined groups from suggestions', async () => {
    const res = await request(app)
      .get('/api/v1/groups/suggestions?limit=4')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${student.accessToken}`)

    expect(res.status).toBe(200)
    const ids = res.body.data.items.map((g: { id: string }) => g.id)
    expect(ids).not.toContain(academicGroupId)
    expect(ids).not.toContain(clubGroupId)
  })

  it('rejects group chat on a non-academic group and returns a conversationId on an academic one', async () => {
    const nonAcademic = await request(app)
      .post(`/api/v1/groups/${clubGroupId}/chat`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${student.accessToken}`)
      .send({})

    expect(nonAcademic.status).toBe(400)
    expect(nonAcademic.body.code).toBe('GROUP_NOT_ACADEMIC')

    const first = await request(app)
      .post(`/api/v1/groups/${academicGroupId}/chat`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${student.accessToken}`)
      .send({})
    expect(first.status).toBe(200)
    expect(typeof first.body.data.conversationId).toBe('string')

    const second = await request(app)
      .post(`/api/v1/groups/${academicGroupId}/chat`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${student.accessToken}`)
      .send({})
    expect(second.status).toBe(200)
    expect(second.body.data.conversationId).toBe(first.body.data.conversationId)
  })

  it('ask-teacher is idempotent and returns the same conversation id twice', async () => {
    const first = await request(app)
      .post(`/api/v1/groups/${academicGroupId}/ask-teacher`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${student.accessToken}`)
      .send({})
    expect(first.status).toBe(200)
    expect(typeof first.body.data.conversationId).toBe('string')
    expect(first.body.data.teacher.id).toBeDefined()

    const second = await request(app)
      .post(`/api/v1/groups/${academicGroupId}/ask-teacher`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${student.accessToken}`)
      .send({})
    expect(second.status).toBe(200)
    expect(second.body.data.conversationId).toBe(first.body.data.conversationId)

    const queue = await request(app)
      .get(`/api/v1/groups/${academicGroupId}/ask-teacher/queue`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${faculty.accessToken}`)
    expect(queue.status).toBe(200)
    expect(queue.body.data.items.some((i: { conversationId: string }) => i.conversationId === first.body.data.conversationId)).toBe(
      true,
    )
  })
})
