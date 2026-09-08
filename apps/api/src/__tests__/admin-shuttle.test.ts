import { describe, expect, it, beforeEach, afterAll } from 'vitest'
import { app, CREDENTIALS, DOMAIN, TEST_UNIVERSITY_ID } from './setup'
import supertest from 'supertest'
import { db } from '../config/db'

async function loginAs(email: string, password: string) {
  const res = await supertest(app)
    .post('/api/v1/auth/login')
    .set('x-university-domain', DOMAIN)
    .send({ email, password })
  return res.body.data.accessToken as string
}

describe('admin shuttle ops', () => {
  let routeId: string
  let driverUserId: string

  beforeEach(async () => {
    await db('shuttle_locations').del()
    await db('shuttle_routes').where({ university_id: TEST_UNIVERSITY_ID }).del()

    const [route] = await db('shuttle_routes')
      .insert({
        university_id: TEST_UNIVERSITY_ID,
        name: 'Test route',
        color: '#4E62BF',
        stops: JSON.stringify([]),
        schedule: JSON.stringify({ type: 'continuous', operatingHours: { start: '07:00', end: '20:00' } }),
        is_active: true,
      })
      .returning('id')
    routeId = route.id

    const [driver] = await db('users')
      .insert({
        university_id: TEST_UNIVERSITY_ID,
        username: 'test_driver_shuttle_ops',
        email: 'driver.shuttleops@uiu.ac.bd',
        password_hash: 'x',
        role: 'driver',
        is_verified: true,
      })
      .onConflict('email')
      .merge({ role: 'driver' })
      .returning('id')
    driverUserId = driver.id
  })

  afterAll(async () => {
    await db('shuttle_locations').del()
    await db('shuttle_routes').where({ university_id: TEST_UNIVERSITY_ID }).del()
    await db('users').where({ email: 'driver.shuttleops@uiu.ac.bd' }).del()
  })

  it('GET /admin/shuttle/stats counts a recent broadcast as live', async () => {
    await db('shuttle_locations').insert({
      route_id: routeId,
      driver_id: driverUserId,
      lat: 23.8103,
      lng: 90.4125,
      updated_at: new Date(),
    })

    const token = await loginAs(CREDENTIALS.admin.email, CREDENTIALS.admin.password)
    const res = await supertest(app)
      .get('/api/v1/admin/shuttle/stats')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.data.busesLive).toBeGreaterThanOrEqual(1)
    expect(res.body.data.onDutyDrivers).toBeGreaterThanOrEqual(1)
    expect(res.body.data.activeRoutes).toBeGreaterThanOrEqual(1)
    const routeEntry = res.body.data.routes.find((r: { routeId: string }) => r.routeId === routeId)
    expect(routeEntry.isLive).toBe(true)
  })

  it('GET /admin/shuttle/stats treats a stale broadcast as idle', async () => {
    const stale = new Date(Date.now() - 10 * 60 * 1000)
    await db('shuttle_locations').insert({
      route_id: routeId,
      driver_id: driverUserId,
      lat: 23.8103,
      lng: 90.4125,
      updated_at: stale,
    })

    const token = await loginAs(CREDENTIALS.admin.email, CREDENTIALS.admin.password)
    const res = await supertest(app)
      .get('/api/v1/admin/shuttle/stats')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${token}`)

    const routeEntry = res.body.data.routes.find((r: { routeId: string }) => r.routeId === routeId)
    expect(routeEntry.isLive).toBe(false)
    expect(res.body.data.busesLive).toBe(0)
  })

  it('GET /admin/shuttle/stats rejects non-admin roles', async () => {
    const token = await loginAs(CREDENTIALS.faculty.email, CREDENTIALS.faculty.password)
    const res = await supertest(app)
      .get('/api/v1/admin/shuttle/stats')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(403)
  })

  it('GET then PATCH /admin/shuttle/settings persists a toggle change', async () => {
    const token = await loginAs(CREDENTIALS.admin.email, CREDENTIALS.admin.password)

    const before = await supertest(app)
      .get('/api/v1/admin/shuttle/settings')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${token}`)
    expect(before.status).toBe(200)
    expect(before.body.data.autoAssignEnabled).toBe(false)

    const patch = await supertest(app)
      .patch('/api/v1/admin/shuttle/settings')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${token}`)
      .send({ autoAssignEnabled: true })
    expect(patch.status).toBe(200)
    expect(patch.body.data.autoAssignEnabled).toBe(true)
    // Untouched fields survive the partial patch unchanged.
    expect(patch.body.data.liveGpsEnabled).toBe(true)

    // Revert for test isolation.
    await supertest(app)
      .patch('/api/v1/admin/shuttle/settings')
      .set('x-university-domain', DOMAIN)
      .set('Authorization', `Bearer ${token}`)
      .send({ autoAssignEnabled: false })
  })
})
