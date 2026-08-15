import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { randomUUID } from 'node:crypto'
import { app, loginAs, CREDENTIALS, DOMAIN, TEST_UNIVERSITY_ID } from './setup'
import { db } from '../config/db'

const api = supertest(app)

let studentToken: string
let alumniToken: string
let studentId: string

const createdPostIds: string[] = []
const createdGroupIds: string[] = []

/** A group the student belongs to, and one they do not. */
let joinedGroupId: string
let otherGroupId: string

function auth(token: string) {
  return { Authorization: `Bearer ${token}` }
}

async function makeGroup(name: string): Promise<string> {
  const [row] = await db('groups')
    .insert({
      id: randomUUID(),
      university_id: TEST_UNIVERSITY_ID,
      name,
      description: name,
      type: 'interest',
      is_private: false,
      created_by: studentId,
    })
    .returning('id')
  const id = typeof row === 'string' ? row : row.id
  createdGroupIds.push(id)
  return id
}

async function makePost(authorId: string, content: string, extra: Record<string, unknown> = {}) {
  const [row] = await db('posts')
    .insert({
      id: randomUUID(),
      university_id: TEST_UNIVERSITY_ID,
      author_id: authorId,
      type: 'post',
      content,
      is_published: true,
      ...extra,
    })
    .returning('id')
  const id = typeof row === 'string' ? row : row.id
  createdPostIds.push(id)
  return id
}

beforeAll(async () => {
  const [st, al] = await Promise.all([
    loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password),
    loginAs(CREDENTIALS.alumni.email, CREDENTIALS.alumni.password),
  ])
  studentToken = st.accessToken
  alumniToken = al.accessToken

  const student = await db('users').where({ email: CREDENTIALS.student.email }).first()
  studentId = student.id

  joinedGroupId = await makeGroup(`Filter test joined ${randomUUID().slice(0, 8)}`)
  otherGroupId = await makeGroup(`Filter test other ${randomUUID().slice(0, 8)}`)

  // Composite (group_id, user_id) primary key — no surrogate id column.
  await db('group_members').insert({
    group_id: joinedGroupId,
    user_id: studentId,
    role: 'member',
  })

  await makePost(studentId, 'post inside a group the student joined', { group_id: joinedGroupId })
  await makePost(studentId, 'post inside a group the student never joined', { group_id: otherGroupId })
  await makePost(studentId, 'ungrouped post on the main feed', { group_id: null })
})

afterAll(async () => {
  if (createdPostIds.length) await db('posts').whereIn('id', createdPostIds).delete()
  if (createdGroupIds.length) {
    await db('group_members').whereIn('group_id', createdGroupIds).delete()
    await db('groups').whereIn('id', createdGroupIds).delete()
  }
})

describe('GET /api/v1/posts?scope=my_groups', () => {
  it('returns only posts from groups the caller belongs to', async () => {
    const res = await api
      .get('/api/v1/posts?scope=my_groups&limit=100')
      .set('x-university-domain', DOMAIN)
      .set(auth(studentToken))

    expect(res.status).toBe(200)
    const contents = res.body.data.items.map((p: { content: string }) => p.content)
    expect(contents).toContain('post inside a group the student joined')
    expect(contents).not.toContain('post inside a group the student never joined')
    expect(contents).not.toContain('ungrouped post on the main feed')
  })

  it('reports a total that matches the scoped rows, not the whole feed', async () => {
    const scoped = await api
      .get('/api/v1/posts?scope=my_groups&limit=100')
      .set('x-university-domain', DOMAIN)
      .set(auth(studentToken))
    const unscoped = await api
      .get('/api/v1/posts?limit=100')
      .set('x-university-domain', DOMAIN)
      .set(auth(studentToken))

    expect(scoped.body.data.total).toBe(scoped.body.data.items.length)
    expect(scoped.body.data.total).toBeLessThan(unscoped.body.data.total)
  })

  it('is empty for a member of no groups rather than falling back to everything', async () => {
    const res = await api
      .get('/api/v1/posts?scope=my_groups&limit=100')
      .set('x-university-domain', DOMAIN)
      .set(auth(alumniToken))

    expect(res.status).toBe(200)
    expect(res.body.data.items).toEqual([])
    expect(res.body.data.total).toBe(0)
  })

  it('rejects an unknown scope instead of silently ignoring it', async () => {
    const res = await api
      .get('/api/v1/posts?scope=everything')
      .set('x-university-domain', DOMAIN)
      .set(auth(studentToken))

    // 422 is this codebase's validation-failure status (see utils/errors.ts).
    expect(res.status).toBe(422)
    expect(res.body.code).toBe('VALIDATION_ERROR')
  })
})

describe('job_promo post type', () => {
  it('lets an alumnus post a job opportunity', async () => {
    const res = await api
      .post('/api/v1/posts')
      .set('x-university-domain', DOMAIN)
      .set(auth(alumniToken))
      .send({ content: 'We are hiring backend engineers', type: 'job_promo' })

    expect(res.status).toBe(201)
    expect(res.body.data.type).toBe('job_promo')
    createdPostIds.push(res.body.data.id)
  })

  it('refuses a student, matching who may post on the job board', async () => {
    const res = await api
      .post('/api/v1/posts')
      .set('x-university-domain', DOMAIN)
      .set(auth(studentToken))
      .send({ content: 'I am hiring', type: 'job_promo' })

    expect(res.status).toBe(403)
    expect(res.body.code).toBe('JOB_POST_FORBIDDEN')
  })

  it('filters the feed down to job posts', async () => {
    const res = await api
      .get('/api/v1/posts?type=job_promo&limit=100')
      .set('x-university-domain', DOMAIN)
      .set(auth(studentToken))

    expect(res.status).toBe(200)
    expect(res.body.data.items.length).toBeGreaterThan(0)
    res.body.data.items.forEach((p: { type: string }) => expect(p.type).toBe('job_promo'))
  })

  it('keeps job posts out of the other type filters', async () => {
    const res = await api
      .get('/api/v1/posts?type=post&limit=100')
      .set('x-university-domain', DOMAIN)
      .set(auth(studentToken))

    const contents = res.body.data.items.map((p: { content: string }) => p.content)
    expect(contents).not.toContain('We are hiring backend engineers')
  })
})
