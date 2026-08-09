import { describe, it, expect, vi, afterEach } from 'vitest'
import { randomUUID } from 'node:crypto'

// Stub only the generator calls; keep every other real export (notably AIQuotaExceededError,
// which the worker's error reporting matches with `instanceof`).
vi.mock('../services/ai.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/ai.service')>()),
  generateQuizQuestions: vi.fn(),
  generateFlashcards: vi.fn(),
  generateSkillPath: vi.fn(),
}))

afterEach(() => {
  vi.clearAllMocks()
})

import { generateQuizQuestions, generateFlashcards, generateSkillPath } from '../services/ai.service'
import { runQuizGeneration, runGroupPosting, runLearningPathGeneration } from './ai-content.worker'
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

/**
 * runQuizGeneration skips any university whose settings have quiz generation disabled or
 * whose configured gen hour isn't the current UTC hour. Both default to off/02:00, so a
 * fixture university needs an explicit settings row or the worker never reaches the insert.
 */
async function enableQuizGeneration(universityId: string): Promise<void> {
  await db('university_settings')
    .insert({
      university_id: universityId,
      ai_quiz_enabled: true,
      ai_learning_gen_hour: new Date().getUTCHours(),
    })
    .onConflict('university_id')
    .merge()
}

async function cleanup(universityId: string): Promise<void> {
  await db('ai_quiz_pool').where({ university_id: universityId }).del()
  await db('university_settings').where({ university_id: universityId }).del()
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
  await db('group_quizzes').whereIn('group_id', groupIds).del()
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
      await enableQuizGeneration(universityId)
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
      await enableQuizGeneration(universityId)
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

/** Today's date pinned to a specific UTC hour, so run-hour gating assertions are deterministic. */
function atUtcHour(hour: number): Date {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour, 0, 0, 0))
}

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
        const now = new Date()
        await groupsService.updateAiSettings({ userId: faculty.id, universityId, role: 'faculty' }, group.id, {
          ai_flashcards_enabled: true,
          require_approval: false,
          subject,
          run_hour: now.getUTCHours(),
        })
        // mockImplementation (not mockResolvedValueOnce) keyed by topic: the worker scans
        // every academic group in the shared test DB per run (including stray groups left
        // over from other test files/runs), so a FIFO one-shot mock can be consumed by an
        // unrelated group processed first. Same reasoning as runQuizGeneration's tests above.
        ;(generateFlashcards as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { topic: string }) =>
          opts.topic === subject ? [{ front: 'Q', back: 'A' }] : [],
        )

        await runGroupPosting(now)

        const decks = await db('group_flashcard_decks').where({ group_id: group.id })
        expect(decks).toHaveLength(1)
        expect(decks[0].is_archived).toBe(false)

        const updatedGroup = await db('groups').where({ id: group.id }).first()
        expect(updatedGroup.ai_settings.last_ai_post_date).toBeTruthy()
      } finally {
        await cleanupGroups(universityId)
      }
    },
    90_000,
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
        const now = new Date()
        await groupsService.updateAiSettings({ userId: faculty.id, universityId, role: 'faculty' }, group.id, {
          ai_flashcards_enabled: true,
          require_approval: true,
          subject,
          run_hour: now.getUTCHours(),
        })
        ;(generateFlashcards as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { topic: string }) =>
          opts.topic === subject ? [{ front: 'Q2', back: 'A2' }] : [],
        )

        await runGroupPosting(now)

        const decks = await db('group_flashcard_decks').where({ group_id: group.id })
        expect(decks).toHaveLength(1)
        expect(decks[0].is_archived).toBe(true)
        const updatedGroup = await db('groups').where({ id: group.id }).first()
        expect(updatedGroup.ai_settings.pending_deck_id).toBe(decks[0].id)
      } finally {
        await cleanupGroups(universityId)
      }
    },
    90_000,
  )

  it(
    'generates a group quiz when only the quiz toggle is enabled',
    async () => {
      const universityId = await createUniversity()
      const faculty = await createFacultyUser(universityId)
      const group = await groupsService.createGroup(
        { userId: faculty.id, universityId, role: 'faculty' },
        { name: 'CS107', description: 'A course group', type: 'academic', is_private: false },
      )
      try {
        const now = new Date()
        await groupsService.updateAiSettings({ userId: faculty.id, universityId, role: 'faculty' }, group.id, {
          ai_quiz_enabled: true,
          ai_flashcards_enabled: false,
          require_approval: false,
          question_style: 'true_false',
          run_hour: now.getUTCHours(),
        })
        ;(generateQuizQuestions as ReturnType<typeof vi.fn>).mockResolvedValue([
          { q: 'Q', options: ['a', 'b', 'c', 'd'], answer: 0 },
        ])

        await runGroupPosting(now)

        const quizzes = await db('group_quizzes').where({ group_id: group.id })
        expect(quizzes).toHaveLength(1)
        expect(quizzes[0].is_archived).toBe(false)
        expect(generateQuizQuestions).toHaveBeenCalledWith(expect.objectContaining({ style: 'true_false' }))
      } finally {
        await db('group_quizzes').where({ university_id: universityId }).del()
        await cleanupGroups(universityId)
      }
    },
    90_000,
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
        const now = new Date()
        const today = now.toISOString().slice(0, 10)
        await groupsService.updateAiSettings({ userId: faculty.id, universityId, role: 'faculty' }, group.id, {
          ai_flashcards_enabled: true,
          run_hour: now.getUTCHours(),
        })
        await db('groups')
          .where({ id: group.id })
          .update({ ai_settings: db.raw(`ai_settings || '{"last_ai_post_date": "${today}"}'::jsonb`) })

        await runGroupPosting(now)

        const decks = await db('group_flashcard_decks').where({ group_id: group.id })
        expect(decks).toHaveLength(0)
      } finally {
        await cleanupGroups(universityId)
      }
    },
    90_000,
  )

  it(
    'attributes the AI deck and post to the campus bot, not the group creator',
    async () => {
      const universityId = await createUniversity()
      const faculty = await createFacultyUser(universityId)
      const group = await groupsService.createGroup(
        { userId: faculty.id, universityId, role: 'faculty' },
        { name: 'CS104', description: 'A course group', type: 'academic', is_private: false },
      )
      try {
        const subject = `Graphs ${randomUUID()}`
        const now = new Date()
        await groupsService.updateAiSettings({ userId: faculty.id, universityId, role: 'faculty' }, group.id, {
          ai_flashcards_enabled: true,
          require_approval: false,
          subject,
          run_hour: now.getUTCHours(),
        })
        ;(generateFlashcards as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { topic: string }) =>
          opts.topic === subject ? [{ front: 'Q', back: 'A' }] : [],
        )

        await runGroupPosting(now)

        const [deck] = await db('group_flashcard_decks').where({ group_id: group.id })
        expect(deck.created_by).not.toBe(faculty.id)

        const post = await db('posts').where({ group_id: group.id }).first()
        expect(post.user_id).not.toBe(faculty.id)
      } finally {
        await cleanupGroups(universityId)
      }
    },
    90_000,
  )

  it(
    'skips a group whose configured run hour has not arrived yet',
    async () => {
      const universityId = await createUniversity()
      const faculty = await createFacultyUser(universityId)
      const group = await groupsService.createGroup(
        { userId: faculty.id, universityId, role: 'faculty' },
        { name: 'CS105', description: 'A course group', type: 'academic', is_private: false },
      )
      try {
        // Pin the clock: the gate is now "run hour arrived or passed", so the assertion needs
        // a deterministic UTC hour rather than an offset from the real current hour.
        const now = atUtcHour(5)
        await groupsService.updateAiSettings({ userId: faculty.id, universityId, role: 'faculty' }, group.id, {
          ai_flashcards_enabled: true,
          run_hour: 10,
        })
        ;(generateFlashcards as ReturnType<typeof vi.fn>).mockResolvedValue([{ front: 'Q', back: 'A' }])

        await runGroupPosting(now)

        expect(await db('group_flashcard_decks').where({ group_id: group.id })).toHaveLength(0)
      } finally {
        await cleanupGroups(universityId)
      }
    },
    90_000,
  )

  it(
    'still posts for a group whose run hour passed earlier today (delayed run self-heals)',
    async () => {
      const universityId = await createUniversity()
      const faculty = await createFacultyUser(universityId)
      const group = await groupsService.createGroup(
        { userId: faculty.id, universityId, role: 'faculty' },
        { name: 'CS108', description: 'A course group', type: 'academic', is_private: false },
      )
      try {
        const subject = `Heaps ${randomUUID()}`
        // Run hour 3 but the worker only gets to run at 09:xx — the last_ai_post_date filter,
        // not the hour, is what prevents a double post, so the group must still be processed.
        const now = atUtcHour(9)
        await groupsService.updateAiSettings({ userId: faculty.id, universityId, role: 'faculty' }, group.id, {
          ai_flashcards_enabled: true,
          require_approval: false,
          subject,
          run_hour: 3,
        })
        ;(generateFlashcards as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { topic: string }) =>
          opts.topic === subject ? [{ front: 'Q', back: 'A' }] : [],
        )

        await runGroupPosting(now)

        expect(await db('group_flashcard_decks').where({ group_id: group.id })).toHaveLength(1)
      } finally {
        await cleanupGroups(universityId)
      }
    },
    90_000,
  )

  it(
    'generates items_per_run cards rather than the hardcoded 10',
    async () => {
      const universityId = await createUniversity()
      const faculty = await createFacultyUser(universityId)
      const group = await groupsService.createGroup(
        { userId: faculty.id, universityId, role: 'faculty' },
        { name: 'CS106', description: 'A course group', type: 'academic', is_private: false },
      )
      try {
        const now = new Date()
        await groupsService.updateAiSettings({ userId: faculty.id, universityId, role: 'faculty' }, group.id, {
          ai_flashcards_enabled: true,
          items_per_run: 3,
          run_hour: now.getUTCHours(),
        })
        ;(generateFlashcards as ReturnType<typeof vi.fn>).mockResolvedValue([{ front: 'Q', back: 'A' }])

        await runGroupPosting(now)

        expect(generateFlashcards).toHaveBeenCalledWith(expect.objectContaining({ count: 3 }))
      } finally {
        await cleanupGroups(universityId)
      }
    },
    90_000,
  )
})

