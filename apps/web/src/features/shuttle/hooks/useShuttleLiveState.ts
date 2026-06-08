import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { socket } from '@/lib/socket'
import { bearingDeg, estimateAlongPath } from '../lib/estimatePosition'
import type { BusState, LiveLocation, ShuttleRoute } from '../types'

/**
 * For live GPS beacons the server doesn't tell us direction, so we infer it by
 * comparing the driver's heading to the overall outbound bearing of the route
 * (first stop → last stop). If they agree within 90°, the bus is outbound.
 */
function inferDirection(route: ShuttleRoute, headingDeg: number): 'outbound' | 'inbound' {
  const stops = [...route.stops]
    .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
    .sort((a, b) => a.orderIndex - b.orderIndex)
  if (stops.length < 2) return 'outbound'
  const outboundBearing = bearingDeg(
    stops[0].lat, stops[0].lng,
    stops[stops.length - 1].lat, stops[stops.length - 1].lng,
  )
  const diff = Math.abs(((headingDeg - outboundBearing) + 540) % 360 - 180)
  return diff < 90 ? 'outbound' : 'inbound'
}

/** A real beacon is treated as "live" only while this fresh; after that we estimate. */
const BEACON_FRESH_MS = 90_000

/**
 * Single source of truth for the live map: fetches routes + real beacons, watches
 * every route over the socket, and on a 1s tick merges each route into a BusState —
 * a fresh beacon shows as `live`, otherwise the schedule estimate shows as
 * `estimated`. The server stores only real beacons; estimation is pure client math.
 */
export function useShuttleLiveState() {
  const [liveLocations, setLiveLocations] = useState<Record<string, LiveLocation>>({})
  const [now, setNow] = useState(() => new Date())
  const rafRef = useRef<number | null>(null)

  const { data: routesData, isLoading: routesLoading } = useQuery<ShuttleRoute[]>({
    queryKey: ['shuttle', 'routes'],
    queryFn: () => api.get<{ data: ShuttleRoute[] }>('/shuttle/routes').then((r) => r.data.data),
  })

  const { data: locationsData } = useQuery<LiveLocation[]>({
    queryKey: ['shuttle', 'locations'],
    queryFn: () => api.get<{ data: LiveLocation[] }>('/shuttle/locations').then((r) => r.data.data),
    refetchInterval: 30_000,
  })

  const routes = useMemo(() => routesData ?? [], [routesData])

  // Seed live beacons from REST — newer updatedAt wins.
  useEffect(() => {
    if (!locationsData) return
    setLiveLocations((prev) => {
      const next = { ...prev }
      for (const loc of locationsData) {
        const existing = prev[loc.routeId]
        if (!existing || loc.updatedAt > existing.updatedAt) next[loc.routeId] = loc
      }
      return next
    })
  }, [locationsData])

  // Watch every route over the socket; unwatch on cleanup.
  useEffect(() => {
    if (routes.length === 0) return
    const ids = routes.map((r) => r.id)
    for (const id of ids) socket.emit('shuttle:watch', { routeId: id })

    function onLocation(payload: LiveLocation) {
      setLiveLocations((prev) => ({ ...prev, [payload.routeId]: payload }))
    }
    socket.on('shuttle:location', onLocation)

    return () => {
      for (const id of ids) socket.emit('shuttle:unwatch', { routeId: id })
      socket.off('shuttle:location', onLocation)
    }
  }, [routes])

  // ~1s tick via requestAnimationFrame so estimated buses glide continuously.
  useEffect(() => {
    let last = 0
    const loop = (t: number) => {
      if (t - last >= 1000) {
        last = t
        setNow(new Date())
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const busStates = useMemo(() => {
    const result: Record<string, BusState> = {}
    const nowMs = now.getTime()

    for (const route of routes) {
      const beacon = liveLocations[route.id]
      const fresh = beacon && nowMs - Date.parse(beacon.updatedAt) < BEACON_FRESH_MS

      if (fresh) {
        result[route.id] = {
          routeId: route.id,
          lat: beacon.lat,
          lng: beacon.lng,
          headingDeg: beacon.headingDeg,
          direction: inferDirection(route, beacon.headingDeg),
          speedKmh: beacon.speedKmh,
          source: 'live',
          updatedAt: beacon.updatedAt,
        }
        continue
      }

      const est = estimateAlongPath(route, now)
      if (est) {
        result[route.id] = {
          routeId: route.id,
          lat: est.lat,
          lng: est.lng,
          headingDeg: est.headingDeg,
          direction: est.direction,
          speedKmh: null,
          source: 'estimated',
          updatedAt: null,
        }
      }
    }
    return result
  }, [routes, liveLocations, now])

  return { routes, routesLoading, busStates, now }
}
