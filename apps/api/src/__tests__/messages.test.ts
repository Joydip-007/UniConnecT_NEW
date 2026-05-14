import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { app, loginAs, CREDENTIALS } from './setup'
import { db } from '../config/db'

const api = supertest(app)

let studentToken: string
let alumniToken: string
let studentId: string
let alumniId: string
let convId: string

const createdConvIds: string[] = []

beforeAll(async () => {
  const [st, al] = await Promise.all([
    loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password),
    loginAs(CREDENTIALS.alumni.email, CREDENTIALS.alumni.password),
  ])
  studentToken = st.accessToken
  alumniToken = al.accessToken

  const [stMe, alMe] = await Promise.all([
    api.get('/api/v1/users/me').set('Authorization', `Bearer ${studentToken}`),
    api.get('/api/v1/users/me').set('Authorization', `Bearer ${alumniToken}`),
  ])
  studentId = (stMe.body as { data: { id: string } }).data.id
  alumniId = (alMe.body as { data: { id: string } }).data.id
})

afterAll(async () => {
  if (createdConvIds.length > 0) {
    await db('messages').whereIn('conversation_id', createdConvIds).delete()
    await db('conversation_participants').whereIn('conversation_id', createdConvIds).delete()
    await db('conversations').whereIn('id', createdConvIds).delete()
  }
})

function auth(token: string) {
  return { Authorization: `Bearer ${token}` }
}

describe('POST /api/v1/conversations', () => {
  it('returns 201 when creating a new DM between student and alumni', async () => {
    // Clean up any pre-existing DM between the pair
    const existing = await db('conversations as c')
      .join('conversation_participants as p1', 'p1.conversation_id', 'c.id')
      .join('conversation_participants as p2', 'p2.conversation_id', 'c.id')
      .where({
        'c.is_group': false,
        'p1.user_id': studentId,
        'p2.user_id': alumniId,
      })
      .select<{ id: string }[]>('c.id')

    if (existing.length > 0) {
      const ids = existing.map((r) => r.id)
      await db('messages').whereIn('conversation_id', ids).delete()
      await db('conversation_participants').whereIn('conversation_id', ids).delete()
      await db('conversations').whereIn('id', ids).delete()
    }

    const res = await api
      .post('/api/v1/conversations')
      .set(auth(studentToken))
      .send({ participantId: alumniId, is_group: false })

    expect(res.status).toBe(201)
    expect(res.body.data).toHaveProperty('id')

    convId = res.body.data.id as string
    createdConvIds.push(convId)
  })

  it('returns 200 with existing conversation on second POST with same pair', async () => {
    const res = await api
      .post('/api/v1/conversations')
      .set(auth(studentToken))
      .send({ participantId: alumniId, is_group: false })

    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(convId)
  })
})

describe('POST /api/v1/conversations/:convId/messages', () => {
  it('returns 201 when sending a message', async () => {
    const res = await api
      .post(`/api/v1/conversations/${convId}/messages`)
      .set(auth(studentToken))
      .send({ content: 'Hello alumni!' })

    expect(res.status).toBe(201)
    expect(res.body.data).toHaveProperty('id')
    expect(res.body.data.content).toBe('Hello alumni!')
  })
})

describe('GET /api/v1/conversations/:convId/messages', () => {
  it('returns 200 with paginated message list', async () => {
    const res = await api
      .get(`/api/v1/conversations/${convId}/messages`)
      .set(auth(studentToken))

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveProperty('items')
    expect(Array.isArray(res.body.data.items)).toBe(true)
  })
})

describe('POST /api/v1/conversations/:convId/read', () => {
  it('returns 200 when marking conversation as read', async () => {
    const res = await api
      .post(`/api/v1/conversations/${convId}/read`)
      .set(auth(alumniToken))

    expect(res.status).toBe(200)
  })
})
