import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { app, loginAs, CREDENTIALS, DOMAIN } from './setup'
import { db } from '../config/db'
import { createGroupFixture } from './factories/groups'

const api = supertest(app)

// faculty ↔ alumni, so this file never races messages.test.ts's student ↔ alumni DM.
let facultyToken: string
let alumniToken: string
let studentToken: string
let facultyId: string
let alumniId: string
let convId: string
let groupId: string

function auth(token: string) {
  return { Authorization: `Bearer ${token}`, 'x-university-domain': DOMAIN }
}

async function send(token: string, body: Record<string, unknown>) {
  return api.post(`/api/v1/conversations/${convId}/messages`).set(auth(token)).send(body)
}

async function listAs(token: string) {
  const res = await api.get(`/api/v1/conversations/${convId}/messages`).set(auth(token))
  return res.body.data.items as Array<Record<string, unknown>>
}

async function conversationAs(token: string) {
  const res = await api.get('/api/v1/conversations').set(auth(token))
  return (res.body.data as Array<Record<string, unknown>>).find((c) => c.id === convId)!
}

beforeAll(async () => {
  const [fa, al, st] = await Promise.all([
    loginAs(CREDENTIALS.faculty.email, CREDENTIALS.faculty.password),
    loginAs(CREDENTIALS.alumni.email, CREDENTIALS.alumni.password),
    loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password),
  ])
  facultyToken = fa.accessToken
  alumniToken = al.accessToken
  studentToken = st.accessToken

  facultyId = (await db('users').where({ email: CREDENTIALS.faculty.email }).first('id')).id
  alumniId = (await db('users').where({ email: CREDENTIALS.alumni.email }).first('id')).id

  await db('user_settings').where({ user_id: alumniId }).update({ privacy_preferences: { messages: 'everyone' } })
  await db('profiles').where({ user_id: alumniId }).update({ is_open_to_msg: true })

  // Start from a clean, unconnected pair so the request semantics are deterministic.
  await db('connections')
    .where({ requester_id: facultyId, addressee_id: alumniId })
    .orWhere({ requester_id: alumniId, addressee_id: facultyId })
    .delete()
  const existing = await db('conversations as c')
    .join('conversation_participants as a', 'a.conversation_id', 'c.id')
    .join('conversation_participants as b', 'b.conversation_id', 'c.id')
    .where({ 'c.is_group': false, 'a.user_id': facultyId, 'b.user_id': alumniId })
    .select<{ id: string }[]>('c.id')
  if (existing.length > 0) await db('conversations').whereIn('id', existing.map((r) => r.id)).delete()

  const res = await api
    .post('/api/v1/conversations')
    .set(auth(facultyToken))
    .send({ participantId: alumniId, is_group: false })
  convId = res.body.data.id as string

  const group = await createGroupFixture({ type: 'club', creatorId: facultyId, name: `Common ground ${Date.now()}` })
  groupId = group.id
  await db('group_members').insert({ group_id: groupId, user_id: alumniId, role: 'member' })
})

afterAll(async () => {
  if (convId) await db('conversations').where({ id: convId }).delete()
  if (groupId) await db('groups').where({ id: groupId }).delete()
})

describe('message requests', () => {
  it('flags an unanswered DM from a non-connection as a request for the recipient only', async () => {
    await send(facultyToken, { content: 'Hello from office hours' })

    expect((await conversationAs(alumniToken)).isRequest).toBe(true)
    expect((await conversationAs(facultyToken)).isRequest).toBe(false)
  })

  it('moves the thread out of requests once the recipient replies', async () => {
    await send(alumniToken, { content: 'Thanks, happy to chat' })
    expect((await conversationAs(alumniToken)).isRequest).toBe(false)
  })
})

