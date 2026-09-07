import { describe, it, expect, afterAll } from 'vitest'
import supertest from 'supertest'
import { app, loginAs, DOMAIN, CREDENTIALS, TEST_UNIVERSITY_ID } from './setup'
import { db } from '../config/db'

const api = supertest(app)
const UNI = { 'x-university-domain': DOMAIN }
const CONTENT_PREFIX = 'ADMIN-CONTENT-TEST'

describe('GET /admin/content/posts exposes publish state', () => {
  afterAll(async () => {
    await db('posts').where({ university_id: TEST_UNIVERSITY_ID }).whereLike('content', `${CONTENT_PREFIX}%`).delete()
  })

  it('returns isPublished and publishAt for a scheduled announcement', async () => {
    const admin = await loginAs(CREDENTIALS.admin.email, CREDENTIALS.admin.password)
    const futureIso = new Date(Date.now() + 60 * 60 * 1000).toISOString()

    const createRes = await api
      .post('/api/v1/posts')
      .set(UNI)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ type: 'announcement', content: `${CONTENT_PREFIX} scheduled`, publish_at: futureIso })
    expect(createRes.status).toBe(201)

    const listRes = await api
      .get('/api/v1/admin/content/posts')
      .set(UNI)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .query({ filter: 'announcement', limit: 50 })
    expect(listRes.status).toBe(200)

    const item = listRes.body.data.items.find((i: { content: string }) => i.content === `${CONTENT_PREFIX} scheduled`)
    expect(item).toBeDefined()
    expect(item.isPublished).toBe(false)
    expect(item.publishAt).toBe(futureIso)
  })

  it('returns isPublished true and publishAt null for an immediately-published announcement', async () => {
    const admin = await loginAs(CREDENTIALS.admin.email, CREDENTIALS.admin.password)

    await api
      .post('/api/v1/posts')
      .set(UNI)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ type: 'announcement', content: `${CONTENT_PREFIX} live` })

    const listRes = await api
      .get('/api/v1/admin/content/posts')
      .set(UNI)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .query({ filter: 'announcement', limit: 50 })

    const item = listRes.body.data.items.find((i: { content: string }) => i.content === `${CONTENT_PREFIX} live`)
    expect(item).toBeDefined()
    expect(item.isPublished).toBe(true)
    expect(item.publishAt).toBeNull()
  })
})
