import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { app, loginAs, DOMAIN, TEST_UNIVERSITY_ID, CREDENTIALS } from './setup'
import { db } from '../config/db'

const api = supertest(app)
const UNI = { 'x-university-domain': DOMAIN }
const TITLE_PREFIX = 'ANN Test'

let adminToken: string
let adminUserId: string

beforeAll(async () => {
  const admin = await loginAs(CREDENTIALS.admin.email, CREDENTIALS.admin.password)
  adminToken = admin.accessToken
  const adminRow = await db('users').where({ email: CREDENTIALS.admin.email }).first<{ id: string }>('id')
  adminUserId = adminRow!.id
})

afterAll(async () => {
  await db('news').where({ university_id: TEST_UNIVERSITY_ID }).whereLike('title', `${TITLE_PREFIX}%`).delete()
})

/** Inserts an imported notice draft with a known source article date. */
async function makeNotice(suffix: string, sourceDate: string): Promise<string> {
  const slug = `ann-test-${suffix.toLowerCase()}-${Math.floor(Math.random() * 1e9)}`
  const [row] = await db('news')
    .insert({
      university_id: TEST_UNIVERSITY_ID,
      author_id: adminUserId,
      title: `${TITLE_PREFIX} ${suffix}`,
      slug,
      body: 'body',
      category: 'notice',
      is_published: false,
      is_imported: true,
      source_url: `https://ann-test.example/${slug}`,
      source_published_at: sourceDate,
    })
    .returning<{ id: string }[]>('id')
  return row!.id
}

function publish(id: string) {
  return api.patch(`/api/v1/news/${id}`).set(UNI).set('Authorization', `Bearer ${adminToken}`).send({ is_published: true })
}

describe('notice announcement', () => {
  it('bulk-publishing notices concurrently never 500s and features the latest notice', async () => {
    const ids = await Promise.all([
      makeNotice('Oldest', '2026-01-01T00:00:00Z'),
      makeNotice('Middle', '2026-03-01T00:00:00Z'),
      makeNotice('Newest', '2030-06-01T00:00:00Z'),
    ])

    // Mirror the admin "Publish selected" bulk action: all at once.
    const results = await Promise.all(ids.map(publish))
    for (const res of results) expect(res.status).toBe(200) // no race / 23505 / 500

    const announced = await db('news')
      .where({ university_id: TEST_UNIVERSITY_ID, is_announcement: true })
      .whereLike('title', `${TITLE_PREFIX}%`)
      .select<{ title: string }[]>('title')

    expect(announced).toHaveLength(1)
    expect(announced[0]!.title).toBe(`${TITLE_PREFIX} Newest`) // latest by source date, not publish order
  })
})
