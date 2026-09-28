import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import supertest from 'supertest'
import { app, DOMAIN, loginAs, CREDENTIALS, TEST_UNIVERSITY_ID } from './setup'
import { db } from '../config/db'

// Uses the alumni account so it never collides with learning.test.ts, which resets the
// student's whole learning state in its own hooks.
let learner: { accessToken: string }
let learnerId: string
let pathId: string
let readUnitId: string
let quizUnitId: string
let badgeIds: string[] = []

const QUESTIONS = [
  { q: 'Two plus two?', options: ['3', '4', '5'], answer: 1 },
  { q: 'Capital of Bangladesh?', options: ['Dhaka', 'Chittagong'], answer: 0 },
]

const get = (url: string) =>
  supertest(app).get(url).set('x-university-domain', DOMAIN).set('Authorization', `Bearer ${learner.accessToken}`)
const post = (url: string) =>
  supertest(app).post(url).set('x-university-domain', DOMAIN).set('Authorization', `Bearer ${learner.accessToken}`)
const put = (url: string) =>
  supertest(app).put(url).set('x-university-domain', DOMAIN).set('Authorization', `Bearer ${learner.accessToken}`)

async function cleanup() {
  await db('user_badges').where({ user_id: learnerId }).del()
  await db('learning_stats').where({ user_id: learnerId }).del()
  // Cascades to units, enrollments, completions and quiz attempts.
  await db('skill_paths').where({ title: 'Quiz attempts path' }).whereNull('university_id').del()
  if (badgeIds.length) await db('badges').whereIn('id', badgeIds).del()
}

beforeAll(async () => {
  learner = await loginAs(CREDENTIALS.alumni.email, CREDENTIALS.alumni.password)
  learnerId = (await db('users').where({ email: CREDENTIALS.alumni.email }).first('id')).id
  await db('badges').whereIn('name', ['Pin test A', 'Pin test B', 'Pin test C', 'Pin test D']).del()
  await cleanup()

  const [path] = await db('skill_paths')
    .insert({ title: 'Quiz attempts path', category: 'testing', difficulty: 'beginner', estimated_days: 2 })
    .returning('id')
  pathId = path.id
  const units = await db('skill_path_units')
    .insert([
      {
        path_id: pathId, display_order: 1, title: 'Read first', type: 'read',
        content: JSON.stringify({ body: 'Counting is fun. It also takes practice.', estimatedMinutes: 4 }),
      },
      {
        path_id: pathId, display_order: 2, title: 'Checkpoint', type: 'quiz',
        content: JSON.stringify({ questions: QUESTIONS }),
        completion_rule: JSON.stringify({ passScore: 70 }),
      },
    ])
    .returning('id')
  readUnitId = units[0].id
  quizUnitId = units[1].id

  const badges = await db('badges')
    .insert(['A', 'B', 'C', 'D'].map((k) => ({
      name: `Pin test ${k}`, category: 'volume', trigger_type: 'unit_completed', trigger_count: 1000 + k.charCodeAt(0),
    })))
    .returning('id')
  badgeIds = badges.map((b: { id: string }) => b.id)
  await db('user_badges').insert(badgeIds.map((badge_id) => ({ user_id: learnerId, badge_id })))
})

afterAll(cleanup)

describe('path detail unit metadata', () => {
  it('exposes summary, minutes and question count even for locked units', async () => {
    const res = await get(`/api/v1/learning/paths/${pathId}`)
    expect(res.status).toBe(200)
    const [read, quiz] = res.body.data.units
    expect(read.summary).toBe('Counting is fun.')
    expect(read.minutes).toBe(4)
    expect(quiz.questionCount).toBe(2)
    expect(quiz.content).toBeNull() // not enrolled: questions stay gated
  })
})

