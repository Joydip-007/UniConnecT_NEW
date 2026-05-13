import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { Bus, CheckCircle2, Clock, Gauge, MapPin } from 'lucide-react'
import { api } from '@/lib/axios'
import { socket } from '@/lib/socket'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ShuttleStop {
  id: string
  name: string
  orderIndex: number
  lat: number
  lng: number
}

interface ShuttleRoute {
  id: string
  name: string
  stops: ShuttleStop[]
  isActive: boolean
  frequency?: string
  operatingHours?: string
}

interface LiveLocation {
  routeId: string
  lat: number
  lng: number
  speedKmh: number
  headingDeg: number
  updatedAt: string
}

interface ProgressResult {
  progress: number
  nearestStopIdx: number
  nextStopIdx: number
  etaMinutes: number | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
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

function calcProgressAndEta(
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

function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true })
  } catch {
    return iso
  }
}

function isLive(updatedAt: string): boolean {
  try {
    return Date.now() - parseISO(updatedAt).getTime() < 5 * 60 * 1000
  } catch {
    return false
  }
}

// ── LiveBadge ─────────────────────────────────────────────────────────────────

function LiveBadge({ updatedAt }: { updatedAt: string | null }) {
  const live = updatedAt ? isLive(updatedAt) : false
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 9px',
        borderRadius: 'var(--r-pill)',
        fontSize: 11,
        fontWeight: 500,
        flexShrink: 0,
        background: live ? 'var(--uc-mint-bg)' : 'var(--surface-raised)',
        border: `0.5px solid ${live ? 'rgba(16,185,129,0.28)' : 'var(--border-default)'}`,
        color: live ? 'var(--uc-mint)' : 'var(--text-tertiary)',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: live ? 'var(--uc-mint)' : 'var(--text-tertiary)',
          animation: live ? 'livePulse 1.5s ease-in-out infinite' : 'none',
        }}
      />
      {live ? 'Live' : 'Offline'}
    </span>
  )
}

// ── SkeletonCard ──────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div
          style={{ height: 15, width: '45%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }}
        />
        <div
          style={{ height: 24, width: 56, background: 'var(--surface-raised)', borderRadius: 'var(--r-pill)' }}
        />
      </div>
      <div style={{ height: 5, background: 'var(--surface-raised)', borderRadius: 'var(--r-pill)' }} />
      <div style={{ display: 'flex', gap: 8 }}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{ flex: 1, height: 56, background: 'var(--surface-raised)', borderRadius: 'var(--r-md)' }}
          />
        ))}
      </div>
    </div>
  )
}

// ── ProgressTrack ─────────────────────────────────────────────────────────────

interface ProgressTrackProps {
  progress: number
  hasLocation: boolean
  firstStop: string
  lastStop: string
}

