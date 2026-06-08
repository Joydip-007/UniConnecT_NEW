import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import supertest from 'supertest'
import { isWithinQuietHours, type QuietHours } from '@uniconnect/shared'
import { app, CREDENTIALS, DOMAIN, loginAs } from './setup'
import { db } from '../config/db'

const api = supertest(app)
let studentToken: string
let studentId: string

function auth(token: string) {
  return { Authorization: `Bearer ${token}`, 'x-university-domain': DOMAIN }
}

beforeAll(async () => {
  const st = await loginAs(CREDENTIALS.student.email, CREDENTIALS.student.password)
  studentToken = st.accessToken
  const me = await api.get('/api/v1/users/me').set(auth(studentToken))
  studentId = me.body.data.id
})

afterAll(async () => {
  // Reset notification prefs so later suites see defaults.
  await db('user_settings').where({ user_id: studentId }).update({ notification_preferences: '{}' })
})

describe('isWithinQuietHours (pure, Asia/Dhaka = UTC+6)', () => {
  const overnight: QuietHours = { enabled: true, start: '22:00', end: '07:00', timezone: 'Asia/Dhaka' }
  const daytime: QuietHours = { enabled: true, start: '09:00', end: '17:00', timezone: 'Asia/Dhaka' }

  it('disabled window is never active', () => {
    expect(isWithinQuietHours({ ...overnight, enabled: false }, new Date('2026-06-08T17:00:00Z'))).toBe(false)
  })

  it('overnight window matches a late-night local time', () => {
    // 17:00 UTC = 23:00 BDT → inside 22:00–07:00
    expect(isWithinQuietHours(overnight, new Date('2026-06-08T17:00:00Z'))).toBe(true)
    // 00:00 UTC = 06:00 BDT → inside (before 07:00 end)
    expect(isWithinQuietHours(overnight, new Date('2026-06-08T00:00:00Z'))).toBe(true)
  })

  it('overnight window excludes midday', () => {
    // 06:00 UTC = 12:00 BDT → outside
    expect(isWithinQuietHours(overnight, new Date('2026-06-08T06:00:00Z'))).toBe(false)
  })

  it('same-day window matches inside and excludes outside', () => {
    // 06:00 UTC = 12:00 BDT → inside 09:00–17:00
    expect(isWithinQuietHours(daytime, new Date('2026-06-08T06:00:00Z'))).toBe(true)
    // 14:00 UTC = 20:00 BDT → outside
    expect(isWithinQuietHours(daytime, new Date('2026-06-08T14:00:00Z'))).toBe(false)
  })
})

describe('Notification preferences — quiet hours + digest', () => {
  it('GET returns quiet-hours and digest defaults', async () => {
    const res = await api.get('/api/v1/notifications/preferences').set(auth(studentToken))
    expect(res.status).toBe(200)
    expect(res.body.data.quietHours).toMatchObject({ enabled: false, timezone: 'Asia/Dhaka' })
    expect(res.body.data.emailDigest).toBe('off')
  })

  it('PUT persists quiet hours and digest, preserving categories', async () => {
    const res = await api
      .put('/api/v1/notifications/preferences')
      .set(auth(studentToken))
      .send({ quietHours: { enabled: true, start: '23:00', end: '06:30' }, emailDigest: 'daily' })
    expect(res.status).toBe(200)
    expect(res.body.data.quietHours).toMatchObject({ enabled: true, start: '23:00', end: '06:30' })
    expect(res.body.data.emailDigest).toBe('daily')
    // categories untouched
    expect(res.body.data.connections.in_app).toBe(true)
  })

  it('a later category-only update preserves quiet hours and digest', async () => {
    const res = await api
      .put('/api/v1/notifications/preferences')
      .set(auth(studentToken))
      .send({ connections: { push: false } })
    expect(res.status).toBe(200)
    expect(res.body.data.connections.push).toBe(false)
    expect(res.body.data.quietHours.enabled).toBe(true)
    expect(res.body.data.emailDigest).toBe('daily')
  })

  it('rejects an invalid time format (422)', async () => {
    const res = await api
      .put('/api/v1/notifications/preferences')
      .set(auth(studentToken))
      .send({ quietHours: { start: '25:99' } })
    expect(res.status).toBe(422)
  })
})
