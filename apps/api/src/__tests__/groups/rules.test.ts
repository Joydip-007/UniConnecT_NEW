import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { app, loginAs, TEST_UNIVERSITY_ID, CREDENTIALS, DOMAIN } from '../setup'
import { db } from '../../config/db'

const api = supertest(app)

async function createGroupWithAdminAndModerator(universityId: string, ownerId: string, moderatorId: string) {
  const [group] = await db('groups')
    .insert({
      university_id: universityId,
      created_by: ownerId,
      name: `Rules Test Group ${Date.now()}`,
      description: 'Test',
      type: 'academic',
      is_private: false,
      member_count: 2,
    })
    .returning('*')
  await db('group_members').insert([
    { group_id: group.id, user_id: ownerId, role: 'owner' },
    { group_id: group.id, user_id: moderatorId, role: 'moderator' },
  ])
  return group as { id: string }
}

describe('Group rules/about', () => {
  let adminToken: string
  let facultyToken: string
  let studentToken: string
  let adminUserId: string
  let facultyUserId: string
  let studentUserId: string

  beforeAll(async () => {
    const a = await loginAs(CREDENTIALS.admin.email, CREDENTIALS.admin.password)
    adminToken = a.accessToken
    adminUserId = (await db('users').where({ email: CREDENTIALS.admin.email }).select('id').first()).id

    const f = await loginAs(CREDENTIALS.faculty.email, CREDENTIALS.faculty.password)
    facultyToken = f.accessToken
    facultyUserId = (await db('users').where({ email: CREDENTIALS.faculty.email }).select('id').first()).id

    const s = await loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password)
    studentToken = s.accessToken
    studentUserId = (await db('users').where({ email: CREDENTIALS.student.email }).select('id').first()).id
  })

  afterAll(async () => {
    await db('groups').whereILike('name', 'Rules Test Group%').delete()
  })

  it('owner can set rules_md', async () => {
    const group = await createGroupWithAdminAndModerator(TEST_UNIVERSITY_ID, adminUserId, facultyUserId)

    const content = '## Rules\n1. Be respectful\n2. No spam'
    const res = await api
      .patch(`/api/v1/groups/${group.id}/rules`)
      .set({ Authorization: `Bearer ${adminToken}`, 'x-university-domain': DOMAIN })
      .send({ content })

    expect(res.status).toBe(200)
    expect(res.body.data.rulesMd).toBe(content)

    const row = await db('groups').where({ id: group.id }).select('rules_md').first()
    expect(row.rules_md).toBe(content)
  })

  it('rules_md is returned in getGroup response', async () => {
    const group = await createGroupWithAdminAndModerator(TEST_UNIVERSITY_ID, adminUserId, facultyUserId)

    await db('groups').where({ id: group.id }).update({ rules_md: 'Test rules content' })
    // Add student as member so they can GET the group
    await db('group_members').insert({ group_id: group.id, user_id: studentUserId, role: 'member' })

    const res = await api
      .get(`/api/v1/groups/${group.id}`)
      .set({ Authorization: `Bearer ${studentToken}`, 'x-university-domain': DOMAIN })

    expect(res.status).toBe(200)
    expect(res.body.data.rulesMd).toBe('Test rules content')
  })

  it('rules_md enforces max 5000 chars at validation layer', async () => {
    const group = await createGroupWithAdminAndModerator(TEST_UNIVERSITY_ID, adminUserId, facultyUserId)

    const res = await api
      .patch(`/api/v1/groups/${group.id}/rules`)
      .set({ Authorization: `Bearer ${adminToken}`, 'x-university-domain': DOMAIN })
      .send({ content: 'x'.repeat(5001) })

    expect(res.status).toBe(422)
  })

  it('moderator cannot set rules (403)', async () => {
    const group = await createGroupWithAdminAndModerator(TEST_UNIVERSITY_ID, adminUserId, facultyUserId)

    const res = await api
      .patch(`/api/v1/groups/${group.id}/rules`)
      .set({ Authorization: `Bearer ${facultyToken}`, 'x-university-domain': DOMAIN })
      .send({ content: '## Rules' })

    expect(res.status).toBe(403)
  })
})
