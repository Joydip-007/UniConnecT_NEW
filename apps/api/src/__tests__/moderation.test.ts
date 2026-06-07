import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import supertest from 'supertest'
import { app, CREDENTIALS, DOMAIN, loginAs } from './setup'
import { db } from '../config/db'

const api = supertest(app)

let studentToken: string
let facultyToken: string
let alumniToken: string
let studentId: string
let facultyId: string
let alumniId: string

// Resources created during the suite, torn down in afterAll so other suites
// (which share the same seed users in this single-fork run) see a clean slate.
const createdPostIds: string[] = []

function auth(token: string) {
  return { Authorization: `Bearer ${token}`, 'x-university-domain': DOMAIN }
}

async function meId(token: string): Promise<string> {
  const res = await api.get('/api/v1/users/me').set(auth(token))
  return res.body.data.id as string
}

beforeAll(async () => {
  const [st, fa, al] = await Promise.all([
    loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password),
    loginAs(CREDENTIALS.faculty.email, CREDENTIALS.faculty.password),
    loginAs(CREDENTIALS.alumni.email, CREDENTIALS.alumni.password),
  ])
  studentToken = st.accessToken
  facultyToken = fa.accessToken
  alumniToken = al.accessToken
  ;[studentId, facultyId, alumniId] = await Promise.all([
    meId(studentToken),
    meId(facultyToken),
    meId(alumniToken),
  ])
})

afterAll(async () => {
  const ids = [studentId, facultyId, alumniId]
  await db('user_blocks').whereIn('blocker_id', ids).orWhereIn('blocked_id', ids).del()
  await db('user_mutes').whereIn('muter_id', ids).orWhereIn('muted_id', ids).del()
  await db('reports').whereIn('reporter_id', ids).del()
  if (createdPostIds.length) await db('posts').whereIn('id', createdPostIds).del()
})

describe('Blocking', () => {
  afterAll(async () => {
    // Ensure no block survives this describe regardless of assertion outcomes.
    await db('user_blocks')
      .where({ blocker_id: studentId, blocked_id: facultyId })
      .orWhere({ blocker_id: facultyId, blocked_id: studentId })
      .del()
  })

  it('blocks a co-tenant user (201) and lists them', async () => {
    const block = await api.post(`/api/v1/moderation/block/${facultyId}`).set(auth(studentToken))
    expect(block.status).toBe(201)
    expect(block.body.data).toMatchObject({ blocked: true })

    const list = await api.get('/api/v1/moderation/blocks').set(auth(studentToken))
    expect(list.status).toBe(200)
    const ids = (list.body.data.items as { id: string }[]).map((u) => u.id)
    expect(ids).toContain(facultyId)
  })

  it('hides the blocked user\'s profile from the blocker (404)', async () => {
    const res = await api.get(`/api/v1/users/${facultyId}`).set(auth(studentToken))
    expect(res.status).toBe(404)
  })

  it('is bidirectional — the blocked user also cannot see the blocker (404)', async () => {
    const res = await api.get(`/api/v1/users/${studentId}`).set(auth(facultyToken))
    expect(res.status).toBe(404)
  })

  it('rejects a connection request between the two with USER_BLOCKED (403)', async () => {
    const res = await api
      .post(`/api/v1/connections/request/${facultyId}`)
      .set(auth(studentToken))
      .send({})
    expect(res.status).toBe(403)
    expect(res.body.code).toBe('USER_BLOCKED')
  })

  it('rejects starting a direct conversation with USER_BLOCKED (403)', async () => {
    const res = await api
      .post('/api/v1/conversations')
      .set(auth(studentToken))
      .send({ participantId: facultyId, is_group: false })
    expect(res.status).toBe(403)
    expect(res.body.code).toBe('USER_BLOCKED')
  })

  it('excludes the blocked user from people search', async () => {
    const res = await api
      .get('/api/v1/search/people')
      .query({ q: 'Faculty' })
      .set(auth(studentToken))
    expect(res.status).toBe(200)
    const ids = (res.body.data.items as { id: string }[]).map((u) => u.id)
    expect(ids).not.toContain(facultyId)
  })

  it('unblock (204/200) restores profile visibility', async () => {
    const unblock = await api.delete(`/api/v1/moderation/block/${facultyId}`).set(auth(studentToken))
    expect([200, 204]).toContain(unblock.status)

    const res = await api.get(`/api/v1/users/${facultyId}`).set(auth(studentToken))
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(facultyId)
  })

  it('rejects blocking yourself (400)', async () => {
    const res = await api.post(`/api/v1/moderation/block/${studentId}`).set(auth(studentToken))
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('SELF_BLOCK_NOT_ALLOWED')
  })
})