describe('checkpoint quiz attempts', () => {
  it('refuses an attempt on a path the caller is not enrolled in', async () => {
    const res = await post(`/api/v1/learning/units/${quizUnitId}/attempts`).send({ answers: [1, 0] })
    expect(res.status).toBe(403)
  })

  it('lists the quiz as locked until the path is started', async () => {
    const res = await get('/api/v1/learning/me/quizzes')
    const row = res.body.data.find((q: { unitId: string }) => q.unitId === quizUnitId)
    expect(row).toMatchObject({ state: 'locked', pathStarted: false, attemptCount: 0, bestScore: null })
  })

  it('refuses an attempt while an earlier unit is unfinished', async () => {
    expect((await post(`/api/v1/learning/paths/${pathId}/enroll`)).status).toBe(200)
    const res = await post(`/api/v1/learning/units/${quizUnitId}/attempts`).send({ answers: [1, 0] })
    expect(res.status).toBe(400)
    const quizzes = await get('/api/v1/learning/me/quizzes')
    const row = quizzes.body.data.find((q: { unitId: string }) => q.unitId === quizUnitId)
    expect(row).toMatchObject({ state: 'locked', pathStarted: true, blockedByTitle: 'Read first' })
  })

  it('records a failing attempt without completing the unit', async () => {
    // Finish the reading unit yesterday so the daily pace does not block today's quiz.
    await db('unit_completions').insert({
      user_id: learnerId, unit_id: readUnitId, path_id: pathId, university_id: TEST_UNIVERSITY_ID,
      completed_at: db.raw(`now() - interval '1 day'`),
    })
    const res = await post(`/api/v1/learning/units/${quizUnitId}/attempts`).send({ answers: [0, 0] })
    expect(res.status).toBe(201)
    expect(res.body.data.attempt).toMatchObject({ score: 50, correctCount: 1, totalQuestions: 2, passed: false })
    expect(res.body.data.completion).toBeNull()
  })

  it('rejects an answer list that does not match the questions', async () => {
    const res = await post(`/api/v1/learning/units/${quizUnitId}/attempts`).send({ answers: [1] })
    expect(res.status).toBe(400)
  })

  it('grades a passing attempt server-side and completes the unit', async () => {
    const res = await post(`/api/v1/learning/units/${quizUnitId}/attempts`).send({ answers: [1, 0] })
    expect(res.status).toBe(201)
    expect(res.body.data.attempt.passed).toBe(true)
    expect(res.body.data.completion).toMatchObject({ completed: true, pathCompleted: true })
  })

  it('lists attempts newest first with a per-question review', async () => {
    const res = await get(`/api/v1/learning/units/${quizUnitId}/attempts`)
    expect(res.status).toBe(200)
    expect(res.body.data.map((a: { score: number }) => a.score)).toEqual([100, 50])
    expect(res.body.data[1].review[0]).toMatchObject({ selectedIndex: 0, correctIndex: 1, isCorrect: false })
  })

  it('reports best and latest scores, and keeps a finished path open for retakes', async () => {
    const quizzes = await get('/api/v1/learning/me/quizzes')
    const row = quizzes.body.data.find((q: { unitId: string }) => q.unitId === quizUnitId)
    expect(row).toMatchObject({ state: 'completed', attemptCount: 2, bestScore: 100, lastScore: 100, passed: true })

    const retake = await post(`/api/v1/learning/units/${quizUnitId}/attempts`).send({ answers: [0, 1] })
    expect(retake.status).toBe(201)
    expect(retake.body.data.completion).toBeNull()
  })
})

describe('badge progress and pins', () => {
  it('returns learning badges with progress and ownership', async () => {
    const res = await get('/api/v1/learning/me/badges/progress')
    expect(res.status).toBe(200)
    const a = res.body.data.find((b: { id: string }) => b.id === badgeIds[0])
    expect(a).toMatchObject({ earned: true, pinned: false, triggerType: 'unit_completed', current: 2 })
    expect(typeof a.heldByPct).toBe('number')
  })

  it('keeps at most three pins, dropping the oldest', async () => {
    for (const id of badgeIds) {
      expect((await put(`/api/v1/learning/me/badges/${id}/pin`).send({ pinned: true })).status).toBe(200)
    }
    const res = await get('/api/v1/learning/me/badges/progress')
    const pinned = res.body.data.filter((b: { pinned: boolean }) => b.pinned).map((b: { id: string }) => b.id)
    expect(pinned.sort()).toEqual(badgeIds.slice(1).sort())
  })

  it('unpins a badge', async () => {
    await put(`/api/v1/learning/me/badges/${badgeIds[3]}/pin`).send({ pinned: false })
    const res = await get('/api/v1/learning/me/badges/progress')
    expect(res.body.data.find((b: { id: string }) => b.id === badgeIds[3]).pinned).toBe(false)
  })

  it('refuses to pin a badge the caller does not own', async () => {
    const centurion = await db('badges').where({ name: 'Centurion' }).first('id')
    const res = await put(`/api/v1/learning/me/badges/${centurion.id}/pin`).send({ pinned: true })
    expect(res.status).toBe(404)
  })
})