describe('PATCH /conversations/:convId/preferences', () => {
  it('pins, mutes and themes the thread for the caller only', async () => {
    const res = await api
      .patch(`/api/v1/conversations/${convId}/preferences`)
      .set(auth(alumniToken))
      .send({ isPinned: true, isMuted: true, chatTheme: 'mint', quickEmoji: '🔥' })

    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ isPinned: true, isMuted: true, chatTheme: 'mint', quickEmoji: '🔥' })
    expect(res.body.data.pinnedAt).toBeTruthy()

    const other = await conversationAs(facultyToken)
    expect(other).toMatchObject({ isPinned: false, isMuted: false, chatTheme: 'indigo', quickEmoji: '👍' })
  })

  it('leaves untouched fields alone on a partial write', async () => {
    const res = await api
      .patch(`/api/v1/conversations/${convId}/preferences`)
      .set(auth(alumniToken))
      .send({ isPinned: false })

    expect(res.body.data).toMatchObject({ isPinned: false, isMuted: true, chatTheme: 'mint', quickEmoji: '🔥' })
    expect(res.body.data.pinnedAt).toBeNull()
  })

  it('rejects an empty body and an unknown theme with 422', async () => {
    const empty = await api.patch(`/api/v1/conversations/${convId}/preferences`).set(auth(alumniToken)).send({})
    expect(empty.status).toBe(422)
    const bad = await api
      .patch(`/api/v1/conversations/${convId}/preferences`)
      .set(auth(alumniToken))
      .send({ chatTheme: 'neon' })
    expect(bad.status).toBe(422)
  })

  it('is 404 for a non-participant', async () => {
    const res = await api
      .patch(`/api/v1/conversations/${convId}/preferences`)
      .set(auth(studentToken))
      .send({ isPinned: true })
    expect(res.status).toBe(404)
  })
})

describe('stickers and attachments', () => {
  it('stores a sticker with its URL (the type CHECK predates stickers)', async () => {
    const res = await send(facultyToken, { type: 'sticker', sticker_url: 'https://static.klipy.com/s/party.gif' })
    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({ contentType: 'sticker', stickerUrl: 'https://static.klipy.com/s/party.gif' })
  })

  it('stores file metadata and lists it under shared files', async () => {
    const res = await send(facultyToken, {
      attachments: [
        { url: 'https://cdn.example.com/lab-sheet-week9.pdf', name: 'lab-sheet-week9.pdf', size: 839680, mimeType: 'application/pdf' },
      ],
    })
    expect(res.status).toBe(201)
    expect(res.body.data.contentType).toBe('file')
    expect(res.body.data.attachments[0]).toMatchObject({ name: 'lab-sheet-week9.pdf', size: 839680 })

    const files = await api.get(`/api/v1/conversations/${convId}/files`).set(auth(alumniToken))
    expect(files.status).toBe(200)
    expect(files.body.data[0]).toMatchObject({ name: 'lab-sheet-week9.pdf', mimeType: 'application/pdf' })
  })

  it('rejects a disallowed file type', async () => {
    const res = await send(facultyToken, {
      attachments: [{ url: 'https://cdn.example.com/run.exe', name: 'run.exe', size: 10, mimeType: 'application/x-msdownload' }],
    })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('ATTACHMENT_TYPE_NOT_ALLOWED')
  })
})

