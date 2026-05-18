export interface ShuttleStop {
  id: string
  name: string
  orderIndex: number
  lat: number
  lng: number
}

export interface ShuttleRoute {
  id: string
  name: string
  stops: ShuttleStop[]
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
