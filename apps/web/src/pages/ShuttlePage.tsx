import { useEffect, useMemo, useState } from 'react'
import { Bus } from 'lucide-react'
import {
  LiveTrackerCard,
  RouteTabs,
  ShuttleControls,
  ShuttleMap,
  SkeletonCard,
  StopList,
  calcProgressAndEta,
  sortRoutes,
  useShuttleLiveState,
  type LiveLocation,
  type ProgressResult,
  type SortKey,
} from '@/features/shuttle'

export default function ShuttlePage() {
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('nearest')
  const [view, setView] = useState<'map' | 'list'>('map')
  const [liveOnly, setLiveOnly] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)

  const { routes, routesLoading, busStates, now } = useShuttleLiveState()

  // Ask for the user's location once — powers "Nearest to me" sorting + the map dot.
  useEffect(() => {
    if (!('geolocation' in navigator)) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setUserLocation(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    )
  }, [])

  const sortedRoutes = useMemo(
    () => sortRoutes(routes, sortKey, busStates, userLocation, now),
    [routes, sortKey, busStates, userLocation, now],
  )

  useEffect(() => {
    if (sortedRoutes.length > 0 && !selectedRouteId) setSelectedRouteId(sortedRoutes[0].id)
  }, [sortedRoutes, selectedRouteId])

  const selectedRoute = routes.find((r) => r.id === selectedRouteId) ?? null
  const selectedBus = selectedRouteId ? (busStates[selectedRouteId] ?? null) : null

  const currentLocation = useMemo<LiveLocation | null>(
    () =>
      selectedBus
        ? {
            routeId: selectedBus.routeId,
            lat: selectedBus.lat,
            lng: selectedBus.lng,
            speedKmh: selectedBus.speedKmh ?? 0,
            headingDeg: selectedBus.headingDeg,
            updatedAt: selectedBus.updatedAt ?? '',
          }
        : null,
    [selectedBus],
  )

  const derived = useMemo((): ProgressResult => {
    if (!selectedRoute || selectedRoute.stops.length === 0 || !currentLocation) {
      return { progress: 0, nearestStopIdx: 0, nextStopIdx: 0, etaMinutes: null }
    }
    return calcProgressAndEta(currentLocation.lat, currentLocation.lng, currentLocation.speedKmh, selectedRoute.stops)
  }, [selectedRoute, currentLocation])

  const atFinalStop =
    currentLocation !== null &&
    selectedRoute !== null &&
    selectedRoute.stops.length > 0 &&
    derived.nearestStopIdx === selectedRoute.stops.length - 1

  if (routesLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  if (routes.length === 0) {
    return (
      <div
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: '48px 24px',
          textAlign: 'center',
        }}
      >
        <Bus size={28} strokeWidth={1} color="var(--text-tertiary)" style={{ display: 'block', margin: '0 auto 12px' }} />
        <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>No active routes</p>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)' }}>
          Shuttle service is not available at this time.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <ShuttleControls
        sortKey={sortKey}
        onSortChange={setSortKey}
        view={view}
        onViewChange={setView}
        liveOnly={liveOnly}
        onLiveOnlyChange={setLiveOnly}
        focusMode={focusMode}
        onFocusModeChange={setFocusMode}
      />

      <RouteTabs routes={sortedRoutes} selectedRouteId={selectedRouteId} onSelect={setSelectedRouteId} />

      {view === 'map' && (
        <div style={{ height: 460 }}>
          <ShuttleMap
            routes={sortedRoutes}
            busStates={busStates}
            selectedRouteId={selectedRouteId}
            focusMode={focusMode}
            liveOnly={liveOnly}
            userLocation={userLocation}
            onSelectRoute={setSelectedRouteId}
          />
        </div>
      )}

      {selectedRoute && (
        <LiveTrackerCard
          route={selectedRoute}
          currentLocation={currentLocation}
          derived={derived}
          atFinalStop={atFinalStop}
          source={selectedBus?.source ?? 'live'}
        />
      )}

      {view === 'list' && selectedRoute && selectedRoute.stops.length > 0 && (
        <StopList route={selectedRoute} hasLocation={currentLocation !== null} derived={derived} atFinalStop={atFinalStop} />
      )}

      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
