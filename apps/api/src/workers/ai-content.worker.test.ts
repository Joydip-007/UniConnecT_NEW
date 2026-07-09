import { describe, it, expect, vi } from 'vitest'
import { randomUUID } from 'node:crypto'

vi.mock('../services/ai.service', () => ({
  generateQuizQuestions: vi.fn(),
}))

import { generateQuizQuestions } from '../services/ai.service'
import { runQuizGeneration } from './ai-content.worker'
import { db } from '../config/db'

async function createUniversity(): Promise<string> {
  const [row] = await db('universities')
    .insert({
      name: 'Test University',
      domain: `test-${randomUUID()}.example.edu`,
    })
    .returning<{ id: string }[]>('id')
  return row.id
}

async function createUserWithProfile(universityId: string, department: string): Promise<void> {
  const [user] = await db('users')
    .insert({
      university_id: universityId,
      username: `test_${randomUUID().slice(0, 8)}`,
      email: `${randomUUID()}@example.edu`,
      role: 'student',
    })
    .returning<{ id: string }[]>('id')

  await db('profiles').insert({
    user_id: user.id,
    full_name: 'Test User',
    department,
  })
}

async function cleanup(universityId: string): Promise<void> {
  await db('ai_quiz_pool').where({ university_id: universityId }).del()
  const userIds = await db('users').where({ university_id: universityId }).pluck('id')
  await db('profiles').whereIn('user_id', userIds).del()
  await db('users').where({ university_id: universityId }).del()
  await db('universities').where({ id: universityId }).del()
}

describe('runQuizGeneration', () => {
  // runQuizGeneration iterates every university/department in the DB, so mocks are
  // implemented by department name (not call order) to stay deterministic alongside
  // whatever pre-existing seed/fixture departments already exist in the shared test DB.
  it(
    'inserts generated questions into ai_quiz_pool per department',
    async () => {
      const universityId = await createUniversity()
      await createUserWithProfile(universityId, 'Physics')
      ;(generateQuizQuestions as ReturnType<typeof vi.fn>).mockImplementation(async () => [
        { q: 'Q1', options: ['a', 'b', 'c', 'd'], answer: 0 },
      ])

      await runQuizGeneration()

      const row = await db('ai_quiz_pool').where({ university_id: universityId, department: 'Physics' }).first()
      expect(row).toBeTruthy()

      await cleanup(universityId)
    },
    // Same shared-rate-limiter/shared-DB reasoning as the test below: runQuizGeneration
    // iterates every university/department already in the DB, which can cross the
    // 12-calls/minute threshold and hit the limiter's ~60s cooldown sleep.
    90_000,
  )

  it(
    'continues to the next department when one generation call fails',
    async () => {
      const universityId = await createUniversity()
      await createUserWithProfile(universityId, 'Failing Dept')
      await createUserWithProfile(universityId, 'OK Dept')
      ;(generateQuizQuestions as ReturnType<typeof vi.fn>).mockImplementation(
        async (options: { department: string }) => {
          if (options.department === 'Failing Dept') throw new Error('quota exceeded')
          return [{ q: 'Q2', options: ['a', 'b', 'c', 'd'], answer: 1 }]
        },
      )

      await expect(runQuizGeneration()).resolves.not.toThrow()

      const failingRow = await db('ai_quiz_pool')
        .where({ university_id: universityId, department: 'Failing Dept' })
        .first()
      expect(failingRow).toBeUndefined()

      const okRow = await db('ai_quiz_pool').where({ university_id: universityId, department: 'OK Dept' }).first()
      expect(okRow).toBeTruthy()

      await cleanup(universityId)
    },
    // The in-process rate limiter (12 calls/min) is shared module state across both tests in
    // this file (and any pre-existing seed departments in the DB), so a second test run can
    // cross the threshold and hit the limiter's ~60s cooldown sleep.
    90_000,
  )
})
