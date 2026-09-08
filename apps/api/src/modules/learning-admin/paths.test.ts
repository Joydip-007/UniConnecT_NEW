import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import { db } from '../../config/db'
import { app, loginAs, DOMAIN, CREDENTIALS } from '../../__tests__/setup'

describe('GET /admin/learning/paths', () => {
  let adminToken: string
  let universityId: string
  let pathId: string

  beforeAll(async () => {
    const auth = await loginAs(CREDENTIALS.admin.email, CREDENTIALS.admin.password)
    adminToken = auth.accessToken
    const uni = await db('universities').where({ domain: DOMAIN }).first('id')
    universityId = uni.id
  })

  beforeEach(async () => {
    await db('skill_paths').where({ title: 'Test path for admin list' }).del()
    const [path] = await db('skill_paths')
      .insert({
        university_id: universityId,
        title: 'Test path for admin list',
        category: 'career',
        difficulty: 'beginner',
        estimated_days: 5,
        is_published: false,
        source: 'manual',
      })
      .returning('id')
    pathId = path.id
    await db('skill_path_units').insert({
      path_id: pathId,
      display_order: 1,
      title: 'Unit one',
      type: 'read',
      content: JSON.stringify({ body: 'hello' }),
    })
  })

  afterAll(async () => {
    await db('skill_paths').where({ title: 'Test path for admin list' }).del()
    await db.destroy()
  })

  it('returns every path for the university, published and draft, with aggregates', async () => {
    const res = await request(app)
      .get('/api/v1/admin/learning/paths')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    const row = res.body.data.find((p: { id: string }) => p.id === pathId)
    expect(row).toMatchObject({
      title: 'Test path for admin list',
      isPublished: false,
      unitCount: 1,
      enrolledCount: 0,
      completionRate: 0,
    })
  })

  it('filters by status=draft', async () => {
    const res = await request(app)
      .get('/api/v1/admin/learning/paths?status=draft')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.every((p: { isPublished: boolean }) => p.isPublished === false)).toBe(true)
  })

  it('rejects a non-admin role', async () => {
    const auth = await loginAs(CREDENTIALS.faculty.email, CREDENTIALS.faculty.password)
    const res = await request(app)
      .get('/api/v1/admin/learning/paths')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${auth.accessToken}`)
    expect(res.status).toBe(403)
  })
})
