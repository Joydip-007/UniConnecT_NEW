import { Link } from 'react-router-dom'
import { formatDistanceToNowStrict } from 'date-fns'
import { Newspaper, TriangleAlert } from 'lucide-react'
import { formatEventDate, useUpcomingEvents } from '@/components/rightRail/useUpcomingEvents'
import { useShuttleNotices } from '../../hooks/useRiderStop'
import { YourStopCard } from './YourStopCard'
import { departures, formatMinutes, lastBusLabel, routeNumberLabel, tripLabel } from '../../lib/schedule'
import type { YourStopInfo } from '../../hooks/useYourStop'
import type { ShuttleNotice, ShuttleRoute } from '../../types'

/** How many events the rail keeps — the one student widget that bears on the trip. */
const EVENTS_SHOWN = 2
const NOTICES_SHOWN = 3

interface ShuttleRightRailProps {
  routes: ShuttleRoute[]
  info: YourStopInfo
  nowMin: number
  onChangeStop: () => void
  onToggleAlert: (next: boolean) => void
}

/** The leg that leaves campus: whichever end of the route is the UIU stop. */
function campusDirection(route: ShuttleRoute): 'outbound' | 'inbound' {
  const stops = [...route.stops].sort((a, b) => a.orderIndex - b.orderIndex)
  const last = stops[stops.length - 1]
  return last && /uiu|campus/i.test(last.name) && route.schedule?.type !== 'continuous' ? 'inbound' : 'outbound'
}

function NextDepartures({ routes, nowMin }: { routes: ShuttleRoute[]; nowMin: number }) {
  const rows = routes
    .map((route) => {
      const direction = campusDirection(route)
      const next = departures(route).find((d) => d.at >= nowMin && (route.schedule?.type === 'continuous' || d.direction === direction))
      return { route, at: next?.at ?? null, label: tripLabel(route, direction) }
    })
    .sort((a, b) => (a.at ?? Infinity) - (b.at ?? Infinity))

  if (rows.length === 0) return null
  return (
    <section className="shuttle-rail-section" style={{ borderTop: 'none' }}>
      <span className="shuttle-rail-title">Next departures from campus</span>
      {rows.map(({ route, at, label }, i) => (
        <div key={route.id} className="shuttle-rail-row" style={{ borderBottom: i < rows.length - 1 ? '0.5px solid var(--border-default)' : 'none' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: route.color, flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="shuttle-rail-row-title">{routeNumberLabel(routes, route.id)}</span>
            <span className="shuttle-rail-row-sub">{label}</span>
          </span>
          <span style={{ fontSize: 12, fontWeight: 500, color: at !== null ? 'var(--text-primary)' : 'var(--text-tertiary)', flexShrink: 0 }}>
            {at !== null ? formatMinutes(at) : 'Done today'}
          </span>
        </div>
      ))}
    </section>
  )
}

export function NoticeRow({ notice, divider }: { notice: ShuttleNotice; divider: boolean }) {
  const disruption = notice.tone === 'disruption'
  const Icon = disruption ? TriangleAlert : Newspaper
  return (
    <div style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: divider ? '0.5px solid var(--border-default)' : 'none' }}>
      <span
        style={{
          flexShrink: 0,
          width: 28,
          height: 28,
          borderRadius: 'var(--r-sm)',
          background: disruption ? 'var(--uc-amber-bg)' : 'var(--uc-indigo-bg)',
          color: disruption ? 'var(--uc-amber-l)' : 'var(--uc-indigo-l)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={14} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="shuttle-rail-row-title">{notice.title}</span>
        <span className="shuttle-rail-row-sub">
          {notice.detail ?? `Transport office · ${formatDistanceToNowStrict(new Date(notice.createdAt))} ago`}
        </span>
      </span>
    </div>
  )
}

function ServiceNotices() {
  const { data } = useShuttleNotices()
  const notices = (data ?? []).slice(0, NOTICES_SHOWN)
  if (notices.length === 0) return null
  return (
    <section className="shuttle-rail-section">
      <span className="shuttle-rail-title">Service notices</span>
      {notices.map((n, i) => (
        <NoticeRow key={n.id} notice={n} divider={i < notices.length - 1} />
      ))}
    </section>
  )
}

function UpcomingEvents({ routes }: { routes: ShuttleRoute[] }) {
  const { data } = useUpcomingEvents()
  const events = (data ?? []).slice(0, EVENTS_SHOWN)
  // The latest departure across every route — the last way home after an event.
  const lastBus = routes
    .map((r) => ({ label: lastBusLabel(r), at: departures(r).slice(-1)[0]?.at ?? -1 }))
    .filter((r) => r.label !== null)
    .sort((a, b) => b.at - a.at)[0]?.label
  if (events.length === 0) return null
  return (
    <section className="shuttle-rail-section">
      <span className="shuttle-rail-title">Upcoming events</span>
      {events.map((event) => {
        const { day, month, time } = formatEventDate(event.startsAt)
        const meta = [event.location, time.toLowerCase(), lastBus ? `last bus ${lastBus}` : null].filter(Boolean).join(' · ')
        return (
          <Link key={event.id} to={`/events/${event.id}`} className="shuttle-rail-event">
            <span className="shuttle-date-box">
              <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--uc-indigo-xl)' }}>{day}</span>
              <span style={{ fontSize: 12, color: 'var(--uc-indigo-l)', marginTop: 2 }}>{month}</span>
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="shuttle-rail-row-title">{event.title}</span>
              <span className="shuttle-rail-row-sub">{meta}</span>
            </span>
          </Link>
        )
      })}
    </section>
  )
}

/**
 * The shuttle page's own rail: your stop on the card surface, then flat sections for
 * every route's next departure, service notices and the events that need a bus home.
 */
export function ShuttleRightRail({ routes, info, nowMin, onChangeStop, onToggleAlert }: ShuttleRightRailProps) {
  return (
    <aside className="shuttle-rail" aria-label="Shuttle">
      <YourStopCard info={info} routes={routes} variant="rail" onChange={onChangeStop} onToggleAlert={onToggleAlert} />
      <NextDepartures routes={routes} nowMin={nowMin} />
      <ServiceNotices />
      <UpcomingEvents routes={routes} />
    </aside>
  )
}

