import { describe, it, expect } from 'vitest'
import supertest from 'supertest'
import { db } from '../config/db'
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

describe('flashcard deck listing — masteredCount', () => {
  it('counts a card as mastered once its review interval reaches the 21-day maturity threshold, and 0 for a member with no reviews', async () => {
    const { accessToken: facultyToken } = await loginAs(CREDENTIALS.faculty.email, CREDENTIALS.faculty.password)
    const group = await createGroupFixture({ type: 'academic' })
    const facultyUser = await db('users').where({ email: CREDENTIALS.faculty.email }).first('id')

    const [deck] = await db('group_flashcard_decks')
      .insert({
        group_id: group.id,
        university_id: group.university_id,
        created_by: facultyUser.id,
        title: 'Mastery test deck',
        card_count: 2,
      })
      .returning('*')

    const [masteredCard] = await db('group_flashcards')
      .insert({ deck_id: deck.id, group_id: group.id, university_id: group.university_id, created_by: facultyUser.id, front: 'Q1', back: 'A1' })
      .returning('*')
    await db('group_flashcards')
      .insert({ deck_id: deck.id, group_id: group.id, university_id: group.university_id, created_by: facultyUser.id, front: 'Q2', back: 'A2' })

    // interval_days >= 21 is the SM-2 "mature card" threshold this deck query counts as mastered.
    await db('group_flashcard_reviews').insert({
      card_id: masteredCard.id,
      user_id: facultyUser.id,
      group_id: group.id,
      university_id: group.university_id,
      interval_days: 30,
      due_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      last_reviewed_at: new Date(),
      last_rating: 'good',
    })

    const facultyRes = await supertest(app)
      .get(`/api/v1/groups/${group.id}/flashcard-decks`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${facultyToken}`)

    expect(facultyRes.status).toBe(200)
    const facultyDeck = facultyRes.body.data.find((d: { id: string }) => d.id === deck.id)
    expect(facultyDeck.masteredCount).toBe(1)
    expect(facultyDeck.cardCount).toBe(2)

    // A different member with no reviews of their own sees masteredCount 0 for the same deck.
    const { accessToken: studentToken } = await loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password)
    const studentUser = await db('users').where({ email: CREDENTIALS.student.email }).first('id')
    await db('group_members').insert({ group_id: group.id, user_id: studentUser.id, role: 'member' })

    const studentRes = await supertest(app)
      .get(`/api/v1/groups/${group.id}/flashcard-decks`)
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${studentToken}`)

    expect(studentRes.status).toBe(200)
    const studentDeck = studentRes.body.data.find((d: { id: string }) => d.id === deck.id)
    expect(studentDeck.masteredCount).toBe(0)
  })
})
