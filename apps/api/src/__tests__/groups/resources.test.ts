import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { app, loginAs, DOMAIN, TEST_UNIVERSITY_ID, CREDENTIALS } from '../setup'
import { db } from '../../config/db'

const api = supertest(app)

async function createGroupWithMember(universityId: string, ownerId: string, memberId: string) {
  const [group] = await db('groups')
    .insert({
      university_id: universityId,
      created_by: ownerId,
      name: `Resource Test Group ${Date.now()}`,
      description: 'Test',
      type: 'academic',
      is_private: false,
      member_count: 2,
    })
    .returning('*')
  await db('group_members').insert([
    { group_id: group.id, user_id: ownerId, role: 'owner' },
    { group_id: group.id, user_id: memberId, role: 'member' },
  ])
  return group as { id: string }
}

describe('Group resources', () => {
  let adminToken: string
  let studentToken: string
  let alumniToken: string
  let adminUserId: string
  let studentUserId: string
  let alumniUserId: string

  beforeAll(async () => {
    const a = await loginAs(CREDENTIALS.admin.email, CREDENTIALS.admin.password)
    adminToken = a.accessToken
    adminUserId = (await db('users').where({ email: CREDENTIALS.admin.email }).select('id').first()).id

    const s = await loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password)
    studentToken = s.accessToken
    studentUserId = (await db('users').where({ email: CREDENTIALS.student.email }).select('id').first()).id

    const al = await loginAs(CREDENTIALS.alumni.email, CREDENTIALS.alumni.password)
    alumniToken = al.accessToken
    alumniUserId = (await db('users').where({ email: CREDENTIALS.alumni.email }).select('id').first()).id
  })

  it('member can upload a resource and it appears in list', async () => {
    const group = await createGroupWithMember(TEST_UNIVERSITY_ID, adminUserId, studentUserId)

    const createRes = await api
      .post(`/api/v1/groups/${group.id}/resources`)
      .set({ Authorization: `Bearer ${studentToken}`, 'x-university-domain': DOMAIN })
      .send({ title: 'Lecture Notes', url: 'https://example.com/notes.pdf', category: 'notes' })

    expect(createRes.status).toBe(201)
    expect(createRes.body.data.title).toBe('Lecture Notes')

    const listRes = await api
      .get(`/api/v1/groups/${group.id}/resources`)
      .set({ Authorization: `Bearer ${studentToken}`, 'x-university-domain': DOMAIN })

    expect(listRes.status).toBe(200)
    expect(listRes.body.data.items.length).toBeGreaterThan(0)

    await db('groups').where({ id: group.id }).delete()
  })

  it('category filter returns only matching resources', async () => {
    const group = await createGroupWithMember(TEST_UNIVERSITY_ID, adminUserId, studentUserId)

    await api.post(`/api/v1/groups/${group.id}/resources`)
      .set({ Authorization: `Bearer ${studentToken}`, 'x-university-domain': DOMAIN })
      .send({ title: 'Notes', url: 'https://example.com/n.pdf', category: 'notes' })

    await api.post(`/api/v1/groups/${group.id}/resources`)
      .set({ Authorization: `Bearer ${studentToken}`, 'x-university-domain': DOMAIN })
      .send({ title: 'Syllabus', url: 'https://example.com/s.pdf', category: 'syllabus' })

    const res = await api
      .get(`/api/v1/groups/${group.id}/resources?category=syllabus`)
      .set({ Authorization: `Bearer ${studentToken}`, 'x-university-domain': DOMAIN })

    expect(res.status).toBe(200)
    expect(res.body.data.items.every((r: { category: string }) => r.category === 'syllabus')).toBe(true)

    await db('groups').where({ id: group.id }).delete()
  })

  it('track increments click_count', async () => {
    const group = await createGroupWithMember(TEST_UNIVERSITY_ID, adminUserId, studentUserId)

    const createRes = await api.post(`/api/v1/groups/${group.id}/resources`)
      .set({ Authorization: `Bearer ${studentToken}`, 'x-university-domain': DOMAIN })
      .send({ title: 'Track Test', url: 'https://example.com/t.pdf', category: 'other' })
    const resourceId = createRes.body.data.id

    const trackRes = await api
      .patch(`/api/v1/groups/${group.id}/resources/${resourceId}/track`)
      .set({ Authorization: `Bearer ${studentToken}`, 'x-university-domain': DOMAIN })

    expect(trackRes.status).toBe(200)
    expect(trackRes.body.data.clickCount).toBe(1)

    await db('groups').where({ id: group.id }).delete()
  })

  it('uploader can delete their own resource', async () => {
    const group = await createGroupWithMember(TEST_UNIVERSITY_ID, adminUserId, studentUserId)

    const createRes = await api.post(`/api/v1/groups/${group.id}/resources`)
      .set({ Authorization: `Bearer ${studentToken}`, 'x-university-domain': DOMAIN })
      .send({ title: 'To Delete', url: 'https://example.com/d.pdf', category: 'notes' })
    const resourceId = createRes.body.data.id

    const deleteRes = await api
      .delete(`/api/v1/groups/${group.id}/resources/${resourceId}`)
      .set({ Authorization: `Bearer ${studentToken}`, 'x-university-domain': DOMAIN })

    expect(deleteRes.status).toBe(200)
    expect(deleteRes.body.data.deleted).toBe(true)

    await db('groups').where({ id: group.id }).delete()
  })

  it('non-uploader member cannot delete (403)', async () => {
    const group = await createGroupWithMember(TEST_UNIVERSITY_ID, adminUserId, studentUserId)

    // alumni is NOT a member of this group yet; add them as a regular member
    await db('group_members').insert({ group_id: group.id, user_id: alumniUserId, role: 'member' })

    const createRes = await api.post(`/api/v1/groups/${group.id}/resources`)
      .set({ Authorization: `Bearer ${studentToken}`, 'x-university-domain': DOMAIN })
      .send({ title: 'Others Resource', url: 'https://example.com/o.pdf', category: 'notes' })
    const resourceId = createRes.body.data.id

    // alumni tries to delete student's resource
    const deleteRes = await api
      .delete(`/api/v1/groups/${group.id}/resources/${resourceId}`)
      .set({ Authorization: `Bearer ${alumniToken}`, 'x-university-domain': DOMAIN })

    expect(deleteRes.status).toBe(403)

    await db('groups').where({ id: group.id }).delete()
  })

  it('admin can delete any resource', async () => {
    const group = await createGroupWithMember(TEST_UNIVERSITY_ID, adminUserId, studentUserId)

    const createRes = await api.post(`/api/v1/groups/${group.id}/resources`)
      .set({ Authorization: `Bearer ${studentToken}`, 'x-university-domain': DOMAIN })
      .send({ title: 'Admin Delete Test', url: 'https://example.com/a.pdf', category: 'notes' })
    const resourceId = createRes.body.data.id

    const deleteRes = await api
      .delete(`/api/v1/groups/${group.id}/resources/${resourceId}`)
      .set({ Authorization: `Bearer ${adminToken}`, 'x-university-domain': DOMAIN })

    expect(deleteRes.status).toBe(200)

    await db('groups').where({ id: group.id }).delete()
  })

  it('non-member cannot list resources (403)', async () => {
    const group = await createGroupWithMember(TEST_UNIVERSITY_ID, adminUserId, studentUserId)

    // alumniUserId is NOT a member
    const res = await api
      .get(`/api/v1/groups/${group.id}/resources`)
      .set({ Authorization: `Bearer ${alumniToken}`, 'x-university-domain': DOMAIN })

    await db('groups').where({ id: group.id }).delete()
    expect(res.status).toBe(403)
  })
})
