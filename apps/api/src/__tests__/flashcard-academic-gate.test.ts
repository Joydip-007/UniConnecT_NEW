import { describe, it, expect } from 'vitest'
import supertest from 'supertest'
import { app, DOMAIN, loginAs, CREDENTIALS } from './setup'
import { createGroupFixture } from './factories/groups'

describe('flashcard routes — requireAcademicGroup', () => {
  it('returns 403 with ACADEMIC_GROUP_REQUIRED for a non-academic group', async () => {
    const { accessToken } = await loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password)
    const group = await createGroupFixture({ type: 'club' })

    const res = await supertest(app)
      .get(`/api/v1/groups/${group.id}/flashcard-decks`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${accessToken}`)

    expect(res.status).toBe(403)
    expect(res.body.code).toBe('ACADEMIC_GROUP_REQUIRED')
  })

  it('returns 404 for a nonexistent group', async () => {
    const { accessToken } = await loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password)

    const res = await supertest(app)
      .get('/api/v1/groups/00000000-0000-0000-0000-000000000000/flashcard-decks')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${accessToken}`)

    expect(res.status).toBe(404)
  })

  it('allows access for an academic group', async () => {
    const { accessToken } = await loginAs(CREDENTIALS.faculty.email, CREDENTIALS.faculty.password)
    const group = await createGroupFixture({ type: 'academic' })

    const res = await supertest(app)
      .get(`/api/v1/groups/${group.id}/flashcard-decks`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${accessToken}`)

    expect(res.status).toBe(200)
  })
})
