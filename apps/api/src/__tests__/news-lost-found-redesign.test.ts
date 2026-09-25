import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { app, loginAs, DOMAIN, TEST_UNIVERSITY_ID, CREDENTIALS } from './setup'
import { db } from '../config/db'

const api = supertest(app)
const UNI = { 'x-university-domain': DOMAIN }
const PREFIX = 'NLF Redesign'

let tokens: Record<'admin' | 'faculty' | 'student' | 'alumni', string>

beforeAll(async () => {
  const [admin, faculty, student, alumni] = await Promise.all([
    loginAs(CREDENTIALS.admin.email, CREDENTIALS.admin.password),
    loginAs(CREDENTIALS.faculty.email, CREDENTIALS.faculty.password),
    loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password),
    loginAs(CREDENTIALS.alumni.email, CREDENTIALS.alumni.password),
  ])
  tokens = { admin: admin.accessToken, faculty: faculty.accessToken, student: student.accessToken, alumni: alumni.accessToken }
})

afterAll(async () => {
  await db('news').where({ university_id: TEST_UNIVERSITY_ID }).whereLike('title', `${PREFIX}%`).delete()
  await db('lost_and_found').where({ university_id: TEST_UNIVERSITY_ID }).whereLike('item_name', `${PREFIX}%`).delete()
  await db('university_settings').where({ university_id: TEST_UNIVERSITY_ID }).update({ lost_found_desk: null })
})

const as = (role: keyof typeof tokens) => ({ ...UNI, Authorization: `Bearer ${tokens[role]}` })

describe('news: summary, tags, key date and rail', () => {
  it('stores the new fields on a faculty draft and returns them normalised', async () => {
    const res = await api
      .post('/api/v1/news')
      .set(as('faculty'))
      .send({
        title: `${PREFIX} add drop`,
        body: 'Section changes after Thursday need a signature.',
        category: 'academic',
        summary: 'Add and drop closes Thursday.',
        tags: ['Add Drop', '#add drop', 'eLMS'],
        key_date: '2099-09-11',
        is_published: false,
      })

    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({
      summary: 'Add and drop closes Thursday.',
      tags: ['add drop', 'elms'],
      keyDate: '2099-09-11',
      isPublished: false,
    })
    expect(res.body.data.author.role).toBe('faculty')
  })

  it('rejects a malformed key date with 422', async () => {
    const res = await api
      .post('/api/v1/news')
      .set(as('faculty'))
      .send({ title: `${PREFIX} bad date`, body: 'b', category: 'notice', key_date: '11/09/2099' })
    expect(res.status).toBe(422)
  })

  it('keeps students out of writing news', async () => {
    const res = await api.post('/api/v1/news').set(as('student')).send({ title: `${PREFIX} nope`, body: 'b', category: 'notice' })
    expect(res.status).toBe(403)
  })

  it('surfaces a published article in the rail and filters the list by tag', async () => {
    const created = await api
      .post('/api/v1/news')
      .set(as('admin'))
      .send({
        title: `${PREFIX} job fair`,
        body: 'Twenty two employers confirmed.',
        category: 'events',
        tags: ['nlf-job-fair'],
        key_date: '2099-09-18',
        is_published: true,
      })
    expect(created.status).toBe(201)
    const newsId = created.body.data.id as string

    const rail = await api.get('/api/v1/news/rail').set(as('student'))
    expect(rail.status).toBe(200)
    expect(rail.body.data.trendingTags).toContain('nlf-job-fair')
    expect(rail.body.data.keyDates).toEqual(
      expect.arrayContaining([expect.objectContaining({ newsId, date: '2099-09-18' })]),
    )
    expect(rail.body.data.sources).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'University administration', kind: 'admin' })]),
    )

    const byTag = await api.get('/api/v1/news').query({ tag: 'NLF-Job-Fair' }).set(as('alumni'))
    expect(byTag.status).toBe(200)
    expect(byTag.body.data.items.map((item: { id: string }) => item.id)).toEqual([newsId])
    expect(byTag.body.data.total).toBe(1)
  })

  it('does not show drafts in the rail', async () => {
    const rail = await api.get('/api/v1/news/rail').set(as('student'))
    expect(rail.body.data.keyDates.map((d: { date: string }) => d.date)).not.toContain('2099-09-11')
  })
})

