import request from 'supertest'
import { describe, it, expect, beforeAll } from 'vitest'
import { app, DOMAIN, loginAs, CREDENTIALS } from '../setup'

describe('group post & event approval queues', () => {
  let faculty: { accessToken: string }
  let student: { accessToken: string }
  let admin: { accessToken: string }
  let groupId: string

  beforeAll(async () => {
    faculty = await loginAs(CREDENTIALS.faculty.email, CREDENTIALS.faculty.password)
    student = await loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password)
    admin = await loginAs(CREDENTIALS.admin.email, CREDENTIALS.admin.password)

    const res = await request(app)
      .post('/api/v1/groups')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${faculty.accessToken}`)
      .send({ name: 'Review queue club', description: 'x', type: 'club', is_private: false })
    groupId = res.body.data.id

    await request(app)
      .patch(`/api/v1/groups/${groupId}/settings`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${faculty.accessToken}`)
      .send({ require_post_approval: true, require_event_approval: true })

    // student and admin join the public group as plain members
    await request(app)
      .post(`/api/v1/groups/${groupId}/members`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${student.accessToken}`)
      .send({})
    await request(app)
      .post(`/api/v1/groups/${groupId}/members`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({})
  })

  it('holds a member post when require_post_approval is on, and approving publishes it', async () => {
    const created = await request(app)
      .post('/api/v1/posts')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${student.accessToken}`)
      .send({ type: 'post', content: 'hi from student', group_id: groupId })

    expect(created.status).toBe(201)
    expect(created.body.data.groupReviewStatus).toBe('pending')
    expect(created.body.data.isPublished).toBe(false)
    const postId = created.body.data.id

    const queue = await request(app)
      .get(`/api/v1/groups/${groupId}/review/posts`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${faculty.accessToken}`)
    expect(queue.status).toBe(200)
    expect(queue.body.data.items.map((p: { id: string }) => p.id)).toContain(postId)

    const beforeApprove = await request(app)
      .get(`/api/v1/groups/${groupId}/posts`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${faculty.accessToken}`)
    expect(beforeApprove.body.data.items.some((p: { id: string }) => p.id === postId)).toBe(false)

    const approve = await request(app)
      .patch(`/api/v1/groups/${groupId}/review/posts/${postId}`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${faculty.accessToken}`)
      .send({ action: 'approve' })
    expect(approve.status).toBe(200)

    const afterApprove = await request(app)
      .get(`/api/v1/groups/${groupId}/posts`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${faculty.accessToken}`)
    expect(afterApprove.body.data.items.some((p: { id: string }) => p.id === postId)).toBe(true)
  })

  it('declining a queued post keeps it out of the group feed', async () => {
    const created = await request(app)
      .post('/api/v1/posts')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${student.accessToken}`)
      .send({ type: 'post', content: 'spammy', group_id: groupId })
    const postId = created.body.data.id

    const decline = await request(app)
      .patch(`/api/v1/groups/${groupId}/review/posts/${postId}`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${faculty.accessToken}`)
      .send({ action: 'decline' })
    expect(decline.status).toBe(200)

    const afterDecline = await request(app)
      .get(`/api/v1/groups/${groupId}/posts`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${faculty.accessToken}`)
    expect(afterDecline.body.data.items.some((p: { id: string }) => p.id === postId)).toBe(false)
  })

  it('moderators bypass the post approval hold', async () => {
    // Promote admin (a plain member so far) to moderator within the group.
    const members = await request(app)
      .get(`/api/v1/groups/${groupId}/members`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${faculty.accessToken}`)
    const adminMember = members.body.data.items.find((m: { role: string; user?: { id: string } }) => m.role === 'member')
    expect(adminMember).toBeTruthy()

    await request(app)
      .patch(`/api/v1/groups/${groupId}/members/${adminMember.user.id}`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${faculty.accessToken}`)
      .send({ role: 'moderator' })

    const created = await request(app)
      .post('/api/v1/posts')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ type: 'post', content: 'mod post, published immediately', group_id: groupId })

    expect(created.status).toBe(201)
    expect(created.body.data.groupReviewStatus).toBeNull()
    expect(created.body.data.isPublished).toBe(true)

    // demote back to member so later tests can use admin as a plain member/organizer
    await request(app)
      .patch(`/api/v1/groups/${groupId}/members/${adminMember.user.id}`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${faculty.accessToken}`)
      .send({ role: 'member' })
  })

  it('holds a member event when require_event_approval is on, and approving publishes it', async () => {
    const created = await request(app)
      .post('/api/v1/events')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        title: 'Queued event',
        description: 'x',
        location: 'Campus',
        starts_at: new Date(Date.now() + 86400000).toISOString(),
        type: 'general',
        group_id: groupId,
        is_published: true,
      })
    expect(created.status).toBe(201)
    expect(created.body.data.groupReviewStatus).toBe('pending')
    expect(created.body.data.isPublished).toBe(false)
    const eventId = created.body.data.id

    const queue = await request(app)
      .get(`/api/v1/groups/${groupId}/review/events`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${faculty.accessToken}`)
    expect(queue.status).toBe(200)
    expect(queue.body.data.items.map((e: { id: string }) => e.id)).toContain(eventId)

    const beforeApprove = await request(app)
      .get(`/api/v1/groups/${groupId}/events`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${faculty.accessToken}`)
    expect(
      beforeApprove.body.data.items.some((e: { id?: string }) => e.id === eventId),
    ).toBe(false)

    const approve = await request(app)
      .patch(`/api/v1/groups/${groupId}/review/events/${eventId}`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${faculty.accessToken}`)
      .send({ action: 'approve' })
    expect(approve.status).toBe(200)

    const afterApprove = await request(app)
      .get(`/api/v1/groups/${groupId}/events`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${faculty.accessToken}`)
    expect(afterApprove.body.data.items.some((e: { id?: string }) => e.id === eventId)).toBe(true)
  })

  it('an explicit draft in an approval-required group is not held for review', async () => {
    const created = await request(app)
      .post('/api/v1/posts')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${student.accessToken}`)
      .send({ type: 'post', content: 'still drafting this one', group_id: groupId, is_published: false })

    expect(created.status).toBe(201)
    expect(created.body.data.groupReviewStatus).toBeNull()
    expect(created.body.data.isPublished).toBe(false)
    const postId = created.body.data.id

    const queue = await request(app)
      .get(`/api/v1/groups/${groupId}/review/posts`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${faculty.accessToken}`)
    expect(queue.body.data.items.some((p: { id: string }) => p.id === postId)).toBe(false)

    const drafts = await request(app)
      .get('/api/v1/me/drafts')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${student.accessToken}`)
    expect(drafts.status).toBe(200)
    expect(drafts.body.data.items.some((d: { id: string }) => d.id === postId)).toBe(true)
  })

  it('non-moderators cannot see or act on the review queue', async () => {
    const res = await request(app)
      .get(`/api/v1/groups/${groupId}/review/posts`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${student.accessToken}`)
    expect(res.status).toBe(403)
  })

  it('review/summary reports pending counts', async () => {
    const created = await request(app)
      .post('/api/v1/posts')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${student.accessToken}`)
      .send({ type: 'post', content: 'another pending one', group_id: groupId })
    expect(created.status).toBe(201)

    const summary = await request(app)
      .get(`/api/v1/groups/${groupId}/review/summary`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${faculty.accessToken}`)
    expect(summary.status).toBe(200)
    expect(summary.body.data.pendingPosts).toBeGreaterThanOrEqual(1)
    expect(summary.body.data).toHaveProperty('pendingEvents')
    expect(summary.body.data).toHaveProperty('pendingJoinRequests')
    expect(summary.body.data).toHaveProperty('reportsOpen')
  })
})
