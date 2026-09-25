import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, CalendarPlus, Check, MapPin } from 'lucide-react'
import { TYPE_META, eventEndsAt, formatDayMonth, formatTime } from '../constants'
import { useAddToCalendar, useEventRsvp } from '../hooks/useEvents'
import type { Event, EventAttendee, RsvpStatus } from '../types'

export type { Event, EventAttendee, EventKind } from '../types'

const AVATAR_TINTS = ['var(--uc-indigo)', 'var(--uc-cyan)', 'var(--uc-amber)', 'var(--uc-mint)', 'var(--uc-orange)']

function avatarTint(id: string): string {
  const sum = [...id].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_TINTS[sum % AVATAR_TINTS.length]
}

function toInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return (parts[0][0] ?? '').toUpperCase()
  return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase()
}

const FACE: CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: '50%',
  border: '2px solid var(--surface-card)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 11,
  fontWeight: 500,
  position: 'relative',
  flexShrink: 0,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
}

function FaceStack({ attendees, total }: { attendees: EventAttendee[]; total: number }) {
  if (total === 0) {
    return <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Be first to RSVP</span>
  }
  const shown = attendees.slice(0, 3)
  const overflow = total - shown.length

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
      {shown.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {shown.map((a, i) => (
            <div
              key={a.id}
              title={a.fullName}
              style={{
                ...FACE,
                marginLeft: i === 0 ? 0 : -7,
                zIndex: shown.length - i,
                background: a.avatarUrl ? undefined : avatarTint(a.id),
                backgroundImage: a.avatarUrl ? `url(${a.avatarUrl})` : undefined,
                color: 'var(--on-accent)',
              }}
            >
              {!a.avatarUrl && toInitials(a.fullName)}
            </div>
          ))}
          {overflow > 0 && (
            <div
              style={{
                ...FACE,
                width: 'auto',
                minWidth: 22,
                padding: '0 5px',
                boxSizing: 'border-box',
                borderRadius: 'var(--r-pill)',
                marginLeft: -7,
                background: 'var(--surface-raised)',
                color: 'var(--text-secondary)',
              }}
            >
              +{overflow}
            </div>
          )}
        </div>
      )}
      <span style={{ fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
        {total} going
      </span>
    </div>
  )
}