describe('runLearningPathGeneration', () => {
  async function cleanupLearning(universityId: string): Promise<void> {
    const pathIds = await db('skill_paths').where({ university_id: universityId }).pluck('id')
    await db('skill_path_units').whereIn('path_id', pathIds).del()
    await db('skill_paths').where({ university_id: universityId }).del()
    await db('university_settings').where({ university_id: universityId }).del()
    await cleanup(universityId)
  }

  it('skips when ai_learning_enabled is false', async () => {
    const universityId = await createUniversity()
    await db('university_settings').insert({
      university_id: universityId,
      ai_learning_enabled: false,
      ai_learning_topics: JSON.stringify([{ category: 'Algorithms' }]),
      ai_learning_gen_hour: new Date().getUTCHours(),
    })

    await runLearningPathGeneration(new Date())

    const paths = await db('skill_paths').where({ university_id: universityId })
    expect(paths).toHaveLength(0)

    await cleanupLearning(universityId)
  })

  it("skips when genHour doesn't match current UTC hour", async () => {
    const universityId = await createUniversity()
    const now = new Date()
    const mismatchedHour = (now.getUTCHours() + 5) % 24
    await db('university_settings').insert({
      university_id: universityId,
      ai_learning_enabled: true,
      ai_learning_topics: JSON.stringify([{ category: 'Algorithms' }]),
      ai_learning_gen_hour: mismatchedHour,
    })

    await runLearningPathGeneration(now)

    const paths = await db('skill_paths').where({ university_id: universityId })
    expect(paths).toHaveLength(0)

    await cleanupLearning(universityId)
  })

  it(
    'inserts is_published=false, source=ai skill_paths + units when enabled and hour matches',
    async () => {
      const universityId = await createUniversity()
      const now = new Date()
      const category = `Algorithms ${randomUUID()}`
      await db('university_settings').insert({
        university_id: universityId,
        ai_learning_enabled: true,
        ai_learning_topics: JSON.stringify([{ category }]),
        ai_learning_gen_hour: now.getUTCHours(),
        ai_learning_count_per_run: 1,
      })
      ;(generateSkillPath as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { category: string }) =>
        opts.category === category
          ? {
              title: 'Intro to Algorithms',
              description: 'A path',
              difficulty: 'beginner',
              estimatedHours: 5,
              units: [
                { title: 'Unit 1', type: 'read', content: { body: 'hello' }, estimatedMinutes: 10 },
                { title: 'Unit 2', type: 'exercise', content: { body: 'do it' }, estimatedMinutes: 15 },
              ],
            }
          : { title: 'x', description: 'x', difficulty: 'beginner', estimatedHours: 1, units: [] },
      )

      await runLearningPathGeneration(now)

      const path = await db('skill_paths').where({ university_id: universityId, category }).first()
      expect(path).toBeTruthy()
      expect(path.is_published).toBe(false)
      expect(path.source).toBe('ai')

      const units = await db('skill_path_units').where({ path_id: path.id }).orderBy('display_order')
      expect(units).toHaveLength(2)
      expect(units[0].title).toBe('Unit 1')
      expect(units[0].content.body).toBe('hello')

      await cleanupLearning(universityId)
    },
    90_000,
  )
})
