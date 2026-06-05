import type { Knex } from 'knex'

/**
 * Seeds UIU's three real shuttle routes with stop coordinates + timetables so the
 * live shuttle map has something to draw. Idempotent — skips any route whose name
 * already exists for a university (re-runs / new tenants are safe).
 *
 * Coordinates are approximate (well-known Dhaka landmarks along each corridor);
 * the straight-line map geometry only needs them to be roughly right. Source:
 * docs/UIU_Shuttle_Services.md.
 *
 * Stop shape matches the web `ShuttleStop` type: { id, name, orderIndex, lat, lng }.
 * Schedule shape is read by the client estimator (estimatePosition.ts):
 *   fixed      → { type, departures: { outbound, inbound } }
 *   continuous → { type, operatingHours: { start, end } }
 */

interface SeedStop {
  id: string
  name: string
  orderIndex: number
  lat: number
  lng: number
}

interface SeedRoute {
  name: string
  color: string
  stops: SeedStop[]
  schedule: Record<string, unknown>
  est_duration_min: number | null
  cycle_minutes: number | null
}

const ROUTES: SeedRoute[] = [
  {
    name: 'Notun Bazar ↔ UIU',
    color: '#3B82F6',
    est_duration_min: 35,
    cycle_minutes: null,
    stops: [
      { id: 'r1-s0', name: 'Notun Bazar', orderIndex: 0, lat: 23.7958, lng: 90.4255 },
      { id: 'r1-s1', name: 'Family Bazar', orderIndex: 1, lat: 23.8005, lng: 90.431 },
      { id: 'r1-s2', name: 'Sayed Nagar', orderIndex: 2, lat: 23.8055, lng: 90.437 },
      { id: 'r1-s3', name: '10 Tala', orderIndex: 3, lat: 23.8095, lng: 90.444 },
      { id: 'r1-s4', name: 'UIU', orderIndex: 4, lat: 23.8128, lng: 90.4501 },
    ],
    schedule: {
      type: 'fixed',
      departures: {
        outbound: ['07:30', '09:25', '10:45', '12:05', '13:25', '14:45', '18:10'],
        inbound: ['10:05', '11:25', '12:45', '14:05', '15:25', '16:40', '17:45', '19:00', '21:40'],
      },
    },
  },
  {
    name: 'Kuril BRTC ↔ UIU',
    color: '#10B981',
    est_duration_min: null,
    cycle_minutes: 50,
    stops: [
      { id: 'r2-s0', name: 'UIU', orderIndex: 0, lat: 23.8128, lng: 90.4501 },
      { id: 'r2-s1', name: 'Bashundhara Gold Refinery Gate', orderIndex: 1, lat: 23.8195, lng: 90.4385 },
      { id: 'r2-s2', name: '300 Feet Road', orderIndex: 2, lat: 23.8245, lng: 90.43 },
      { id: 'r2-s3', name: 'Kuril BRTC Bus Stand', orderIndex: 3, lat: 23.8275, lng: 90.421 },
    ],
    schedule: {
      type: 'continuous',
      operatingHours: { start: '07:30', end: '17:00' },
    },
  },
  {
    name: 'EWU ↔ UIU',
    color: '#A855F7',
    est_duration_min: 30,
    cycle_minutes: null,
    stops: [
      { id: 'r3-s0', name: 'EWU Gate', orderIndex: 0, lat: 23.7686, lng: 90.4253 },
      { id: 'r3-s1', name: 'Lohar Bridge', orderIndex: 1, lat: 23.779, lng: 90.43 },
      { id: 'r3-s2', name: 'Bottola', orderIndex: 2, lat: 23.788, lng: 90.433 },
      { id: 'r3-s3', name: 'UIU', orderIndex: 3, lat: 23.8128, lng: 90.4501 },
    ],
    schedule: {
      type: 'fixed',
      departures: {
        outbound: ['06:50', '07:40', '08:30', '09:00', '10:30', '11:50', '13:10'],
        inbound: ['14:00', '15:20', '16:40', '17:20', '18:00'],
      },
    },
  },
]

const ROUTE_NAMES = ROUTES.map((r) => r.name)

export async function up(knex: Knex) {
  const universities = await knex<{ id: string }>('universities').select('id')

  for (const university of universities) {
    for (const route of ROUTES) {
      const existing = await knex('shuttle_routes')
        .where({ university_id: university.id, name: route.name })
        .first<{ id: string }>('id')
      if (existing) continue

      await knex('shuttle_routes').insert({
        university_id: university.id,
        name: route.name,
        color: route.color,
        stops: JSON.stringify(route.stops),
        schedule: JSON.stringify(route.schedule),
        est_duration_min: route.est_duration_min,
        cycle_minutes: route.cycle_minutes,
        is_active: true,
      })
    }
  }
}

export async function down(knex: Knex) {
  await knex('shuttle_routes').whereIn('name', ROUTE_NAMES).del()
}
