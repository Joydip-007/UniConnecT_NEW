import type { EventSummary } from '../types'
import { EventSummaryCard } from './EventSummaryCard'

interface Props {
  events: EventSummary[]
}

export function UpcomingEvents({ events }: Props) {
  if (events.length === 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>No upcoming events.</p>
    )
  }
  return (
    <>
      {events.map((event) => (
        <EventSummaryCard key={event.id} event={event} />
      ))}
    </>
  )
}
