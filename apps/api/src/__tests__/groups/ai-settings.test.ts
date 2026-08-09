import { describe, it, expect } from 'vitest'
import { db } from '../../config/db'
import { groupsService, mergeAiSettings } from '../../modules/groups/service'
import { randomUUID } from 'node:crypto'

async function makeAcademicGroup() {
  const [uni] = await db('universities')
    .insert({ name: 'AI Settings U', domain: `ai-${randomUUID()}.example.edu` })
    .returning<{ id: string }[]>('id')
  const [user] = await db('users')
    .insert({
      university_id: uni.id,
      username: `t_${randomUUID().slice(0, 8)}`,
      email: `${randomUUID()}@example.edu`,
      role: 'faculty',
    })
    .returning<{ id: string }[]>('id')
  await db('profiles').insert({ user_id: user.id, full_name: 'Faculty' })
  const context = { userId: user.id, universityId: uni.id, role: 'faculty' as const }
  const group = await groupsService.createGroup(context, {
    name: 'AI CS101',
    description: 'g',
    type: 'academic',
    is_private: false,
  })
  return { context, groupId: group.id, universityId: uni.id }
}

describe('ai_settings concurrent writes', () => {
  it('does not clobber a concurrent write made from a stale snapshot', async () => {
    const { context, groupId } = await makeAcademicGroup()

    await groupsService.updateAiSettings(context, groupId, { subject: 'Trees' })

    // Simulates the worker: it holds a snapshot taken BEFORE the creator's save below.
    const staleSnapshot = { subject: 'Trees' }

    await groupsService.updateAiSettings(context, groupId, { ai_flashcards_enabled: true })
    await mergeAiSettings(groupId, { ...staleSnapshot, last_ai_post_date: '2026-08-09' })

    const row = await db('groups').where({ id: groupId }).first()
    // The creator's enable survives the worker's write.
    expect(row.ai_settings.ai_flashcards_enabled).toBe(true)
    expect(row.ai_settings.last_ai_post_date).toBe('2026-08-09')
  })
})
