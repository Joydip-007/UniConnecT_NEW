import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useRiderStop } from './useRiderStop'
import { etaToStop, formatMinutes, minutesOfDay, nextDeparture, runningDeparture } from '../lib/schedule'
import type { BusState, ShuttleRoute } from '../types'

/** The design's "Alert me 5 min before". */
export const STOP_ALERT_MINUTES = 5

export interface YourStopInfo {
  route: ShuttleRoute | null
  stopName: string | null
  /** Minutes until the bus reaches the stop, or null when none is approaching. */
  eta: number | null
  /** True when the ETA comes from a real beacon rather than the timetable. */
  live: boolean
  runningAt: number | null
  afterAt: number | null
  alertEnabled: boolean
}

/**
 * Everything "Your stop" shows — the rider's saved stop, when the bus reaches it and
 * the trip after — computed once on the page and handed to both the desktop rail and
 * the mobile card, so the two never disagree.
 */
export function useYourStop(routes: ShuttleRoute[], busStates: Record<string, BusState>, now: Date): YourStopInfo {
  const { data: prefs } = useRiderStop()
  const route = routes.find((r) => r.id === prefs?.routeId) ?? null
  const stop = route?.stops.find((s) => s.id === prefs?.stopId) ?? null
  const bus = route ? busStates[route.id] : undefined
  const nowMin = minutesOfDay(now)
  const running = route ? runningDeparture(route, nowMin) : null
  const after = route ? nextDeparture(route, running ? running.at + 1 : nowMin) : null

  return {
    route,
    stopName: stop?.name ?? null,
    eta: route && stop && bus ? etaToStop(route, bus, stop.id) : null,
    live: bus?.source === 'live',
    runningAt: running?.at ?? null,
    afterAt: after?.at ?? null,
    alertEnabled: prefs?.alertEnabled ?? true,
  }
}

/** Fires once per trip when the bus comes within five minutes of the rider's stop. */
export function useStopAlert(info: YourStopInfo) {
  const fired = useRef<string | null>(null)
  const { route, stopName, eta, runningAt, alertEnabled } = info

  useEffect(() => {
    if (!alertEnabled || !route || !stopName || eta === null || eta > STOP_ALERT_MINUTES) return
    const key = `${route.id}:${stopName}:${runningAt ?? 'live'}`
    if (fired.current === key) return
    fired.current = key

    const text = `Your bus reaches ${stopName} in about ${eta} min`
    const detail = runningAt !== null ? `${formatMinutes(runningAt)} trip` : undefined
    toast(text, { description: detail })
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('Shuttle arriving', { body: text })
    }
  }, [alertEnabled, route, stopName, eta, runningAt])
}
