import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest'
import { db } from '../config/db'
import { TEST_UNIVERSITY_ID, CREDENTIALS } from '../__tests__/setup'

vi.mock('../queues/learning.queue', () => ({
  learningQueue: { add: vi.fn(), process: vi.fn(), on: vi.fn() },
}))
vi.mock('../queues/push.queue', () => ({
  pushQueue: { add: vi.fn() },
}))

import { generateDailyQuizSlots } from './quiz.worker'

// Dhaka is UTC+6: 18:10Z = 00:10 local on 2026-07-07.
const INSTANT = new Date('2026-07-06T18:10:00Z')
const LOCAL_DATE = '2026-07-07'
const DEPARTMENT = 'Ai Quiz Pool Test Dept'

let studentId: string

beforeAll(async () => {
  await db('universities').where({ id: TEST_UNIVERSITY_ID }).update({ timezone: 'Asia/Dhaka' })
  studentId = (await db('users').where({ email: CREDENTIALS.student.email }).first('id')).id
  await db('profiles').where({ user_id: studentId }).update({ department: DEPARTMENT })
})

afterAll(async () => {
  await db('profiles').where({ user_id: studentId }).update({ department: null })
  await db('ai_quiz_pool').where({ university_id: TEST_UNIVERSITY_ID, department: DEPARTMENT }).del()
  await db('daily_quiz_slots').where({ university_id: TEST_UNIVERSITY_ID, department: DEPARTMENT }).del()
})

describe('generateDailyQuizSlots — ai_quiz_pool priority', () => {
  afterAll(async () => {
    await db('ai_quiz_pool').where({ university_id: TEST_UNIVERSITY_ID, department: DEPARTMENT }).del()
    await db('daily_quiz_slots').where({ university_id: TEST_UNIVERSITY_ID, department: DEPARTMENT }).del()
  })

  it('consumes an available ai_quiz_pool row before falling back to skill_path_units', async () => {
    const [pooled] = await db('ai_quiz_pool')
      .insert({
        university_id: TEST_UNIVERSITY_ID,
        department: DEPARTMENT,
        questions: JSON.stringify([{ q: 'AI Q', options: ['a', 'b', 'c', 'd'], answer: 0 }]),
      })
      .returning('id')

    await generateDailyQuizSlots(INSTANT)

    const slot = await db('daily_quiz_slots')
      .where({ university_id: TEST_UNIVERSITY_ID, department: DEPARTMENT, date: LOCAL_DATE })
      .first()
    expect(slot).toBeTruthy()
    const questions = typeof slot.questions === 'string' ? JSON.parse(slot.questions) : slot.questions
    expect(questions[0].q).toBe('AI Q')

    const consumed = await db('ai_quiz_pool').where({ id: pooled.id }).first()
    expect(consumed.consumed_at).not.toBeNull()

    // Rerun should be a no-op (slot already exists) and must not throw.
    await generateDailyQuizSlots(INSTANT)
    const rows = await db('daily_quiz_slots').where({
      university_id: TEST_UNIVERSITY_ID,
      department: DEPARTMENT,
      date: LOCAL_DATE,
    })
    expect(rows.length).toBe(1)
  })

  it('falls back to skill_path_units/FALLBACK_QUESTIONS when no pool row is available', async () => {
    await db('daily_quiz_slots')
      .where({ university_id: TEST_UNIVERSITY_ID, department: DEPARTMENT, date: LOCAL_DATE })
      .del()

    await generateDailyQuizSlots(INSTANT)

    const slot = await db('daily_quiz_slots')
      .where({ university_id: TEST_UNIVERSITY_ID, department: DEPARTMENT, date: LOCAL_DATE })
      .first()
    expect(slot).toBeTruthy()
    const questions = typeof slot.questions === 'string' ? JSON.parse(slot.questions) : slot.questions
    expect(questions[0].q).not.toBe('AI Q')
  })
})
