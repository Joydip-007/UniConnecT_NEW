import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { format, parseISO, isPast } from 'date-fns'
import { MapPin } from 'lucide-react'
import { api } from '@/lib/axios'
import { queryClient } from '@/lib/queryClient'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EventAttendee {
  id: string
  fullName: string
  avatarUrl: string | null
}

export type EventKind = 'career_fair' | 'seminar' | 'workshop' | 'alumni_meetup' | 'club'

export interface Event {
  id: string
  title: string
  type: EventKind
  startDate: string
  endDate: string | null
  location: string
  description: string
  coverUrl: string | null
  rsvpCounts: { going: number; maybe: number }
  capacity: number | null
  myRsvp: 'going' | 'maybe' | null
  previewAttendees: EventAttendee[]
  totalAttendees: number
  organizer: { id: string; fullName: string }
}

type RsvpStatus = 'going' | 'maybe' | null

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_META: Record<EventKind, { label: string; bdr: string; color: string; glow: string }> = {
  career_fair:   { label: 'Career fair',   bdr: 'var(--uc-indigo-bdr)',   color: 'var(--uc-indigo-xl)',  glow: 'rgba(91,91,214,0.35)' },
  seminar:       { label: 'Seminar',       bdr: 'var(--uc-orange-bdr)',   color: 'var(--uc-orange-l)',   glow: 'rgba(240,90,40,0.28)' },
  workshop:      { label: 'Workshop',      bdr: 'rgba(16,185,129,0.28)',  color: 'var(--uc-mint)',        glow: 'rgba(16,185,129,0.28)' },
  alumni_meetup: { label: 'Alumni meetup', bdr: 'rgba(6,182,212,0.28)',   color: 'var(--uc-cyan)',        glow: 'rgba(6,182,212,0.28)' },
  club:          { label: 'Club',          bdr: 'rgba(139,92,246,0.28)',  color: 'rgba(196,181,253,1)',   glow: 'rgba(139,92,246,0.32)' },
}

const AVATAR_PALETTE = [
  'rgba(91,91,214,0.75)',
  'rgba(240,90,40,0.75)',
  'rgba(16,185,129,0.75)',
  'rgba(6,182,212,0.75)',
  'rgba(139,92,246,0.75)',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function avatarColor(id: string): string {
  const sum = [...id].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_PALETTE[sum % AVATAR_PALETTE.length]
}

function toInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return (parts[0][0] ?? '').toUpperCase()
  return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase()
}

// ── FaceStack ─────────────────────────────────────────────────────────────────

