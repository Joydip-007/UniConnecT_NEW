import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import request from 'supertest'
import { db } from '../../config/db'
import { app, loginAs, DOMAIN } from '../../__tests__/setup'

describe('learning path unit management', () => {
  let pathId: string
  let unitId: string
  let universityId: string
  let accessToken: string

  beforeEach(async () => {
    const uni = await db('universities').where({ domain: DOMAIN }).first('id')
    universityId = uni.id
    accessToken = (await loginAs('admin@uiu.ac.bd', 'Admin@1234')).accessToken
    await db('skill_paths').where({ title: 'Path with units' }).del()
    const [path] = await db('skill_paths')
      .insert({ university_id: universityId, title: 'Path with units', category: 'career', difficulty: 'beginner', estimated_days: 5, is_published: false, source: 'manual' })
      .returning('id')
    pathId = path.id
    const [unit] = await db('skill_path_units')
      .insert({ path_id: pathId, display_order: 1, title: 'First unit', type: 'read', content: JSON.stringify({ body: 'x' }) })
      .returning('id')
    unitId = unit.id
  })

  afterAll(async () => {
    await db('skill_paths').where({ title: 'Path with units' }).del()
    await db.destroy()
  })

  it('appends a new unit at the end', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/learning/paths/${pathId}/units`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Second unit', type: 'exercise', content: { body: 'do this' } })
    expect(res.status).toBe(201)
    const units = await db('skill_path_units').where({ path_id: pathId }).orderBy('display_order')
    expect(units).toHaveLength(2)
    expect(units[1].display_order).toBe(2)
  })

  it('updates a unit', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/learning/paths/${pathId}/units/${unitId}`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Renamed unit' })
    expect(res.status).toBe(200)
    const row = await db('skill_path_units').where({ id: unitId }).first('title')
    expect(row.title).toBe('Renamed unit')
  })

  it('deletes a unit', async () => {
    const res = await request(app)
      .delete(`/api/v1/admin/learning/paths/${pathId}/units/${unitId}`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${accessToken}`)
    expect(res.status).toBe(200)
    const row = await db('skill_path_units').where({ id: unitId }).first()
    expect(row).toBeUndefined()
  })

  it('reorders units', async () => {
    const [second] = await db('skill_path_units')
      .insert({ path_id: pathId, display_order: 2, title: 'Second', type: 'read', content: JSON.stringify({ body: 'y' }) })
      .returning('id')
    const res = await request(app)
      .patch(`/api/v1/admin/learning/paths/${pathId}/units/reorder`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ unitIds: [second.id, unitId] })
    expect(res.status).toBe(200)
    const rows = await db('skill_path_units').where({ path_id: pathId }).orderBy('display_order')
    expect(rows[0].id).toBe(second.id)
    expect(rows[1].id).toBe(unitId)
  })
})
