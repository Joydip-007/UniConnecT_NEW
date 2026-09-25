import { describe, expect, it } from 'vitest'
import {
  departures,
  dutyTrips,
  etaToStop,
  formatMinutes,
  nextDeparture,
  onDutyLabel,
  routeNumberLabel,
  scheduleSummary,
} from './schedule'
import type { BusState, ShuttleRoute, ShuttleShift } from '../types'

const route: ShuttleRoute = {
  id: 'r1',
  name: 'Notun Bazar ↔ UIU',
  color: '#3B82F6',
  isActive: true,
  estDurationMin: 30,
  stops: [
    { id: 's0', name: 'Notun Bazar', orderIndex: 0, lat: 23.7958, lng: 90.4255 },
    { id: 's1', name: 'Family Bazar', orderIndex: 1, lat: 23.8005, lng: 90.431 },
    { id: 's2', name: 'UIU', orderIndex: 2, lat: 23.8128, lng: 90.4501 },
  ],
  schedule: { type: 'fixed', departures: { outbound: ['08:00', '12:00'], inbound: ['10:00'] } },
}

/** A Date on today's calendar at hh:mm local time. */
function at(hh: number, mm = 0) {
  const d = new Date()
  d.setHours(hh, mm, 0, 0)
  return d
}

function shift(from: Date, to: Date | null, routeId = 'r1'): ShuttleShift {
  return { id: `${from.getTime()}`, routeId, startedAt: from.toISOString(), endedAt: to?.toISOString() ?? null, ridersCount: 3 }
}

describe('schedule helpers', () => {
  it('orders both directions into one timetable and summarises it', () => {
    expect(departures(route).map((d) => d.at)).toEqual([480, 600, 720])
    expect(scheduleSummary(route)).toBe('3 trips a day · 8:00 am to 12:00 pm')
    expect(nextDeparture(route, 601)?.at).toBe(720)
    expect(formatMinutes(0)).toBe('12:00 am')
  })

  it('numbers routes by their position in the name-ordered list', () => {
    const other = { ...route, id: 'r0', name: 'EWU ↔ UIU' }
    expect(routeNumberLabel([other, route], 'r1')).toBe('Route 2')
  })

  it('settles trips against real shifts: covered is done, uncovered is not driven', () => {
    const now = at(11)
    const trips = dutyTrips(route, [shift(at(7, 50), at(8, 40))], now)
    expect(trips.map((t) => t.status)).toEqual(['done', 'missed', 'scheduled'])
    expect(trips[0].label).toBe('Notun Bazar to UIU')
    expect(trips[1].label).toBe('UIU to Notun Bazar')
  })

  it('marks the trip on the road as running while a shift is open', () => {
    const trips = dutyTrips(route, [shift(at(9, 55), null)], at(10, 10))
    expect(trips[1].status).toBe('running')
  })

  it('adds up time on duty, counting an open shift to now', () => {
    expect(onDutyLabel([shift(at(8), at(9, 30)), shift(at(10), null)], at(10, 20))).toBe('1h 50m')
  })

  it('estimates minutes to a stop ahead and returns null for one already passed', () => {
    const bus: BusState = {
      routeId: 'r1',
      lat: 23.8005,
      lng: 90.431,
      headingDeg: 45,
      direction: 'outbound',
      speedKmh: 20,
      source: 'live',
      updatedAt: new Date().toISOString(),
    }
    expect(etaToStop(route, bus, 's2')).toBeGreaterThan(0)
    expect(etaToStop(route, bus, 's0')).toBeNull()
  })
})
