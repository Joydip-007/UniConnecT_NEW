import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { app, loginAs, CREDENTIALS } from './setup'
import { db } from '../config/db'

const api = supertest(app)

let studentToken: string
let facultyToken: string
let createdPostId: string

const createdPostIds: string[] = []

beforeAll(async () => {
  const [st, sf] = await Promise.all([
    loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password),
    loginAs(CREDENTIALS.faculty.email, CREDENTIALS.faculty.password),
  ])
  studentToken = st.accessToken
  facultyToken = sf.accessToken
})

afterAll(async () => {
  if (createdPostIds.length > 0) {
    await db('posts').whereIn('id', createdPostIds).delete()
  }
})

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` }
}

describe('POST /api/v1/posts', () => {
  it('returns 201 when student creates a regular post', async () => {
    const res = await api
      .post('/api/v1/posts')
      .set(authHeader(studentToken))
      .send({ content: 'Hello from test student!', type: 'post' })

    expect(res.status).toBe(201)
    expect(res.body.data).toHaveProperty('id')
    expect(res.body.data.content).toBe('Hello from test student!')

    createdPostId = res.body.data.id as string
    createdPostIds.push(createdPostId)
  })

  it('returns 403 when student tries to create an announcement', async () => {
    const res = await api
      .post('/api/v1/posts')
      .set(authHeader(studentToken))
      .send({ content: 'Announcement!', type: 'announcement' })

    expect(res.status).toBe(403)
    expect(res.body.code).toBe('ANNOUNCEMENT_FORBIDDEN')
  })

  it('returns 201 when faculty creates an announcement', async () => {
    const res = await api
      .post('/api/v1/posts')
      .set(authHeader(facultyToken))
      .send({ content: 'Official announcement!', type: 'announcement' })

    expect(res.status).toBe(201)
    expect(res.body.data.type).toBe('announcement')
    createdPostIds.push(res.body.data.id as string)
  })
})

describe('GET /api/v1/posts', () => {
  it('returns 200 with paginated items array', async () => {
    const res = await api
      .get('/api/v1/posts')
      .set(authHeader(studentToken))

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveProperty('items')
    expect(Array.isArray(res.body.data.items)).toBe(true)
    expect(res.body.data).toHaveProperty('total')
  })
})

describe('GET /api/v1/posts/:postId', () => {
  it('returns 200 with a single post', async () => {
    const res = await api
      .get(`/api/v1/posts/${createdPostId}`)
      .set(authHeader(studentToken))

    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(createdPostId)
  })
})

describe('POST /api/v1/posts/:postId/reactions', () => {
  it('returns 200 on first reaction', async () => {
    const res = await api
      .post(`/api/v1/posts/${createdPostId}/reactions`)
      .set(authHeader(studentToken))
      .send({ reaction_type: 'like' })

    expect(res.status).toBe(200)
  })

  it('returns 200 on duplicate reaction (upsert, not 409)', async () => {
    const res = await api
      .post(`/api/v1/posts/${createdPostId}/reactions`)
      .set(authHeader(studentToken))
      .send({ reaction_type: 'like' })

    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/v1/posts/:postId', () => {
  it('returns 403 when a different user tries to delete', async () => {
    // facultyToken is not the author of createdPostId
    const res = await api
      .delete(`/api/v1/posts/${createdPostId}`)
      .set(authHeader(facultyToken))

    expect(res.status).toBe(403)
  })

  it('returns 200 when author deletes their own post', async () => {
    // Create a dedicated post to delete
    const create = await api
      .post('/api/v1/posts')
      .set(authHeader(studentToken))
      .send({ content: 'Post to be deleted', type: 'post' })

    expect(create.status).toBe(201)
    const postId = create.body.data.id as string

    const res = await api
      .delete(`/api/v1/posts/${postId}`)
      .set(authHeader(studentToken))

    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/v1/posts/:postId/comments/:commentId', () => {
  let postId: string
  let commentId: string

  beforeAll(async () => {
    const postRes = await api
      .post('/api/v1/posts')
      .set(authHeader(studentToken))
      .send({ content: 'Post for comment delete test', type: 'post' })
    postId = postRes.body.data.id as string
    createdPostIds.push(postId)

    const commentRes = await api
      .post(`/api/v1/posts/${postId}/comments`)
      .set(authHeader(studentToken))
      .send({ content: 'Comment to delete' })
    commentId = commentRes.body.data.id as string
  })

  it('returns 200 when the author deletes their comment', async () => {
    const res = await api
      .delete(`/api/v1/posts/${postId}/comments/${commentId}`)
      .set(authHeader(studentToken))
    expect(res.status).toBe(200)
    expect(res.body.data.deleted).toBe(true)
  })

  it('returns 404 for an already-deleted comment', async () => {
    const res = await api
      .delete(`/api/v1/posts/${postId}/comments/${commentId}`)
      .set(authHeader(studentToken))
    expect(res.status).toBe(404)
  })
})

describe('POST /api/v1/posts/:postId/comments/:commentId/reactions', () => {
  let postId: string
  let commentId: string

  beforeAll(async () => {
    const postRes = await api
      .post('/api/v1/posts')
      .set(authHeader(studentToken))
      .send({ content: 'Post for comment reaction test', type: 'post' })
    postId = postRes.body.data.id as string
    createdPostIds.push(postId)

    const commentRes = await api
      .post(`/api/v1/posts/${postId}/comments`)
      .set(authHeader(studentToken))
      .send({ content: 'Comment to react to' })
    commentId = commentRes.body.data.id as string
  })

  it('returns 200 when adding a reaction', async () => {
    const res = await api
      .post(`/api/v1/posts/${postId}/comments/${commentId}/reactions`)
      .set(authHeader(studentToken))
      .send({ reaction_type: 'like' })
    expect(res.status).toBe(200)
  })

  it('returns 200 when removing a reaction', async () => {
    const res = await api
      .delete(`/api/v1/posts/${postId}/comments/${commentId}/reactions`)
      .set(authHeader(studentToken))
    expect(res.status).toBe(200)
  })
})

describe('POST /api/v1/posts — hashtag extraction', () => {
  let hashtagPostId: string

  afterAll(async () => {
    if (hashtagPostId) await db('posts').where('id', hashtagPostId).delete()
  })

  it('extracts hashtags from post content and creates tags + post_tags', async () => {
    const res = await api
      .post('/api/v1/posts')
      .set(authHeader(studentToken))
      .send({ content: 'Super excited for #csefest and #uiu2025!', type: 'post' })

    expect(res.status).toBe(201)
    hashtagPostId = (res.body.data as { id: string }).id

    const tags = await db('post_tags as pt')
      .join('tags as t', 't.id', 'pt.tag_id')
      .where('pt.post_id', hashtagPostId)
      .select<{ name: string }[]>('t.name')

    const names = tags.map((t) => t.name).sort()
    expect(names).toEqual(['csefest', 'uiu2025'])
  })

  it('normalises hashtags to lowercase', async () => {
    const res = await api
      .post('/api/v1/posts')
      .set(authHeader(studentToken))
      .send({ content: '#UPPERCASE and #MixedCase', type: 'post' })

    expect(res.status).toBe(201)
    const id = (res.body.data as { id: string }).id
    createdPostIds.push(id)

    const tags = await db('post_tags as pt')
      .join('tags as t', 't.id', 'pt.tag_id')
      .where('pt.post_id', id)
      .select<{ name: string }[]>('t.name')

    const names = tags.map((t) => t.name).sort()
    expect(names).toEqual(['mixedcase', 'uppercase'])
  })

  it('caps extraction at 10 tags per post', async () => {
    const manyTags = Array.from({ length: 15 }, (_, i) => `#tag${i}`).join(' ')
    const res = await api
      .post('/api/v1/posts')
      .set(authHeader(studentToken))
      .send({ content: manyTags, type: 'post' })

    expect(res.status).toBe(201)
    const id = (res.body.data as { id: string }).id
    createdPostIds.push(id)

    const tags = await db('post_tags').where('post_id', id).select('tag_id')
    expect(tags.length).toBe(10)
  })
})
