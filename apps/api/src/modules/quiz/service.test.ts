import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { db } from '../../config/db'
import { TEST_UNIVERSITY_ID, CREDENTIALS } from '../../__tests__/setup'
import { getTodayLeaderboard } from './service'

const DEPARTMENT = 'Leaderboard Test Dept'
// Must match `todayLocalDate('UTC')` in service.ts at test-run time — the university's
// timezone is forced to UTC below, so today's date in UTC is what the service will query for.
const LOCAL_DATE = new Date().toLocaleDateString('en-CA', { timeZone: 'UTC' })

let studentId: string
let slotId: string

beforeAll(async () => {
  await db('universities').where({ id: TEST_UNIVERSITY_ID }).update({ timezone: 'UTC' })

  studentId = (await db('users').where({ email: CREDENTIALS.student.email }).first('id')).id
  await db('profiles')
    .where({ user_id: studentId })
    .update({ department: DEPARTMENT, full_name: 'Leaderboard Test Student', avatar_url: 'https://example.com/avatar.png' })

  const [slot] = await db('daily_quiz_slots')
    .insert({
      university_id: TEST_UNIVERSITY_ID,
      department: DEPARTMENT,
      date: LOCAL_DATE,
      questions: JSON.stringify([{ q: 'Q1', options: ['a', 'b', 'c', 'd'], answer: 0 }]),
    })
    .returning('id')
  slotId = slot.id

  await db('daily_quiz_attempts').insert({
    slot_id: slotId,
    user_id: studentId,
    university_id: TEST_UNIVERSITY_ID,
    answers: JSON.stringify([0]),
    score: 100,
    correct_count: 1,
    total_questions: 1,
  })
})

afterAll(async () => {
  await db('daily_quiz_attempts').where({ slot_id: slotId }).delete()
  await db('daily_quiz_slots').where({ id: slotId }).delete()
  await db('profiles').where({ user_id: studentId }).update({ department: null, full_name: 'Student', avatar_url: null })
})

describe('getTodayLeaderboard', () => {
  it('returns fullName/avatarUrl sourced from profiles, not users', async () => {
    const leaderboard = await getTodayLeaderboard({ userId: studentId, universityId: TEST_UNIVERSITY_ID })

    expect(leaderboard).toHaveLength(1)
    expect(leaderboard[0]).toMatchObject({
      userId: studentId,
      fullName: 'Leaderboard Test Student',
      avatarUrl: 'https://example.com/avatar.png',
      score: 100,
      correctCount: 1,
    })
  })
})
