import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { routeCorridor, routeNumberLabel } from '../../lib/schedule'
import type { ShuttleRiderPrefs, ShuttleRoute } from '../../types'

interface StopPickerModalProps {
  isOpen: boolean
  routes: ShuttleRoute[]
  prefs: ShuttleRiderPrefs | undefined
  saving: boolean
  onClose: () => void
  onSave: (routeId: string, stopId: string) => void
}

/** Pick the route, then the stop you wait at. */
export function StopPickerModal({ isOpen, routes, prefs, saving, onClose, onSave }: StopPickerModalProps) {
  const [routeId, setRouteId] = useState<string | null>(null)
  const [stopId, setStopId] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setRouteId(prefs?.routeId ?? routes[0]?.id ?? null)
    setStopId(prefs?.stopId ?? null)
  }, [isOpen, prefs, routes])

  const route = routes.find((r) => r.id === routeId) ?? null
  const stops = route ? [...route.stops].sort((a, b) => a.orderIndex - b.orderIndex) : []

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Your stop" maxWidth={420} sheet>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {routes.map((r) => {
            const on = r.id === routeId
            return (
              <button
                key={r.id}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setRouteId(r.id)
                  setStopId(null)
                }}
                className="shuttle-pill"
                data-on={on || undefined}
                style={on ? { background: 'var(--uc-indigo-bg)', borderColor: 'var(--uc-indigo-bdr)', color: 'var(--uc-indigo-xl)' } : undefined}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color }} />
                {routeNumberLabel(routes, r.id)}
              </button>
            )
          })}
        </div>

        {route && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{routeCorridor(route)}</span>}

        <div role="radiogroup" aria-label="Stops" style={{ display: 'flex', flexDirection: 'column' }}>
          {stops.map((stop, i) => {
            const on = stop.id === stopId
            return (
              <button
                key={stop.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setStopId(stop.id)}
                className="shuttle-stop-option"
                style={{ borderBottom: i < stops.length - 1 ? '0.5px solid var(--border-default)' : 'none' }}
              >
                <span style={{ flex: 1, fontWeight: on ? 500 : 400, color: on ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                  {stop.name}
                </span>
                {on && <Check size={15} color="var(--uc-indigo-l)" />}
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} className="driver-btn driver-btn--ghost">
            Cancel
          </button>
          <button
            type="button"
            disabled={!routeId || !stopId || saving}
            onClick={() => routeId && stopId && onSave(routeId, stopId)}
            className="driver-btn shuttle-btn-indigo"
          >
            Save stop
          </button>
        </div>
      </div>
    </Modal>
  )
}
