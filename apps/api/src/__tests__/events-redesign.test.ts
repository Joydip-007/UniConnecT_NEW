import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { app, loginAs, DOMAIN, TEST_UNIVERSITY_ID, CREDENTIALS } from './setup'
import { db } from '../config/db'

const api = supertest(app)
const UNI = { 'x-university-domain': DOMAIN }
const PREFIX = 'Events Redesign'
const HOUR = 60 * 60 * 1000

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
  await db('events').where({ university_id: TEST_UNIVERSITY_ID }).whereLike('title', `${PREFIX}%`).delete()
})

const as = (role: keyof typeof tokens) => ({ ...UNI, Authorization: `Bearer ${tokens[role]}` })

async function createEvent(title: string, startsAt: Date, extra: Record<string, unknown> = {}) {
  const res = await api
    .post('/api/v1/events')
    .set(as('faculty'))
    .send({
      title: `${PREFIX} ${title}`,
      description: 'd',
      location: 'Room 101',
      starts_at: startsAt.toISOString(),
      is_published: true,
      ...extra,
    })
  expect(res.status).toBe(201)
  return res.body.data as { id: string }
}

async function getEvent(role: keyof typeof tokens, id: string) {
  const res = await api.get(`/api/v1/events/${id}`).set(as(role))
  expect(res.status).toBe(200)
  return res.body.data
}

describe('events: waitlist', () => {
  it('queues people once a capped event is full and promotes the oldest when a seat frees', async () => {
    const event = await createEvent('waitlist', new Date(Date.now() + 48 * HOUR), { capacity: 1 })

    expect((await api.post(`/api/v1/events/${event.id}/rsvp`).set(as('student')).send({ status: 'going' })).status).toBe(201)

    const refused = await api.post(`/api/v1/events/${event.id}/rsvp`).set(as('alumni')).send({ status: 'going' })
    expect(refused.status).toBe(409)

    const queued = await api.post(`/api/v1/events/${event.id}/rsvp`).set(as('alumni')).send({ status: 'waitlisted' })
    expect(queued.status).toBe(201)
    expect(queued.body.data.status).toBe('waitlisted')
    await api.post(`/api/v1/events/${event.id}/rsvp`).set(as('admin')).send({ status: 'waitlisted' })

    const alumniView = await getEvent('alumni', event.id)
    expect(alumniView).toMatchObject({ myRsvp: 'waitlisted', waitlistPosition: 1, waitlistCount: 2 })
    expect((await getEvent('admin', event.id)).waitlistPosition).toBe(2)

    // Re-joining keeps your place in the queue.
    await api.post(`/api/v1/events/${event.id}/rsvp`).set(as('alumni')).send({ status: 'waitlisted' })
    expect((await getEvent('alumni', event.id)).waitlistPosition).toBe(1)

    // The student gives up the seat — the first in line gets it, the second moves up.
    expect((await api.delete(`/api/v1/events/${event.id}/rsvp`).set(as('student'))).status).toBe(200)
    expect(await getEvent('alumni', event.id)).toMatchObject({ myRsvp: 'going', waitlistPosition: null })
    expect(await getEvent('admin', event.id)).toMatchObject({ myRsvp: 'waitlisted', waitlistPosition: 1 })

    // Raising the cap empties the queue into the new seats.
    const raised = await api.patch(`/api/v1/events/${event.id}`).set(as('faculty')).send({ capacity: 5 })
    expect(raised.status).toBe(200)
    expect(await getEvent('admin', event.id)).toMatchObject({ myRsvp: 'going', waitlistCount: 0 })
  })

  it('gives a free seat straight away to someone asking to queue', async () => {
    const event = await createEvent('free seat', new Date(Date.now() + 48 * HOUR), { capacity: 3 })
    const res = await api.post(`/api/v1/events/${event.id}/rsvp`).set(as('student')).send({ status: 'waitlisted' })
    expect(res.body.data.status).toBe('going')
  })

  it('promotes when a going RSVP switches to maybe', async () => {
    const event = await createEvent('switch', new Date(Date.now() + 48 * HOUR), { capacity: 1 })
    await api.post(`/api/v1/events/${event.id}/rsvp`).set(as('student')).send({ status: 'going' })
    await api.post(`/api/v1/events/${event.id}/rsvp`).set(as('alumni')).send({ status: 'waitlisted' })
    await api.post(`/api/v1/events/${event.id}/rsvp`).set(as('student')).send({ status: 'maybe' })
    expect((await getEvent('alumni', event.id)).myRsvp).toBe('going')
  })
})

