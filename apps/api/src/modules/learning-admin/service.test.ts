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
})
