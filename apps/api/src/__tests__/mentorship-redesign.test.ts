import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import supertest from 'supertest'
import { app, loginAs, CREDENTIALS, DOMAIN } from './setup'
import { db } from '../config/db'

// Mentorship redesign (Mentorship Page.dc.html): mentor settings, directory stats,
// per-session points, session requests, ending / reopening, undo and the waitlist.

const api = supertest(app)

let alumniToken: string
let studentToken: string
let alumniId: string
let studentId: string
let savedAlumni: Record<string, unknown>

function auth(token: string) {
  return { Authorization: `Bearer ${token}`, 'x-university-domain': DOMAIN }
}

async function cleanup() {
  // The seeded alumnus exists only for tests, so every request on it is test data.
  const rows = await db('mentorship_requests')
    .where({ alumni_id: alumniId })
    .select<{ conversation_id: string | null }[]>('conversation_id')
  await db('mentorship_requests').where({ alumni_id: alumniId }).delete()
  const convs = rows.map((r) => r.conversation_id).filter((id): id is string => !!id)
  if (convs.length > 0) await db('conversations').whereIn('id', convs).delete()
  await db('mentorship_waitlist').where({ student_id: studentId, alumni_id: alumniId }).delete()
  await db('profiles')
    .where({ user_id: alumniId })
    .update({ is_open_to_mentorship: true, max_mentees: 3, mentorship_points: 0, mentorship_topics: [], mentorship_availability: [] })
}

/** Fills one of the alumnus's places with an accepted request from another user. */
async function fillPlace() {
  const other = await db('users').where({ email: CREDENTIALS.faculty.email }).first<{ id: string; university_id: string }>('id', 'university_id')
  await db('mentorship_requests').insert({
    university_id: other!.university_id,
    student_id: other!.id,
    alumni_id: alumniId,
    message: 'phantom',
    status: 'accepted',
  })
}

async function fillPlaceAgain() {
  const other = await db('users').where({ email: CREDENTIALS.admin.email }).first<{ id: string; university_id: string }>('id', 'university_id')
  await db('mentorship_requests').insert({
    university_id: other!.university_id,
    student_id: other!.id,
    alumni_id: alumniId,
    message: 'phantom',
    status: 'accepted',
  })
}

async function requestAndAccept() {
  const created = await api
    .post('/api/v1/mentorship/requests')
    .set(auth(studentToken))
    .send({ alumniId, message: 'Help with backend interviews' })
  expect(created.status).toBe(201)
  const id = created.body.data.id as string
  const accepted = await api
    .patch(`/api/v1/mentorship/requests/${id}`)
    .set(auth(alumniToken))
    .send({ status: 'accepted' })
  expect(accepted.status).toBe(200)
  return id
}

beforeAll(async () => {
  const [al, st] = await Promise.all([
    loginAs(CREDENTIALS.alumni.email, CREDENTIALS.alumni.password),
    loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password),
  ])
  alumniToken = al.accessToken
  studentToken = st.accessToken
  const users = await db('users')
    .whereIn('email', [CREDENTIALS.alumni.email, CREDENTIALS.student.email])
    .select<{ id: string; email: string }[]>('id', 'email')
  alumniId = users.find((u) => u.email === CREDENTIALS.alumni.email)!.id
  studentId = users.find((u) => u.email === CREDENTIALS.student.email)!.id
  savedAlumni = await db('profiles')
    .where({ user_id: alumniId })
    .first('is_open_to_mentorship', 'max_mentees', 'mentorship_points', 'mentorship_topics', 'mentorship_availability')
  await cleanup()
})

afterEach(cleanup)

afterAll(async () => {
  await db('profiles').where({ user_id: alumniId }).update(savedAlumni)
})

