import { useEffect, useMemo, useState } from 'react'
import { Bus } from 'lucide-react'
import {
  LiveTrackerCard,
  RouteTabs,
  SkeletonCard,
  StopList,
  calcProgressAndEta,
  useShuttleData,
  type ProgressResult,
} from '@/features/shuttle'

export default function ShuttlePage() {
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
  const { routes, routesLoading, currentLocation } = useShuttleData(selectedRouteId)

  useEffect(() => {
    if (routes.length > 0 && !selectedRouteId) {
      setSelectedRouteId(routes[0].id)
    }
  }, [routes, selectedRouteId])

  const selectedRoute = routes.find((r) => r.id === selectedRouteId) ?? null

  const derived = useMemo((): ProgressResult => {
    if (!selectedRoute || selectedRoute.stops.length === 0 || !currentLocation) {
      return { progress: 0, nearestStopIdx: 0, nextStopIdx: 0, etaMinutes: null }
    }
    return calcProgressAndEta(
      currentLocation.lat,
      currentLocation.lng,
      currentLocation.speedKmh,
      selectedRoute.stops,
    )
  }, [selectedRoute, currentLocation])

  const atFinalStop =
    currentLocation !== null &&
    selectedRoute !== null &&
    selectedRoute.stops.length > 0 &&
    derived.nearestStopIdx === selectedRoute.stops.length - 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {!routesLoading && routes.length > 0 && (
        <RouteTabs routes={routes} selectedRouteId={selectedRouteId} onSelect={setSelectedRouteId} />
      )}

      {routesLoading && (
        <>
          <SkeletonCard />
          <SkeletonCard />
        </>
      )}

      {!routesLoading && routes.length === 0 && (
        <div
          style={{
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-lg)',
            padding: '48px 24px',
            textAlign: 'center',
          }}
        >
          <Bus
            size={28}
            strokeWidth={1}
            color="var(--text-tertiary)"
            style={{ display: 'block', margin: '0 auto 12px' }}
          />
          <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
            No active routes
          </p>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)' }}>
            Shuttle service is not available at this time.
          </p>
        </div>
      )}

      {selectedRoute && (
        <LiveTrackerCard
          route={selectedRoute}
          currentLocation={currentLocation}
          derived={derived}
          atFinalStop={atFinalStop}
        />
      )}

      {selectedRoute && selectedRoute.stops.length > 0 && (
        <StopList
          route={selectedRoute}
          hasLocation={currentLocation !== null}
          derived={derived}
          atFinalStop={atFinalStop}
        />
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