async function postItem(role: keyof typeof tokens, overrides: Record<string, unknown> = {}) {
  const res = await api
    .post('/api/v1/lost-found')
    .set(as(role))
    .send({
      type: 'lost',
      itemName: `${PREFIX} calculator`,
      description: 'Black Casio',
      locationDetail: 'Room 512',
      contactInfo: '01712 000 000',
      ...overrides,
    })
  expect(res.status).toBe(201)
  return res.body.data as { id: string; isResolved: boolean; isPinned: boolean; isSaved: boolean }
}

describe('lost & found: tabs, resolve, pin, save, remove, stats', () => {
  it('lists only open items when isResolved=false (the query string is not coerced to true)', async () => {
    const open = await postItem('student')
    const done = await postItem('student', { itemName: `${PREFIX} umbrella` })
    await api.patch(`/api/v1/lost-found/${done.id}/resolve`).set(as('student')).send({})

    const openList = await api.get('/api/v1/lost-found').query({ isResolved: 'false' }).set(as('alumni'))
    const openIds = openList.body.data.items.map((item: { id: string }) => item.id)
    expect(openIds).toContain(open.id)
    expect(openIds).not.toContain(done.id)

    const resolvedList = await api.get('/api/v1/lost-found').query({ isResolved: 'true' }).set(as('alumni'))
    expect(resolvedList.body.data.items.map((item: { id: string }) => item.id)).toContain(done.id)
  })

  it('stamps resolved_at on resolve and clears it on an admin reopen', async () => {
    const item = await postItem('student')
    await api.patch(`/api/v1/lost-found/${item.id}/resolve`).set(as('student')).send({})
    expect((await db('lost_and_found').where({ id: item.id }).first())!.resolved_at).not.toBeNull()

    const reopened = await api.patch(`/api/v1/lost-found/${item.id}/resolve`).set(as('admin')).send({ is_resolved: false })
    expect(reopened.status).toBe(200)
    expect(reopened.body.data.isResolved).toBe(false)
    expect((await db('lost_and_found').where({ id: item.id }).first())!.resolved_at).toBeNull()
  })

  it('does not let another member resolve an item they did not post', async () => {
    const item = await postItem('student')
    const res = await api.patch(`/api/v1/lost-found/${item.id}/resolve`).set(as('alumni')).send({})
    expect(res.status).toBe(403)
  })

  it('lets only an admin pin, and a pinned item leads the board', async () => {
    const item = await postItem('student', { itemName: `${PREFIX} keys` })
    await postItem('alumni', { itemName: `${PREFIX} newer`, type: 'found' })

    expect((await api.patch(`/api/v1/lost-found/${item.id}/pin`).set(as('faculty')).send({ is_pinned: true })).status).toBe(403)

    const pinned = await api.patch(`/api/v1/lost-found/${item.id}/pin`).set(as('admin')).send({ is_pinned: true })
    expect(pinned.status).toBe(200)
    expect(pinned.body.data.isPinned).toBe(true)

    const list = await api.get('/api/v1/lost-found').query({ isResolved: 'false' }).set(as('student'))
    expect(list.body.data.items[0].id).toBe(item.id)

    await api.patch(`/api/v1/lost-found/${item.id}/pin`).set(as('admin')).send({ is_pinned: false })
  })

  it('saves per user and lists the caller’s saved items', async () => {
    const item = await postItem('alumni', { itemName: `${PREFIX} ID card` })

    expect((await api.post(`/api/v1/lost-found/${item.id}/save`).set(as('student'))).status).toBe(200)
    // Idempotent: saving twice is not an error.
    expect((await api.post(`/api/v1/lost-found/${item.id}/save`).set(as('student'))).status).toBe(200)

    const mine = await api.get('/api/v1/lost-found/saved').set(as('student'))
    expect(mine.status).toBe(200)
    expect(mine.body.data.items.map((i: { id: string }) => i.id)).toContain(item.id)
    expect(mine.body.data.items.find((i: { id: string }) => i.id === item.id).isSaved).toBe(true)

    const theirs = await api.get(`/api/v1/lost-found/${item.id}`).set(as('faculty'))
    expect(theirs.body.data.isSaved).toBe(false)

    await api.delete(`/api/v1/lost-found/${item.id}/save`).set(as('student'))
    const after = await api.get('/api/v1/lost-found/saved').set(as('student'))
    expect(after.body.data.items.map((i: { id: string }) => i.id)).not.toContain(item.id)
  })

  it('lets the poster or an admin remove an item, nobody else', async () => {
    const item = await postItem('student', { itemName: `${PREFIX} bottle` })
    expect((await api.delete(`/api/v1/lost-found/${item.id}`).set(as('alumni'))).status).toBe(403)
    expect((await api.delete(`/api/v1/lost-found/${item.id}`).set(as('admin'))).status).toBe(200)
    expect(await db('lost_and_found').where({ id: item.id }).first()).toBeUndefined()
  })

  it('reports rail stats: reunited this month, resolve rate and hotspots', async () => {
    const place = `${PREFIX} Library hotspot`
    const a = await postItem('student', { locationDetail: place })
    await postItem('alumni', { locationDetail: place.toUpperCase() })
    await api.patch(`/api/v1/lost-found/${a.id}/resolve`).set(as('student')).send({})

    const res = await api.get('/api/v1/lost-found/stats').set(as('faculty'))
    expect(res.status).toBe(200)
    expect(res.body.data.reunitedThisMonth).toBeGreaterThanOrEqual(1)
    expect(res.body.data.resolvedPct).toEqual(expect.any(Number))
    expect(res.body.data.avgResolveDays).toEqual(expect.any(Number))
    // Case-insensitive grouping: both spellings count toward one place.
    const spot = res.body.data.hotspots.find((h: { place: string }) => h.place.toLowerCase() === place.toLowerCase())
    if (spot) expect(spot.count).toBeGreaterThanOrEqual(2)
  })

  it('lets only an admin set the desk, and clears it with null', async () => {
    const desk = { location: 'Gate 2 security office', hours: '8 am to 8 pm, Sun to Thu', holdPolicy: 'Held 30 days' }
    expect((await api.put('/api/v1/lost-found/desk').set(as('faculty')).send({ desk })).status).toBe(403)

    expect((await api.put('/api/v1/lost-found/desk').set(as('admin')).send({ desk })).status).toBe(200)
    expect((await api.get('/api/v1/lost-found/stats').set(as('student'))).body.data.desk).toEqual(desk)

    expect((await api.put('/api/v1/lost-found/desk').set(as('admin')).send({ desk: null })).status).toBe(200)
    expect((await api.get('/api/v1/lost-found/stats').set(as('student'))).body.data.desk).toBeNull()
  })

  it('accepts a lost & found report and resolves its admin-queue location', async () => {
    const item = await postItem('alumni', { itemName: `${PREFIX} reported` })
    const report = await api
      .post('/api/v1/moderation/report')
      .set(as('student'))
      .send({ targetType: 'lost_found', targetId: item.id, reason: 'spam' })
    expect(report.status).toBe(201)

    const grouped = await api.get('/api/v1/admin/reports/grouped').set(as('admin'))
    const row = (grouped.body.data.items as { targetId: string; location: { path: string } }[]).find((r) => r.targetId === item.id)
    expect(row?.location.path).toBe('/lost-found?type=lost')

    await db('reports').where({ target_id: item.id }).delete()
  })
})
