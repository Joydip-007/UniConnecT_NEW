import { describe, it, expect } from 'vitest'
import { randomUUID } from 'node:crypto'
import { db } from '../../config/db'
import { learningAdminService } from './service'

async function createUniversity(): Promise<string> {
  const [row] = await db('universities')
    .insert({
      name: 'Test University',
      domain: `test-${randomUUID()}.example.edu`,
    })
    .returning<{ id: string }[]>('id')
  return row.id
}

async function cleanup(universityId: string): Promise<void> {
  await db('university_settings').where({ university_id: universityId }).del()
  await db('universities').where({ id: universityId }).del()
}

describe('learningAdminService', () => {
  it('getConfig returns defaults for a fresh university', async () => {
    const universityId = await createUniversity()

    const config = await learningAdminService.getConfig(universityId)

    expect(config.enabled).toBe(false)
    expect(config.topics).toEqual([])
    expect(config.difficulty).toBe('intermediate')
    expect(config.language).toBe('en')
    expect(config.estimatedDays).toBe(7)
    expect(config.customInstructions).toBeNull()
    expect(config.genHour).toBe(2)
    expect(config.countPerRun).toBe(1)
    expect(config.quizRequireApproval).toBe(false)

    await cleanup(universityId)
  })

  it('updateConfig persists and round-trips a partial patch', async () => {
    const universityId = await createUniversity()

    const updated = await learningAdminService.updateConfig(universityId, {
      enabled: true,
      topics: [{ category: 'Data Structures', difficulty: 'beginner' }],
      language: 'bn',
      estimatedDays: 14,
    })

    expect(updated.enabled).toBe(true)
    expect(updated.topics).toEqual([{ category: 'Data Structures', difficulty: 'beginner' }])
    expect(updated.language).toBe('bn')
    expect(updated.estimatedDays).toBe(14)
    // untouched fields keep their defaults
    expect(updated.difficulty).toBe('intermediate')
    expect(updated.quizRequireApproval).toBe(false)

    const fetched = await learningAdminService.getConfig(universityId)
    expect(fetched).toEqual(updated)

    await cleanup(universityId)
  })
  it('lists and action pending paths correctly', async () => {
    const universityId = await createUniversity()

    // Create a path
    const [path] = await db('skill_paths').insert({
      university_id: universityId,
      title: 'AI Path',
      category: 'Computer Science',
      description: 'Desc',
      difficulty: 'beginner',
      estimated_days: 7,
      is_published: false,
      source: 'ai'
    }).returning('id')

    await db('skill_path_units').insert({
      path_id: path.id,
      title: 'Unit 1',
      display_order: 1,
      type: 'quiz',
      content: '{}'
    })

    const pending = await learningAdminService.listPendingPaths(universityId)
    expect(pending.length).toBe(1)
    expect(pending[0].id).toBe(path.id)

    // Approve
    await learningAdminService.approvePath(universityId, path.id)
    const approved = await db('skill_paths').where({ id: path.id }).first()
    expect(approved.is_published).toBe(true)

    // Ensure list is now empty
    const pendingAfterApprove = await learningAdminService.listPendingPaths(universityId)
    expect(pendingAfterApprove.length).toBe(0)

    // Discard
    await db('skill_paths').where({ id: path.id }).update({ is_published: false }) // revert to test discard
    await learningAdminService.discardPath(universityId, path.id)

    const discardedPath = await db('skill_paths').where({ id: path.id }).first()
    const discardedUnits = await db('skill_path_units').where({ path_id: path.id })
    expect(discardedPath).toBeUndefined()
    expect(discardedUnits.length).toBe(0)

    await cleanup(universityId)
  })

  it('lists and action pending quiz batches correctly', async () => {
    const universityId = await createUniversity()

    // Must return empty if requireApproval is false
    const [quiz] = await db('ai_quiz_pool').insert({
      university_id: universityId,
      department: 'Dept',
      questions: '[]',
      is_approved: null
    }).returning('id')

    let pending = await learningAdminService.listPendingQuizBatches(universityId)
    expect(pending.length).toBe(0)

    // Enable it
    await learningAdminService.updateConfig(universityId, { quizRequireApproval: true })
    pending = await learningAdminService.listPendingQuizBatches(universityId)
    expect(pending.length).toBe(1)
    expect(pending[0].id).toBe(quiz.id)

    // Approve
    await learningAdminService.approveQuizBatch(universityId, quiz.id)
    const approved = await db('ai_quiz_pool').where({ id: quiz.id }).first()
    expect(approved.is_approved).toBe(true)

    // Discard another
    const [quiz2] = await db('ai_quiz_pool').insert({
      university_id: universityId,
      department: 'Dept',
      questions: '[]',
      is_approved: null
    }).returning('id')

    await learningAdminService.discardQuizBatch(universityId, quiz2.id)
    const discarded = await db('ai_quiz_pool').where({ id: quiz2.id }).first()
    expect(discarded.is_approved).toBe(false)

    await db('ai_quiz_pool').where({ university_id: universityId }).del()
    await cleanup(universityId)
  })
})
