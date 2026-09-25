import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import supertest from 'supertest'
import { app, CREDENTIALS, DOMAIN, TEST_UNIVERSITY_ID, loginAs } from './setup'
import bcrypt from 'bcryptjs'
import { db } from '../config/db'

const STOPS = [
  { id: 't-s0', name: 'Campus', orderIndex: 0, lat: 23.81, lng: 90.45 },
  { id: 't-s1', name: 'Bazar', orderIndex: 1, lat: 23.8, lng: 90.43 },
]

function api(method: 'get' | 'post' | 'put' | 'delete', path: string, token: string) {
  return supertest(app)[method](`/api/v1${path}`).set('x-university-domain', DOMAIN).set('Authorization', `Bearer ${token}`)
}

describe('shuttle duty, rider stop and notices', () => {
  let routeId: string
  let admin: string
  let student: string

  beforeEach(async () => {
    await db('shuttle_routes').where({ university_id: TEST_UNIVERSITY_ID, name: 'Duty test route' }).del()
    const [route] = await db('shuttle_routes')
      .insert({
        university_id: TEST_UNIVERSITY_ID,
        name: 'Duty test route',
        color: '#4E62BF',
        stops: JSON.stringify(STOPS),
        schedule: JSON.stringify({ type: 'fixed', departures: { outbound: ['08:00'], inbound: ['09:00'] } }),
        is_active: true,
      })
      .returning('id')
    routeId = route.id
    admin = (await loginAs(CREDENTIALS.admin.email, CREDENTIALS.admin.password)).accessToken
    student = (await loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password)).accessToken
  })

  afterAll(async () => {
    await db('shuttle_notices').whereIn('title', ['Diverted via Hatirjheel', 'Already over']).del()
    await db('shuttle_routes').where({ university_id: TEST_UNIVERSITY_ID, name: 'Duty test route' }).del()
  })

  it('opens, counts riders on, and closes a shift that the duty board reads back', async () => {
    const since = new Date(Date.now() - 60_000).toISOString()

    const start = await api('post', '/shuttle/shifts/start', admin).send({ route_id: routeId })
    expect(start.status).toBe(201)
    expect(start.body.data.endedAt).toBeNull()

    await api('post', '/shuttle/shifts/riders', admin).send({ delta: 1 })
    await api('post', '/shuttle/shifts/riders', admin).send({ delta: 1 })
    const minus = await api('post', '/shuttle/shifts/riders', admin).send({ delta: -1 })
    expect(minus.body.data.ridersCount).toBe(1)

    const duty = await api('get', `/shuttle/duty?since=${encodeURIComponent(since)}`, admin)
    expect(duty.status).toBe(200)
    expect(duty.body.data.activeShift.routeId).toBe(routeId)
    expect(duty.body.data.assignedRouteId).toBe(routeId)

    const stop = await api('post', '/shuttle/shifts/stop', admin)
    expect(stop.body.data.endedAt).not.toBeNull()

    const after = await api('get', `/shuttle/duty?since=${encodeURIComponent(since)}`, admin)
    expect(after.body.data.activeShift).toBeNull()
    expect(after.body.data.shifts).toHaveLength(1)
    expect(after.body.data.assignedRouteId).toBe(routeId)
  })

  it('lets a real driver account through requireAuth (token role check includes driver)', async () => {
    const email = 'driver.duty@uiu.ac.bd'
    await db('users')
      .insert({
        university_id: TEST_UNIVERSITY_ID,
        username: 'duty_test_driver',
        email,
        password_hash: await bcrypt.hash('Driver#123', 10),
        role: 'driver',
        is_verified: true,
      })
      .onConflict('email')
      .merge({ role: 'driver' })
    try {
      const { accessToken } = await loginAs(email, 'Driver#123')
      const res = await api('get', `/shuttle/duty?since=${encodeURIComponent(new Date().toISOString())}`, accessToken)
      expect(res.status).toBe(200)
    } finally {
      await db('users').where({ email }).del()
    }
  })

  it('refuses to count riders with no open shift, and keeps members out of the duty board', async () => {
    await api('post', '/shuttle/shifts/stop', admin)
    const riders = await api('post', '/shuttle/shifts/riders', admin).send({ delta: 1 })
    expect(riders.status).toBe(400)
    expect(riders.body.code).toBe('NO_OPEN_SHIFT')

    const duty = await api('get', `/shuttle/duty?since=${encodeURIComponent(new Date().toISOString())}`, student)
    expect(duty.status).toBe(403)
  })

  it('saves a rider stop and rejects a stop that is not on the route', async () => {
    const empty = await api('get', '/shuttle/me/stop', student)
    expect(empty.body.data).toMatchObject({ alertEnabled: true })

    const saved = await api('put', '/shuttle/me/stop', student).send({ route_id: routeId, stop_id: 't-s1', alert_enabled: false })
    expect(saved.status).toBe(200)
    expect(saved.body.data).toEqual({ routeId, stopId: 't-s1', alertEnabled: false })

    const bad = await api('put', '/shuttle/me/stop', student).send({ route_id: routeId, stop_id: 'nope', alert_enabled: true })
    expect(bad.status).toBe(404)
  })

  it('lets admins post and remove notices, hides expired ones, and forbids students', async () => {
    const created = await api('post', '/shuttle/notices', admin).send({
      route_id: routeId,
      tone: 'disruption',
      title: 'Diverted via Hatirjheel',
      detail: 'Road works until 30 Sep',
    })
    expect(created.status).toBe(201)
    expect(created.body.data.routeName).toBe('Duty test route')

    await api('post', '/shuttle/notices', admin).send({
      tone: 'info',
      title: 'Already over',
      expires_at: new Date(Date.now() - 1000).toISOString(),
    })

    const list = await api('get', '/shuttle/notices', student)
    const titles = list.body.data.map((n: { title: string }) => n.title)
    expect(titles).toContain('Diverted via Hatirjheel')
    expect(titles).not.toContain('Already over')

    const forbidden = await api('post', '/shuttle/notices', student).send({ tone: 'info', title: 'x' })
    expect(forbidden.status).toBe(403)

    const removed = await api('delete', `/shuttle/notices/${created.body.data.id}`, admin)
    expect(removed.status).toBe(204)
    const again = await api('get', '/shuttle/notices', student)
    expect(again.body.data.map((n: { id: string }) => n.id)).not.toContain(created.body.data.id)
  })
})