function CardButton({
  children,
  onClick,
  disabled,
  tone = 'ghost',
  label,
  square = false,
}: {
  children: ReactNode
  onClick: (e: MouseEvent) => void
  disabled?: boolean
  tone?: 'primary' | 'selected' | 'ghost' | 'strong'
  label?: string
  square?: boolean
}) {
  const tones: Record<typeof tone, CSSProperties> = {
    primary: { border: '0.5px solid transparent', background: 'var(--uc-indigo)', color: 'var(--on-indigo)', fontWeight: 500 },
    selected: { border: '0.5px solid var(--border-strong)', background: 'var(--surface-raised)', color: 'var(--text-primary)' },
    ghost: { border: '0.5px solid var(--border-hover)', background: 'transparent', color: 'var(--text-secondary)' },
    strong: { border: '0.5px solid var(--border-hover)', background: 'transparent', color: 'var(--text-primary)' },
  }
  return (
    <button
      type="button"
      className={`event-card-btn event-card-btn--${tone}${square ? ' event-card-btn--square' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        fontSize: 12,
        fontWeight: 400,
        borderRadius: 'var(--r-pill)',
        fontFamily: 'inherit',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        whiteSpace: 'nowrap',
        transition: 'background 150ms, color 150ms, border-color 150ms',
        ...tones[tone],
      }}
    >
      {children}
    </button>
  )
}

export function EventCard({ event }: { event: Event }) {
  const navigate = useNavigate()
  const rsvp = useEventRsvp(event.id)
  const addToCalendar = useAddToCalendar()

  const meta = TYPE_META[event.type] ?? TYPE_META.general
  const start = new Date(event.startDate)
  const ended = eventEndsAt(event) < new Date()
  const going = event.rsvpCounts.going
  const mine = event.myRsvp
  const full = event.capacity !== null && going >= event.capacity && mine !== 'going'
  const busy = rsvp.isPending

  const coverStyle: CSSProperties = event.coverUrl
    ? { backgroundImage: `url(${event.coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : {
        backgroundColor: 'var(--surface-raised)',
        backgroundImage: [
          `radial-gradient(ellipse at 25% 65%, ${meta.bdr} 0%, transparent 60%)`,
          'radial-gradient(circle, var(--border-hover) 1px, transparent 1px)',
        ].join(', '),
        backgroundSize: '100% 100%, 18px 18px',
      }

  function toggle(e: MouseEvent, target: RsvpStatus) {
    e.stopPropagation()
    if (busy) return
    rsvp.mutate(mine === target ? null : target)
  }

  function add(e: MouseEvent) {
    e.stopPropagation()
    addToCalendar.mutate({ eventId: event.id, title: event.title })
  }

  const open = () => navigate(`/events/${event.id}`)

  const capacityPct = event.capacity ? Math.min(100, Math.round((going / event.capacity) * 100)) : 0
  const atCapacity = event.capacity !== null && going >= event.capacity
  const capacityNote = atCapacity
    ? mine === 'waitlisted' && event.waitlistPosition
      ? `${going} of ${event.capacity} seats taken · you're #${event.waitlistPosition} in line`
      : `${going} of ${event.capacity} seats taken · waitlist open`
    : `${going} of ${event.capacity} seats taken`

  return (
    <article
      className="card-hover-border"
      onClick={open}
      style={{
        cursor: 'pointer',
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        opacity: ended ? 0.72 : 1,
        transition: 'border-color 200ms',
      }}
    >
      {/* ── Cover ──────────────────────────────────────────────────────────── */}
      <div style={{ height: 80, position: 'relative', borderBottom: `0.5px solid ${meta.bdr}`, ...coverStyle }}>
        <span
          style={{
            position: 'absolute',
            bottom: 8,
            left: 12,
            fontSize: 12,
            fontWeight: 500,
            padding: '2px 10px',
            borderRadius: 'var(--r-pill)',
            background: 'var(--overlay-media)',
            border: `0.5px solid ${meta.bdr}`,
            color: meta.color,
          }}
        >
          {meta.label}
        </span>
        {ended && (
          <span
            style={{
              position: 'absolute',
              top: 8,
              right: 12,
              fontSize: 12,
              padding: '2px 8px',
              borderRadius: 'var(--r-pill)',
              background: 'var(--overlay-media)',
              border: '0.5px solid var(--border-default)',
              color: 'var(--text-tertiary)',
            }}
          >
            Ended
          </span>
        )}
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            right: 12,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 3,
            background: 'var(--overlay-media)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-md)',
            padding: '5px 10px',
          }}
        >
          <span style={{ fontSize: 18, fontWeight: 500, color: 'var(--uc-indigo-l)', lineHeight: 1 }}>
            {String(start.getDate()).padStart(2, '0')}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
            {start.toLocaleString('en-US', { month: 'short' }).toUpperCase()}
          </span>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 500,
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          <Link
            to={`/events/${event.id}`}
            onClick={(e) => e.stopPropagation()}
            style={{ color: 'var(--text-primary)', textDecoration: 'none' }}
          >
            {event.title}
          </Link>
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <MapPin size={11} strokeWidth={1.5} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {event.location}
          </span>
        </div>

        {/* Capacity meter — pressure shows before the event is full, not just after. */}
        {!ended && event.capacity !== null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div
              role="meter"
              aria-label="Seats taken"
              aria-valuemin={0}
              aria-valuemax={event.capacity}
              aria-valuenow={Math.min(going, event.capacity)}
              style={{ height: 3, borderRadius: 'var(--r-pill)', background: 'var(--surface-raised)', overflow: 'hidden' }}
            >
              <div style={{ width: `${capacityPct}%`, height: '100%', background: atCapacity ? 'var(--uc-red)' : 'var(--uc-indigo)' }} />
            </div>
            <span style={{ fontSize: 12, color: atCapacity ? 'var(--uc-red)' : 'var(--text-tertiary)' }}>{capacityNote}</span>
          </div>
        )}

        {/* Clash with something the viewer already committed to — shown before they RSVP. */}
        {!ended && event.conflict && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              background: 'var(--uc-amber-bg)',
              border: '0.5px solid var(--uc-amber-bdr)',
              borderRadius: 'var(--r-sm)',
              color: 'var(--uc-amber-l)',
              fontSize: 12,
              minWidth: 0,
            }}
          >
            <AlertTriangle size={12} strokeWidth={1.5} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Overlaps {event.conflict.title}, {formatTime(new Date(event.conflict.startsAt))}
              {new Date(event.conflict.startsAt).toDateString() !== start.toDateString() &&
                ` on ${formatDayMonth(new Date(event.conflict.startsAt))}`}
            </span>
          </div>
        )}

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="event-card-footer" onClick={(e) => e.stopPropagation()}>
          <div className="event-card-faces">
            {ended ? (
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{going} attended</span>
            ) : (
              <FaceStack attendees={event.previewAttendees} total={going} />
            )}
          </div>

          {ended ? (
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }}>Event ended</span>
          ) : full ? (
            <div className="event-card-actions">
              <CardButton onClick={add} disabled={addToCalendar.isPending}>
                <CalendarPlus size={12} strokeWidth={1.5} />
                Add
              </CardButton>
              {mine === 'waitlisted' ? (
                <CardButton tone="selected" onClick={(e) => toggle(e, 'waitlisted')} disabled={busy} label="Leave waitlist">
                  <Check size={11} strokeWidth={2} />
                  On waitlist
                </CardButton>
              ) : (
                <CardButton tone="strong" onClick={(e) => toggle(e, 'waitlisted')} disabled={busy}>
                  Join waitlist
                </CardButton>
              )}
            </div>
          ) : (
            <div className="event-card-actions">
              {mine === 'going' && (
                <CardButton square onClick={add} disabled={addToCalendar.isPending} label="Add to calendar">
                  <CalendarPlus size={13} strokeWidth={1.5} />
                </CardButton>
              )}
              <CardButton tone={mine === 'going' ? 'primary' : 'ghost'} onClick={(e) => toggle(e, 'going')} disabled={busy}>
                {mine === 'going' && <Check size={11} strokeWidth={2} />}
                Going
              </CardButton>
              <CardButton tone={mine === 'maybe' ? 'selected' : 'ghost'} onClick={(e) => toggle(e, 'maybe')} disabled={busy}>
                Maybe
              </CardButton>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
