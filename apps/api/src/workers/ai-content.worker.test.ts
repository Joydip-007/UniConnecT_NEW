import { describe, it, expect, vi } from 'vitest'
import { randomUUID } from 'node:crypto'

vi.mock('../services/ai.service', () => ({
  generateQuizQuestions: vi.fn(),
  generateFlashcards: vi.fn(),
}))

import { generateQuizQuestions, generateFlashcards } from '../services/ai.service'
import { runQuizGeneration, runGroupPosting } from './ai-content.worker'
import { db } from '../config/db'
import { groupsService } from '../modules/groups/service'

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

async function createFacultyUser(universityId: string): Promise<{ id: string }> {
  const [user] = await db('users')
    .insert({
      university_id: universityId,
      username: `test_${randomUUID().slice(0, 8)}`,
      email: `${randomUUID()}@example.edu`,
      role: 'faculty',
    })
    .returning<{ id: string }[]>('id')

  await db('profiles').insert({
    user_id: user.id,
    full_name: 'Test Faculty',
  })

  return { id: user.id }
}

async function cleanupGroups(universityId: string): Promise<void> {
  const groupIds = await db('groups').where({ university_id: universityId }).pluck('id')
  await db('group_flashcards').whereIn('group_id', groupIds).del()
  await db('group_flashcard_decks').whereIn('group_id', groupIds).del()
  await db('posts').whereIn('group_id', groupIds).del()
  await db('group_members').whereIn('group_id', groupIds).del()
  await db('groups').where({ university_id: universityId }).del()
  await cleanup(universityId)
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

describe('runGroupPosting', () => {
  it(
    'creates a visible deck and bot post when require_approval is false',
    async () => {
      const universityId = await createUniversity()
      const faculty = await createFacultyUser(universityId)
      const group = await groupsService.createGroup(
        { userId: faculty.id, universityId, role: 'faculty' },
        { name: 'CS101', description: 'A course group', type: 'academic', is_private: false },
      )
      try {
        const subject = `Linked Lists ${randomUUID()}`
        await groupsService.updateAiSettings({ userId: faculty.id, universityId, role: 'faculty' }, group.id, {
          ai_flashcards_enabled: true,
          require_approval: false,
          subject,
        })
        // mockImplementation (not mockResolvedValueOnce) keyed by topic: the worker scans
        // every academic group in the shared test DB per run (including stray groups left
        // over from other test files/runs), so a FIFO one-shot mock can be consumed by an
        // unrelated group processed first. Same reasoning as runQuizGeneration's tests above.
        ;(generateFlashcards as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { topic: string }) =>
          opts.topic === subject ? [{ front: 'Q', back: 'A' }] : [],
        )

        await runGroupPosting()

        const decks = await db('group_flashcard_decks').where({ group_id: group.id })
        expect(decks).toHaveLength(1)
        expect(decks[0].is_archived).toBe(false)

        const updatedGroup = await db('groups').where({ id: group.id }).first()
        expect(updatedGroup.ai_settings.last_ai_post_date).toBeTruthy()
      } finally {
        await cleanupGroups(universityId)
      }
    },
    30_000,
  )

  it(
    'creates an archived deck with pending_deck_id when require_approval is true',
    async () => {
      const universityId = await createUniversity()
      const faculty = await createFacultyUser(universityId)
      const group = await groupsService.createGroup(
        { userId: faculty.id, universityId, role: 'faculty' },
        { name: 'CS102', description: 'A course group', type: 'academic', is_private: false },
      )
      try {
        const subject = `Trees ${randomUUID()}`
        await groupsService.updateAiSettings({ userId: faculty.id, universityId, role: 'faculty' }, group.id, {
          ai_flashcards_enabled: true,
          require_approval: true,
          subject,
        })
        ;(generateFlashcards as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { topic: string }) =>
          opts.topic === subject ? [{ front: 'Q2', back: 'A2' }] : [],
        )

        await runGroupPosting()

        const decks = await db('group_flashcard_decks').where({ group_id: group.id })
        expect(decks).toHaveLength(1)
        expect(decks[0].is_archived).toBe(true)
        const updatedGroup = await db('groups').where({ id: group.id }).first()
        expect(updatedGroup.ai_settings.pending_deck_id).toBe(decks[0].id)
      } finally {
        await cleanupGroups(universityId)
      }
    },
    30_000,
  )

  it(
    'skips a group whose last_ai_post_date is already today',
    async () => {
      // Assert on this test's own group only (not a global "generateFlashcards was never
      // called" check) — the worker scans every academic group across every university in
      // the shared test DB each run, so other concurrently-seeded groups may legitimately
      // trigger calls. Mirrors the department-scoped assertions in runQuizGeneration's tests
      // above for the same reason.
      const universityId = await createUniversity()
      const faculty = await createFacultyUser(universityId)
      const group = await groupsService.createGroup(
        { userId: faculty.id, universityId, role: 'faculty' },
        { name: 'CS103', description: 'A course group', type: 'academic', is_private: false },
      )
      try {
        const today = new Date().toISOString().slice(0, 10)
        await groupsService.updateAiSettings({ userId: faculty.id, universityId, role: 'faculty' }, group.id, {
          ai_flashcards_enabled: true,
        })
        await db('groups')
          .where({ id: group.id })
          .update({ ai_settings: db.raw(`ai_settings || '{"last_ai_post_date": "${today}"}'::jsonb`) })

        await runGroupPosting()

        const decks = await db('group_flashcard_decks').where({ group_id: group.id })
        expect(decks).toHaveLength(0)
      } finally {
        await cleanupGroups(universityId)
      }
    },
    30_000,
  )
})
