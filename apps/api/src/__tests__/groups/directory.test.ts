import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import supertest from 'supertest'
import { app, loginAs, TEST_UNIVERSITY_ID, CREDENTIALS, DOMAIN } from '../setup'
import { db } from '../../config/db'

const api = supertest(app)

const GROUP_PREFIX = 'Directory Test Group'

async function createGroup(ownerId: string, members: string[]) {
  const [group] = await db('groups')
    .insert({
      university_id: TEST_UNIVERSITY_ID,
      created_by: ownerId,
      name: `${GROUP_PREFIX} ${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      description: 'Directory fixture',
      type: 'other',
      is_private: false,
      member_count: members.length,
    })
    .returning('*')

  await db('group_members').insert(
    members.map((userId, i) => ({
      group_id: group.id,
      user_id: userId,
      role: i === 0 ? 'owner' : 'member',
    })),
  )

  return group as { id: string }
}

describe('Groups directory — social proof and mute', () => {
  let studentToken: string
  let studentId: string
  let facultyId: string
  let alumniId: string
  let adminId: string

  beforeAll(async () => {
    const s = await loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password)
    studentToken = s.accessToken
    studentId = (await db('users').where({ email: CREDENTIALS.student.email }).select('id').first()).id
    facultyId = (await db('users').where({ email: CREDENTIALS.faculty.email }).select('id').first()).id
    alumniId = (await db('users').where({ email: CREDENTIALS.alumni.email }).select('id').first()).id
    adminId = (await db('users').where({ email: CREDENTIALS.admin.email }).select('id').first()).id
  })

  afterEach(async () => {
    await db('connections').where({ university_id: TEST_UNIVERSITY_ID }).delete()
  })

  afterAll(async () => {
    await db('groups').whereILike('name', `${GROUP_PREFIX}%`).delete()
    await db('connections').where({ university_id: TEST_UNIVERSITY_ID }).delete()
  })

  async function listGroups() {
    const res = await api
      .get('/api/v1/groups')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${studentToken}`)
      .query({ limit: 100 })
    expect(res.status).toBe(200)
    return res.body.data.items as {
      id: string
      previewMembers: { id: string; fullName: string }[]
      knownMemberCount: number
      isMuted: boolean
    }[]
  }

  it('returns at most three preview members, owner first', async () => {
    const group = await createGroup(adminId, [adminId, facultyId, alumniId, studentId])

    const row = (await listGroups()).find((g) => g.id === group.id)
    expect(row).toBeDefined()
    expect(row!.previewMembers).toHaveLength(3)
    expect(row!.previewMembers[0].id).toBe(adminId)
  })

  // The detail header renders the same avatar stack as the card, so the detail
  // endpoint carries the same social proof.
  it('returns the preview members and known count on the detail endpoint too', async () => {
    const group = await createGroup(adminId, [adminId, facultyId, alumniId, studentId])

    const res = await api
      .get(`/api/v1/groups/${group.id}`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.previewMembers).toHaveLength(3)
    expect(res.body.data.previewMembers[0].id).toBe(adminId)
    expect(res.body.data.knownMemberCount).toBe(0)
  })

  // The count is "people you know", so it must follow the viewer's accepted connections
  // — not the raw member count, and not pending requests.
  it('counts only accepted connections among the members', async () => {
    const group = await createGroup(adminId, [adminId, facultyId, alumniId, studentId])

    const before = (await listGroups()).find((g) => g.id === group.id)
    expect(before!.knownMemberCount).toBe(0)

    await db('connections').insert([
      {
        university_id: TEST_UNIVERSITY_ID,
        requester_id: studentId,
        addressee_id: facultyId,
        status: 'accepted',
      },
      {
        university_id: TEST_UNIVERSITY_ID,
        requester_id: alumniId,
        addressee_id: studentId,
        status: 'pending',
      },
    ])

    const after = (await listGroups()).find((g) => g.id === group.id)
    expect(after!.knownMemberCount).toBe(1)
  })

  it('mutes and unmutes the caller’s own membership', async () => {
    const group = await createGroup(adminId, [adminId, studentId])

    const muted = await api
      .patch(`/api/v1/groups/${group.id}/members/me/mute`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ muted: true })
    expect(muted.status).toBe(200)
    expect(muted.body.data.isMuted).toBe(true)

    expect((await listGroups()).find((g) => g.id === group.id)!.isMuted).toBe(true)

    await api
      .patch(`/api/v1/groups/${group.id}/members/me/mute`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ muted: false })

    expect((await listGroups()).find((g) => g.id === group.id)!.isMuted).toBe(false)
  })

  it('rejects muting a group the caller is not in', async () => {
    const group = await createGroup(adminId, [adminId])

    const res = await api
      .patch(`/api/v1/groups/${group.id}/members/me/mute`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ muted: true })

    expect(res.status).toBe(404)
  })

  it('rejects a non-boolean mute value', async () => {
    const group = await createGroup(adminId, [adminId, studentId])

    const res = await api
      .patch(`/api/v1/groups/${group.id}/members/me/mute`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ muted: 'yes' })

    expect(res.status).toBe(422)
  })
})
