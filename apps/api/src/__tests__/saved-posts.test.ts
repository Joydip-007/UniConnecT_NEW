import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { randomUUID } from 'node:crypto'
import { app, loginAs, CREDENTIALS, DOMAIN, TEST_UNIVERSITY_ID } from './setup'
import { db } from '../config/db'

const api = supertest(app)

let studentToken: string
let alumniToken: string
let studentId: string
let alumniId: string

const createdPostIds: string[] = []

function auth(token: string) {
  return { Authorization: `Bearer ${token}` }
}

async function makePost(authorId: string, content: string, extra: Record<string, unknown> = {}) {
  const [row] = await db('posts')
    .insert({
      id: randomUUID(),
      university_id: TEST_UNIVERSITY_ID,
      author_id: authorId,
      type: 'post',
      content,
      is_published: true,
      ...extra,
    })
    .returning('id')
  const id = typeof row === 'string' ? row : row.id
  createdPostIds.push(id)
  return id
}

function get(token: string) {
  return api.get('/api/v1/posts/saved?limit=100').set('x-university-domain', DOMAIN).set(auth(token))
}

/** Ids in the order the endpoint returned them. */
async function savedContents(token: string): Promise<string[]> {
  const res = await get(token)
  expect(res.status).toBe(200)
  return res.body.data.items.map((p: { content: string }) => p.content)
}

let savedId: string
let unsavedId: string
let archivedId: string
let draftId: string

beforeAll(async () => {
  const [st, al] = await Promise.all([
    loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password),
    loginAs(CREDENTIALS.alumni.email, CREDENTIALS.alumni.password),
  ])
  studentToken = st.accessToken
  alumniToken = al.accessToken

  const [student, alumni] = await Promise.all([
    db('users').where({ email: CREDENTIALS.student.email }).first(),
    db('users').where({ email: CREDENTIALS.alumni.email }).first(),
  ])
  studentId = student.id
  alumniId = alumni.id

  savedId = await makePost(alumniId, 'a post the student bookmarked')
  unsavedId = await makePost(alumniId, 'a post the student never bookmarked')
  archivedId = await makePost(alumniId, 'a bookmarked post the author later archived', {
    archived_at: db.fn.now(),
  })
  draftId = await makePost(alumniId, 'a bookmarked post the author later unpublished', {
    is_published: false,
  })

  await db('saved_posts').insert([
    { user_id: studentId, post_id: savedId },
    { user_id: studentId, post_id: archivedId },
    { user_id: studentId, post_id: draftId },
  ])
})

afterAll(async () => {
  if (createdPostIds.length) {
    await db('saved_posts').whereIn('post_id', createdPostIds).delete()
    await db('posts').whereIn('id', createdPostIds).delete()
  }
})

describe('GET /api/v1/posts/saved', () => {
  it("returns the caller's bookmarks and nothing else", async () => {
    const contents = await savedContents(studentToken)
    expect(contents).toContain('a post the student bookmarked')
    expect(contents).not.toContain('a post the student never bookmarked')
  })

  it('marks every returned post as saved', async () => {
    const res = await get(studentToken)
    expect(res.body.data.items.length).toBeGreaterThan(0)
    res.body.data.items.forEach((p: { isSaved: boolean }) => expect(p.isSaved).toBe(true))
  })

  it('is empty for a user who has saved nothing, rather than falling back to the feed', async () => {
    const res = await get(alumniToken)
    expect(res.status).toBe(200)
    expect(res.body.data.items).toEqual([])
    expect(res.body.data.total).toBe(0)
  })

  it('drops a bookmark whose post the author has since archived', async () => {
    const contents = await savedContents(studentToken)
    expect(contents).not.toContain('a bookmarked post the author later archived')
  })

  it('drops a bookmark whose post the author has since unpublished', async () => {
    const contents = await savedContents(studentToken)
    expect(contents).not.toContain('a bookmarked post the author later unpublished')
  })

  it('reports a total that matches the rows it actually returns', async () => {
    const res = await get(studentToken)
    expect(res.body.data.total).toBe(res.body.data.items.length)
  })

  it('stops returning a post once it is unsaved', async () => {
    await api
      .delete(`/api/v1/posts/${savedId}/save`)
      .set('x-university-domain', DOMAIN)
      .set(auth(studentToken))
      .expect(200)

    expect(await savedContents(studentToken)).not.toContain('a post the student bookmarked')

    // Restore, so this suite stays order-independent for anything added after it.
    await api
      .post(`/api/v1/posts/${savedId}/save`)
      .set('x-university-domain', DOMAIN)
      .set(auth(studentToken))
      .expect(201)
    expect(await savedContents(studentToken)).toContain('a post the student bookmarked')
  })

  it('rejects an unauthenticated caller', async () => {
    await api.get('/api/v1/posts/saved').set('x-university-domain', DOMAIN).expect(401)
  })

  it('is not swallowed by the /:postId route', async () => {
    // '/saved' must be declared before '/:postId', or this 404s as a missing post.
    const res = await get(studentToken)
    expect(res.body.data).toHaveProperty('items')
  })

  it('validates pagination like every other list', async () => {
    await api
      .get('/api/v1/posts/saved?limit=notanumber')
      .set('x-university-domain', DOMAIN)
      .set(auth(studentToken))
      .expect(422)
  })

  it('never leaks a post from another university', async () => {
    const res = await get(studentToken)
    const ids = res.body.data.items.map((p: { id: string }) => p.id)
    if (ids.length) {
      const rows = await db('posts').whereIn('id', ids).select('university_id')
      rows.forEach((r) => expect(r.university_id).toBe(TEST_UNIVERSITY_ID))
    }
  })

  it('leaves the unsaved post out for a different user entirely', async () => {
    expect(unsavedId).toBeTruthy()
    expect(await savedContents(alumniToken)).toEqual([])
  })
})
