import { haversineKm } from '../utils'
import type { BusState, ShuttleRoute } from '../types'

export type SortKey = 'nearest' | 'soonest' | 'live'

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'nearest', label: 'Nearest to me' },
  { key: 'soonest', label: 'Soonest departure' },
  { key: 'live', label: 'Live first' },
]

function parseHM(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

/** Minutes until this route's next scheduled departure (Infinity if unknown). */
function minutesToNextDeparture(route: ShuttleRoute, nowMin: number): number {
  const s = route.schedule
  if (s?.type === 'continuous' || s?.operatingHours) {
    const start = s.operatingHours?.start ? parseHM(s.operatingHours.start) : null
    const end = s.operatingHours?.end ? parseHM(s.operatingHours.end) : null
    if (start !== null && nowMin < start) return start - nowMin
    if (end !== null && nowMin > end) return Infinity
    return 0 // running now
  }
  const deps = [
    ...(s?.departures?.outbound ?? s?.outbound ?? []),
    ...(s?.departures?.inbound ?? s?.inbound ?? []),
  ]
    .map(parseHM)
    .filter((n): n is number => n !== null)
  const upcoming = deps.filter((d) => d >= nowMin).sort((a, b) => a - b)
  return upcoming.length > 0 ? upcoming[0] - nowMin : Infinity
}

/** Distance from the user to the route's closest stop (Infinity if no location). */
function nearestStopKm(route: ShuttleRoute, user: { lat: number; lng: number } | null): number {
  if (!user) return Infinity
  const stops = route.stops.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
  if (stops.length === 0) return Infinity
  return Math.min(...stops.map((s) => haversineKm(user.lat, user.lng, s.lat, s.lng)))
}

export function sortRoutes(
  routes: ShuttleRoute[],
  sortKey: SortKey,
  busStates: Record<string, BusState>,
  user: { lat: number; lng: number } | null,
  now: Date,
): ShuttleRoute[] {
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const byName = (a: ShuttleRoute, b: ShuttleRoute) => a.name.localeCompare(b.name)

  return [...routes].sort((a, b) => {
    if (sortKey === 'nearest') {
      const d = nearestStopKm(a, user) - nearestStopKm(b, user)
      return d !== 0 && Number.isFinite(d) ? d : byName(a, b)
    }
    if (sortKey === 'soonest') {
      const d = minutesToNextDeparture(a, nowMin) - minutesToNextDeparture(b, nowMin)
      return d !== 0 && Number.isFinite(d) ? d : byName(a, b)
    }
    // live first: live (0) → estimated (1) → none (2)
    const rank = (r: ShuttleRoute) => {
      const src = busStates[r.id]?.source
      return src === 'live' ? 0 : src === 'estimated' ? 1 : 2
    }
    const d = rank(a) - rank(b)
    return d !== 0 ? d : byName(a, b)
  })
}