describe('Muting', () => {
  let mutedPostId: string

  beforeAll(async () => {
    const post = await api
      .post('/api/v1/posts')
      .set(auth(alumniToken))
      .send({ content: 'MODTEST muted feed post', type: 'post' })
    mutedPostId = post.body.data.id
    createdPostIds.push(mutedPostId)
  })

  afterAll(async () => {
    await db('user_mutes').where({ muter_id: studentId, muted_id: alumniId }).del()
  })

  it('post is visible in the feed before muting', async () => {
    const res = await api.get('/api/v1/posts').query({ limit: 50, authorId: alumniId }).set(auth(studentToken))
    expect(res.status).toBe(200)
    const ids = (res.body.data.items as { id: string }[]).map((p) => p.id)
    expect(ids).toContain(mutedPostId)
  })

  it('mutes a user (201) and lists them', async () => {
    const mute = await api.post(`/api/v1/moderation/mute/${alumniId}`).set(auth(studentToken))
    expect(mute.status).toBe(201)
    expect(mute.body.data).toMatchObject({ muted: true })

    const list = await api.get('/api/v1/moderation/mutes').set(auth(studentToken))
    const ids = (list.body.data.items as { id: string }[]).map((u) => u.id)
    expect(ids).toContain(alumniId)
  })

  it('hides the muted user\'s posts from the feed', async () => {
    const res = await api.get('/api/v1/posts').query({ limit: 50, authorId: alumniId }).set(auth(studentToken))
    const ids = (res.body.data.items as { id: string }[]).map((p) => p.id)
    expect(ids).not.toContain(mutedPostId)
  })

  it('keeps the muted user\'s profile visible and flags isMutedByViewer', async () => {
    const res = await api.get(`/api/v1/users/${alumniId}`).set(auth(studentToken))
    expect(res.status).toBe(200)
    expect(res.body.data.isMutedByViewer).toBe(true)
  })

  it('unmutes and the post reappears in the feed', async () => {
    const unmute = await api.delete(`/api/v1/moderation/mute/${alumniId}`).set(auth(studentToken))
    expect([200, 204]).toContain(unmute.status)

    const res = await api.get('/api/v1/posts').query({ limit: 50, authorId: alumniId }).set(auth(studentToken))
    const ids = (res.body.data.items as { id: string }[]).map((p) => p.id)
    expect(ids).toContain(mutedPostId)
  })
})

describe('Reporting', () => {
  it('files a report against a user (201)', async () => {
    const res = await api
      .post('/api/v1/moderation/report')
      .set(auth(studentToken))
      .send({ targetType: 'user', targetId: facultyId, reason: 'harassment', description: 'test' })
    expect(res.status).toBe(201)
    expect(res.body.data.id).toBeTruthy()
  })

  it('files a report against content (201)', async () => {
    const post = await api
      .post('/api/v1/posts')
      .set(auth(alumniToken))
      .send({ content: 'MODTEST reportable post', type: 'post' })
    createdPostIds.push(post.body.data.id)

    const res = await api
      .post('/api/v1/moderation/report')
      .set(auth(studentToken))
      .send({ targetType: 'post', targetId: post.body.data.id, reason: 'spam' })
    expect(res.status).toBe(201)
  })

  it('rejects reporting yourself (400)', async () => {
    const res = await api
      .post('/api/v1/moderation/report')
      .set(auth(studentToken))
      .send({ targetType: 'user', targetId: studentId, reason: 'spam' })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('SELF_REPORT_NOT_ALLOWED')
  })

  it('rejects an invalid reason (422)', async () => {
    const res = await api
      .post('/api/v1/moderation/report')
      .set(auth(studentToken))
      .send({ targetType: 'user', targetId: facultyId, reason: 'not_a_reason' })
    expect(res.status).toBe(422)
  })

  it('surfaces filed reports in the admin queue', async () => {
    const adminLogin = await loginAs(CREDENTIALS.admin.email, CREDENTIALS.admin.password)
    const res = await api
      .get('/api/v1/admin/reports')
      .set(auth(adminLogin.accessToken))
    expect(res.status).toBe(200)
    const userReports = (res.body.data.items as { targetType: string }[]).filter(
      (r) => r.targetType === 'user',
    )
    expect(userReports.length).toBeGreaterThan(0)
  })
})

describe('Moderation auth', () => {
  it('requires authentication', async () => {
    const res = await api.get('/api/v1/moderation/blocks').set('x-university-domain', DOMAIN)
    expect(res.status).toBe(401)
  })
})
