import { CheckCircle2 } from 'lucide-react'
import { haversineKm } from '../utils'
import type { StopSort } from '../lib/stopSort'
import type { ProgressResult, ShuttleRoute } from '../types'

interface StopListProps {
  route: ShuttleRoute
  hasLocation: boolean
  derived: ProgressResult
  atFinalStop: boolean
  sort: StopSort
  userLocation: { lat: number; lng: number } | null
}

/**
 * Orders the stops without losing their route index (the passed/here/next state is
 * positional). "Live first" puts the stops still ahead of the bus on top; "Nearest"
 * needs the rider's location and otherwise keeps route order.
 */
function orderStops(route: ShuttleRoute, sort: StopSort, derived: ProgressResult, hasLocation: boolean, user: StopListProps['userLocation']) {
  const indexed = route.stops.map((stop, index) => ({ stop, index }))
  if (sort === 'name') return indexed.sort((a, b) => a.stop.name.localeCompare(b.stop.name))
  if (sort === 'nearest' && user) {
    const d = (s: (typeof indexed)[number]) => haversineKm(user.lat, user.lng, s.stop.lat, s.stop.lng)
    return indexed.sort((a, b) => d(a) - d(b))
  }
  if (sort === 'live' && hasLocation) {
    const ahead = (i: number) => (i >= derived.nearestStopIdx ? 0 : 1)
    return indexed.sort((a, b) => ahead(a.index) - ahead(b.index) || a.index - b.index)
  }
  return indexed
}

export function StopList({ route, hasLocation, derived, atFinalStop, sort, userLocation }: StopListProps) {
  const rows = orderStops(route, sort, derived, hasLocation, userLocation)
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: '16px 20px',
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
          All stops
        </h3>
        <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>
          {route.stops.length} stops on this route
        </span>
      </div>

      <div>
        {rows.map(({ stop, index: i }, row) => {
          const passed = hasLocation && i < derived.nearestStopIdx
          const nearest = hasLocation && i === derived.nearestStopIdx
          const isNext =
            hasLocation && i === derived.nextStopIdx && i !== derived.nearestStopIdx && !atFinalStop
          const isLast = row === rows.length - 1

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

              {nearest && !atFinalStop && (
                <Pill
                  bg="var(--uc-indigo-bg)"
                  border="var(--uc-indigo-bdr)"
                  color="var(--uc-indigo-xl)"
                  text="Here"
                />
              )}
              {isNext && (
                <Pill
                  bg="var(--uc-orange-bg)"
                  border="var(--uc-orange-bdr)"
                  color="var(--uc-orange-l)"
                  text="Next"
                />
              )}
              {atFinalStop && nearest && (
                <Pill
                  bg="var(--uc-mint-bg)"
                  border="var(--uc-mint-bdr)"
                  color="var(--uc-mint)"
                  text="Arrived"
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Pill({ bg, border, color, text }: { bg: string; border: string; color: string; text: string }) {
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 500,
        padding: '2px 8px',
        borderRadius: 'var(--r-pill)',
        background: bg,
        border: `0.5px solid ${border}`,
        color,
        flexShrink: 0,
      }}
    >
      {text}
    </span>
  )
}
