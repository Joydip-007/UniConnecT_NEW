import { Bus, Clock, Radio, Users, type LucideIcon } from 'lucide-react'
import type { ShuttleDuty, ShuttleRoute } from '../../types'
import {
  dutyTrips,
  formatMinutes,
  minutesOfDay,
  onDutyLabel,
  routeCorridor,
  routeNumberLabel,
  type TripStatus,
} from '../../lib/schedule'

const TRIP_TONES: Record<TripStatus, { label: string; bg: string; bdr: string; fg: string }> = {
  done: { label: 'Done', bg: 'var(--uc-mint-bg)', bdr: 'var(--uc-mint-bdr)', fg: 'var(--uc-mint)' },
  running: { label: 'Running', bg: 'var(--uc-cyan-bg)', bdr: 'var(--uc-cyan-bdr)', fg: 'var(--uc-cyan)' },
  scheduled: { label: 'Scheduled', bg: 'var(--surface-raised)', bdr: 'var(--border-default)', fg: 'var(--text-secondary)' },
  missed: { label: 'Not driven', bg: 'transparent', bdr: 'var(--border-default)', fg: 'var(--text-tertiary)' },
}

interface DutyTabProps {
  duty: ShuttleDuty | undefined
  routes: ShuttleRoute[]
  now: Date
  active: boolean
  onGoDrive: () => void
}

function StatCard({ icon: Icon, label, value, note }: { icon: LucideIcon; label: string; value: string; note: string }) {
  return (
    <div className="driver-card driver-stat">
      <span className="driver-stat-label">
        <Icon size={13} />
        <span className="driver-only-desktop">{label}</span>
      </span>
      <span className="driver-stat-value">{value}</span>
      <span className="driver-stat-note">
        <span className="driver-only-desktop">{note}</span>
        <span className="driver-only-mobile">{label}</span>
      </span>
    </div>
  )
}

/** Today's trips and totals, all read from the driver's real broadcast shifts. */
export function DutyTab({ duty, routes, now, active, onGoDrive }: DutyTabProps) {
  const route = routes.find((r) => r.id === duty?.assignedRouteId) ?? null
  const shifts = duty?.shifts ?? []
  const trips = route ? dutyTrips(route, shifts, now) : []
  const done = trips.filter((t) => t.status === 'done').length
  const left = trips.filter((t) => t.status === 'scheduled' || t.status === 'running').length
  const riders = shifts.reduce((sum, s) => sum + s.ridersCount, 0)
  const firstStart = shifts[0] ? formatMinutes(minutesOfDay(new Date(shifts[0].startedAt))) : null
  const label = route ? routeNumberLabel(routes, route.id) : null

  return (
    <>
      <div className="driver-title-row">
        <h1 className="driver-h1">Duty board</h1>
        {label && (
          <span className="driver-only-mobile driver-duty-pill">
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--uc-orange-l)' }} />
            {active ? 'Live' : 'On duty'} · {label}
          </span>
        )}
      </div>

      <div className="driver-stat-grid">
        <StatCard
          icon={Bus}
          label="Trips today"
          value={trips.length ? `${done} of ${trips.length}` : '0'}
          note={label ? `${left} left on ${label.toLowerCase()}` : 'No route assigned yet'}
        />
        <StatCard
          icon={Clock}
          label="Time on duty"
          value={onDutyLabel(shifts, now)}
          note={firstStart ? `Since ${firstStart}` : 'Not on duty yet today'}
        />
        <StatCard icon={Users} label="Riders carried" value={String(riders)} note="Counted at the door" />
      </div>

      <section className="driver-card driver-list-card">
        <h2 style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Today's trips</h2>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          {route && label ? `${label}, ${routeCorridor(route)}` : 'Start a broadcast on the Drive tab to pick up a route'}
        </span>
        {trips.length > 0 && (
          <div style={{ marginTop: 10 }}>
            {trips.map((trip, i) => {
              const tone = TRIP_TONES[trip.status]
              return (
                <div
                  key={`${trip.at}-${trip.label}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '11px 0',
                    borderBottom: i < trips.length - 1 ? '0.5px solid var(--border-default)' : 'none',
                  }}
                >
                  <span className="driver-trip-time">{formatMinutes(trip.at)}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.35 }}>{trip.label}</span>
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
                    {tone.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {!active && (
        <button type="button" onClick={onGoDrive} className="driver-only-mobile driver-btn driver-btn--primary driver-btn--block">
          <Radio size={16} />
          Start next trip
        </button>
      )}
    </>
  )
}
