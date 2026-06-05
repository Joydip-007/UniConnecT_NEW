import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/axios'

export type BroadcastStatus = 'idle' | 'locating' | 'broadcasting' | 'denied' | 'error'

export interface DriverFix {
  lat: number
  lng: number
  at: number
}

/** Minimum gap between beacon POSTs while broadcasting. */
const POST_INTERVAL_MS = 10_000

/**
 * Streams the driver's device GPS to POST /shuttle/locations while `active`.
 * Uses watchPosition for continuous fixes but throttles network writes to one
 * every ~10s. Reports permission-denied/error states for the UI to surface.
 */
export function useDriverBroadcast(routeId: string | null, active: boolean) {
  const [status, setStatus] = useState<BroadcastStatus>('idle')
  const [lastFix, setLastFix] = useState<DriverFix | null>(null)
  const watchId = useRef<number | null>(null)
  const lastSent = useRef(0)

  useEffect(() => {
    if (!active || !routeId) {
      setStatus('idle')
      return
    }
    if (!('geolocation' in navigator)) {
      setStatus('error')
      return
    }

    setStatus('locating')
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed, heading } = pos.coords
        setLastFix({ lat: latitude, lng: longitude, at: Date.now() })
        setStatus('broadcasting')

        const now = Date.now()
        if (now - lastSent.current < POST_INTERVAL_MS) return
        lastSent.current = now

        const speedKmh =
          speed != null && speed >= 0 ? Math.min(999.99, Math.round(speed * 3.6 * 100) / 100) : null
        const headingDeg =
          heading != null && !Number.isNaN(heading)
            ? Math.min(359.99, Math.max(0, Math.round(heading * 100) / 100))
            : null

        api
          .post('/shuttle/locations', {
            route_id: routeId,
            lat: latitude,
            lng: longitude,
            speed_kmh: speedKmh,
            heading_deg: headingDeg,
          })
          .catch(() => setStatus('error'))
      },
      (err) => {
        setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'error')
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 },
    )

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current)
        watchId.current = null
      }
    }
  }, [routeId, active])

  return { status, lastFix }
}