describe('view-once photos', () => {
  let onceId: string
  const photo = { url: 'https://cdn.example.com/whiteboard.jpg', name: 'whiteboard.jpg', size: 2048, mimeType: 'image/jpeg' }

  it('only allows view once on a single photo', async () => {
    const res = await send(facultyToken, {
      viewOnce: true,
      attachments: [{ url: 'https://cdn.example.com/a.pdf', name: 'a.pdf', size: 1, mimeType: 'application/pdf' }],
    })
    expect(res.status).toBe(422)
  })

  it('never exposes the URL in list payloads and keeps it out of shared files', async () => {
    const res = await send(facultyToken, { viewOnce: true, attachments: [photo] })
    expect(res.status).toBe(201)
    onceId = res.body.data.id as string

    const item = (await listAs(alumniToken)).find((m) => m.id === onceId)!
    expect(item.viewOnce).toEqual({ opened: false })
    expect(item.mediaUrls).toEqual([])
    expect((item.attachments as Array<{ url: string }>)[0]!.url).toBe('')

    const files = await api.get(`/api/v1/conversations/${convId}/files`).set(auth(alumniToken))
    expect((files.body.data as Array<{ name: string }>).some((f) => f.name === 'whiteboard.jpg')).toBe(false)
  })

  it('refuses the sender, serves the recipient once, then 410s', async () => {
    const sender = await api.post(`/api/v1/conversations/${convId}/messages/${onceId}/open-once`).set(auth(facultyToken))
    expect(sender.status).toBe(403)

    const first = await api.post(`/api/v1/conversations/${convId}/messages/${onceId}/open-once`).set(auth(alumniToken))
    expect(first.status).toBe(200)
    expect(first.body.data.url).toBe(photo.url)

    const second = await api.post(`/api/v1/conversations/${convId}/messages/${onceId}/open-once`).set(auth(alumniToken))
    expect(second.status).toBe(410)
    expect(second.body.code).toBe('VIEW_ONCE_ALREADY_OPENED')
  })

  it('reports opened to both sides afterwards', async () => {
    expect((await listAs(alumniToken)).find((m) => m.id === onceId)!.viewOnce).toEqual({ opened: true })
    expect((await listAs(facultyToken)).find((m) => m.id === onceId)!.viewOnce).toEqual({ opened: true })
  })
})

describe('edit, remove for me, reactions', () => {
  let textId: string

  it('edits a text message and stamps editedAt', async () => {
    textId = (await send(facultyToken, { content: 'Office hours at 2' })).body.data.id as string
    const res = await api
      .patch(`/api/v1/conversations/${convId}/messages/${textId}`)
      .set(auth(facultyToken))
      .send({ content: 'Office hours at 3' })
    expect(res.status).toBe(200)
    expect(res.body.data.content).toBe('Office hours at 3')
    expect(res.body.data.editedAt).toBeTruthy()
  })

  it('refuses to edit a non-text message', async () => {
    const sticker = await send(facultyToken, { type: 'sticker', sticker_url: 'https://static.klipy.com/s/ok.gif' })
    const res = await api
      .patch(`/api/v1/conversations/${convId}/messages/${sticker.body.data.id as string}`)
      .set(auth(facultyToken))
      .send({ content: 'nope' })
    expect(res.status).toBe(400)
  })

  it('returns reactions inline with the message list', async () => {
    await api
      .post(`/api/v1/conversations/${convId}/messages/${textId}/reactions`)
      .set(auth(alumniToken))
      .send({ reaction_type: 'like' })
    const item = (await listAs(facultyToken)).find((m) => m.id === textId)!
    expect(item.reactions).toMatchObject({ like: [{ userId: alumniId }] })
  })

  it('refuses reactions from a non-participant', async () => {
    const res = await api
      .post(`/api/v1/conversations/${convId}/messages/${textId}/reactions`)
      .set(auth(studentToken))
      .send({ reaction_type: 'like' })
    expect(res.status).toBe(404)
  })

  it('hides a message for the caller only', async () => {
    const res = await api.post(`/api/v1/conversations/${convId}/messages/${textId}/hide`).set(auth(alumniToken))
    expect(res.status).toBe(200)
    expect((await listAs(alumniToken)).some((m) => m.id === textId)).toBe(false)
    expect((await listAs(facultyToken)).some((m) => m.id === textId)).toBe(true)
  })

  it('scrubs attachments when a message is deleted', async () => {
    const file = await send(facultyToken, {
      attachments: [{ url: 'https://cdn.example.com/notes.txt', name: 'notes.txt', size: 12, mimeType: 'text/plain' }],
    })
    const res = await api
      .delete(`/api/v1/conversations/${convId}/messages/${file.body.data.id as string}`)
      .set(auth(facultyToken))
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ isDeleted: true, attachments: [], mediaUrls: [] })
  })
})

describe('GET /conversations/:convId/common-groups', () => {
  it('lists groups both people belong to', async () => {
    const res = await api.get(`/api/v1/conversations/${convId}/common-groups`).set(auth(alumniToken))
    expect(res.status).toBe(200)
    expect((res.body.data as Array<{ id: string }>).some((g) => g.id === groupId)).toBe(true)
  })
})
