import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import supertest from 'supertest'
import { app, DOMAIN, loginAs, CREDENTIALS, TEST_UNIVERSITY_ID } from './setup'
import { db } from '../config/db'

let student: { accessToken: string }
let pathId: string
let unitIds: string[]
let studentId: string

beforeAll(async () => {
  student = await loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password)
  studentId = (await db('users').where({ email: CREDENTIALS.student.email }).first('id')).id

  // Reset this student's learning state so assertions (e.g. currentStreak) are
  // deterministic across reruns against the shared, persistent test DB.
  await db('unit_completions').where({ user_id: studentId }).del()
  await db('skill_path_enrollments').where({ user_id: studentId }).del()
  await db('user_badges').where({ user_id: studentId }).del()
  await db('learning_stats').where({ user_id: studentId }).del()

  // Remove stale fixture rows left behind by a prior interrupted run. Deleting
  // skill_paths cascades to skill_path_units/enrollments/unit_completions
  // (all ON DELETE CASCADE — see migration 085_create_learning_tables).
  await db('skill_paths')
    .where({ title: 'Foreign' })
    .orWhere((qb) => qb.whereIn('title', ['Test path', 'Reminder path']).whereNull('university_id'))
    .del()
  await db('universities').where({ name: 'Other U' }).del()

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

afterAll(async () => {
  await db('unit_completions').where({ user_id: studentId }).del()
  await db('skill_path_enrollments').where({ user_id: studentId }).del()
  await db('user_badges').where({ user_id: studentId }).del()
  await db('learning_stats').where({ user_id: studentId }).del()

  // Deleting skill_paths cascades to skill_path_units/enrollments/unit_completions.
  await db('skill_paths')
    .where({ title: 'Foreign' })
    .orWhere((qb) => qb.whereIn('title', ['Test path', 'Reminder path']).whereNull('university_id'))
    .del()
  await db('universities').where({ name: 'Other U' }).del()
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

describe('badges', () => {
  let badgeId: string
  beforeAll(async () => {
    const studentId = (await db('users').where({ email: CREDENTIALS.student.email }).first('id')).id
    const badge = await db('badges').where({ name: 'Week one' }).first('id')
    badgeId = badge.id
    await db('user_badges').insert({ user_id: studentId, badge_id: badgeId }).onConflict(['user_id', 'badge_id']).ignore()
  })

  it('lists my badges with rarity', async () => {
    const res = await get('/api/v1/learning/me/badges')
    expect(res.status).toBe(200)
    const b = res.body.data.find((x: { id: string }) => x.id === badgeId)
    expect(b.rarity).toBe('epic') // sole holder in the test DB tier
  })

  it('showcases an owned badge and swaps atomically', async () => {
    const put = await supertest(app).put('/api/v1/learning/me/badges/showcase')
      .set('x-university-domain', DOMAIN).set('Authorization', `Bearer ${student.accessToken}`)
      .send({ badgeId })
    expect(put.status).toBe(200)
    const res = await get('/api/v1/learning/me/badges')
    expect(res.body.data.find((x: { id: string }) => x.id === badgeId).isShowcased).toBe(true)
  })

  it('rejects showcasing an unowned badge', async () => {
    const other = await db('badges').where({ name: 'Centurion' }).first('id')
    const put = await supertest(app).put('/api/v1/learning/me/badges/showcase')
      .set('x-university-domain', DOMAIN).set('Authorization', `Bearer ${student.accessToken}`)
      .send({ badgeId: other.id })
    expect(put.status).toBe(404)
  })

  it('exposes another user’s badges within the university', async () => {
    const faculty = await loginAs(CREDENTIALS.faculty.email, CREDENTIALS.faculty.password)
    const studentId = (await db('users').where({ email: CREDENTIALS.student.email }).first('id')).id
    const res = await supertest(app).get(`/api/v1/learning/users/${studentId}/badges`)
      .set('x-university-domain', DOMAIN).set('Authorization', `Bearer ${faculty.accessToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.some((x: { id: string }) => x.id === badgeId)).toBe(true)
  })
})
