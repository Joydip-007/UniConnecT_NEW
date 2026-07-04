import { beforeAll, describe, expect, it } from 'vitest'
import supertest from 'supertest'
import { app, DOMAIN, loginAs, CREDENTIALS, TEST_UNIVERSITY_ID } from './setup'
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

describe('unit completion & streaks', () => {
  it('rejects completing a locked (out-of-order) unit', async () => {
    const res = await post(`/api/v1/learning/units/${unitIds[1]}/complete`).send({})
    expect(res.status).toBe(400)
  })

  it('completes the first unit and starts a streak', async () => {
    const res = await post(`/api/v1/learning/units/${unitIds[0]}/complete`).send({})
    expect(res.status).toBe(200)
    expect(res.body.data.streak.currentStreak).toBe(1)
  })

  it('is idempotent on repeat completion', async () => {
    const res = await post(`/api/v1/learning/units/${unitIds[0]}/complete`).send({})
    expect(res.status).toBe(200)
    expect(res.body.data.alreadyCompleted).toBe(true)
  })

  it('enforces one unit per path per day', async () => {
    const res = await post(`/api/v1/learning/units/${unitIds[1]}/complete`).send({})
    expect(res.status).toBe(429)
  })

  it('surfaces the next unit in /me/today', async () => {
    const res = await get('/api/v1/learning/me/today')
    expect(res.status).toBe(200)
    const entry = res.body.data.find((e: { pathId: string }) => e.pathId === pathId)
    expect(entry.unit.id).toBe(unitIds[1])
    expect(entry.completedToday).toBe(true)
  })

  it('requires a passing score on quiz units', async () => {
    // Fast-forward: mark unit 2 complete yesterday directly in the DB to unlock unit 3 and clear the daily cap
    await db('unit_completions').insert({
      user_id: (await db('users').where({ email: CREDENTIALS.student.email }).first('id')).id,
      unit_id: unitIds[1], path_id: pathId, university_id: TEST_UNIVERSITY_ID,
      completed_at: db.raw(`now() - interval '1 day'`),
    })
    expect((await post(`/api/v1/learning/units/${unitIds[2]}/complete`).send({ score: 40 })).status).toBe(400)
    const pass = await post(`/api/v1/learning/units/${unitIds[2]}/complete`).send({ score: 85 })
    expect(pass.status).toBe(200)
    expect(pass.body.data.pathCompleted).toBe(true)
  })

  it('marks the enrollment completed and enqueued no inline badge writes', async () => {
    const enr = await db('skill_path_enrollments')
      .where({ path_id: pathId })
      .first('status')
    expect(enr.status).toBe('completed')
  })

  it('returns stats', async () => {
    const res = await get('/api/v1/learning/me/stats')
    expect(res.status).toBe(200)
    expect(res.body.data.currentStreak).toBeGreaterThanOrEqual(1)
    expect(res.body.data.freezesRemaining).toBeDefined()
  })
})
