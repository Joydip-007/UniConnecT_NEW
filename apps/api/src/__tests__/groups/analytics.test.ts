import request from 'supertest'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { app, DOMAIN, loginAs, CREDENTIALS, TEST_UNIVERSITY_ID } from '../setup'
import { db } from '../../config/db'

describe('group analytics, suggestions, chat, ask-teacher', () => {
  let faculty: { accessToken: string }
  let student: { accessToken: string }
  let admin: { accessToken: string }
  let academicGroupId: string
  let clubGroupId: string
  let systemGroupId: string

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

    const adminUser = await db('users')
      .where({ university_id: TEST_UNIVERSITY_ID, email: CREDENTIALS.admin.email })
      .select<{ id: string }[]>('id')
      .first()
    const [systemGroup] = await db('groups')
      .insert({
        university_id: TEST_UNIVERSITY_ID,
        created_by: adminUser!.id,
        name: 'System-managed suggestions probe',
        description: 'x',
        type: 'other',
        is_private: false,
        is_system: true,
        allowed_role: 'student',
        // Deliberately huge — guarantees this row would sort to the very top of
        // suggestions (member_count desc is the tiebreaker) if the is_system filter
        // were ever dropped, making the exclusion assertion below meaningful even
        // amid whatever other groups earlier tests left in this database.
        member_count: 999999,
      })
      .returning<{ id: string }[]>('id')
    systemGroupId = systemGroup!.id
  })

  afterAll(async () => {
    await db('groups').where({ id: systemGroupId }).delete()
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

  it('never surfaces a system group, even one that would otherwise rank first', async () => {
    const res = await request(app)
      .get('/api/v1/groups/suggestions?limit=20')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${student.accessToken}`)

    expect(res.status).toBe(200)
    const ids = res.body.data.items.map((g: { id: string }) => g.id)
    expect(ids).not.toContain(systemGroupId)
  })

  it('GET /groups/:id serves chatUnread for the class chat', async () => {
    const opened = await request(app)
      .post(`/api/v1/groups/${academicGroupId}/chat`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${student.accessToken}`)
      .send({})
    expect(opened.status).toBe(200)
    const conversationId = opened.body.data.conversationId as string

    const before = await request(app)
      .get(`/api/v1/groups/${academicGroupId}`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${student.accessToken}`)
    expect(before.body.data.chatUnread).toBe(0)

    const sent = await request(app)
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${faculty.accessToken}`)
      .send({ content: 'Reminder: quiz on Sunday' })
    expect(sent.status).toBe(201)

    const after = await request(app)
      .get(`/api/v1/groups/${academicGroupId}`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${student.accessToken}`)
    expect(after.body.data.chatUnread).toBe(1)

    // The sender has nothing unread from others.
    const senderView = await request(app)
      .get(`/api/v1/groups/${academicGroupId}`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${faculty.accessToken}`)
    expect(senderView.body.data.chatUnread).toBe(0)
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

  it('creates exactly one class chat conversation under concurrent first opens', async () => {
    const raceGroup = await request(app)
      .post('/api/v1/groups')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${faculty.accessToken}`)
      .send({ name: 'CSE Race Section', description: 'x', type: 'academic', is_private: false })
    const raceGroupId = raceGroup.body.data.id

    await request(app)
      .post(`/api/v1/groups/${raceGroupId}/members`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${student.accessToken}`)
      .send({})

    const [a, b, c] = await Promise.all([
      request(app)
        .post(`/api/v1/groups/${raceGroupId}/chat`)
        .set('x-university-domain', DOMAIN)
        .set('Authorization', `Bearer ${faculty.accessToken}`)
        .send({}),
      request(app)
        .post(`/api/v1/groups/${raceGroupId}/chat`)
        .set('x-university-domain', DOMAIN)
        .set('Authorization', `Bearer ${student.accessToken}`)
        .send({}),
      request(app)
        .post(`/api/v1/groups/${raceGroupId}/chat`)
        .set('x-university-domain', DOMAIN)
        .set('Authorization', `Bearer ${faculty.accessToken}`)
        .send({}),
    ])

    expect(a.status).toBe(200)
    expect(b.status).toBe(200)
    expect(c.status).toBe(200)
    expect(b.body.data.conversationId).toBe(a.body.data.conversationId)
    expect(c.body.data.conversationId).toBe(a.body.data.conversationId)

    const stored = await db('groups')
      .where({ id: raceGroupId })
      .select<{ chat_conversation_id: string }[]>('chat_conversation_id')
      .first()
    expect(stored?.chat_conversation_id).toBe(a.body.data.conversationId)

    const matchingConversations = await db('conversations').where({ id: a.body.data.conversationId }).select('id')
    expect(matchingConversations).toHaveLength(1)
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
