import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import supertest from 'supertest'
import { app, loginAs, DOMAIN, TEST_UNIVERSITY_ID, CREDENTIALS } from './setup'
import { db } from '../config/db'

const api = supertest(app)
const UNI = { 'x-university-domain': DOMAIN }

let adminToken: string
let facultyToken: string
let adminUserId: string

beforeAll(async () => {
  const [admin, faculty] = await Promise.all([
    loginAs(CREDENTIALS.admin.email, CREDENTIALS.admin.password),
    loginAs(CREDENTIALS.faculty.email, CREDENTIALS.faculty.password),
  ])
  adminToken = admin.accessToken
  facultyToken = faculty.accessToken

  const adminRow = await db('users').where({ email: CREDENTIALS.admin.email }).first<{ id: string }>('id')
  adminUserId = adminRow!.id
})

afterEach(async () => {
  // Reset config + run history between tests so the 409 guard etc. start clean
  await db('content_sync_runs').where({ university_id: TEST_UNIVERSITY_ID }).delete()
  await db('university_settings')
    .where({ university_id: TEST_UNIVERSITY_ID })
    .update({
      content_sync_enabled: false,
      content_sync_news_url: null,
      content_sync_notice_url: null,
      content_sync_event_url: null,
    })
})

afterAll(async () => {
  await db('news')
    .where({ university_id: TEST_UNIVERSITY_ID })
    .andWhere((b) => b.whereLike('title', 'CS Test%').orWhereLike('source_url', 'https://cs-test.example%'))
    .delete()
  await db('content_sync_runs').where({ university_id: TEST_UNIVERSITY_ID }).delete()
})

describe('content-sync config', () => {
  it('is admin-only — faculty gets 403', async () => {
    const res = await api.get('/api/v1/admin/content-sync/config').set(UNI).set('Authorization', `Bearer ${facultyToken}`)
    expect(res.status).toBe(403)
  })

  it('round-trips config via PATCH then GET', async () => {
    const patch = await api
      .patch('/api/v1/admin/content-sync/config')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ noticeUrl: 'https://www.uiu.ac.bd/notice/', enabled: true })

    expect(patch.status).toBe(200)
    expect(patch.body.data).toMatchObject({ noticeUrl: 'https://www.uiu.ac.bd/notice/', enabled: true })

    const get = await api.get('/api/v1/admin/content-sync/config').set(UNI).set('Authorization', `Bearer ${adminToken}`)
    expect(get.body.data.noticeUrl).toBe('https://www.uiu.ac.bd/notice/')
    expect(get.body.data.enabled).toBe(true)
  })

  it('treats an empty-string URL as cleared (null)', async () => {
    await api
      .patch('/api/v1/admin/content-sync/config')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ noticeUrl: 'https://www.uiu.ac.bd/notice/' })

    const cleared = await api
      .patch('/api/v1/admin/content-sync/config')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ noticeUrl: '' })

    expect(cleared.body.data.noticeUrl).toBeNull()
  })
})

describe('POST /api/v1/admin/content-sync/run', () => {
  it('returns 400 when sync is disabled', async () => {
    const res = await api.post('/api/v1/admin/content-sync/run').set(UNI).set('Authorization', `Bearer ${adminToken}`).send({})
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('CONTENT_SYNC_DISABLED')
  })

  it('returns 400 when enabled but no source URLs', async () => {
    await db('university_settings')
      .insert({ university_id: TEST_UNIVERSITY_ID, content_sync_enabled: true })
      .onConflict('university_id')
      .merge({ content_sync_enabled: true })

    const res = await api.post('/api/v1/admin/content-sync/run').set(UNI).set('Authorization', `Bearer ${adminToken}`).send({})
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('CONTENT_SYNC_NO_SOURCES')
  })

  it('returns 409 when a run is already in progress', async () => {
    await db('university_settings')
      .insert({
        university_id: TEST_UNIVERSITY_ID,
        content_sync_enabled: true,
        content_sync_notice_url: 'https://www.uiu.ac.bd/notice/',
      })
      .onConflict('university_id')
      .merge({ content_sync_enabled: true, content_sync_notice_url: 'https://www.uiu.ac.bd/notice/' })

    await db('content_sync_runs').insert({
      university_id: TEST_UNIVERSITY_ID,
      triggered_by: adminUserId,
      status: 'running',
    })

    const res = await api.post('/api/v1/admin/content-sync/run').set(UNI).set('Authorization', `Bearer ${adminToken}`).send({})
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('CONTENT_SYNC_RUNNING')
  })
})

describe('incremental dedup', () => {
  it('rejects a second item with the same (university_id, source_url)', async () => {
    const sourceUrl = `https://cs-test.example/notice/dedup-${Date.now()}/`
    const base = {
      university_id: TEST_UNIVERSITY_ID,
      author_id: adminUserId,
      body: 'Body',
      category: 'notice',
      is_imported: true,
      source_url: sourceUrl,
    }

    await db('news').insert({ ...base, title: 'CS Test dedup A', slug: `cs-test-dedup-a-${Date.now()}` })

    await expect(
      db('news').insert({ ...base, title: 'CS Test dedup B', slug: `cs-test-dedup-b-${Date.now()}` }),
    ).rejects.toThrow()
  })
})

describe('announcement rotation', () => {
  it('publishing a newer notice demotes the previous announcement', async () => {
    const mkNotice = async (title: string) => {
      const res = await api
        .post('/api/v1/news')
        .set(UNI)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title, body: 'Notice body', category: 'notice', is_published: false })
      expect(res.status).toBe(201)
      return res.body.data.id as string
    }

    const publish = (id: string) =>
      api
        .patch(`/api/v1/news/${id}`)
        .set(UNI)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ is_published: true })

    const idA = await mkNotice(`CS Test Notice A ${Date.now()}`)
    const idB = await mkNotice(`CS Test Notice B ${Date.now()}`)

    await publish(idA)
    let rows = await db('news').whereIn('id', [idA, idB]).select<{ id: string; is_announcement: boolean }[]>('id', 'is_announcement')
    expect(rows.find((r) => r.id === idA)?.is_announcement).toBe(true)

    await publish(idB)
    rows = await db('news').whereIn('id', [idA, idB]).select<{ id: string; is_announcement: boolean }[]>('id', 'is_announcement')
    expect(rows.find((r) => r.id === idB)?.is_announcement).toBe(true)
    expect(rows.find((r) => r.id === idA)?.is_announcement).toBe(false)

    // exactly one announcement for the university
    const [{ count }] = await db('news')
      .where({ university_id: TEST_UNIVERSITY_ID, is_announcement: true })
      .count<{ count: string }[]>({ count: '*' })
    expect(Number(count)).toBe(1)
  })
})
