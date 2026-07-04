import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest'
import { db } from '../config/db'
import { TEST_UNIVERSITY_ID, CREDENTIALS } from '../__tests__/setup'

vi.mock('../queues/learning.queue', () => ({
  learningQueue: { add: vi.fn(), process: vi.fn(), on: vi.fn() },
}))
vi.mock('../queues/push.queue', () => ({
  pushQueue: { add: vi.fn() },
}))

import { runLearningSweep } from './learning.worker'
import { pushQueue } from '../queues/push.queue'

// Dhaka is UTC+6: 18:10Z = 00:10 local (sweep hour); 14:10Z = 20:10 local (reminder hour).
const SWEEP_INSTANT = new Date('2026-07-05T18:10:00Z')    // local date 2026-07-06
const REMINDER_INSTANT = new Date('2026-07-05T14:10:00Z') // local date 2026-07-05

let studentId: string
let pathId: string

beforeAll(async () => {
  await db('universities').where({ id: TEST_UNIVERSITY_ID }).update({ timezone: 'Asia/Dhaka' })
  studentId = (await db('users').where({ email: CREDENTIALS.student.email }).first('id')).id

  // Clean up any stale 'Reminder path' fixture (and this student's enrollment
  // in it) left behind by a prior interrupted run against the shared test DB.
  await db('skill_path_enrollments')
    .where({ user_id: studentId })
    .whereIn('path_id', db('skill_paths').select('id').where({ title: 'Reminder path' }))
    .del()
  await db('skill_paths').where({ title: 'Reminder path' }).del()
  await db('learning_stats').where({ user_id: studentId }).del()
})

afterAll(async () => {
  if (pathId) {
    await db('skill_path_enrollments').where({ path_id: pathId }).del()
    await db('skill_paths').where({ id: pathId }).del()
  }
  await db('skill_paths').where({ title: 'Reminder path' }).del()
  await db('learning_stats').where({ user_id: studentId }).del()
})

describe('runLearningSweep — midnight', () => {
  it('consumes a freeze for one missed day and is idempotent on rerun', async () => {
    await db('learning_stats')
      .insert({
        user_id: studentId, university_id: TEST_UNIVERSITY_ID,
        current_streak: 5, longest_streak: 5, last_activity_date: '2026-07-04',
        freezes_used_month: null, freezes_used_count: 0,
      })
      .onConflict('user_id')
      .merge()
    await runLearningSweep(SWEEP_INSTANT) // missed 2026-07-05
    let row = await db('learning_stats').where({ user_id: studentId }).first()
    expect(row.current_streak).toBe(5)
    // `date` columns come back as local-midnight Date objects; toISOString() would
    // shift the date backward in positive-UTC-offset timezones (e.g. Asia/Dhaka),
    // so compare via local Y/M/D components instead of a UTC conversion.
    const d = row.last_activity_date as Date
    const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    expect(localDate).toBe('2026-07-05')
    expect(row.freezes_used_count).toBe(1)
    await runLearningSweep(SWEEP_INSTANT) // rerun in the same hour must not double-consume
    row = await db('learning_stats').where({ user_id: studentId }).first()
    expect(row.freezes_used_count).toBe(1)
  })

  it('resets when monthly freezes are exhausted', async () => {
    await db('learning_stats').where({ user_id: studentId }).update({
      current_streak: 5, last_activity_date: '2026-07-04', freezes_used_month: '2026-07', freezes_used_count: 2,
    })
    await runLearningSweep(SWEEP_INSTANT)
    const row = await db('learning_stats').where({ user_id: studentId }).first()
    expect(row.current_streak).toBe(0)
  })
})

describe('runLearningSweep — reminder', () => {
  it('enqueues at most one push per day for streaked users with active enrollments', async () => {
    const [path] = await db('skill_paths').insert({ title: 'Reminder path', category: 'x' }).returning('id')
    pathId = path.id
    await db('skill_path_enrollments')
      .insert({ user_id: studentId, path_id: path.id, university_id: TEST_UNIVERSITY_ID, status: 'active' })
      .onConflict(['user_id', 'path_id']).merge({ status: 'active' })
    await db('learning_stats').where({ user_id: studentId }).update({
      current_streak: 3, last_activity_date: '2026-07-04', last_reminder_date: null,
    })
    await runLearningSweep(REMINDER_INSTANT)
    expect(pushQueue.add).toHaveBeenCalledTimes(1)
    await runLearningSweep(REMINDER_INSTANT) // second run same day → no new push
    expect(pushQueue.add).toHaveBeenCalledTimes(1)
  })
})
