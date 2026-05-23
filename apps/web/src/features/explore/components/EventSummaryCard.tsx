import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { api } from '@/lib/axios'
import type { EventSummary } from '../types'

interface Props {
  event: EventSummary
}

export function EventSummaryCard({ event }: Props) {
  const qc = useQueryClient()
  const isGoing = event.myRsvp === 'going'

  const { mutate: rsvp, isPending } = useMutation({
    mutationFn: () =>
      isGoing
        ? api.delete(`/events/${event.id}/rsvp`)
        : api.post(`/events/${event.id}/rsvp`, { status: 'going' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['explore', 'discovery'] }),
  })

  return (
    <div
      style={{
        flexShrink: 0,
        width: 192,
        scrollSnapAlign: 'start',
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        overflow: 'hidden',
      }}
    >
      {event.coverUrl && (
        <img
          src={event.coverUrl}
          alt=""
          style={{ width: '100%', height: 72, objectFit: 'cover', display: 'block' }}
        />
      )}
      <div style={{ padding: '10px 12px' }}>
        <Link to={`/events/${event.id}`} style={{ textDecoration: 'none' }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--text-primary)',
              lineHeight: 1.3,
              marginBottom: 4,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {event.title}
          </div>
        </Link>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
          {formatDistanceToNow(parseISO(event.startsAt), { addSuffix: true })} · {event.rsvpCount} going
        </div>
        <button
          onClick={() => rsvp()}
          disabled={isPending}
          style={{
            width: '100%',
            padding: '4px 0',
            borderRadius: 'var(--r-pill)',
            border: '0.5px solid var(--border-default)',
            background: isGoing ? 'var(--surface-raised)' : 'var(--uc-indigo)',
            color: isGoing ? 'var(--text-primary)' : 'var(--uc-indigo-xl)',
            fontSize: 11,
            fontWeight: 500,
            cursor: isPending ? 'default' : 'pointer',
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {isGoing ? 'Going ✓' : 'Going?'}
        </button>
      </div>
    </div>
  )
}
