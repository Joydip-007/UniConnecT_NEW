import { useEffect, useMemo, useState } from 'react'
import { Bus, TriangleAlert } from 'lucide-react'
import {
  LiveTrackerCard,
  RouteTabs,
  ShuttleControls,
  ShuttleMap,
  SkeletonCard,
  StopList,
  calcProgressAndEta,
  useShuttleLiveState,
  type LiveLocation,
  type ProgressResult,
} from '@/features/shuttle'
import type { StopSort } from '@/features/shuttle/lib/stopSort'
import { ShuttleRightRail } from '@/features/shuttle/components/rider/ShuttleRightRail'
import { YourStopCard } from '@/features/shuttle/components/rider/YourStopCard'
import { StopPickerModal } from '@/features/shuttle/components/rider/StopPickerModal'
import { useRiderStop, useSaveRiderStop, useShuttleNotices } from '@/features/shuttle/hooks/useRiderStop'
import { useStopAlert, useYourStop } from '@/features/shuttle/hooks/useYourStop'
import { minutesOfDay, routeNumberLabel } from '@/features/shuttle/lib/schedule'
import { usePageRails } from '@/stores/pageRailStore'

export default function ShuttlePage() {
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
  const [sort, setSort] = useState<StopSort>('nearest')
  const [view, setView] = useState<'map' | 'list'>('map')
  const [liveOnly, setLiveOnly] = useState(false)
  const [follow, setFollow] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)

  const { routes, routesLoading, routesError, refetchRoutes, busStates, now } = useShuttleLiveState()
  const { data: prefs, isPending: prefsPending } = useRiderStop()
  const saveStop = useSaveRiderStop()
  const { data: notices } = useShuttleNotices()

  // Ask for the user's location once — powers "Nearest to me" and the map dot.
  useEffect(() => {
    if (!('geolocation' in navigator)) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setUserLocation(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    )
  }, [])

  // "Live only" narrows the tabs to routes with a real beacon, when any exist.
  const visibleRoutes = useMemo(() => {
    if (!liveOnly) return routes
    const live = routes.filter((r) => busStates[r.id]?.source === 'live')
    return live.length ? live : routes
  }, [routes, busStates, liveOnly])

  // Start on the rider's own route when they have one saved.
  useEffect(() => {
    if (selectedRouteId && visibleRoutes.some((r) => r.id === selectedRouteId)) return
    if (prefsPending) return
    const preferred = visibleRoutes.find((r) => r.id === prefs?.routeId)
    if (visibleRoutes.length > 0) setSelectedRouteId((preferred ?? visibleRoutes[0]).id)
  }, [visibleRoutes, selectedRouteId, prefs?.routeId, prefsPending])

  const selectedRoute = routes.find((r) => r.id === selectedRouteId) ?? null
  const selectedBus = selectedRouteId ? (busStates[selectedRouteId] ?? null) : null
  const shownBus = selectedBus && (!liveOnly || selectedBus.source === 'live') ? selectedBus : null

  const currentLocation = useMemo<LiveLocation | null>(
    () =>
      shownBus
        ? {
            routeId: shownBus.routeId,
            lat: shownBus.lat,
            lng: shownBus.lng,
            speedKmh: shownBus.speedKmh ?? 0,
            headingDeg: shownBus.headingDeg,
            updatedAt: shownBus.updatedAt ?? '',
          }
        : null,
    [shownBus],
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

  const stopInfo = useYourStop(routes, busStates, now)
  useStopAlert(stopInfo)

  function toggleAlert(next: boolean) {
    if (!prefs) return
    if (next && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Notification.requestPermission()
    }
    saveStop.mutate({ ...prefs, alertEnabled: next })
  }

  // The rail re-renders once a minute, not on every one-second tick of the bus.
  const nowMin = minutesOfDay(now)
  const { eta, live, runningAt, afterAt, alertEnabled, stopName, route: stopRoute } = stopInfo
  const rightRail = useMemo(
    () =>
      routes.length > 0 ? (
        <ShuttleRightRail
          routes={routes}
          info={{ route: stopRoute, stopName, eta, live, runningAt, afterAt, alertEnabled }}
          nowMin={nowMin}
          onChangeStop={() => setPickerOpen(true)}
          onToggleAlert={toggleAlert}
        />
      ) : null,
    // toggleAlert closes over prefs, which the deps below already track.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [routes, stopRoute, stopName, eta, live, runningAt, afterAt, alertEnabled, nowMin, prefs],
  )
  usePageRails(null, rightRail)

  if (routesLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  if (routesError) {
    return (
      <div className="shuttle-empty">
        <Bus size={28} strokeWidth={1} color="var(--text-tertiary)" />
        <div>
          <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
            Couldn't reach the shuttle service
          </p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>Check your connection and try again.</p>
        </div>
        <button type="button" onClick={() => refetchRoutes()} className="driver-btn shuttle-btn-indigo">
          Retry
        </button>
      </div>
    )
  }

  if (routes.length === 0) {
    return (
      <div className="shuttle-empty">
        <Bus size={28} strokeWidth={1} color="var(--text-tertiary)" />
        <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>No active routes</p>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>Shuttle service is not available at this time.</p>
      </div>
    )
  }

  const topNotice = notices?.find((n) => n.tone === 'disruption') ?? notices?.[0]
  const legend = selectedRoute
    ? [
        {
          label: `${routeNumberLabel(routes, selectedRoute.id)}${shownBus?.source === 'live' ? ', live' : ''}`,
          color: selectedRoute.color,
        },
        ...(routes.length > 1 ? [{ label: 'Other routes', color: 'var(--text-tertiary)' }] : []),
        ...(userLocation ? [{ label: 'You', color: 'var(--uc-orange)' }] : []),
      ]
    : []

  return (
    <div className="shuttle-page">
      <div className="shuttle-slot-controls">
        <ShuttleControls
          view={view}
          onViewChange={setView}
          liveOnly={liveOnly}
          onLiveOnlyChange={setLiveOnly}
          sort={sort}
          onSortChange={setSort}
        />
      </div>

      <div className="shuttle-slot-tabs">
        <RouteTabs routes={visibleRoutes} busStates={busStates} selectedRouteId={selectedRouteId} onSelect={setSelectedRouteId} />
      </div>

      {view === 'map' && (
        <div className="shuttle-slot-map shuttle-map-frame">
          <ShuttleMap
            routes={visibleRoutes}
            busStates={busStates}
            selectedRouteId={selectedRouteId}
            follow={follow}
            onToggleFollow={() => setFollow((f) => !f)}
            liveOnly={liveOnly}
            userLocation={userLocation}
            onSelectRoute={setSelectedRouteId}
            overlay={
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {legend.map((l) => (
                  <span key={l.label} className="shuttle-map-chip">
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.color }} />
                    {l.label}
                  </span>
                ))}
              </div>
            }
          />
        </div>
      )}

      {selectedRoute && (
        <div className="shuttle-slot-tracker">
          <LiveTrackerCard
            route={selectedRoute}
            currentLocation={currentLocation}
            derived={derived}
            atFinalStop={atFinalStop}
            source={shownBus?.source ?? 'live'}
          />
        </div>
      )}

      {/* Phones drop the right rail, so its two most useful parts sit under the tracker. */}
      <div className="shuttle-slot-mobile-extras">
        <YourStopCard info={stopInfo} routes={routes} variant="compact" onChange={() => setPickerOpen(true)} onToggleAlert={toggleAlert} />
        {topNotice && (
          <div className="shuttle-notice-banner" data-tone={topNotice.tone}>
            <TriangleAlert size={15} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text-primary)' }}>
              {topNotice.title}
              {topNotice.detail ? `, ${topNotice.detail.charAt(0).toLowerCase()}${topNotice.detail.slice(1)}` : ''}
            </span>
          </div>
        )}
      </div>

      {view === 'list' && selectedRoute && selectedRoute.stops.length > 0 && (
        <div className="shuttle-slot-list">
          <StopList
            route={selectedRoute}
            hasLocation={currentLocation !== null}
            derived={derived}
            atFinalStop={atFinalStop}
            sort={sort}
            userLocation={userLocation}
          />
        </div>
      )}

      <StopPickerModal
        isOpen={pickerOpen}
        routes={routes}
        prefs={prefs}
        saving={saveStop.isPending}
        onClose={() => setPickerOpen(false)}
        onSave={(routeId, stopId) =>
          saveStop.mutate(
            { routeId, stopId, alertEnabled: prefs?.alertEnabled ?? true },
            { onSuccess: () => setPickerOpen(false) },
          )
        }
      />
    </div>
  )
}
