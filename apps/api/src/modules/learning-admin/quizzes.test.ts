import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { db } from '../../config/db'
import { app, loginAs, DOMAIN, CREDENTIALS } from '../../__tests__/setup'

import * as aiService from '../../services/ai.service'

// The test setup file imports `app` before any per-file vi.mock runs, so the service
// already holds the real bindings — spy on the namespace instead of mocking the module.
const generateQuizQuestions = vi.spyOn(aiService, 'generateQuizQuestions')
const generateSkillPath = vi.spyOn(aiService, 'generateSkillPath')

const TITLE = 'Quizzes tab test path'

describe('admin Quizzes tab endpoints', () => {
  let adminToken: string
  let studentToken: string
  let universityId: string
  let pathId: string
  let quizUnitId: string

  beforeAll(async () => {
    adminToken = (await loginAs(CREDENTIALS.admin.email, CREDENTIALS.admin.password)).accessToken
    studentToken = (await loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password)).accessToken
    universityId = (await db('universities').where({ domain: DOMAIN }).first('id')).id
  })

  beforeEach(async () => {
    generateQuizQuestions.mockReset()
    generateSkillPath.mockReset()
    await db('skill_paths').where({ title: TITLE }).del()
    await db('ai_quiz_pool').where({ university_id: universityId, department: 'QUIZTEST' }).del()
    const [path] = await db('skill_paths')
      .insert({ university_id: universityId, title: TITLE, category: 'technical', difficulty: 'beginner', estimated_days: 3, is_published: true, source: 'manual' })
      .returning('id')
    pathId = path.id
    await db('skill_path_units').insert({ path_id: pathId, display_order: 1, title: 'Reading one', type: 'read', content: JSON.stringify({ body: 'x' }) })
    const [unit] = await db('skill_path_units')
      .insert({
        path_id: pathId,
        display_order: 2,
        title: 'Checkpoint',
        type: 'quiz',
        content: JSON.stringify({ questions: [{ q: 'Q?', options: ['a', 'b', 'c', 'd'], answer: 1 }] }),
        completion_rule: JSON.stringify({ passScore: 70 }),
      })
      .returning('id')
    quizUnitId = unit.id
  })

  afterAll(async () => {
    await db('skill_paths').where({ title: TITLE }).del()
    await db('ai_quiz_pool').where({ university_id: universityId, department: 'QUIZTEST' }).del()
    await db.destroy()
  })

  const asAdmin = (r: request.Test) => r.set('x-university-domain', DOMAIN).set('Authorization', `Bearer ${adminToken}`)

  it('GET /quizzes lists quiz units on paths with pass mark, question count and the path status', async () => {
    const res = await asAdmin(request(app).get('/api/v1/admin/learning/quizzes'))
    expect(res.status).toBe(200)
    const row = res.body.data.find((q: { id: string }) => q.id === quizUnitId)
    expect(row).toMatchObject({
      kind: 'path_unit',
      title: 'Checkpoint',
      pathId,
      pathTitle: TITLE,
      questionCount: 1,
      passMark: 70,
      attempts: 0,
      avgScore: null,
      status: 'published',
      source: 'staff',
    })
  })

  it('GET /quizzes surfaces an unconsumed AI batch as scheduled when no approval gate is on', async () => {
    await asAdmin(request(app).patch('/api/v1/admin/learning/config')).send({ quizRequireApproval: false })
    const [batch] = await db('ai_quiz_pool')
      .insert({ university_id: universityId, department: 'QUIZTEST', questions: JSON.stringify([{ q: 'a', options: ['1', '2', '3', '4'], answer: 0 }]) })
      .returning('id')
    const res = await asAdmin(request(app).get('/api/v1/admin/learning/quizzes'))
    const row = res.body.data.find((q: { id: string }) => q.id === batch.id)
    expect(row).toMatchObject({ kind: 'ai_batch', status: 'scheduled', questionCount: 1, source: 'ai' })
  })

  it('GET /quizzes/:kind/:id returns the questions and 404s for a foreign row', async () => {
    const ok = await asAdmin(request(app).get(`/api/v1/admin/learning/quizzes/path_unit/${quizUnitId}`))
    expect(ok.status).toBe(200)
    expect(ok.body.data.questions).toHaveLength(1)

    const missing = await asAdmin(request(app).get(`/api/v1/admin/learning/quizzes/daily_slot/${quizUnitId}`))
    expect(missing.status).toBe(404)

    const bad = await asAdmin(request(app).get(`/api/v1/admin/learning/quizzes/nope/${quizUnitId}`))
    expect(bad.status).toBe(422)
  })

  it('POST /quizzes/generate appends an AI quiz unit to the chosen path', async () => {
    generateQuizQuestions.mockResolvedValue([
      { q: 'Gen?', options: ['a', 'b', 'c', 'd'], answer: 2 },
      { q: 'Gen 2?', options: ['a', 'b', 'c', 'd'], answer: 0 },
    ])
    const res = await asAdmin(request(app).post('/api/v1/admin/learning/quizzes/generate')).send({ pathId, count: 2, style: 'mcq', difficulty: 'intermediate' })
    expect(res.status).toBe(201)
    expect(generateQuizQuestions).toHaveBeenCalledWith(
      expect.objectContaining({ count: 2, style: 'mcq', difficulty: 'intermediate', topic: expect.stringContaining('Reading one') }),
    )
    const unit = await db('skill_path_units').where({ id: res.body.data.unitId }).first()
    expect(unit).toMatchObject({ path_id: pathId, type: 'quiz', display_order: 3, title: `${TITLE} checkpoint` })
    expect(unit.content.questions).toHaveLength(2)
    expect(unit.completion_rule).toEqual({ passScore: 60 })
  })

  it('POST /paths/draft returns the AI draft without persisting anything', async () => {
    generateSkillPath.mockResolvedValue({
      title: 'Drafted',
      description: 'd',
      difficulty: 'advanced',
      estimatedHours: 2,
      units: [
        { title: 'U1', type: 'read', content: { body: 'b' }, estimatedMinutes: 8 },
        { title: 'Q1', type: 'quiz', content: { questions: [] }, estimatedMinutes: 10 },
      ],
    })
    const before = await db('skill_paths').where({ university_id: universityId }).count<{ count: string }[]>('id')
    const res = await asAdmin(request(app).post('/api/v1/admin/learning/paths/draft')).send({ topic: 'Data structures', unitCount: 2, department: 'CSE' })
    expect(res.status).toBe(200)
    expect(generateSkillPath).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'Data structures', unitCount: 2, includeCheckpointQuizzes: true, difficulty: 'beginner' }),
    )
    expect(res.body.data).toMatchObject({ title: 'Drafted', difficulty: 'advanced' })
    expect(res.body.data.units[1]).toMatchObject({ type: 'quiz', completionRule: { passScore: 60 } })
    const after = await db('skill_paths').where({ university_id: universityId }).count<{ count: string }[]>('id')
    expect(after[0].count).toBe(before[0].count)
  })

  it('rejects a short topic with 422 and non-admins with 403', async () => {
    const short = await asAdmin(request(app).post('/api/v1/admin/learning/paths/draft')).send({ topic: 'ab' })
    expect(short.status).toBe(422)
    const student = await request(app)
      .get('/api/v1/admin/learning/quizzes')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${studentToken}`)
    expect(student.status).toBe(403)
  })
})