describe('Mentor settings', () => {
  it('saves topics, availability and capacity without resetting untouched fields', async () => {
    const first = await api
      .patch('/api/v1/mentorship/settings')
      .set(auth(alumniToken))
      .send({ topics: ['Backend', 'Interviews', 'Backend'], availability: ['Tue, 6:00 to 8:00 pm'] })
    expect(first.status).toBe(200)
    expect(first.body.data.topics).toEqual(['Backend', 'Interviews'])

    const second = await api.patch('/api/v1/mentorship/settings').set(auth(alumniToken)).send({ maxMentees: 5 })
    expect(second.body.data).toMatchObject({
      maxMentees: 5,
      topics: ['Backend', 'Interviews'],
      availability: ['Tue, 6:00 to 8:00 pm'],
      isOpenToMentorship: true,
    })
  })

  it('refuses a capacity below the current mentee count', async () => {
    await fillPlace()
    await fillPlaceAgain()
    const res = await api.patch('/api/v1/mentorship/settings').set(auth(alumniToken)).send({ maxMentees: 1 })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('CAPACITY_BELOW_ACTIVE')
  })

  it('is alumni-only', async () => {
    const res = await api.get('/api/v1/mentorship/settings').set(auth(studentToken))
    expect(res.status).toBe(403)
  })
})

describe('Sessions pay points per session', () => {
  it('awards points on log, reverses them on delete, and closes the open session request', async () => {
    const id = await requestAndAccept()
    await db('profiles').where({ user_id: alumniId }).update({ mentorship_availability: ['Thu, 6:00 pm'] })

    const proposed = await api
      .post(`/api/v1/mentorship/requests/${id}/session-requests`)
      .set(auth(studentToken))
      .send({ slotLabel: 'Thu, 6:00 pm', topic: 'Mock interview' })
    expect(proposed.status).toBe(201)
    expect(proposed.body.data.status).toBe('requested')

    const mine = await api.get('/api/v1/mentorship/requests/mine').set(auth(studentToken))
    const row = mine.body.data.items.find((r: { id: string }) => r.id === id)
    expect(row.openSessionRequest).toMatchObject({ slotLabel: 'Thu, 6:00 pm', status: 'requested' })
    expect(row.alumni.availability).toEqual(['Thu, 6:00 pm'])

    const logged = await api
      .post(`/api/v1/mentorship/requests/${id}/sessions`)
      .set(auth(alumniToken))
      .send({ sessionDate: '2026-09-18', durationMinutes: 45, topic: 'CV review' })
    expect(logged.status).toBe(201)

    const rewards = await api.get('/api/v1/mentorship/rewards/me').set(auth(alumniToken))
    expect(rewards.body.data.points).toBe(10)

    const incoming = await api
      .get('/api/v1/mentorship/requests/incoming')
      .query({ status: 'accepted' })
      .set(auth(alumniToken))
    const inc = incoming.body.data.items.find((r: { id: string }) => r.id === id)
    expect(inc).toMatchObject({ sessionCount: 1, totalMinutes: 45, openSessionRequest: null })

    const history = await api.get('/api/v1/mentorship/sessions/mine').set(auth(alumniToken))
    expect(history.body.data).toMatchObject({ totalSessions: 1, pointsEarned: 10 })

    await api.delete(`/api/v1/mentorship/requests/${id}/sessions/${logged.body.data.id}`).set(auth(alumniToken))
    const after = await api.get('/api/v1/mentorship/rewards/me').set(auth(alumniToken))
    expect(after.body.data.points).toBe(0)
  })

  it('requires a time when the alumnus schedules', async () => {
    const id = await requestAndAccept()
    const res = await api
      .post(`/api/v1/mentorship/requests/${id}/session-requests`)
      .set(auth(alumniToken))
      .send({ slotLabel: null })
    expect(res.status).toBe(400)
  })
})

