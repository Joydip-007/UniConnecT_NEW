import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { app, loginAs, DOMAIN, TEST_UNIVERSITY_ID, CREDENTIALS } from './setup'
import { db } from '../config/db'

const api = supertest(app)
const UNI = { 'x-university-domain': DOMAIN }

let adminToken: string
let reporterId: string
let targetPostId: string
const seededReportIds: string[] = []

beforeAll(async () => {
  const admin = await loginAs(CREDENTIALS.admin.email, CREDENTIALS.admin.password)
  adminToken = admin.accessToken

  const reporter = await db('users').where({ email: CREDENTIALS.student.email }).first('id')
  reporterId = reporter.id

  const post = await db('posts')
    .insert({
      university_id: TEST_UNIVERSITY_ID,
      author_id: reporterId,
      content: 'Stats test post',
      type: 'post',
    })
    .returning('id')
  targetPostId = post[0].id ?? post[0]

  const [highReport, mediumReport] = await db('reports')
    .insert([
      { reporter_id: reporterId, target_id: targetPostId, target_type: 'post', reason: 'harassment', status: 'pending' },
      { reporter_id: reporterId, target_id: targetPostId, target_type: 'post', reason: 'misinformation', status: 'resolved', resolved_at: db.fn.now() },
    ])
    .returning('id')
  seededReportIds.push(highReport.id ?? highReport, mediumReport.id ?? mediumReport)
})

afterAll(async () => {
  await db('reports').whereIn('id', seededReportIds).delete()
  await db('posts').where({ id: targetPostId }).delete()
})

describe('GET /api/v1/admin/stats — extended moderation/insights fields', () => {
  it('returns escalatedReports, resolvedPct7d and moderationHealth', async () => {
    const res = await api
      .get('/api/v1/admin/stats')
      .set(UNI)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveProperty('escalatedReports')
    expect(res.body.data).toHaveProperty('resolvedPct7d')
    expect(res.body.data).toHaveProperty('pendingInviteBatches')
    expect(res.body.data.moderationHealth).toMatchObject({
      reportsOpen: expect.any(Number),
      resolvedPct7d: expect.any(Number),
      medianResponseHours: expect.any(Number),
      repeatOffenders: expect.any(Number),
    })
    // The seeded pending 'harassment' report is high-severity and open, so it counts as escalated.
    expect(res.body.data.escalatedReports).toBeGreaterThanOrEqual(1)
  })
})
