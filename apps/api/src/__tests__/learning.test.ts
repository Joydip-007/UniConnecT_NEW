import { beforeAll, describe, expect, it } from 'vitest'
import supertest from 'supertest'
import { app, DOMAIN, loginAs, CREDENTIALS } from './setup'
import { db } from '../config/db'

let student: { accessToken: string }
let pathId: string
let unitIds: string[]

beforeAll(async () => {
  student = await loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password)
  // Isolated fixture path (platform-wide) with 3 units, incl. a quiz
  const [path] = await db('skill_paths')
    .insert({ title: 'Test path', category: 'testing', difficulty: 'beginner', estimated_days: 3 })
    .returning('id')
  pathId = path.id
  const units = await db('skill_path_units')
    .insert([
      { path_id: pathId, display_order: 1, title: 'Unit 1', type: 'read', content: JSON.stringify({ body: 'a' }) },
      { path_id: pathId, display_order: 2, title: 'Unit 2', type: 'exercise', content: JSON.stringify({ body: 'b' }) },
      { path_id: pathId, display_order: 3, title: 'Unit 3', type: 'quiz', content: JSON.stringify({ questions: [] }), completion_rule: JSON.stringify({ passScore: 70 }) },
    ])
    .returning('id')
  unitIds = units.map((u: { id: string }) => u.id)
})

const get = (url: string) =>
  supertest(app).get(url).set('x-university-domain', DOMAIN).set('Authorization', `Bearer ${student.accessToken}`)
const post = (url: string) =>
  supertest(app).post(url).set('x-university-domain', DOMAIN).set('Authorization', `Bearer ${student.accessToken}`)

describe('learning paths', () => {
  it('lists visible published paths with unit counts', async () => {
    const res = await get('/api/v1/learning/paths')
    expect(res.status).toBe(200)
    const mine = res.body.data.find((p: { id: string }) => p.id === pathId)
    expect(mine).toBeDefined()
    expect(Number(mine.unitCount)).toBe(3)
  })

  it('enrolls, then rejects double enrollment', async () => {
    expect((await post(`/api/v1/learning/paths/${pathId}/enroll`)).status).toBe(200)
    expect((await post(`/api/v1/learning/paths/${pathId}/enroll`)).status).toBe(409)
  })

  it('returns path detail with ordered units and my enrollment', async () => {
    const res = await get(`/api/v1/learning/paths/${pathId}`)
    expect(res.status).toBe(200)
    expect(res.body.data.units.map((u: { display_order: number }) => u.display_order)).toEqual([1, 2, 3])
    expect(res.body.data.enrollment.status).toBe('active')
  })

  it('abandons and allows re-enroll', async () => {
    expect((await post(`/api/v1/learning/paths/${pathId}/abandon`)).status).toBe(200)
    const re = await post(`/api/v1/learning/paths/${pathId}/enroll`)
    expect(re.status).toBe(200)
  })

  it('404s a path from another tenant', async () => {
    const [other] = await db('universities')
      .insert({ name: 'Other U', domain: `other-${Date.now()}.edu` })
      .returning('id')
    const [foreign] = await db('skill_paths')
      .insert({ university_id: other.id, title: 'Foreign', category: 'x' })
      .returning('id')
    expect((await get(`/api/v1/learning/paths/${foreign.id}`)).status).toBe(404)
  })
})
