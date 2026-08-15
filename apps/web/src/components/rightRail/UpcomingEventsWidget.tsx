import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MapPin } from 'lucide-react'
import { api } from '@/lib/axios'
import { PATHS } from '@/router/paths'
import { Section, SectionHeader, SkeletonLine, WidgetShell } from './primitives'

function formatDate(iso: string) {
  const d = new Date(iso)
  return {
    day: d.getDate(),
    month: d.toLocaleString('en-US', { month: 'short' }),
    time: d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
  }
}

interface EventItem {
  id: string
  title: string
  location: string | null
  startsAt: string
}

function EventMini({ event, isLast = false }: { event: EventItem; isLast?: boolean }) {
  const navigate = useNavigate()
  const { day, month, time } = formatDate(event.startsAt)

  return (
    <button
      onClick={() => navigate(PATHS.EVENT_DETAIL.replace(':id', event.id))}
      className="interactive-surface"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        width: '100%',
        padding: '8px 0',
        background: 'none',
        border: 'none',
        borderBottom: isLast ? 'none' : '0.5px solid var(--border-default)',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      {/* Date box */}
      <div
        style={{
          flexShrink: 0,
          width: 38,
          background: 'var(--uc-indigo-bg)',
          border: '0.5px solid var(--uc-indigo-bdr)',
          borderRadius: 'var(--r-sm)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '4px 0',
          lineHeight: 1,
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--uc-indigo-xl)' }}>{day}</span>
        <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--uc-indigo-l)', marginTop: 2 }}>
          {month}
        </span>
      </div>

      {/* Event info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--text-primary)',
            lineHeight: 1.35,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {event.title}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            marginTop: 3,
            fontSize: 12,
            color: 'var(--text-tertiary)',
          }}
        >
          {event.location && (
            <>
              <MapPin size={11} />
              <span
                style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 140,
                }}
              >
                {event.location}
              </span>
              <span style={{ opacity: 0.5 }}>·</span>
            </>
          )}
          <span>{time}</span>
        </div>
      </div>
    </button>
  )
}

/** Hides entirely when nothing is scheduled from today onward. */
export function UpcomingEventsWidget() {
  const navigate = useNavigate()

  const { data: events, isLoading } = useQuery({
    queryKey: ['events', 'list', { from: 'today' }],
    queryFn: () => {
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      return api
        .get<{ data: { items: EventItem[] } }>('/events', {
          params: { from: startOfDay.toISOString(), limit: 3 },
        })
        .then((r) => r.data.data.items)
    },
  })

  if (!isLoading && (!events || events.length === 0)) return null

  return (
    <WidgetShell>
      <Section withTopDivider>
        <SectionHeader title="Upcoming events" onSeeAll={() => navigate(PATHS.EVENTS)} />

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ display: 'flex', gap: 10, paddingBottom: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 46,
                    borderRadius: 'var(--r-sm)',
                    background: 'var(--surface-raised)',
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4 }}>
                  <SkeletonLine width="80%" />
                  <SkeletonLine width="50%" height={10} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            {(events ?? []).slice(0, 3).map((event, i, arr) => (
              <EventMini key={event.id} event={event} isLast={i === arr.length - 1} />
            ))}
          </div>
        )}
      </Section>
    </WidgetShell>
  )
}
