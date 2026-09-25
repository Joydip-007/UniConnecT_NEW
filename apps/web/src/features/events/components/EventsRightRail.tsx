import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageRailCard, SkeletonLine } from '@/components/rightRail/primitives'
import { TYPE_META, formatTime, toIsoDay } from '../constants'
import { useMyUpcomingEvents, useTopOrganisers } from '../hooks/useEvents'
import type { Event } from '../types'

const WEEK_DAYS = 5
const GOING_SHOWN = 3
const ORGANISER_TINTS = [
  { bg: 'var(--uc-cyan-bg)', bdr: 'var(--uc-cyan-bdr)', fg: 'var(--uc-cyan)' },
  { bg: 'var(--uc-amber-bg)', bdr: 'var(--uc-amber-bdr)', fg: 'var(--uc-amber-l)' },
  { bg: 'var(--uc-indigo-bg)', bdr: 'var(--uc-indigo-bdr)', fg: 'var(--uc-indigo-l)' },
  { bg: 'var(--uc-mint-bg)', bdr: 'var(--uc-mint-bdr)', fg: 'var(--uc-mint)' },
  { bg: 'var(--uc-orange-bg)', bdr: 'var(--uc-orange-bdr)', fg: 'var(--uc-orange-l)' },
]

function tintFor(id: string) {
  const sum = [...id].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return ORGANISER_TINTS[sum % ORGANISER_TINTS.length]
}

/**
 * The next five days, each dotted with the type of the first event the viewer is going to
 * that day. A day is a shortcut: it filters the grid to that date.
 */
function YourWeek({ events }: { events: Event[] }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const selected = searchParams.get('date')

  const days = useMemo(() => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    return Array.from({ length: WEEK_DAYS }, (_, i) => {
      const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
      const iso = toIsoDay(day)
      const first = events.find((e) => toIsoDay(new Date(e.startDate)) === iso)
      return { iso, day, isToday: i === 0, dot: first ? TYPE_META[first.type]?.dot ?? TYPE_META.general.dot : null }
    })
  }, [events])

  function pick(iso: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('from')
        next.delete('to')
        next.delete('when')
        if (selected === iso) next.delete('date')
        else next.set('date', iso)
        return next
      },
      { replace: true },
    )
  }

  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {days.map(({ iso, day, isToday, dot }) => {
        const on = selected === iso
        return (
          <button
            key={iso}
            type="button"
            onClick={() => pick(iso)}
            aria-pressed={on}
            aria-label={`${day.toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}${dot ? ', you have an event' : ''}`}
            className="events-week-day"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              padding: '8px 0',
              border: `0.5px solid ${on ? 'var(--uc-indigo-bdr)' : 'transparent'}`,
              borderRadius: 'var(--r-sm)',
              background: on ? 'var(--uc-indigo-bg)' : isToday ? 'var(--surface-raised)' : 'transparent',
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              {day.toLocaleString('en-US', { weekday: 'short' }).toUpperCase()}
            </span>
            <span
              style={{
                fontSize: 14,
                fontWeight: isToday || on ? 500 : 400,
                color: on ? 'var(--uc-indigo-xl)' : isToday ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {day.getDate()}
            </span>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: dot ?? 'transparent' }} />
          </button>
        )
      })}
    </div>
  )
}

function GoingRow({ event }: { event: Event }) {
  const start = new Date(event.startDate)
  return (
    <Link
      to={`/events/${event.id}`}
      className="events-rail-row"
      style={{ display: 'flex', gap: 10, alignItems: 'flex-start', textDecoration: 'none', color: 'inherit', borderRadius: 'var(--r-sm)' }}
    >
      <div
        style={{
          width: 34,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          padding: '5px 0',
          background: 'var(--uc-indigo-bg)',
          borderRadius: 'var(--r-sm)',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--uc-indigo-xl)', lineHeight: 1 }}>{start.getDate()}</span>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          {start.toLocaleString('en-US', { month: 'short' }).toUpperCase()}
        </span>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, lineHeight: 1.35, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {event.title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {formatTime(start)} · {event.location}
        </div>
      </div>
    </Link>
  )
}

/**
 * The events right rail: the viewer's week at a glance, what they've said yes to, and
 * who is putting on the most upcoming events.
 */
export function EventsRightRail() {
  const mine = useMyUpcomingEvents()
  const organisers = useTopOrganisers()

  const going = mine.data ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <PageRailCard title="Your week">
        {mine.isLoading ? <SkeletonLine height={56} /> : <YourWeek events={going} />}
      </PageRailCard>

      <PageRailCard title="You are going">
        {mine.isLoading ? (
          <>
            <SkeletonLine width="80%" />
            <SkeletonLine width="60%" />
          </>
        ) : going.length === 0 ? (
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Nothing yet. RSVP to an event and it lands here.</span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {going.slice(0, GOING_SHOWN).map((event, i) => (
              <div key={event.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {i > 0 && <div style={{ height: 0.5, background: 'var(--border-default)' }} />}
                <GoingRow event={event} />
              </div>
            ))}
          </div>
        )}
      </PageRailCard>

      {(organisers.data?.length ?? 0) > 0 && (
        <PageRailCard title="Top organisers" gap={10}>
          {organisers.data!.map((org) => {
            const tint = tintFor(org.id)
            return (
              <Link
                key={`${org.kind}-${org.id}`}
                to={org.kind === 'group' ? `/groups/${org.id}` : `/profile/${org.id}`}
                className="events-rail-row"
                style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit', borderRadius: 'var(--r-sm)' }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    flexShrink: 0,
                    borderRadius: 'var(--r-sm)',
                    background: org.avatarUrl ? `center / cover no-repeat url(${org.avatarUrl})` : tint.bg,
                    border: `0.5px solid ${tint.bdr}`,
                    color: tint.fg,
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {!org.avatarUrl && (org.name[0] ?? '').toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {org.name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{org.upcomingCount} upcoming</div>
                </div>
              </Link>
            )
          })}
        </PageRailCard>
      )}
    </div>
  )
}
