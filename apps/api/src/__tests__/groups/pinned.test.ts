import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { app, loginAs, TEST_UNIVERSITY_ID, CREDENTIALS, DOMAIN } from '../setup'
import { db } from '../../config/db'

const api = supertest(app)

async function createGroupWith3Members(universityId: string, ownerId: string, moderatorId: string, regularId: string) {
  const [group] = await db('groups')
    .insert({
      university_id: universityId,
      created_by: ownerId,
      name: `Pinned Test Group ${Date.now()}`,
      description: 'Test',
      type: 'academic',
      is_private: false,
      member_count: 3,
    })
    .returning('*')
  await db('group_members').insert([
    { group_id: group.id, user_id: ownerId, role: 'owner' },
    { group_id: group.id, user_id: moderatorId, role: 'moderator' },
    { group_id: group.id, user_id: regularId, role: 'member' },
  ])
  return group as { id: string }
}

describe('Pinned announcement', () => {
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
    await db('groups').whereILike('name', 'Pinned Test Group%').delete()
  })

  it('owner can set pinned text; groups row is updated', async () => {
    const group = await createGroupWith3Members(TEST_UNIVERSITY_ID, adminUserId, facultyUserId, studentUserId)

    const res = await api
      .patch(`/api/v1/groups/${group.id}/pinned`)
      .set({ Authorization: `Bearer ${adminToken}`, 'x-university-domain': DOMAIN })
      .send({ text: 'Welcome everyone!' })

    expect(res.status).toBe(200)

    const row = await db('groups').where({ id: group.id }).select('pinned_text', 'pinned_at', 'pinned_by').first()
    expect(row.pinned_text).toBe('Welcome everyone!')
    expect(row.pinned_by).toBe(adminUserId)
    expect(row.pinned_at).not.toBeNull()
  })

  it('moderator can set pinned text', async () => {
    const group = await createGroupWith3Members(TEST_UNIVERSITY_ID, adminUserId, facultyUserId, studentUserId)

    const res = await api
      .patch(`/api/v1/groups/${group.id}/pinned`)
      .set({ Authorization: `Bearer ${facultyToken}`, 'x-university-domain': DOMAIN })
      .send({ text: 'Moderator pinned this' })

    expect(res.status).toBe(200)
  })

  it('setting text: null clears the pin (no notification required)', async () => {
    const group = await createGroupWith3Members(TEST_UNIVERSITY_ID, adminUserId, facultyUserId, studentUserId)

    await api
      .patch(`/api/v1/groups/${group.id}/pinned`)
      .set({ Authorization: `Bearer ${adminToken}`, 'x-university-domain': DOMAIN })
      .send({ text: 'Hello' })

    const res = await api
      .patch(`/api/v1/groups/${group.id}/pinned`)
      .set({ Authorization: `Bearer ${adminToken}`, 'x-university-domain': DOMAIN })
      .send({ text: null })

    expect(res.status).toBe(200)
    expect(res.body.data.pinnedText).toBeNull()

    const row = await db('groups').where({ id: group.id }).select('pinned_text').first()
    expect(row.pinned_text).toBeNull()
  })

  it('regular member cannot set pinned text (403)', async () => {
    const group = await createGroupWith3Members(TEST_UNIVERSITY_ID, adminUserId, facultyUserId, studentUserId)

    const res = await api
      .patch(`/api/v1/groups/${group.id}/pinned`)
      .set({ Authorization: `Bearer ${studentToken}`, 'x-university-domain': DOMAIN })
      .send({ text: 'Member trying' })

    expect(res.status).toBe(403)
  })
})
