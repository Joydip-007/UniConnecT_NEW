import { describe, it, expect, beforeAll } from 'vitest'
import supertest from 'supertest'
import { app, loginAs, CREDENTIALS, DOMAIN } from '../setup'
import { db } from '../../config/db'
import { groupsService, mergeAiSettings } from '../../modules/groups/service'
import { randomUUID } from 'node:crypto'

const api = supertest(app)

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

/**
 * These go over HTTP on purpose. The service-level tests above call updateAiSettings
 * directly and so skip `validate(UpdateGroupAISettingsSchema)` — which is exactly where
 * the toggles-are-mutually-exclusive bug lived. Only the routed path proves the fix.
 */
describe('PATCH /groups/:id/ai-settings — partial writes', () => {
  let token: string
  let groupId: string

  beforeAll(async () => {
    token = (await loginAs(CREDENTIALS.faculty.email, CREDENTIALS.faculty.password)).accessToken
    const created = await api
      .post('/api/v1/groups')
      .set('Authorization', `Bearer ${token}`)
      .set('x-university-domain', DOMAIN)
      .send({ name: `AI Toggles ${randomUUID().slice(0, 8)}`, description: 'g', type: 'academic', is_private: false })
    expect(created.status).toBe(201)
    groupId = created.body.data.id
  })

  function patch(body: Record<string, unknown>) {
    return api
      .patch(`/api/v1/groups/${groupId}/ai-settings`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-university-domain', DOMAIN)
      .send(body)
  }

  it('leaves the other toggles alone when one is switched on', async () => {
    expect((await patch({ require_approval: true })).status).toBe(200)
    expect((await patch({ ai_quiz_enabled: true })).status).toBe(200)
    expect((await patch({ ai_flashcards_enabled: true })).status).toBe(200)

    const res = await api
      .get(`/api/v1/groups/${groupId}/ai-settings`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-university-domain', DOMAIN)

    // All three independently on — previously each PATCH reset the other two to false.
    expect(res.body.data.aiSettings).toMatchObject({
      require_approval: true,
      ai_quiz_enabled: true,
      ai_flashcards_enabled: true,
    })
  })

  it('does not overwrite unrelated stored fields with schema defaults', async () => {
    await patch({ subject: 'Recursion', run_hour: 14, items_per_run: 20, language: 'bn' })
    await patch({ ai_quiz_enabled: true })

    const row = await db('groups').where({ id: groupId }).first()
    expect(row.ai_settings).toMatchObject({
      subject: 'Recursion',
      run_hour: 14,
      items_per_run: 20,
      language: 'bn',
    })
  })

  it('persists only the keys the client sent', async () => {
    const fresh = await api
      .post('/api/v1/groups')
      .set('Authorization', `Bearer ${token}`)
      .set('x-university-domain', DOMAIN)
      .send({ name: `AI Keys ${randomUUID().slice(0, 8)}`, description: 'g', type: 'academic', is_private: false })

    await api
      .patch(`/api/v1/groups/${fresh.body.data.id}/ai-settings`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-university-domain', DOMAIN)
      .send({ ai_quiz_enabled: true })

    const row = await db('groups').where({ id: fresh.body.data.id }).first()
    expect(Object.keys(row.ai_settings ?? {})).toEqual(['ai_quiz_enabled'])
  })
})