function FaceStack({ attendees, total }: { attendees: EventAttendee[]; total: number }) {
  const shown = attendees.slice(0, 3)
  const overflow = total - shown.length

  if (total === 0) {
    return (
      <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)' }}>
        Be first to RSVP
      </span>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {shown.map((a, i) => (
          <div
            key={a.id}
            title={a.fullName}
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: a.avatarUrl ? undefined : avatarColor(a.id),
              backgroundImage: a.avatarUrl ? `url(${a.avatarUrl})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              border: '2px solid var(--surface-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 8,
              fontWeight: 500,
              color: '#fff',
              marginLeft: i === 0 ? 0 : -7,
              zIndex: shown.length - i,
              position: 'relative',
              flexShrink: 0,
            }}
          >
            {!a.avatarUrl && toInitials(a.fullName)}
          </div>
        ))}
        {overflow > 0 && (
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: 'var(--surface-raised)',
              border: '2px solid var(--surface-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 8,
              fontWeight: 500,
              color: 'var(--text-secondary)',
              marginLeft: -7,
              position: 'relative',
              flexShrink: 0,
            }}
          >
            +{overflow}
          </div>
        )}
      </div>
      <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
        {total} going
      </span>
    </div>
  )
}

// ── EventCard ─────────────────────────────────────────────────────────────────

export function EventCard({ event, queryKey }: { event: Event; queryKey: readonly unknown[] }) {
  const navigate = useNavigate()
  const [localRsvp, setLocalRsvp]     = useState<RsvpStatus>(event.myRsvp)
  const [localCounts, setLocalCounts] = useState(event.rsvpCounts)

  const meta   = TYPE_META[event.type]
  const ended  = isPast(parseISO(event.endDate ?? event.startDate))
  const full   = event.capacity !== null && localCounts.going >= event.capacity && localRsvp !== 'going'

  const dayStr   = format(parseISO(event.startDate), 'd')
  const monthStr = format(parseISO(event.startDate), 'MMM').toUpperCase()

  const coverStyle: React.CSSProperties = event.coverUrl
    ? {
        backgroundImage: `url(${event.coverUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : {
        backgroundColor: 'var(--surface-raised)',
        backgroundImage: [
          `radial-gradient(ellipse at 25% 65%, ${meta.glow} 0%, transparent 60%)`,
          'radial-gradient(circle, rgba(255,255,255,0.085) 1px, transparent 1px)',
        ].join(', '),
        backgroundSize: '100% 100%, 18px 18px',
      }

  // Optimistic counter update — keeps local state in sync with cache write
  function patchCounts(prev: RsvpStatus, next: RsvpStatus) {
    setLocalRsvp(next)
    setLocalCounts((c) => {
      const nc = { ...c }
      if (prev === 'going') nc.going = Math.max(0, nc.going - 1)
      if (prev === 'maybe') nc.maybe = Math.max(0, nc.maybe - 1)
      if (next === 'going') nc.going += 1
      if (next === 'maybe') nc.maybe += 1
      return nc
    })
  }

  const rsvpMutation = useMutation({
    mutationFn: (next: RsvpStatus) =>
      next === null
        ? api.delete(`/events/${event.id}/rsvp`)
        : api.post(`/events/${event.id}/rsvp`, { status: next }),

    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey })
      const snapshot = queryClient.getQueryData<Event[]>(queryKey)
      patchCounts(localRsvp, next)

      // Update rsvpCounts in the list cache
      queryClient.setQueryData<Event[]>(queryKey, (old = []) =>
        old.map((e) => {
          if (e.id !== event.id) return e
          const prev = e.myRsvp
          const nc = { ...e.rsvpCounts }
          if (prev === 'going') nc.going = Math.max(0, nc.going - 1)
          if (prev === 'maybe') nc.maybe = Math.max(0, nc.maybe - 1)
          if (next === 'going') nc.going += 1
          if (next === 'maybe') nc.maybe += 1
          return { ...e, myRsvp: next, rsvpCounts: nc }
        }),
      )
      return { snapshot }
    },

    onError: (_err, _next, ctx) => {
      setLocalRsvp(event.myRsvp)
      setLocalCounts(event.rsvpCounts)
      if (ctx?.snapshot) queryClient.setQueryData(queryKey, ctx.snapshot)
    },

    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  })

  function handleRsvp(e: React.MouseEvent, target: 'going' | 'maybe') {
    e.stopPropagation()
    if (rsvpMutation.isPending) return
    rsvpMutation.mutate(localRsvp === target ? null : target)
  }

  const goingActive = localRsvp === 'going'
  const maybeActive = localRsvp === 'maybe'

  return (
    <article
      onClick={() => navigate(`/events/${event.id}`)}
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color 200ms',
        display: 'flex',
        flexDirection: 'column',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-hover)' }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)' }}
    >
      {/* ── Cover ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          height: 80,
          position: 'relative',
          borderBottom: `0.5px solid ${meta.bdr}`,
          ...coverStyle,
        }}
      >
        {/* Type badge — bottom-left */}
        <span
          style={{
            position: 'absolute',
            bottom: 8,
            left: 12,
            fontSize: 11,
            fontWeight: 500,
            padding: '2px 10px',
            borderRadius: 'var(--r-pill)',
            background: 'rgba(6,13,26,0.65)',
            border: `0.5px solid ${meta.bdr}`,
            color: meta.color,
          }}
        >
          {meta.label}
        </span>

        {/* Date box — bottom-right */}
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            right: 12,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            lineHeight: 1,
            gap: 3,
            background: 'rgba(6,13,26,0.70)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-md)',
            padding: '5px 10px',
          }}
        >
          <span style={{ fontSize: 18, fontWeight: 500, color: 'var(--uc-indigo-l)', lineHeight: 1 }}>
            {dayStr}
          </span>
          <span style={{ fontSize: 9, fontWeight: 400, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
            {monthStr}
          </span>
        </div>

        {/* Ended badge — top-right */}
        {ended && (
          <span
            style={{
              position: 'absolute',
              top: 8,
              right: 12,
              fontSize: 11,
              fontWeight: 400,
              padding: '2px 8px',
              borderRadius: 'var(--r-pill)',
              background: 'rgba(6,13,26,0.70)',
              border: '0.5px solid var(--border-default)',
              color: 'var(--text-tertiary)',
            }}
          >
            Ended
          </span>
        )}
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          padding: '14px 16px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          flex: 1,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--text-primary)',
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {event.title}
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <MapPin size={11} strokeWidth={1.5} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
          <span
            style={{
              fontSize: 12,
              fontWeight: 400,
              color: 'var(--text-secondary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {event.location}
          </span>
        </div>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div
          style={{
            marginTop: 'auto',
            paddingTop: 10,
            borderTop: '0.5px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Face stack */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <FaceStack attendees={event.previewAttendees} total={localCounts.going} />
          </div>

          {/* RSVP buttons */}
          {!ended ? (
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {/* Going */}
              <button
                type="button"
                onClick={(e) => handleRsvp(e, 'going')}
                disabled={(!goingActive && full) || rsvpMutation.isPending}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  fontSize: 12,
                  fontWeight: goingActive ? 500 : 400,
                  padding: '5px 14px',
                  borderRadius: 'var(--r-pill)',
                  border: goingActive ? 'none' : '0.5px solid var(--border-hover)',
                  background: goingActive ? 'var(--uc-indigo)' : 'transparent',
                  color: goingActive ? '#fff' : full ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                  cursor: (!goingActive && full) || rsvpMutation.isPending ? 'not-allowed' : 'pointer',
                  transition: 'background 150ms, color 150ms',
                  opacity: rsvpMutation.isPending ? 0.55 : 1,
                }}
              >
                {goingActive && <span style={{ fontSize: 10 }}>✓</span>}
                {!goingActive && full ? 'Full' : 'Going'}
              </button>

              {/* Maybe */}
              <button
                type="button"
                onClick={(e) => handleRsvp(e, 'maybe')}
                disabled={rsvpMutation.isPending}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 400,
                  padding: '5px 14px',
                  borderRadius: 'var(--r-pill)',
                  border: maybeActive ? '0.5px solid var(--border-strong)' : '0.5px solid var(--border-hover)',
                  background: maybeActive ? 'var(--surface-raised)' : 'transparent',
                  color: maybeActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: rsvpMutation.isPending ? 'not-allowed' : 'pointer',
                  transition: 'background 150ms, color 150ms',
                  opacity: rsvpMutation.isPending ? 0.55 : 1,
                }}
              >
                Maybe
              </button>
            </div>
          ) : (
            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)', flexShrink: 0 }}>
              Event ended
            </span>
          )}
        </div>
      </div>
    </article>
  )
}
