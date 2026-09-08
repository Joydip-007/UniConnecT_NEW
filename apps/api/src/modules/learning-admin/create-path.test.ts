import { describe, it, expect, afterAll } from 'vitest'
import request from 'supertest'
import { db } from '../../config/db'
import { app, loginAs, DOMAIN, CREDENTIALS } from '../../__tests__/setup'

describe('POST /admin/learning/paths', () => {
  afterAll(async () => {
    await db('skill_paths').where({ title: 'Manually created path' }).del()
  })

  it('creates a manual, unpublished path with its units', async () => {
    const { accessToken } = await loginAs(CREDENTIALS.admin.email, CREDENTIALS.admin.password)
    const res = await request(app)
      .post('/api/v1/admin/learning/paths')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Manually created path',
        category: 'career',
        difficulty: 'beginner',
        estimatedDays: 5,
        department: 'CSE',
        units: [
          { title: 'Unit one', type: 'read', content: { body: 'Intro text' } },
          { title: 'Checkpoint', type: 'quiz', content: { questions: [{ q: 'Q1?', options: ['a', 'b'], answer: 0 }] }, completionRule: { passScore: 70 } },
        ],
      })
    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({ title: 'Manually created path', isPublished: false, source: 'manual', unitCount: 2 })

    const units = await db('skill_path_units').where({ path_id: res.body.data.id }).orderBy('display_order')
    expect(units).toHaveLength(2)
    expect(units[0].display_order).toBe(1)
    expect(units[1].display_order).toBe(2)
  })

  it('rejects a path with zero units', async () => {
    const { accessToken } = await loginAs(CREDENTIALS.admin.email, CREDENTIALS.admin.password)
    const res = await request(app)
      .post('/api/v1/admin/learning/paths')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'No units path', category: 'career', difficulty: 'beginner', estimatedDays: 5, units: [] })
    expect(res.status).toBe(422)
  })
})
