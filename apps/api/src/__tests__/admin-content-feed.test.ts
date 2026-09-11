import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import supertest from 'supertest'
import { app, loginAs, DOMAIN, CREDENTIALS, TEST_UNIVERSITY_ID } from './setup'
import { db } from '../config/db'

const api = supertest(app)
const UNI = { 'x-university-domain': DOMAIN }
const PREFIX = 'ADMIN-CONTENT-FEED-TEST'

type Session = { accessToken: string }

async function createPost(session: Session, body: Record<string, unknown>) {
  const res = await api.post('/api/v1/posts').set(UNI).set('Authorization', `Bearer ${session.accessToken}`).send(body)
  expect(res.status).toBe(201)
  return res.body.data as { id: string }
}

describe('admin content moderation (feed posts)', () => {
  let admin: Session
  let student: Session
  let postId: string
  let jobPromoId: string

  beforeAll(async () => {
    admin = await loginAs(CREDENTIALS.admin.email, CREDENTIALS.admin.password)
    student = await loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password)
    postId = (await createPost(student, { type: 'post', content: `${PREFIX} plain` })).id
    jobPromoId = (await createPost(admin, { type: 'job_promo', content: `${PREFIX} job` })).id
  })

  afterAll(async () => {
    const ids = db('posts').where({ university_id: TEST_UNIVERSITY_ID }).whereLike('content', `${PREFIX}%`).select('id')
    await db('content_attachments').where({ entity_type: 'post' }).whereIn('entity_id', ids).delete()
    await db('posts').where({ university_id: TEST_UNIVERSITY_ID }).whereLike('content', `${PREFIX}%`).delete()
  })

  it('GET /admin/content/feed lists posts by type in the FeedPost shape', async () => {
    const res = await api
      .get('/api/v1/admin/content/feed')
      .set(UNI)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .query({ type: 'job_promo', limit: 50 })
    expect(res.status).toBe(200)
    const items = res.body.data.items as { id: string; type: string; author: { role: string }; reactionCounts: unknown }[]
    expect(items.some((i) => i.id === jobPromoId)).toBe(true)
    expect(items.every((i) => i.type === 'job_promo')).toBe(true)
    expect(items.some((i) => i.id === postId)).toBe(false)
    const item = items.find((i) => i.id === jobPromoId)!
    expect(item.author.role).toBe('admin')
    expect(item.reactionCounts).toBeDefined()
  })

  it('GET /admin/content/feed hydrates media and attachments like the member feed', async () => {
    const withMedia = await createPost(student, {
      type: 'post',
      content: `${PREFIX} media`,
      media_urls: ['https://cdn.example.com/photo.jpg'],
      attachments: [
        { fileUrl: 'https://cdn.example.com/notes.pdf', fileName: 'notes.pdf', mimeType: 'application/pdf', sizeBytes: 1024 },
      ],
    })
    const res = await api
      .get('/api/v1/admin/content/feed')
      .set(UNI)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .query({ type: 'post', limit: 50 })
    expect(res.status).toBe(200)
    const items = res.body.data.items as { id: string; mediaUrls: string[]; attachments: { fileName: string }[] }[]
    const item = items.find((i) => i.id === withMedia.id)!
    expect(item).toBeDefined()
    expect(item.mediaUrls).toEqual(['https://cdn.example.com/photo.jpg'])
    expect(item.attachments).toHaveLength(1)
    expect(item.attachments[0].fileName).toBe('notes.pdf')
  })

  it('rejects an unknown type with 422', async () => {
    const res = await api
      .get('/api/v1/admin/content/feed')
      .set(UNI)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .query({ type: 'events' })
    expect(res.status).toBe(422)
  })

  it('PATCH /publish on a post toggles is_published', async () => {
    const off = await api
      .patch(`/api/v1/admin/content/posts/${postId}/publish`)
      .set(UNI)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ is_published: false })
    expect(off.status).toBe(200)
    expect(off.body.data.isPublished).toBe(false)

    const row = await db('posts').where({ id: postId }).first()
    expect(row.is_published).toBe(false)

    const on = await api
      .patch(`/api/v1/admin/content/posts/${postId}/publish`)
      .set(UNI)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ is_published: true })
    expect(on.status).toBe(200)
    expect((await db('posts').where({ id: postId }).first()).is_published).toBe(true)
  })

  it('PATCH /comments closes and reopens replies', async () => {
    const res = await api
      .patch(`/api/v1/admin/content/posts/${postId}/comments`)
      .set(UNI)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ comments_disabled: true })
    expect(res.status).toBe(200)
    expect(res.body.data.commentsDisabled).toBe(true)

    const listed = await api
      .get('/api/v1/admin/content/feed')
      .set(UNI)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .query({ type: 'post', limit: 50 })
    const item = (listed.body.data.items as { id: string; commentsDisabled: boolean }[]).find((i) => i.id === postId)
    expect(item?.commentsDisabled).toBe(true)

    await api
      .patch(`/api/v1/admin/content/posts/${postId}/comments`)
      .set(UNI)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ comments_disabled: false })
  })

  it('remove hides the post from the list and the public feed, lists it under removed=true, and restore brings it back', async () => {
    const before = await api
      .get('/api/v1/admin/content/summary')
      .set(UNI)
      .set('Authorization', `Bearer ${admin.accessToken}`)
    expect(before.status).toBe(200)
    const removedBefore = before.body.data.removed as number
    const postBefore = before.body.data.byType.post as number
    expect(before.body.data.byType.job_promo).toBeGreaterThanOrEqual(1)

    const remove = await api
      .patch(`/api/v1/admin/content/posts/${postId}/removed`)
      .set(UNI)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ is_removed: true })
    expect(remove.status).toBe(200)

    const row = await db('posts').where({ id: postId }).first()
    expect(row.removed_at).not.toBeNull()
    expect(row.archived_at).not.toBeNull()

    const active = await api
      .get('/api/v1/admin/content/feed')
      .set(UNI)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .query({ type: 'post', limit: 50 })
    expect((active.body.data.items as { id: string }[]).some((i) => i.id === postId)).toBe(false)

    const tray = await api
      .get('/api/v1/admin/content/feed')
      .set(UNI)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .query({ removed: 'true', limit: 50 })
    expect((tray.body.data.items as { id: string }[]).some((i) => i.id === postId)).toBe(true)

    const feed = await api
      .get('/api/v1/posts')
      .set(UNI)
      .set('Authorization', `Bearer ${student.accessToken}`)
      .query({ limit: 50 })
    expect((feed.body.data.items as { id: string }[]).some((i) => i.id === postId)).toBe(false)

    const summary = await api
      .get('/api/v1/admin/content/summary')
      .set(UNI)
      .set('Authorization', `Bearer ${admin.accessToken}`)
    expect(summary.body.data.removed).toBe(removedBefore + 1)
    // The per-type count follows the same removed_at filter as the queue tabs.
    expect(summary.body.data.byType.post).toBe(postBefore - 1)

    // The author cannot unarchive an admin-removed post.
    const unarchive = await api
      .post(`/api/v1/posts/${postId}/unarchive`)
      .set(UNI)
      .set('Authorization', `Bearer ${student.accessToken}`)
    expect(unarchive.status).toBe(403)

    const restore = await api
      .patch(`/api/v1/admin/content/posts/${postId}/removed`)
      .set(UNI)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ is_removed: false })
    expect(restore.status).toBe(200)

    const restored = await db('posts').where({ id: postId }).first()
    expect(restored.removed_at).toBeNull()
    expect(restored.archived_at).toBeNull()

    const again = await api
      .get('/api/v1/admin/content/feed')
      .set(UNI)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .query({ type: 'post', limit: 50 })
    expect((again.body.data.items as { id: string }[]).some((i) => i.id === postId)).toBe(true)
  })

  it('students cannot reach the admin content endpoints', async () => {
    const res = await api
      .get('/api/v1/admin/content/feed')
      .set(UNI)
      .set('Authorization', `Bearer ${student.accessToken}`)
    expect(res.status).toBe(403)
  })
})
