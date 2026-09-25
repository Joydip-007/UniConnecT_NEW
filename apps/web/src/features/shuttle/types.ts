export interface ShuttleStop {
  id: string
  name: string
  orderIndex: number
  lat: number
  lng: number
}

/**
 * Loose shape of the `schedule` jsonb on a route. The API stores it as an open
 * object, so every field is optional and the estimator degrades gracefully when
 * data is missing (returns no position → the bus is simply hidden).
 */
export interface ShuttleSchedule {
  type?: 'fixed' | 'continuous'
  departures?: { outbound?: string[]; inbound?: string[] }
  outbound?: string[]
  inbound?: string[]
  operatingHours?: { start?: string; end?: string }
}

export interface ShuttleRoute {
  id: string
  name: string
  color: string
  stops: ShuttleStop[]
  schedule?: ShuttleSchedule
  estDurationMin?: number | null
  cycleMinutes?: number | null
  isActive: boolean
  frequency?: string
  operatingHours?: string
}

export interface LiveLocation {
  routeId: string
  lat: number
  lng: number
  speedKmh: number
  headingDeg: number
  updatedAt: string
}

export interface ProgressResult {
  progress: number
  nearestStopIdx: number
  nextStopIdx: number
  etaMinutes: number | null
}

/** A bus position merged from a real beacon (live) or schedule estimate. */
export interface BusState {
  routeId: string
  lat: number
  lng: number
  headingDeg: number
  direction: 'outbound' | 'inbound'
  speedKmh: number | null
  source: 'live' | 'estimated'
  updatedAt: string | null
}

/** One broadcast session — opened by Start broadcast, closed by Stop. */
export interface ShuttleShift {
  id: string
  routeId: string
  startedAt: string
  endedAt: string | null
  ridersCount: number
}

export interface ShuttleDuty {
  activeShift: ShuttleShift | null
  /** The open shift's route, else the last route this driver drove. */
  assignedRouteId: string | null
  /** Today's shifts, oldest first. */
  shifts: ShuttleShift[]
}

export interface ShuttleRiderPrefs {
  routeId: string | null
  stopId: string | null
  alertEnabled: boolean
}

export interface ShuttleNotice {
  id: string
  routeId: string | null
  routeName: string | null
  routeColor: string | null
  tone: 'disruption' | 'info'
  title: string
  detail: string | null
  expiresAt: string | null
  createdAt: string
}
