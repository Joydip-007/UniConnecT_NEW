import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { ROLE_SHELL } from '@/config/roleShell'
import { PATHS } from '@/router/paths'
import { formatEventDate, useUpcomingEvents } from '@/components/rightRail/useUpcomingEvents'

const cardStyle: React.CSSProperties = {
  flex: '0 0 auto',
  width: 188,
  background: 'var(--surface-card)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-md)',
  padding: 10,
  display: 'flex',
  gap: 10,
  cursor: 'pointer',
  textAlign: 'left',
}

const dateBoxStyle: React.CSSProperties = {
  flexShrink: 0,
  width: 38,
  borderRadius: 'var(--r-sm)',
  background: 'var(--uc-indigo-bg)',
  border: '0.5px solid var(--uc-indigo-bdr)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '4px 0',
}

const titleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--text-primary)',
  lineHeight: 1.35,
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
}

/**
 * Below 767px the right rail is dropped entirely, which takes upcoming events with it —
 * the one widget whose payload is time-sensitive enough to be worth keeping on a phone.
 * It comes back as a horizontal strip under the filter row (CSS decides the breakpoint;
 * `.feed-events-strip` is `display: none` wherever the real rail exists, so the two are
 * never on screen together).
 *
 * Which roles get it is the same manifest decision the rail makes — reading
 * `ROLE_SHELL[role].rightRail` rather than branching on the role keeps the shell's
 * single source of navigation truth intact.
 */
export function MobileEventsStrip() {
  const navigate = useNavigate()
  const role = useAuthStore((s) => s.user?.role) ?? 'student'
  const inManifest = ROLE_SHELL[role].rightRail.includes('upcoming-events')
  const { data: events } = useUpcomingEvents()

  if (!inManifest || !events || events.length === 0) return null

  return (
    <section className="feed-events-strip" aria-label="Upcoming events">
      <span
        style={{
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '0.04em',
          color: 'var(--text-label)',
          paddingLeft: 2,
        }}
      >
        Upcoming events
      </span>
      <div className="feed-events-strip__scroller">
        {events.map((event) => {
          const { day, month, time } = formatEventDate(event.startsAt)
          return (
            <button
              key={event.id}
              type="button"
              className="interactive-surface"
              onClick={() => navigate(PATHS.EVENT_DETAIL.replace(':id', event.id))}
              style={cardStyle}
            >
              <span style={dateBoxStyle}>
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--uc-indigo-xl)', lineHeight: 1 }}>
                  {day}
                </span>
                <span style={{ fontSize: 11, color: 'var(--uc-indigo-l)', lineHeight: 1.2 }}>{month}</span>
              </span>
              <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={titleStyle}>{event.title}</span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{time}</span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
