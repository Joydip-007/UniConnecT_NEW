import { formatDistanceToNow, parseISO } from 'date-fns'
import type { ProgressResult, ShuttleStop } from './types'

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

export function calcProgressAndEta(
  lat: number,
  lng: number,
  speedKmh: number,
  stops: ShuttleStop[],
): ProgressResult {
  if (stops.length === 0) {
    return { progress: 0, nearestStopIdx: 0, nextStopIdx: 0, etaMinutes: null }
  }
  const distances = stops.map((s) => haversineKm(lat, lng, s.lat, s.lng))
  const nearestStopIdx = distances.indexOf(Math.min(...distances))
  const progress = (nearestStopIdx / Math.max(stops.length - 1, 1)) * 100
  const nextStopIdx = Math.min(nearestStopIdx + 1, stops.length - 1)
  const distToNext = haversineKm(lat, lng, stops[nextStopIdx].lat, stops[nextStopIdx].lng)
  const etaMinutes = speedKmh > 1 ? Math.max(1, Math.round((distToNext / speedKmh) * 60)) : null
  return { progress, nearestStopIdx, nextStopIdx, etaMinutes }
}

export function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true })
  } catch {
    return iso
  }
}

export function isLive(updatedAt: string): boolean {
  try {
    return Date.now() - parseISO(updatedAt).getTime() < 5 * 60 * 1000
  } catch {
    return false
  }
}
