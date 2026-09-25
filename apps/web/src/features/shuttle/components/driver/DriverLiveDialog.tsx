import { useState } from 'react'
import { List, Map as MapIcon, X } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { ShuttleMap } from '../ShuttleMap'
import { calcProgressAndEta } from '../../utils'
import { routeCorridor, routeNumberLabel } from '../../lib/schedule'
import type { BusState, ShuttleRoute } from '../../types'

interface DriverLiveDialogProps {
  route: ShuttleRoute | null
  routes: ShuttleRoute[]
  busStates: Record<string, BusState>
  mine: boolean
  broadcasting: boolean
  onClose: () => void
}

type StopState = 'passed' | 'here' | 'next' | 'ahead'

/** "What students see": one route's map or stop list, exactly as the rider page draws it. */
export function DriverLiveDialog({ route, routes, busStates, mine, broadcasting, onClose }: DriverLiveDialogProps) {
  const [view, setView] = useState<'map' | 'list'>('map')
  const bus = route ? busStates[route.id] : undefined
  // A driver who is not broadcasting sees their route the way riders do: offline.
  const shownBus = mine && !broadcasting ? undefined : bus?.source === 'live' ? bus : undefined
  const stops = route ? [...route.stops].sort((a, b) => a.orderIndex - b.orderIndex) : []
  const derived =
    shownBus && stops.length ? calcProgressAndEta(shownBus.lat, shownBus.lng, shownBus.speedKmh ?? 0, stops) : null

  const label = route ? `${routeNumberLabel(routes, route.id)}, ${routeCorridor(route)}` : ''
  const sub = mine
    ? broadcasting
      ? `${label} · your bus, as riders see it`
      : `${label} · not broadcasting, riders see this route as offline`
    : `${label} · ${shownBus ? 'another driver is live' : 'no driver broadcasting'}`

  function stateOf(i: number): StopState | null {
    if (!derived) return null
    if (i < derived.nearestStopIdx) return 'passed'
    if (i === derived.nearestStopIdx) return 'here'
    if (i === derived.nextStopIdx) return 'next'
    return 'ahead'
  }

  return (
    <Modal isOpen={route !== null} onClose={onClose} title="Shuttle live" frame="panel" panelWidth={680} sheet>
      <div className="driver-live-dialog">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>Shuttle live</span>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{sub}</span>
          </span>
          <button type="button" onClick={onClose} aria-label="Close" className="driver-icon-btn">
            <X size={18} />
          </button>
        </div>

        <div className="shuttle-segment" role="tablist" aria-label="View">
          {(
            [
              { v: 'map', label: 'Map', Icon: MapIcon },
              { v: 'list', label: 'List', Icon: List },
            ] as const
          ).map(({ v, label: text, Icon }) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className="shuttle-segment-btn"
              data-on={view === v || undefined}
            >
              <Icon size={14} />
              {text}
            </button>
          ))}
        </div>

        {route && view === 'map' && (
          <div className="driver-live-map">
            <ShuttleMap
              routes={[route]}
              busStates={shownBus ? { [route.id]: shownBus } : {}}
              selectedRouteId={route.id}
              follow={false}
              liveOnly
              userLocation={null}
              onSelectRoute={() => undefined}
              controls={false}
              overlay={
                <span className="shuttle-map-chip" style={{ color: 'var(--uc-cyan)' }}>
                  <span className="shuttle-live-dot" />
                  What students see
                </span>
              }
            />
          </div>
        )}

        {route && view === 'list' && (
          <div className="driver-card driver-rows-card" style={{ padding: '4px 16px' }}>
            {stops.map((stop, i) => {
              const state = stateOf(i)
              const fill =
                state === 'passed' ? 'var(--surface-hover)' : state === 'here' ? 'var(--uc-orange)' : 'var(--surface-card)'
              const ring =
                state === 'next' ? 'var(--uc-cyan)' : state === 'passed' ? 'var(--border-hover)' : route.color
              const meta =
                state === 'passed'
                  ? 'Passed'
                  : state === 'here'
                    ? mine ? 'You are here' : 'Bus is here'
                    : state === 'next'
                      ? derived?.etaMinutes ? `Next · ~${derived.etaMinutes} min` : 'Next'
                      : state === 'ahead' ? 'Ahead' : ''
              return (
                <div
                  key={stop.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '11px 0',
                    borderBottom: i < stops.length - 1 ? '0.5px solid var(--border-default)' : 'none',
                  }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: fill, border: `2px solid ${ring}` }} />
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 13,
                      fontWeight: state === 'here' || state === 'next' ? 500 : 400,
                      color: state === 'passed' ? 'var(--text-tertiary)' : 'var(--text-primary)',
                    }}
                  >
                    {stop.name}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      flexShrink: 0,
                      color: state === 'here' ? 'var(--uc-orange-l)' : state === 'next' ? 'var(--uc-cyan)' : 'var(--text-tertiary)',
                    }}
                  >
                    {meta}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Modal>
  )
}
