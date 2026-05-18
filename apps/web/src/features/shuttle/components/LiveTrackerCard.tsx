import { Bus, Clock, Gauge, MapPin } from 'lucide-react'
import { relativeTime } from '../utils'
import type { LiveLocation, ProgressResult, ShuttleRoute } from '../types'
import { LiveBadge } from './LiveBadge'
import { ProgressTrack } from './ProgressTrack'
import { StatBox } from './StatBox'

interface LiveTrackerCardProps {
  route: ShuttleRoute
  currentLocation: LiveLocation | null
  derived: ProgressResult
  atFinalStop: boolean
}

export function LiveTrackerCard({
  route,
  currentLocation,
  derived,
  atFinalStop,
}: LiveTrackerCardProps) {
  const nextStop = route.stops[derived.nextStopIdx] ?? null

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
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Bus size={15} strokeWidth={1.5} color="var(--uc-indigo)" style={{ flexShrink: 0 }} />
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
              {route.name}
            </h2>
          </div>
          {(route.frequency || route.operatingHours) && (
            <p style={{ margin: 0, fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>
              {[route.frequency, route.operatingHours].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <LiveBadge updatedAt={currentLocation?.updatedAt ?? null} />
      </div>

      {!currentLocation && (
        <div
          style={{
            padding: '16px',
            background: 'var(--surface-raised)',
            borderRadius: 'var(--r-md)',
            textAlign: 'center',
          }}
        >
          <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)' }}>
            Location unavailable — shuttle may be offline
          </p>
        </div>
      )}

      {route.stops.length > 0 && (
        <ProgressTrack
          progress={derived.progress}
          hasLocation={currentLocation !== null}
          firstStop={route.stops[0].name}
          lastStop={route.stops[route.stops.length - 1].name}
        />
      )}

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
  )
}
