import { Lock, Map as MapIcon, MapPin, Minus, Plus, Radio } from 'lucide-react'
import type { BroadcastStatus, DriverFix } from '../../hooks/useDriverBroadcast'
import type { ShuttleRoute, ShuttleShift } from '../../types'
import { routeCorridor, routeNumberLabel } from '../../lib/schedule'

const STATUS_COPY: Record<BroadcastStatus, { label: string; color: string }> = {
  idle: { label: 'Not broadcasting', color: 'var(--text-tertiary)' },
  locating: { label: 'Getting your location…', color: 'var(--uc-indigo)' },
  broadcasting: { label: 'Broadcasting live', color: 'var(--uc-orange-l)' },
  denied: { label: 'Location permission denied', color: 'var(--uc-red)' },
  error: { label: 'Something went wrong', color: 'var(--uc-red)' },
}

interface DriveTabProps {
  name: string
  routes: ShuttleRoute[]
  selectedRouteId: string | null
  onSelectRoute: (routeId: string) => void
  active: boolean
  status: BroadcastStatus
  lastFix: DriverFix | null
  shift: ShuttleShift | null
  starting: boolean
  onStart: () => void
  onStop: () => void
  onRiders: (delta: 1 | -1) => void
  ridersPending: boolean
  onOpenLive: () => void
}

/** Pick a route, start and stop the broadcast. The route locks while live. */
export function DriveTab({
  name,
  routes,
  selectedRouteId,
  onSelectRoute,
  active,
  status,
  lastFix,
  shift,
  starting,
  onStart,
  onStop,
  onRiders,
  ridersPending,
  onOpenLive,
}: DriveTabProps) {
  const statusInfo = active ? STATUS_COPY[status] : STATUS_COPY.idle
  const selected = routes.find((r) => r.id === selectedRouteId) ?? null
  const canStart = Boolean(selectedRouteId) && !starting

  return (
    <>
      <div className="driver-title-row">
        <h1 className="driver-h1">
          <span className="driver-only-desktop">Drive</span>
          <span className="driver-only-mobile">Broadcast</span>
        </h1>
        <span className="driver-title-sub">Signed in as {name}</span>
      </div>

      <div className="driver-drive-grid">
        <section className="driver-card" style={{ gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Select your route</span>
            {active && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-tertiary)' }}>
                <Lock size={12} />
                Locked while live
              </span>
            )}
          </div>
          {routes.length === 0 && (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>No routes available.</p>
          )}
          {routes.map((route) => {
            const on = route.id === selectedRouteId
            return (
              <button
                key={route.id}
                type="button"
                aria-pressed={on}
                disabled={active}
                onClick={() => onSelectRoute(route.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  minHeight: 48,
                  padding: '12px 14px',
                  fontSize: 14,
                  textAlign: 'left',
                  borderRadius: 'var(--r-md)',
                  cursor: active ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  fontWeight: on ? 500 : 400,
                  color: on ? 'var(--text-primary)' : 'var(--text-secondary)',
                  background: on ? 'var(--uc-orange-bg)' : 'var(--surface-raised)',
                  border: `0.5px solid ${on ? 'var(--uc-orange-bdr)' : 'var(--border-default)'}`,
                  opacity: active && !on ? 0.5 : 1,
                }}
              >
                <span style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: route.color }} />
                {routeNumberLabel(routes, route.id)}, {routeCorridor(route)}
              </button>
            )
          })}
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <section className="driver-card" style={{ gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Radio size={15} color={statusInfo.color} />
              <span style={{ fontSize: 14, fontWeight: 500, color: statusInfo.color }}>{statusInfo.label}</span>
            </div>
            {active && lastFix && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-tertiary)' }}>
                <MapPin size={12} />
                {lastFix.lat.toFixed(5)}, {lastFix.lng.toFixed(5)}
              </div>
            )}
            {active && shift && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px 8px 12px',
                  borderRadius: 'var(--r-md)',
                  background: 'var(--surface-raised)',
                }}
              >
                <span style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)' }}>Riders this trip</span>
                <button
                  type="button"
                  aria-label="Remove a rider"
                  disabled={ridersPending || shift.ridersCount === 0}
                  onClick={() => onRiders(-1)}
                  className="driver-count-btn"
                >
                  <Minus size={14} />
                </button>
                <span
                  aria-live="polite"
                  style={{ minWidth: 28, textAlign: 'center', fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}
                >
                  {shift.ridersCount}
                </span>
                <button
                  type="button"
                  aria-label="Add a rider"
                  disabled={ridersPending}
                  onClick={() => onRiders(1)}
                  className="driver-count-btn"
                >
                  <Plus size={14} />
                </button>
              </div>
            )}
            {active && (
              <button type="button" onClick={onOpenLive} className="driver-btn driver-btn--ghost driver-btn--inline">
                <MapIcon size={14} />
                See it on Shuttle live
              </button>
            )}
          </section>

          {active ? (
            <button type="button" onClick={onStop} className="driver-btn driver-btn--ghost driver-btn--lg">
              Stop broadcast
            </button>
          ) : (
            <button
              type="button"
              disabled={!canStart}
              onClick={onStart}
              className="driver-btn driver-btn--lg"
              style={{
                border: 'none',
                cursor: canStart ? 'pointer' : 'not-allowed',
                color: selectedRouteId ? 'var(--on-accent)' : 'var(--text-tertiary)',
                background: selectedRouteId ? 'var(--uc-orange)' : 'var(--surface-raised)',
              }}
            >
              {selected ? `Start broadcast · ${routeNumberLabel(routes, selected.id)}` : 'Start broadcast'}
            </button>
          )}
          <p className="driver-footnote">
            Keep this screen open while driving. Your location is shared with students only while broadcasting.
          </p>
        </div>
      </div>
    </>
  )
}
