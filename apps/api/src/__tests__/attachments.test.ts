import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { app, loginAs, CREDENTIALS } from './setup'
import { db } from '../config/db'

const api = supertest(app)

let facultyToken: string
let studentToken: string
const createdNewsIds: string[] = []

function auth(token: string) {
  return { Authorization: `Bearer ${token}` }
}

const baseNews = {
  title: 'Notice with attachments',
  body: 'See the attached files for details.',
  category: 'notice',
  is_published: true,
}

const pdf = (n: number) => ({
  fileUrl: `https://files.example.com/notice-${n}.pdf`,
  fileName: `notice-${n}.pdf`,
  mimeType: 'application/pdf',
  sizeBytes: 1024,
})

beforeAll(async () => {
  const [fac, stu] = await Promise.all([
    loginAs(CREDENTIALS.faculty.email, CREDENTIALS.faculty.password),
    loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password),
  ])
  facultyToken = fac.accessToken
  studentToken = stu.accessToken
})

afterAll(async () => {
  if (createdNewsIds.length > 0) {
    await db('content_attachments').whereIn('entity_id', createdNewsIds).delete()
    await db('news').whereIn('id', createdNewsIds).delete()
  }
})

describe('news attachments', () => {
  it('creates news with attachments and returns them on detail', async () => {
    const create = await api
      .post('/api/v1/news')
      .set(auth(facultyToken))
      .send({ ...baseNews, attachments: [pdf(1), pdf(2)] })
    expect(create.status).toBe(201)
    const id = create.body.data.id as string
    createdNewsIds.push(id)

    const detail = await api.get(`/api/v1/news/${id}`).set(auth(facultyToken))
    expect(detail.status).toBe(200)
    const names = (detail.body.data.attachments as Array<{ fileName: string; fileUrl: string }>)
      .map((a) => a.fileName)
      .sort()
    expect(names).toEqual(['notice-1.pdf', 'notice-2.pdf'])
  })

  it('adds and removes attachments on update', async () => {
    const create = await api
      .post('/api/v1/news')
      .set(auth(facultyToken))
      .send({ ...baseNews, attachments: [pdf(1)] })
    const id = create.body.data.id as string
    createdNewsIds.push(id)
    const existingId = create.body.data.attachments[0].id as string

    const update = await api
      .patch(`/api/v1/news/${id}`)
      .set(auth(facultyToken))
      .send({ attachments: [pdf(2)], removedAttachmentIds: [existingId] })
    expect(update.status).toBe(200)

    const names = (update.body.data.attachments as Array<{ fileName: string }>).map((a) => a.fileName)
    expect(names).toEqual(['notice-2.pdf'])
  })

  it('rejects a disallowed file type', async () => {
    const res = await api
      .post('/api/v1/news')
      .set(auth(facultyToken))
      .send({
        ...baseNews,
        attachments: [{ fileUrl: 'https://files.example.com/x.exe', fileName: 'malware.exe' }],
      })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('ATTACHMENT_TYPE_NOT_ALLOWED')
  })

  it('rejects more than the per-entity limit', async () => {
    const res = await api
      .post('/api/v1/news')
      .set(auth(facultyToken))
      .send({ ...baseNews, attachments: Array.from({ length: 11 }, (_, i) => pdf(i)) })
    // Either the Zod array max (.max(10)) or the service cap rejects it.
    expect(res.status).toBe(422)
  })

  it('forbids a student (non-faculty) from creating news with attachments', async () => {
    const res = await api
      .post('/api/v1/news')
      .set(auth(studentToken))
      .send({ ...baseNews, attachments: [pdf(1)] })
    expect(res.status).toBe(403)
  })
})
