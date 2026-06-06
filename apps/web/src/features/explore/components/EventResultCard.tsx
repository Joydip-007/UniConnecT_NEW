import { Link } from 'react-router-dom'
import type { EventSearchResult } from '@/features/search'

interface Props {
  event: EventSearchResult
}

export function EventResultCard({ event }: Props) {
  return (
    <Link
      to={`/events/${event.id}`}
      style={{
        display: 'block',
        padding: '10px 14px',
        borderBottom: '0.5px solid var(--border-default)',
        fontSize: 14,
        textDecoration: 'none',
      }}
    >
      <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{event.title}</div>
      <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>
        {event.location} · {new Date(event.startsAt).toLocaleDateString()}
      </div>
    </Link>
  )
}
