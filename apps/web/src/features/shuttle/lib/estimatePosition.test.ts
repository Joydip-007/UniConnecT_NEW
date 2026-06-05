import { describe, it, expect } from 'vitest'
import { estimateAlongPath } from './estimatePosition'
import type { ShuttleRoute } from '../types'

// Two stops on the same latitude → travel is due east; the midpoint lng is 90.45.
const A = { id: 'a', name: 'A', orderIndex: 0, lat: 23.8, lng: 90.4 }
const B = { id: 'b', name: 'B', orderIndex: 1, lat: 23.8, lng: 90.5 }

function route(partial: Partial<ShuttleRoute>): ShuttleRoute {
  return { id: 'r', name: 'R', color: '#F05A28', stops: [A, B], isActive: true, ...partial }
}

describe('estimateAlongPath', () => {
  it('interpolates a fixed-trip bus halfway along the route at mid-trip', () => {
    const r = route({
      schedule: { type: 'fixed', departures: { outbound: ['10:00'] } },
      estDurationMin: 60,
    })
    const pos = estimateAlongPath(r, new Date(2026, 5, 5, 10, 30, 0)) // 30 min into a 60 min trip
    expect(pos).not.toBeNull()
    expect(pos!.source).toBe('estimated')
    expect(pos!.lat).toBeCloseTo(23.8, 4)
    expect(pos!.lng).toBeCloseTo(90.45, 3)
    expect(pos!.headingDeg).toBeCloseTo(90, 0) // due east
  })

  it('returns null when the fixed route is between trips (off-duty)', () => {
    const r = route({
      schedule: { type: 'fixed', departures: { outbound: ['10:00'] } },
      estDurationMin: 60,
    })
    expect(estimateAlongPath(r, new Date(2026, 5, 5, 9, 0, 0))).toBeNull() // before departure
    expect(estimateAlongPath(r, new Date(2026, 5, 5, 11, 30, 0))).toBeNull() // after arrival
  })

  it('runs a continuous route within operating hours and heads back on the return leg', () => {
    const r = route({
      schedule: { type: 'continuous', operatingHours: { start: '08:00', end: '20:00' } },
      cycleMinutes: 60,
    })
    const outbound = estimateAlongPath(r, new Date(2026, 5, 5, 8, 15, 0)) // phase .25 → outbound
    expect(outbound!.source).toBe('estimated')
    expect(outbound!.headingDeg).toBeCloseTo(90, 0) // east

    const inbound = estimateAlongPath(r, new Date(2026, 5, 5, 8, 45, 0)) // phase .75 → return
    expect(inbound!.headingDeg).toBeCloseTo(270, 0) // west
  })

  it('returns null outside continuous operating hours', () => {
    const r = route({
      schedule: { type: 'continuous', operatingHours: { start: '08:00', end: '17:00' } },
      cycleMinutes: 60,
    })
    expect(estimateAlongPath(r, new Date(2026, 5, 5, 6, 0, 0))).toBeNull()
    expect(estimateAlongPath(r, new Date(2026, 5, 5, 18, 0, 0))).toBeNull()
  })

  it('returns null when the route has fewer than two geo-located stops', () => {
    const r = route({ stops: [A], schedule: { type: 'continuous', operatingHours: { start: '00:00', end: '23:59' } } })
    expect(estimateAlongPath(r, new Date(2026, 5, 5, 10, 0, 0))).toBeNull()
  })
})
