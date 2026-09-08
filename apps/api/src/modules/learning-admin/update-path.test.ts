import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import request from 'supertest'
import { db } from '../../config/db'
import { app, loginAs, DOMAIN } from '../../__tests__/setup'

describe('PATCH /admin/learning/paths/:id', () => {
  let pathId: string
  let universityId: string

  beforeEach(async () => {
    const uni = await db('universities').where({ domain: DOMAIN }).first('id')
    universityId = uni.id
    await db('skill_paths').where({ title: 'Path to update' }).del()
    const [path] = await db('skill_paths')
      .insert({ university_id: universityId, title: 'Path to update', category: 'career', difficulty: 'beginner', estimated_days: 5, is_published: false, source: 'manual' })
      .returning('id')
    pathId = path.id
  })

  afterAll(async () => {
    await db('skill_paths').where({ title: 'Path to update' }).del()
    await db('skill_paths').where({ title: 'Renamed path' }).del()
    await db.destroy()
  })

  it('updates metadata fields only', async () => {
    const { accessToken } = await loginAs('admin@uiu.ac.bd', 'Admin@1234')
    const res = await request(app)
      .patch(`/api/v1/admin/learning/paths/${pathId}`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Renamed path', department: 'CSE' })
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ title: 'Renamed path', department: 'CSE', category: 'career' })
  })

  it('publishes a draft path', async () => {
    const { accessToken } = await loginAs('admin@uiu.ac.bd', 'Admin@1234')
    const res = await request(app)
      .patch(`/api/v1/admin/learning/paths/${pathId}/publish`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ isPublished: true })
    expect(res.status).toBe(200)
    expect(res.body.data.isPublished).toBe(true)
  })

  it('404s for a path in another university', async () => {
    const { accessToken } = await loginAs('admin@uiu.ac.bd', 'Admin@1234')
    const res = await request(app)
      .patch(`/api/v1/admin/learning/paths/00000000-0000-0000-0000-000000000000`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'x' })
    expect(res.status).toBe(404)
  })
})
