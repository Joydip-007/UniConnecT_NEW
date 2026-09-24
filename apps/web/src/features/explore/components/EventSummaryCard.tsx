import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { eventWhen } from '../cardHelpers'
import { useDiscoveryRsvp } from '../hooks/useDiscoveryActions'
import type { EventSummary } from '../types'
import { useExploreLinkState } from '../hooks/useExploreLinkState'

interface Props {
  event: EventSummary
}

export function EventRsvpButton({ event, size = 28 }: { event: EventSummary; size?: 28 | 32 }) {
  const { mutate, isPending } = useDiscoveryRsvp(event)
  const isGoing = event.myRsvp === 'going'

  return (
    <button
      type="button"
      onClick={() => mutate()}
      disabled={isPending}
      aria-pressed={isGoing}
      aria-label={isGoing ? `You're going to ${event.title}` : `RSVP going to ${event.title}`}
      style={{
        flexShrink: 0,
        minHeight: size,
        padding: '0 14px',
        borderRadius: 'var(--r-pill)',
        fontSize: 12,
        fontWeight: 500,
        cursor: isPending ? 'default' : 'pointer',
        opacity: isPending ? 0.6 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        whiteSpace: 'nowrap',
        background: isGoing ? 'transparent' : 'var(--uc-indigo)',
        color: isGoing ? 'var(--uc-indigo-xl)' : 'var(--on-accent)',
        border: isGoing ? '0.5px solid var(--uc-indigo-bdr)' : '0.5px solid transparent',
      }}
    >
      Going
    </button>
  )
}

export function EventDateBlock({ startsAt }: { startsAt: string }) {
  const d = parseISO(startsAt)
  return (
    <div
      aria-hidden="true"
      style={{
        width: 40,
        height: 40,
        flexShrink: 0,
        borderRadius: 'var(--r-sm)',
        background: 'var(--uc-indigo-bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.06em', color: 'var(--uc-indigo-l)', lineHeight: 1 }}>
        {format(d, 'MMM').toUpperCase()}
      </div>
      <div style={{ fontSize: 17, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1 }}>
        {format(d, 'dd')}
      </div>
    </div>
  )
}

export function EventSummaryCard({ event }: Props) {
  const linkState = useExploreLinkState()
  return (
    <div
      className="explore-rail-card"
      style={{
        flexShrink: 0,
        width: 220,
        height: 132,
        boxSizing: 'border-box',
        scrollSnapAlign: 'start',
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <Link state={linkState} to={`/events/${event.id}`} style={{ display: 'flex', gap: 10, flex: 1, minHeight: 0, textDecoration: 'none' }}>
        <EventDateBlock startsAt={event.startsAt} />
        <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--text-primary)',
              lineHeight: 1.35,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {event.title}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              marginTop: 3,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {eventWhen(event)}
          </div>
        </div>
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{event.rsvpCount} going</span>
        <EventRsvpButton event={event} />
      </div>
    </div>
  )
}
