import { ChevronRight, Map as MapIcon } from 'lucide-react'
import type { BusState, ShuttleRoute } from '../../types'
import { routeCorridor, routeNumberLabel } from '../../lib/schedule'

interface LiveTabProps {
  routes: ShuttleRoute[]
  busStates: Record<string, BusState>
  myRouteId: string | null
  broadcasting: boolean
  onOpen: (routeId: string | null) => void
}

type LiveRowState = 'mine' | 'live' | 'offline'

function liveRowState(route: ShuttleRoute, busStates: Record<string, BusState>, myRouteId: string | null, broadcasting: boolean): LiveRowState {
  if (broadcasting && route.id === myRouteId) return 'mine'
  return busStates[route.id]?.source === 'live' ? 'live' : 'offline'
}

const ROW_TONES: Record<LiveRowState, { status: string; note: string; bg: string; bdr: string; fg: string }> = {
  mine: { status: 'You', note: 'You are broadcasting this route', bg: 'var(--uc-orange-bg)', bdr: 'var(--uc-orange-bdr)', fg: 'var(--uc-orange-l)' },
  live: { status: 'Live', note: 'Another driver is live', bg: 'var(--uc-cyan-bg)', bdr: 'var(--uc-cyan-bdr)', fg: 'var(--uc-cyan)' },
  offline: { status: 'Offline', note: 'No driver broadcasting', bg: 'transparent', bdr: 'var(--border-default)', fg: 'var(--text-tertiary)' },
}

/** Every route's live state, as riders see it. A row opens that route's map and stops. */
export function LiveTab({ routes, busStates, myRouteId, broadcasting, onOpen }: LiveTabProps) {
  return (
    <>
      <h1 className="driver-h1">Shuttle live</h1>
      <section className="driver-card driver-rows-card">
        {routes.length === 0 && (
          <p style={{ margin: '12px 0', fontSize: 13, color: 'var(--text-tertiary)' }}>No routes available.</p>
        )}
        {routes.map((route, i) => {
          const tone = ROW_TONES[liveRowState(route, busStates, myRouteId, broadcasting)]
          return (
            <button
              key={route.id}
              type="button"
              onClick={() => onOpen(route.id)}
              className="driver-live-row"
              style={{ borderBottom: i < routes.length - 1 ? '0.5px solid var(--border-default)' : 'none' }}
            >
              <span style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: route.color }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="driver-row-title">
                  {routeNumberLabel(routes, route.id)}, {routeCorridor(route)}
                </span>
                <span className="driver-row-meta">{tone.note}</span>
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  padding: '2px 10px',
                  borderRadius: 'var(--r-pill)',
                  flexShrink: 0,
                  background: tone.bg,
                  border: `0.5px solid ${tone.bdr}`,
                  color: tone.fg,
                }}
              >
                {tone.status}
              </span>
              <ChevronRight size={16} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
            </button>
          )
        })}
      </section>
      <button type="button" onClick={() => onOpen(null)} className="driver-btn driver-btn--ghost driver-btn--fit">
        <MapIcon size={15} />
        Open map and list
      </button>
    </>
  )
}
