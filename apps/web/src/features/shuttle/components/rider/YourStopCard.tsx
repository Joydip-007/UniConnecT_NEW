import { Bell, MapPin } from 'lucide-react'
import { formatMinutes, routeNumberLabel } from '../../lib/schedule'
import { STOP_ALERT_MINUTES, type YourStopInfo } from '../../hooks/useYourStop'
import type { ShuttleRoute } from '../../types'

interface YourStopCardProps {
  info: YourStopInfo
  routes: ShuttleRoute[]
  variant: 'rail' | 'compact'
  onChange: () => void
  onToggleAlert: (next: boolean) => void
}

function AlertSwitch({ on, onToggle, compact }: { on: boolean; onToggle: (next: boolean) => void; compact: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onToggle(!on)}
      className="shuttle-alert-switch"
      data-compact={compact || undefined}
    >
      <Bell size={14} color="var(--text-secondary)" />
      <span style={{ flex: 1 }}>Alert me {STOP_ALERT_MINUTES} min before</span>
      <span className="shuttle-switch-track" data-on={on || undefined}>
        <span className="shuttle-switch-knob" />
      </span>
    </button>
  )
}

function Row({ title, sub, value, valueColor, divider }: { title: string; sub: string; value: string; valueColor: string; divider?: boolean }) {
  return (
    <div className="shuttle-rail-row" style={{ borderBottom: divider ? '0.5px solid var(--border-default)' : 'none' }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="shuttle-rail-row-title">{title}</span>
        <span className="shuttle-rail-row-sub">{sub}</span>
      </span>
      <span style={{ fontSize: 12, fontWeight: 500, color: valueColor, flexShrink: 0 }}>{value}</span>
    </div>
  )
}

/**
 * When does my bus reach my stop. The ETA reuses what the tracker computes; orange pin
 * because the stop is yours, cyan ETA only when it comes from a live beacon.
 */
export function YourStopCard({ info, routes, variant, onChange, onToggleAlert }: YourStopCardProps) {
  const { route, stopName, eta, live, runningAt, afterAt, alertEnabled } = info
  const etaColor = live ? 'var(--uc-cyan)' : 'var(--text-secondary)'

  if (!route || !stopName) {
    return (
      <section className={variant === 'rail' ? 'shuttle-rail-card' : 'shuttle-mobile-card'}>
        {variant === 'rail' && <span className="shuttle-rail-title" style={{ marginBottom: 6 }}>Your stop</span>}
        <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
          Pick the stop you wait at to see when your bus reaches it.
        </p>
        <button type="button" onClick={onChange} className="driver-btn driver-btn--ghost driver-btn--fit">
          <MapPin size={14} color="var(--uc-orange-l)" />
          Choose your stop
        </button>
      </section>
    )
  }

  const nextSub = runningAt !== null ? `${formatMinutes(runningAt)} trip, running` : 'No trip on the road'
  const nextValue = eta !== null ? `~${eta} min` : runningAt !== null ? 'Passed' : 'Not running'

  if (variant === 'compact') {
    return (
      <section className="shuttle-mobile-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MapPin size={14} color="var(--uc-orange-l)" />
          <button type="button" onClick={onChange} className="shuttle-link-reset" style={{ flex: 1, textAlign: 'left' }}>
            Your stop · {stopName}
          </button>
          <span style={{ fontSize: 12, fontWeight: 500, color: eta !== null ? etaColor : 'var(--text-tertiary)' }}>{nextValue}</span>
        </div>
        <AlertSwitch on={alertEnabled} onToggle={onToggleAlert} compact />
      </section>
    )
  }

  return (
    <section className="shuttle-rail-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span className="shuttle-rail-title">Your stop</span>
        <button type="button" onClick={onChange} className="shuttle-rail-link">
          Change
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, minWidth: 0 }}>
        <MapPin size={14} color="var(--uc-orange-l)" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {stopName}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }}>· {routeNumberLabel(routes, route.id)}</span>
      </div>
      <Row
        title="Next bus"
        sub={nextSub}
        value={nextValue}
        valueColor={eta !== null ? etaColor : 'var(--text-tertiary)'}
        divider
      />
      <Row
        title="After that"
        sub={afterAt !== null ? `${formatMinutes(afterAt)} trip` : 'No more trips today'}
        value={afterAt !== null ? 'Scheduled' : ''}
        valueColor="var(--text-secondary)"
      />
      <div style={{ marginTop: 10 }}>
        <AlertSwitch on={alertEnabled} onToggle={onToggleAlert} compact={false} />
      </div>
    </section>
  )
}
