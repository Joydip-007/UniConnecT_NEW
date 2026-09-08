import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { app, loginAs, DOMAIN, TEST_UNIVERSITY_ID, CREDENTIALS } from './setup'
import { db } from '../config/db'

const api = supertest(app)
const UNI = { 'x-university-domain': DOMAIN }

let adminToken: string
let reporterId: string
let secondReporterId: string
let postId: string
const reportIds: string[] = []

beforeAll(async () => {
  const admin = await loginAs(CREDENTIALS.admin.email, CREDENTIALS.admin.password)
  adminToken = admin.accessToken

  const reporter = await db('users').where({ email: CREDENTIALS.student.email }).first('id')
  reporterId = reporter.id
  const secondReporter = await db('users').where({ email: CREDENTIALS.alumni.email }).first('id')
  secondReporterId = secondReporter.id

  const post = await db('posts')
    .insert({ university_id: TEST_UNIVERSITY_ID, author_id: reporterId, content: 'Grouped report test post', type: 'post' })
    .returning('id')
  postId = post[0].id ?? post[0]

  const inserted = await db('reports')
    .insert([
      { reporter_id: reporterId, target_id: postId, target_type: 'post', reason: 'spam', status: 'pending' },
      { reporter_id: secondReporterId, target_id: postId, target_type: 'post', reason: 'harassment', status: 'pending' },
    ])
    .returning('id')
  reportIds.push(...inserted.map((r: { id: string } | string) => (typeof r === 'string' ? r : r.id)))
})

afterAll(async () => {
  await db('reports').whereIn('id', reportIds).delete()
  await db('posts').where({ id: postId }).delete()
})

describe('GET /api/v1/admin/reports/grouped', () => {
  it('collapses multiple reports on the same target into one row with a count and the highest severity', async () => {
    const res = await api
      .get('/api/v1/admin/reports/grouped')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    const row = res.body.data.items.find((i: { targetId: string }) => i.targetId === postId)
    expect(row).toBeDefined()
    expect(row.reportCount).toBe(2)
    expect(row.severity).toBe('high') // harassment outranks spam
    expect(row.targetType).toBe('post')
    expect(row.removable).toBe(true)
  })
})

describe('PATCH /api/v1/admin/reports/target/:targetType/:targetId', () => {
  it('dismiss resolves every open report for the target without deleting the post', async () => {
    const res = await api
      .patch(`/api/v1/admin/reports/target/post/${postId}`)
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'dismiss' })

    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('dismissed')

    const remainingOpen = await db('reports').whereIn('id', reportIds).where('status', 'dismissed')
    expect(remainingOpen).toHaveLength(2)

    const post = await db('posts').where({ id: postId }).first()
    expect(post).toBeDefined()

    const auditRow = await db('university_audit_logs')
      .where({ university_id: TEST_UNIVERSITY_ID, action: 'report_group.dismiss' })
      .first()
    expect(auditRow).toBeDefined()
  })

  it('returns 404 when the target has no open reports', async () => {
    const res = await api
      .patch(`/api/v1/admin/reports/target/post/${postId}`)
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'dismiss' })

    expect(res.status).toBe(404)
  })
})
