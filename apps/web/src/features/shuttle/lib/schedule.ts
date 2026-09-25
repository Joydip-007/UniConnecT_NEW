import { haversineKm } from '../utils'
import type { BusState, ShuttleRoute, ShuttleShift } from '../types'

/**
 * Timetable reading shared by the rider rail, the tracker card and the driver's duty
 * board. The route's `schedule` jsonb is loose (see `ShuttleSchedule`), so every helper
 * degrades to "no data" instead of throwing.
 */

/** Used when a route omits its own estimation params — matches `estimatePosition.ts`. */
const DEFAULT_TRIP_MIN = 35
const DEFAULT_CYCLE_MIN = 50
/** Average city speed for a scheduled (not live) bus when estimating an arrival. */
const SCHEDULED_SPEED_KMH = 18

export function parseHM(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

/** 870 → "2:30 pm" — the design's lower-case 12-hour clock. */
export function formatMinutes(total: number): string {
  const h24 = Math.floor(total / 60) % 24
  const m = total % 60
  const suffix = h24 >= 12 ? 'pm' : 'am'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}

export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

/** "Route 3" — the position in the API's name-ordered list, so every screen agrees. */
export function routeNumberLabel(routes: ShuttleRoute[], routeId: string): string {
  const index = routes.findIndex((r) => r.id === routeId)
  return index === -1 ? 'Route' : `Route ${index + 1}`
}

/** "Notun Bazar ↔ UIU" → "Notun Bazar to UIU". */
export function routeCorridor(route: ShuttleRoute): string {
  return route.name.replace(/\s*↔\s*/g, ' to ')
}

export function tripMinutes(route: ShuttleRoute): number {
  return route.estDurationMin ?? (route.cycleMinutes ? Math.round(route.cycleMinutes / 2) : DEFAULT_TRIP_MIN)
}

export interface Departure {
  /** Minutes since local midnight. */
  at: number
  direction: 'outbound' | 'inbound'
}

/** Every departure today, in time order. A continuous route departs once per cycle. */
export function departures(route: ShuttleRoute): Departure[] {
  const s = route.schedule
  if (s?.type === 'continuous' || (!s?.departures && !s?.outbound && s?.operatingHours)) {
    const start = parseHM(s?.operatingHours?.start ?? '')
    const end = parseHM(s?.operatingHours?.end ?? '')
    if (start === null || end === null) return []
    const cycle = route.cycleMinutes ?? DEFAULT_CYCLE_MIN
    const out: Departure[] = []
    for (let t = start; t <= end; t += cycle) out.push({ at: t, direction: 'outbound' })
    return out
  }
  const read = (list: string[] | undefined, direction: Departure['direction']) =>
    (list ?? [])
      .map(parseHM)
      .filter((n): n is number => n !== null)
      .map((at) => ({ at, direction }))
  return [
    ...read(s?.departures?.outbound ?? s?.outbound, 'outbound'),
    ...read(s?.departures?.inbound ?? s?.inbound, 'inbound'),
  ].sort((a, b) => a.at - b.at)
}

/** "Every 20 minutes · 7:45 am to 9:00 pm" or "12 trips a day · 6:50 am to 6:00 pm". */
export function scheduleSummary(route: ShuttleRoute): string {
  const deps = departures(route)
  if (deps.length === 0) return 'No timetable yet'
  const first = formatMinutes(deps[0].at)
  const last = formatMinutes(deps[deps.length - 1].at)
  if (route.schedule?.type === 'continuous') {
    return `Every ${route.cycleMinutes ?? DEFAULT_CYCLE_MIN} minutes · ${first} to ${last}`
  }
  return `${deps.length} trips a day · ${first} to ${last}`
}

/** The first departure at or after `nowMin`, or null when service is over for the day. */
export function nextDeparture(route: ShuttleRoute, nowMin: number, direction?: Departure['direction']): Departure | null {
  return departures(route).find((d) => d.at >= nowMin && (!direction || d.direction === direction)) ?? null
}

/** The departure whose trip is on the road right now, if any. */
export function runningDeparture(route: ShuttleRoute, nowMin: number): Departure | null {
  const dur = tripMinutes(route)
  return departures(route).find((d) => d.at <= nowMin && nowMin < d.at + dur) ?? null
}

/** When the last bus of the day leaves, as "9:00 pm" — or null with no timetable. */
export function lastBusLabel(route: ShuttleRoute): string | null {
  const deps = departures(route)
  return deps.length ? formatMinutes(deps[deps.length - 1].at) : null
}

function orderedStops(route: ShuttleRoute) {
  return [...route.stops]
    .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
    .sort((a, b) => a.orderIndex - b.orderIndex)
}

export function tripLabel(route: ShuttleRoute, direction: Departure['direction']): string {
  const stops = orderedStops(route)
  if (stops.length < 2) return routeCorridor(route)
  const [a, b] = direction === 'outbound' ? [stops[0], stops[stops.length - 1]] : [stops[stops.length - 1], stops[0]]
  return `${a.name} to ${b.name}`
}

/**
 * Minutes until the bus reaches `stopId`, walking the stops between the bus and the
 * stop in its direction of travel. Uses the beacon's speed when live and a city
 * average otherwise. Null when the bus has already passed the stop on this leg.
 */
export function etaToStop(route: ShuttleRoute, bus: BusState, stopId: string): number | null {
  const stops = orderedStops(route)
  const leg = bus.direction === 'outbound' ? stops : [...stops].reverse()
  const target = leg.findIndex((s) => s.id === stopId)
  if (target === -1) return null

  const dists = leg.map((s) => haversineKm(bus.lat, bus.lng, s.lat, s.lng))
  const nearest = dists.indexOf(Math.min(...dists))
  // The bus is between `nearest` and the stop after it; a target behind it is passed.
  if (target < nearest) return null

  let km = dists[target]
  if (target > nearest) {
    km = dists[nearest + 1]
    for (let i = nearest + 1; i < target; i++) {
      km += haversineKm(leg[i].lat, leg[i].lng, leg[i + 1].lat, leg[i + 1].lng)
    }
  }
  const speed = bus.source === 'live' && bus.speedKmh && bus.speedKmh > 1 ? bus.speedKmh : SCHEDULED_SPEED_KMH
  return Math.max(1, Math.round((km / speed) * 60))
}

export type TripStatus = 'done' | 'running' | 'scheduled' | 'missed'

export interface DutyTrip {
  at: number
  label: string
  status: TripStatus
}

/**
 * Today's trips on the driver's route, each settled against the driver's real shifts:
 * a past trip is done only if a shift on this route covered its departure, the trip
 * on the road is running while a shift is open, and future ones are scheduled.
 */
export function dutyTrips(route: ShuttleRoute, shifts: ShuttleShift[], now: Date): DutyTrip[] {
  const nowMs = now.getTime()
  const midnight = new Date(now)
  midnight.setHours(0, 0, 0, 0)
  const dur = tripMinutes(route)
  const mine = shifts.filter((s) => s.routeId === route.id)

  return departures(route).map(({ at, direction }) => {
    const startMs = midnight.getTime() + at * 60_000
    const endMs = startMs + dur * 60_000
    const covered = mine.some((s) => {
      const from = Date.parse(s.startedAt)
      const to = s.endedAt ? Date.parse(s.endedAt) : nowMs
      return from <= endMs && to >= startMs
    })
    const open = mine.some((s) => s.endedAt === null)
    let status: TripStatus
    if (startMs > nowMs) status = 'scheduled'
    else if (endMs > nowMs) status = open ? 'running' : covered ? 'done' : 'scheduled'
    else status = covered ? 'done' : 'missed'
    return { at, label: tripLabel(route, direction), status }
  })
}

/** "6h 20m" of shift time today, counting an open shift up to now. */
export function onDutyLabel(shifts: ShuttleShift[], now: Date): string {
  const ms = shifts.reduce((sum, s) => {
    const to = s.endedAt ? Date.parse(s.endedAt) : now.getTime()
    return sum + Math.max(0, to - Date.parse(s.startedAt))
  }, 0)
  const mins = Math.round(ms / 60_000)
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

/** Local midnight as ISO — the `since` the duty endpoint scopes "today" by. */
export function todayStartIso(now = new Date()): string {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}