function ProgressTrack({ progress, hasLocation, firstStop, lastStop }: ProgressTrackProps) {
  const pct = Math.max(0, Math.min(100, progress))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ position: 'relative', padding: '7px 0' }}>
        {/* Track background */}
        <div
          style={{
            height: 5,
            background: 'var(--surface-raised)',
            borderRadius: 'var(--r-pill)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              background: 'var(--uc-indigo)',
              borderRadius: 'var(--r-pill)',
              transition: 'width 1200ms cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </div>
        {/* Shuttle position dot */}
        {hasLocation && (
          <div
            style={{
              position: 'absolute',
              left: `${pct}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: 'var(--surface-card)',
              border: '0.5px solid var(--uc-indigo)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'left 1200ms cubic-bezier(0.4, 0, 0.2, 1)',
              zIndex: 1,
            }}
          >
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: 'var(--uc-indigo-l)',
                animation: 'livePulse 2s ease-in-out infinite',
              }}
            />
          </div>
        )}
      </div>
      {/* Stop labels + percentage */}
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 400,
            color: 'var(--text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '38%',
          }}
        >
          {firstStop}
        </span>
        <span
          style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)', flexShrink: 0 }}
        >
          {Math.round(pct)}% complete
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 400,
            color: 'var(--text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '38%',
            textAlign: 'right',
          }}
        >
          {lastStop}
        </span>
      </div>
    </div>
  )
}

// ── StatBox ───────────────────────────────────────────────────────────────────

function StatBox({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div
      style={{
        background: 'var(--surface-raised)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-md)',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {icon}
        <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)' }}>{label}</span>
      </div>
      <span
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </span>
    </div>
  )
}

// ── ShuttlePage ───────────────────────────────────────────────────────────────

export default function ShuttlePage() {
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
  const [liveLocations, setLiveLocations] = useState<Record<string, LiveLocation>>({})

  const { data: routesData, isLoading: routesLoading } = useQuery<ShuttleRoute[]>({
    queryKey: ['shuttle', 'routes'],
    queryFn: () =>
      api.get<{ data: ShuttleRoute[] }>('/shuttle/routes').then((r) => r.data.data),
  })

  const { data: locationsData } = useQuery<LiveLocation[]>({
    queryKey: ['shuttle', 'locations'],
    queryFn: () =>
      api.get<{ data: LiveLocation[] }>('/shuttle/locations').then((r) => r.data.data),
    refetchInterval: 30_000,
  })

  const routes = useMemo(() => routesData ?? [], [routesData])

  // Auto-select first route when data arrives
  useEffect(() => {
    if (routes.length > 0 && !selectedRouteId) {
      setSelectedRouteId(routes[0].id)
    }
  }, [routes, selectedRouteId])

  // Seed live locations from REST — newer updatedAt wins over older socket data
  useEffect(() => {
    if (!locationsData) return
    setLiveLocations((prev) => {
      const next = { ...prev }
      for (const loc of locationsData) {
        const existing = prev[loc.routeId]
        if (!existing || loc.updatedAt > existing.updatedAt) {
          next[loc.routeId] = loc
        }
      }
      return next
    })
  }, [locationsData])

  // Socket: watch selected route, unwatch on cleanup / route change
  useEffect(() => {
    if (!selectedRouteId) return

    socket.emit('shuttle:watch', { routeId: selectedRouteId })

    function onLocation(payload: LiveLocation) {
      if (payload.routeId !== selectedRouteId) return
      setLiveLocations((prev) => ({ ...prev, [payload.routeId]: payload }))
    }

    socket.on('shuttle:location', onLocation)

    return () => {
      socket.emit('shuttle:unwatch', { routeId: selectedRouteId })
      socket.off('shuttle:location', onLocation)
    }
  }, [selectedRouteId])

  const selectedRoute = routes.find((r) => r.id === selectedRouteId) ?? null
  const currentLocation = selectedRouteId ? (liveLocations[selectedRouteId] ?? null) : null

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

  const nextStop = selectedRoute?.stops[derived.nextStopIdx] ?? null

  const etaText = !currentLocation
    ? '—'
    : atFinalStop
      ? 'At final stop'
      : currentLocation.speedKmh === 0
        ? 'Stopped'
        : derived.etaMinutes !== null
          ? `~${derived.etaMinutes} min`
          : '—'

  const speedText = currentLocation ? `${Math.round(currentLocation.speedKmh)} km/h` : '—'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Route selector tabs */}
      {!routesLoading && routes.length > 0 && (
        <nav
          style={{
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-lg)',
            padding: '4px 6px',
            display: 'flex',
            gap: 2,
            overflowX: 'auto',
          }}
        >
          {routes.map((route) => {
            const active = selectedRouteId === route.id
            return (
              <button
                key={route.id}
                type="button"
                onClick={() => setSelectedRouteId(route.id)}
                style={{
                  flex: '1 0 auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  fontSize: 13,
                  fontWeight: active ? 500 : 400,
                  borderRadius: 'var(--r-pill)',
                  border: 'none',
                  cursor: 'pointer',
                  background: active ? 'var(--uc-indigo-bg)' : 'transparent',
                  color: active ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
                  transition: 'background 150ms, color 150ms',
                  whiteSpace: 'nowrap',
                }}
              >
                <Bus size={13} strokeWidth={1.5} />
                {route.name}
              </button>
            )
          })}
        </nav>
      )}

      {/* Loading skeletons */}
      {routesLoading && (
        <>
          <SkeletonCard />
          <SkeletonCard />
        </>
      )}

      {/* No active routes */}
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
          <p
            style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}
          >
            No active routes
          </p>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)' }}>
            Shuttle service is not available at this time.
          </p>
        </div>
      )}

      {/* Live tracker card */}
      {selectedRoute && (
        <div
          style={{
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-lg)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}
              >
                <Bus
                  size={15}
                  strokeWidth={1.5}
                  color="var(--uc-indigo)"
                  style={{ flexShrink: 0 }}
                />
                <h2
                  style={{
                    margin: 0,
                    fontSize: 15,
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {selectedRoute.name}
                </h2>
              </div>
              {(selectedRoute.frequency || selectedRoute.operatingHours) && (
                <p
                  style={{ margin: 0, fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}
                >
                  {[selectedRoute.frequency, selectedRoute.operatingHours]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
            </div>
            <LiveBadge updatedAt={currentLocation?.updatedAt ?? null} />
          </div>

          {/* No location state */}
          {!currentLocation && (
            <div
              style={{
                padding: '16px',
                background: 'var(--surface-raised)',
                borderRadius: 'var(--r-md)',
                textAlign: 'center',
              }}
            >
              <p
                style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)' }}
              >
                Location unavailable — shuttle may be offline
              </p>
            </div>
          )}

          {/* Animated progress track */}
          {selectedRoute.stops.length > 0 && (
            <ProgressTrack
              progress={derived.progress}
              hasLocation={currentLocation !== null}
              firstStop={selectedRoute.stops[0].name}
              lastStop={selectedRoute.stops[selectedRoute.stops.length - 1].name}
            />
          )}

          {/* Stats row */}
          {currentLocation && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <StatBox
                icon={<Gauge size={12} strokeWidth={1.5} color="var(--text-tertiary)" />}
                label="Speed"
                value={speedText}
              />
              <StatBox
                icon={<MapPin size={12} strokeWidth={1.5} color="var(--text-tertiary)" />}
                label="Next stop"
                value={atFinalStop ? 'Final stop' : (nextStop?.name ?? '—')}
              />
              <StatBox
                icon={<Clock size={12} strokeWidth={1.5} color="var(--text-tertiary)" />}
                label="ETA"
                value={etaText}
              />
            </div>
          )}

          {/* Updated timestamp */}
          {currentLocation && (
            <p
              style={{
                margin: 0,
                fontSize: 11,
                fontWeight: 400,
                color: 'var(--text-tertiary)',
                textAlign: 'right',
              }}
            >
              Updated {relativeTime(currentLocation.updatedAt)}
            </p>
          )}
        </div>
      )}

      {/* Stops list */}
      {selectedRoute && selectedRoute.stops.length > 0 && (
        <div
          style={{
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-lg)',
            padding: '16px 20px',
          }}
        >
          <div style={{ marginBottom: 12 }}>
            <h3
              style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}
            >
              All stops
            </h3>
            <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)' }}>
              {selectedRoute.stops.length} stops on this route
            </span>
          </div>

          <div>
            {selectedRoute.stops.map((stop, i) => {
              const passed = currentLocation !== null && i < derived.nearestStopIdx
              const nearest = currentLocation !== null && i === derived.nearestStopIdx
              const isNext =
                currentLocation !== null &&
                i === derived.nextStopIdx &&
                i !== derived.nearestStopIdx &&
                !atFinalStop
              const isLast = i === selectedRoute.stops.length - 1

              return (
                <div
                  key={stop.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 0',
                    borderBottom: isLast ? 'none' : '0.5px solid var(--border-default)',
                  }}
                >
                  {/* Status indicator */}
                  <div
                    style={{
                      width: 20,
                      display: 'flex',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {passed ? (
                      <CheckCircle2 size={14} strokeWidth={1.5} color="var(--uc-indigo)" />
                    ) : (
                      <div
                        style={{
                          width: nearest ? 12 : 8,
                          height: nearest ? 12 : 8,
                          borderRadius: '50%',
                          background: nearest ? 'var(--uc-indigo-l)' : 'transparent',
                          border: `0.5px solid ${nearest ? 'var(--uc-indigo)' : 'var(--border-default)'}`,
                          transition: 'background 300ms, border-color 300ms',
                        }}
                      />
                    )}
                  </div>

                  {/* Stop name */}
                  <span
                    style={{
                      flex: 1,
                      fontSize: 13,
                      fontWeight: nearest || isNext ? 500 : 400,
                      color: passed
                        ? 'var(--text-tertiary)'
                        : nearest || isNext
                          ? 'var(--text-primary)'
                          : 'var(--text-secondary)',
                      transition: 'color 300ms',
                    }}
                  >
                    {stop.name}
                  </span>

                  {/* Status badge */}
                  {nearest && !atFinalStop && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        padding: '2px 8px',
                        borderRadius: 'var(--r-pill)',
                        background: 'var(--uc-indigo-bg)',
                        border: '0.5px solid var(--uc-indigo-bdr)',
                        color: 'var(--uc-indigo-xl)',
                        flexShrink: 0,
                      }}
                    >
                      Here
                    </span>
                  )}
                  {isNext && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        padding: '2px 8px',
                        borderRadius: 'var(--r-pill)',
                        background: 'var(--uc-orange-bg)',
                        border: '0.5px solid var(--uc-orange-bdr)',
                        color: 'var(--uc-orange-l)',
                        flexShrink: 0,
                      }}
                    >
                      Next
                    </span>
                  )}
                  {atFinalStop && nearest && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        padding: '2px 8px',
                        borderRadius: 'var(--r-pill)',
                        background: 'var(--uc-mint-bg)',
                        border: '0.5px solid rgba(16,185,129,0.28)',
                        color: 'var(--uc-mint)',
                        flexShrink: 0,
                      }}
                    >
                      Arrived
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
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