describe('events: list windows, conflicts and faces', () => {
  it('splits upcoming, ongoing and past around now, past newest-first', async () => {
    const future = await createEvent('future', new Date(Date.now() + 72 * HOUR))
    const live = await createEvent('live', new Date(Date.now() - HOUR), { ends_at: new Date(Date.now() + HOUR).toISOString() })
    const older = await createEvent('older', new Date(Date.now() - 96 * HOUR))
    const newer = await createEvent('newer', new Date(Date.now() - 48 * HOUR))

    const ids = async (when: string) => {
      const res = await api.get('/api/v1/events').query({ when, limit: 100 }).set(as('student'))
      expect(res.status).toBe(200)
      return (res.body.data.items as { id: string }[]).map((e) => e.id)
    }

    const upcoming = await ids('upcoming')
    expect(upcoming).toContain(future.id)
    expect(upcoming).not.toContain(live.id)

    const ongoing = await ids('ongoing')
    expect(ongoing).toContain(live.id)
    expect(ongoing).not.toContain(future.id)

    const past = await ids('past')
    expect(past).not.toContain(live.id)
    expect(past.indexOf(newer.id)).toBeLessThan(past.indexOf(older.id))

    expect((await api.get('/api/v1/events').query({ when: 'someday' }).set(as('student'))).status).toBe(422)
  })

  it('flags an overlap with another event the viewer is going to, and shows who is going', async () => {
    const start = new Date(Date.now() + 120 * HOUR)
    const lab = await createEvent('lab', start, { ends_at: new Date(start.getTime() + 2 * HOUR).toISOString() })
    const seminar = await createEvent('seminar', new Date(start.getTime() + HOUR))
    const later = await createEvent('later', new Date(start.getTime() + 5 * HOUR))

    await api.post(`/api/v1/events/${lab.id}/rsvp`).set(as('student')).send({ status: 'going' })

    const view = await getEvent('student', seminar.id)
    expect(view.conflict).toMatchObject({ id: lab.id, title: `${PREFIX} lab` })
    expect((await getEvent('student', later.id)).conflict).toBeNull()
    expect((await getEvent('alumni', seminar.id)).conflict).toBeNull()

    const labView = await getEvent('alumni', lab.id)
    expect(labView.previewAttendees).toHaveLength(1)
    expect(labView.previewAttendees[0]).toHaveProperty('fullName')
  })

  it('limits /my to events from a given instant', async () => {
    const past = await createEvent('my past', new Date(Date.now() - 72 * HOUR))
    const next = await createEvent('my next', new Date(Date.now() + 72 * HOUR))
    await api.post(`/api/v1/events/${past.id}/rsvp`).set(as('alumni')).send({ status: 'going' })
    await api.post(`/api/v1/events/${next.id}/rsvp`).set(as('alumni')).send({ status: 'going' })

    const res = await api.get('/api/v1/events/my').query({ from: new Date().toISOString() }).set(as('alumni'))
    const ids = (res.body.data.items as { id: string }[]).map((e) => e.id)
    expect(ids).toContain(next.id)
    expect(ids).not.toContain(past.id)
  })
})

describe('events: rail and picker endpoints', () => {
  it('ranks organisers by upcoming events', async () => {
    await createEvent('org a', new Date(Date.now() + 200 * HOUR))
    await createEvent('org b', new Date(Date.now() + 201 * HOUR))

    const res = await api.get('/api/v1/events/organisers').set(as('student'))
    expect(res.status).toBe(200)
    const organisers = res.body.data as { kind: string; upcomingCount: number }[]
    expect(organisers.length).toBeGreaterThan(0)
    expect(organisers.length).toBeLessThanOrEqual(5)
    expect(organisers[0].upcomingCount).toBeGreaterThanOrEqual(2)
    for (let i = 1; i < organisers.length; i++) {
      expect(organisers[i - 1].upcomingCount).toBeGreaterThanOrEqual(organisers[i].upcomingCount)
    }
  })

  it('lists event start instants in a bounded window', async () => {
    const start = new Date(Date.now() + 300 * HOUR)
    await createEvent('dot', start, { type: 'workshop' })

    const from = new Date(start.getTime() - HOUR).toISOString()
    const to = new Date(start.getTime() + HOUR).toISOString()
    const res = await api.get('/api/v1/events/dates').query({ from, to }).set(as('student'))
    expect(res.status).toBe(200)
    expect(res.body.data).toContainEqual({ startsAt: start.toISOString(), type: 'workshop' })

    const seminarsOnly = await api.get('/api/v1/events/dates').query({ from, to, type: 'seminar' }).set(as('student'))
    expect(seminarsOnly.body.data).not.toContainEqual(expect.objectContaining({ type: 'workshop' }))

    const tooWide = await api
      .get('/api/v1/events/dates')
      .query({ from, to: new Date(start.getTime() + 90 * 24 * HOUR).toISOString() })
      .set(as('student'))
    expect(tooWide.status).toBe(422)
  })
})