describe('Ending a mentorship', () => {
  it('records who ended it and why, and lets only them reopen it', async () => {
    const id = await requestAndAccept()
    const ended = await api
      .post(`/api/v1/mentorship/requests/${id}/end`)
      .set(auth(studentToken))
      .send({ reason: 'Goals met', note: 'Thank you' })
    expect(ended.status).toBe(200)

    const mine = await api.get('/api/v1/mentorship/requests/mine').set(auth(studentToken))
    const row = mine.body.data.items.find((r: { id: string }) => r.id === id)
    expect(row).toMatchObject({ status: 'completed', endReason: 'Goals met', endNote: 'Thank you', endedBy: studentId })

    const byOther = await api.post(`/api/v1/mentorship/requests/${id}/reopen`).set(auth(alumniToken))
    expect(byOther.status).toBe(403)
    const reopened = await api.post(`/api/v1/mentorship/requests/${id}/reopen`).set(auth(studentToken))
    expect(reopened.status).toBe(200)
    expect(reopened.body.data.status).toBe('accepted')
  })

  it('lists an alumnus-ended mentorship with no sessions as canceled', async () => {
    const id = await requestAndAccept()
    await api.post(`/api/v1/mentorship/requests/${id}/end`).set(auth(alumniToken)).send({ reason: 'Schedule conflict' })
    const history = await api.get('/api/v1/mentorship/sessions/mine').set(auth(alumniToken))
    expect(history.body.data.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'canceled', requestId: id })]),
    )
  })
})

describe('Accept and decline', () => {
  it('fills a decline reason at capacity, and undo returns the request to pending', async () => {
    await db('profiles').where({ user_id: alumniId }).update({ max_mentees: 1 })
    const created = await api
      .post('/api/v1/mentorship/requests')
      .set(auth(studentToken))
      .send({ alumniId, message: 'Portfolio help' })
    expect(created.status).toBe(201)
    const id = created.body.data.id as string
    // The only place fills after the request arrived, so the decline lands at capacity.
    await fillPlace()

    const declined = await api
      .patch(`/api/v1/mentorship/requests/${id}`)
      .set(auth(alumniToken))
      .send({ status: 'declined' })
    expect(declined.status).toBe(200)
    const mine = await api.get('/api/v1/mentorship/requests/mine').set(auth(studentToken))
    expect(mine.body.data.items.find((r: { id: string }) => r.id === id).declineReason).toBe('At mentee capacity right now')

    const undo = await api.patch(`/api/v1/mentorship/requests/${id}`).set(auth(alumniToken)).send({ status: 'pending' })
    expect(undo.status).toBe(200)
    expect(undo.body.data.status).toBe('pending')
  })

  it('reports reply time and sessions on the directory', async () => {
    await requestAndAccept()
    const res = await api.get('/api/v1/mentorship/alumni').query({ limit: 100 }).set(auth(studentToken))
    const me = res.body.data.items.find((a: { id: string }) => a.id === alumniId)
    expect(me.avgReplyHours).not.toBeNull()
    expect(me).toMatchObject({ sessionsCompleted: 0, isWaitlisted: false, currentMentees: 1 })
  })
})

describe('Waitlist', () => {
  it('blocks a request to a full mentor, and notifies then clears the waitlist when a place opens', async () => {
    await db('profiles').where({ user_id: alumniId }).update({ max_mentees: 1 })
    await fillPlace()
    const blocked = await api
      .post('/api/v1/mentorship/requests')
      .set(auth(studentToken))
      .send({ alumniId, message: 'Please' })
    expect(blocked.status).toBe(400)
    expect(blocked.body.code).toBe('MENTOR_AT_CAPACITY')

    const joined = await api.post(`/api/v1/mentorship/alumni/${alumniId}/waitlist`).set(auth(studentToken))
    expect(joined.status).toBe(201)
    const list = await api.get('/api/v1/mentorship/alumni').query({ limit: 100 }).set(auth(studentToken))
    expect(list.body.data.items.find((a: { id: string }) => a.id === alumniId).isWaitlisted).toBe(true)

    // Raising capacity opens a place: the waitlist is consumed.
    await api.patch('/api/v1/mentorship/settings').set(auth(alumniToken)).send({ maxMentees: 2 })
    const left = await db('mentorship_waitlist').where({ student_id: studentId, alumni_id: alumniId })
    expect(left).toHaveLength(0)
  })
})
