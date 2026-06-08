import { haversineKm } from '../utils'
import type { ShuttleRoute, ShuttleStop } from '../types'

/**
 * Client-side shuttle position estimation.
 *
 * The server only ever stores REAL GPS beacons. When no fresh beacon exists for
 * a route, we interpolate the bus along the route polyline from the timetable +
 * the current clock — pure math, no network, no cost. The result is always
 * labelled `source: 'estimated'` and must never be presented as GPS-accurate.
 *
 * `estimateAlongPath(route, now)` is a pure function of its arguments (it never
 * reads the clock itself) so it is trivially unit-testable with a fixed `now`.
 */

export interface EstimatedPosition {
  lat: number
  lng: number
  headingDeg: number
  direction: 'outbound' | 'inbound'
  source: 'estimated'
}

// Fallbacks when a route omits explicit estimation params.
const DEFAULT_TRIP_MIN = 35
const DEFAULT_CYCLE_MIN = 50

/** Stops that carry valid coordinates, ordered by orderIndex. */
function geoStops(route: ShuttleRoute): ShuttleStop[] {
  return [...route.stops]
    .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
    .sort((a, b) => a.orderIndex - b.orderIndex)
}

/** Initial bearing from point A to point B, degrees in [0, 360). Exported for direction inference on live beacons. */
export function bearingDeg(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const φ1 = toRad(aLat)
  const φ2 = toRad(bLat)
  const Δλ = toRad(bLng - aLng)
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360
}

/**
 * Position at fraction `f` (0..1) along an ordered polyline, with the heading of
 * the segment it lands in. Travel direction is encoded by the order of `stops`
 * (reverse the array for the return leg), so headings come out correct both ways.
 */
function positionAlong(stops: ShuttleStop[], f: number): { lat: number; lng: number; headingDeg: number } {
  if (stops.length === 1) return { lat: stops[0].lat, lng: stops[0].lng, headingDeg: 0 }

  const segLen: number[] = []
  let total = 0
  for (let i = 0; i < stops.length - 1; i++) {
    const d = haversineKm(stops[i].lat, stops[i].lng, stops[i + 1].lat, stops[i + 1].lng)
    segLen.push(d)
    total += d
  }
  if (total === 0) return { lat: stops[0].lat, lng: stops[0].lng, headingDeg: 0 }

  const target = Math.min(Math.max(f, 0), 1) * total
  let acc = 0
  for (let i = 0; i < segLen.length; i++) {
    if (acc + segLen[i] >= target || i === segLen.length - 1) {
      const a = stops[i]
      const b = stops[i + 1]
      const segFrac = segLen[i] === 0 ? 0 : (target - acc) / segLen[i]
      return {
        lat: a.lat + (b.lat - a.lat) * segFrac,
        lng: a.lng + (b.lng - a.lng) * segFrac,
        headingDeg: bearingDeg(a.lat, a.lng, b.lat, b.lng),
      }
    }
    acc += segLen[i]
  }
  const last = stops[stops.length - 1]
  return { lat: last.lat, lng: last.lng, headingDeg: 0 }
}

/** "HH:MM" → minutes since midnight, or null if unparseable. */
function parseHM(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

function readDepartures(route: ShuttleRoute, key: 'outbound' | 'inbound'): number[] {
  const s = route.schedule
  const raw = s?.departures?.[key] ?? s?.[key] ?? []
  return raw.map(parseHM).filter((n): n is number => n !== null).sort((a, b) => a - b)
}

function minutesOfDay(now: Date): number {
  return now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60
}

function isContinuous(route: ShuttleRoute): boolean {
  if (route.schedule?.type === 'continuous') return true
  if (route.schedule?.type === 'fixed') return false
  // No explicit type: continuous if it has operating hours but no departures.
  const hasDepartures = readDepartures(route, 'outbound').length + readDepartures(route, 'inbound').length > 0
  return !hasDepartures && Boolean(route.schedule?.operatingHours)
}

function estimateFixed(route: ShuttleRoute, stops: ShuttleStop[], nowMin: number): EstimatedPosition | null {
  const tripMin = route.estDurationMin ?? DEFAULT_TRIP_MIN

  // Each candidate trip = a departure time + a direction-ordered stop list.
  const candidates: Array<{ dep: number; ordered: ShuttleStop[]; direction: 'outbound' | 'inbound' }> = [
    ...readDepartures(route, 'outbound').map((dep) => ({ dep, ordered: stops, direction: 'outbound' as const })),
    ...readDepartures(route, 'inbound').map((dep) => ({ dep, ordered: [...stops].reverse(), direction: 'inbound' as const })),
  ]

  // The active trip is the latest one whose [dep, dep+tripMin] window contains now.
  let best: { dep: number; ordered: ShuttleStop[]; direction: 'outbound' | 'inbound' } | null = null
  for (const c of candidates) {
    if (nowMin >= c.dep && nowMin <= c.dep + tripMin) {
      if (!best || c.dep > best.dep) best = c
    }
  }
  if (!best) return null // off-duty between trips → no marker

  const f = (nowMin - best.dep) / tripMin
  const p = positionAlong(best.ordered, f)
  return { lat: p.lat, lng: p.lng, headingDeg: p.headingDeg, direction: best.direction, source: 'estimated' }
}

function estimateContinuous(route: ShuttleRoute, stops: ShuttleStop[], nowMin: number): EstimatedPosition | null {
  const start = route.schedule?.operatingHours?.start
  const end = route.schedule?.operatingHours?.end
  const startMin = start ? parseHM(start) : null
  const endMin = end ? parseHM(end) : null
  if (startMin !== null && nowMin < startMin) return null
  if (endMin !== null && nowMin > endMin) return null

  const cycle = route.cycleMinutes ?? DEFAULT_CYCLE_MIN
  const base = startMin ?? 0
  const phase = (((nowMin - base) % cycle) + cycle) % cycle / cycle // 0..1

  // Ping-pong: first half travels out, second half travels back.
  const direction: 'outbound' | 'inbound' = phase < 0.5 ? 'outbound' : 'inbound'
  const ordered = direction === 'outbound' ? stops : [...stops].reverse()
  const f = phase < 0.5 ? phase * 2 : (phase - 0.5) * 2
  const p = positionAlong(ordered, f)
  return { lat: p.lat, lng: p.lng, headingDeg: p.headingDeg, direction, source: 'estimated' }
}

export function estimateAlongPath(route: ShuttleRoute, now: Date): EstimatedPosition | null {
  const stops = geoStops(route)
  if (stops.length < 2) return null

  const nowMin = minutesOfDay(now)
  return isContinuous(route)
    ? estimateContinuous(route, stops, nowMin)
    : estimateFixed(route, stops, nowMin)
}
