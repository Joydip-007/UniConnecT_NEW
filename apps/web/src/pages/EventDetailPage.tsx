import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, keepPreviousData } from '@tanstack/react-query'
import { format, parseISO, isPast, isSameDay } from 'date-fns'
import {
  ArrowLeft,
  MapPin,
  Monitor,
  Calendar,
  Clock,
  Users,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Pencil,
} from 'lucide-react'
import type { ContentAttachment } from '@uniconnect/shared'
import { api } from '@/lib/axios'
import { queryClient } from '@/lib/queryClient'
import { useAuthStore } from '@/stores/authStore'
import { Avatar } from '@/components/Avatar'
import { GhostBtn, OrangeBtn } from '@/components/Button'
import { ImageLightbox } from '@/components/ImageLightbox'
import { CreateEventForm } from '@/features/events/components/CreateEventForm'
import { AttachmentList } from '@/features/content-sync'

// ── Types ─────────────────────────────────────────────────────────────────────

type EventKind = 'general' | 'career_fair' | 'seminar' | 'workshop' | 'alumni_meetup' | 'club'
type RsvpStatus = 'going' | 'maybe' | 'not_going' | null

interface EventDetail {
  id: string
  title: string
  type: EventKind
  description: string
  location: string
  isOnline: boolean
  onlineLink: string | null
  coverUrl: string | null
  startsAt: string
  endsAt: string | null
  capacity: number | null
  isPublished: boolean
  organizer: { id: string; fullName: string; avatarUrl: string | null }
  rsvpCounts: { going: number; maybe: number; not_going: number }
  myRsvp: RsvpStatus
  attachments?: ContentAttachment[]
}

interface AttendeeItem {
  id: string
  fullName: string
  avatarUrl: string | null
  profile: { headline: string | null; department: string | null }
}

interface AttendeesPage {
  items: AttendeeItem[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_META: Record<EventKind, { label: string; bdr: string; color: string; glow: string }> = {
  general:       { label: 'General',       bdr: 'var(--border-hover)',      color: 'var(--text-secondary)', glow: 'rgba(238,242,255,0.08)' },
  career_fair:   { label: 'Career fair',   bdr: 'var(--uc-indigo-bdr)',     color: 'var(--uc-indigo-xl)',   glow: 'rgba(91,91,214,0.35)'   },
  seminar:       { label: 'Seminar',       bdr: 'var(--uc-orange-bdr)',     color: 'var(--uc-orange-l)',    glow: 'rgba(240,90,40,0.28)'   },
  workshop:      { label: 'Workshop',      bdr: 'var(--uc-mint-bdr)',       color: 'var(--uc-mint)',         glow: 'var(--uc-mint-bdr)'     },
  alumni_meetup: { label: 'Alumni meetup', bdr: 'var(--uc-cyan-bdr)',       color: 'var(--uc-cyan)',         glow: 'var(--uc-cyan-bdr)'     },
  club:          { label: 'Club',          bdr: 'rgba(139,92,246,0.28)',    color: 'rgba(196,181,253,1)',    glow: 'rgba(139,92,246,0.32)'  },
}

const AVATAR_PALETTE = [
  'rgba(91,91,214,0.75)',
  'rgba(240,90,40,0.75)',
  'rgba(16,185,129,0.75)',
  'rgba(6,182,212,0.75)',
  'rgba(139,92,246,0.75)',
]

const ATTENDEES_LIMIT = 12

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

function formatDateRange(startsAt: string, endsAt: string | null) {
  const start = parseISO(startsAt)
  const end = endsAt ? parseISO(endsAt) : start
  const sameDay = isSameDay(start, end)
  return {
    date: sameDay
      ? format(start, 'EEEE, MMMM d, yyyy')
      : `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`,
    time: sameDay
      ? `${format(start, 'h:mm a')} – ${format(end, 'h:mm a')}`
      : `${format(start, 'MMM d, h:mm a')} – ${format(end, 'MMM d, h:mm a')}`,
  }
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ h, w = '100%', r = 'var(--r-sm)' }: { h: number; w?: string; r?: string }) {
  return (
    <div
      style={{
        height: h,
        width: w,
        background: 'var(--surface-raised)',
        borderRadius: r,
        flexShrink: 0,
      }}
    />
  )
}

function EventDetailSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Skeleton h={32} w="120px" />
      <Skeleton h={240} r="var(--r-lg)" />
      <div
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <Skeleton h={22} w="70%" />
        <Skeleton h={14} w="50%" />
        <Skeleton h={14} w="40%" />
      </div>
      <div
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <Skeleton h={14} w="30%" />
        <Skeleton h={14} w="90%" />
        <Skeleton h={14} w="80%" />
        <Skeleton h={14} w="60%" />
      </div>
    </div>
  )
}

// ── MetaRow ───────────────────────────────────────────────────────────────────

function MetaRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <span
        style={{
          flexShrink: 0,
          marginTop: 1,
          color: 'var(--text-tertiary)',
          display: 'flex',
        }}
      >
        {icon}
      </span>
      <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        {children}
      </span>
    </div>
  )
}

// ── AttendeeRow ───────────────────────────────────────────────────────────────

function AttendeeRow({ attendee }: { attendee: AttendeeItem }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 0',
        borderBottom: '0.5px solid var(--border-default)',
      }}
    >
      {attendee.avatarUrl ? (
        <img
          src={attendee.avatarUrl}
          alt={attendee.fullName}
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            objectFit: 'cover',
            flexShrink: 0,
          }}
        />
      ) : (
        <Avatar
          initials={toInitials(attendee.fullName)}
          color={avatarColor(attendee.id)}
          size={36}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {attendee.fullName}
        </p>
        {(attendee.profile.headline || attendee.profile.department) && (
          <p
            style={{
              margin: '1px 0 0',
              fontSize: 12,
              fontWeight: 400,
              color: 'var(--text-secondary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {attendee.profile.headline ?? attendee.profile.department}
          </p>
        )}
      </div>
    </div>
  )
}

// ── RsvpButton ────────────────────────────────────────────────────────────────

function RsvpButton({
  label,
  count,
  active,
  disabled,
  onClick,
  accentBg,
  accentColor,
}: {
  label: string
  count: number
  active: boolean
  disabled: boolean
  onClick: () => void
  accentBg: string
  accentColor: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        padding: '10px 8px',
        borderRadius: 'var(--r-md)',
        border: active ? `0.5px solid ${accentColor}` : '0.5px solid var(--border-default)',
        background: active ? accentBg : 'var(--surface-raised)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 150ms, border-color 150ms',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        style={{
          fontSize: 13,
          fontWeight: active ? 500 : 400,
          color: active ? accentColor : 'var(--text-secondary)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 400,
          color: active ? accentColor : 'var(--text-tertiary)',
        }}
      >
        {count}
      </span>
    </button>
  )
}

// ── EventDetailPage ───────────────────────────────────────────────────────────

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const [localRsvp, setLocalRsvp] = useState<RsvpStatus>(null)
  const [localCounts, setLocalCounts] = useState<EventDetail['rsvpCounts'] | null>(null)
  const [attendeePage, setAttendeePage] = useState(1)
  const [editing, setEditing] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const eventQuery = useQuery<EventDetail>({
    queryKey: ['events', 'detail', id],
    queryFn: () => api.get<{ data: EventDetail }>(`/events/${id}`).then((r) => r.data.data),
    enabled: !!id,
  })

  const publishMutation = useMutation({
    mutationFn: () => api.patch(`/events/${id}/publish`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['events'] })
      void queryClient.invalidateQueries({ queryKey: ['events', 'detail', id] })
      void queryClient.invalidateQueries({ queryKey: ['content-sync', 'pending'] })
    },
  })

  // Sync local RSVP state once event data arrives
  useEffect(() => {
    if (eventQuery.data) {
      setLocalRsvp(eventQuery.data.myRsvp)
      setLocalCounts(eventQuery.data.rsvpCounts)
    }
  }, [eventQuery.data])

  const attendeesQuery = useQuery<AttendeesPage>({
    queryKey: ['events', 'attendees', id, attendeePage],
    queryFn: () =>
      api
        .get<{ data: AttendeesPage }>(`/events/${id}/attendees`, {
          params: { status: 'going', page: attendeePage, limit: ATTENDEES_LIMIT },
        })
        .then((r) => r.data.data),
    enabled: !!id,
    placeholderData: keepPreviousData,
  })

  const rsvpMutation = useMutation({
    mutationFn: (next: RsvpStatus) =>
      next === null
        ? api.delete(`/events/${id}/rsvp`)
        : api.post(`/events/${id}/rsvp`, { status: next }),

    onMutate: async (next) => {
      const prev = localRsvp
      setLocalRsvp(next)
      setLocalCounts((c) => {
        if (!c) return c
        const nc = { ...c }
        if (prev === 'going') nc.going = Math.max(0, nc.going - 1)
        if (prev === 'maybe') nc.maybe = Math.max(0, nc.maybe - 1)
        if (prev === 'not_going') nc.not_going = Math.max(0, nc.not_going - 1)
        if (next === 'going') nc.going += 1
        if (next === 'maybe') nc.maybe += 1
        if (next === 'not_going') nc.not_going += 1
        return nc
      })
      return { prev }
    },

    onError: (_err, _next, ctx) => {
      setLocalRsvp(ctx?.prev ?? null)
      if (eventQuery.data) setLocalCounts(eventQuery.data.rsvpCounts)
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['events', 'detail', id] })
      queryClient.invalidateQueries({ queryKey: ['events', 'attendees', id] })
    },
  })

  function handleRsvp(target: 'going' | 'maybe' | 'not_going') {
    if (rsvpMutation.isPending) return
    rsvpMutation.mutate(localRsvp === target ? null : target)
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (eventQuery.isLoading) return <EventDetailSkeleton />

  // ── Error / not found ──────────────────────────────────────────────────────

  if (eventQuery.isError || !eventQuery.data) {
    return (
      <div
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: '48px 24px',
          textAlign: 'center',
        }}
      >
        <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
          Event not found
        </p>
        <p style={{ margin: '0 0 20px', fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)' }}>
          This event may have been removed or the link is invalid.
        </p>
        <GhostBtn onClick={() => navigate('/events')}>Back to events</GhostBtn>
      </div>
    )
  }

  const event = eventQuery.data
  const counts = localCounts ?? event.rsvpCounts
  const rsvp = localRsvp
  const meta = TYPE_META[event.type] ?? TYPE_META.general
  const ended = isPast(parseISO(event.endsAt ?? event.startsAt))
  const full =
    event.capacity !== null && counts.going >= event.capacity && rsvp !== 'going'
  const { date, time } = formatDateRange(event.startsAt, event.endsAt)

  // Organizer can edit their own event; admins can edit/publish any event.
  const canEdit = Boolean(user && (user.id === event.organizer.id || user.role === 'admin'))

  const attendees = attendeesQuery.data
  const totalPages = attendees ? Math.ceil(attendees.total / ATTENDEES_LIMIT) : 1

  const coverStyle: React.CSSProperties = event.coverUrl
    ? { backgroundImage: `url(${event.coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : {
        backgroundColor: 'var(--surface-raised)',
        backgroundImage: [
          `radial-gradient(ellipse at 30% 60%, ${meta.glow} 0%, transparent 65%)`,
          'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
        ].join(', '),
        backgroundSize: '100% 100%, 20px 20px',
      }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Back button ─────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        style={{
          alignSelf: 'flex-start',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px 0',
          fontSize: 13,
          fontWeight: 400,
          color: 'var(--text-secondary)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)' }}
      >
        <ArrowLeft size={14} strokeWidth={1.5} />
        Back to events
      </button>

      {/* ── Hero cover ──────────────────────────────────────────────────── */}
      <div
        role={event.coverUrl ? 'button' : undefined}
        tabIndex={event.coverUrl ? 0 : undefined}
        onClick={event.coverUrl ? () => setLightboxOpen(true) : undefined}
        onKeyDown={
          event.coverUrl
            ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setLightboxOpen(true) } }
            : undefined
        }
        style={{
          height: 240,
          borderRadius: 'var(--r-lg)',
          border: `0.5px solid ${meta.bdr}`,
          overflow: 'hidden',
          position: 'relative',
          cursor: event.coverUrl ? 'zoom-in' : undefined,
          ...coverStyle,
        }}
      >
        {/* Bottom gradient overlay */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '55%',
            background: 'linear-gradient(to top, var(--overlay-bg-strong) 0%, transparent 100%)',
          }}
        />

        {/* Type badge */}
        <span
          style={{
            position: 'absolute',
            bottom: 14,
            left: 16,
            fontSize: 11,
            fontWeight: 500,
            padding: '3px 12px',
            borderRadius: 'var(--r-pill)',
            background: 'var(--overlay-media)',
            border: `0.5px solid ${meta.bdr}`,
            color: meta.color,
          }}
        >
          {meta.label}
        </span>

        {/* Ended badge */}
        {ended && (
          <span
            style={{
              position: 'absolute',
              top: 14,
              right: 16,
              fontSize: 11,
              fontWeight: 400,
              padding: '3px 10px',
              borderRadius: 'var(--r-pill)',
              background: 'var(--overlay-media)',
              border: '0.5px solid var(--border-default)',
              color: 'var(--text-tertiary)',
            }}
          >
            Ended
          </span>
        )}
      </div>

      {/* ── Editor toolbar — organizer or admin ──────────────────────────── */}
      {canEdit && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {!event.isPublished && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: 'var(--uc-orange-l)',
                background: 'var(--uc-orange-bg)',
                borderRadius: 'var(--r-pill)',
                padding: '2px 10px',
              }}
            >
              Draft
            </span>
          )}
          <GhostBtn onClick={() => setEditing(true)}>
            <Pencil size={13} style={{ marginRight: 6, display: 'inline', verticalAlign: 'middle' }} />
            Edit
          </GhostBtn>
          {!event.isPublished && (
            <OrangeBtn onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending}>
              {publishMutation.isPending ? 'Publishing…' : 'Publish'}
            </OrangeBtn>
          )}
        </div>
      )}

      {/* ── Title + meta card ────────────────────────────────────────────── */}
      <div
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 500,
            color: 'var(--text-primary)',
            lineHeight: 1.4,
          }}
        >
          {event.title}
        </h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <MetaRow icon={<Calendar size={14} strokeWidth={1.5} />}>
            {date}
          </MetaRow>

          <MetaRow icon={<Clock size={14} strokeWidth={1.5} />}>
            {time}
          </MetaRow>

          {event.isOnline ? (
            <MetaRow icon={<Monitor size={14} strokeWidth={1.5} />}>
              Online event
              {event.onlineLink && (
                <a
                  href={event.onlineLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    marginLeft: 8,
                    fontSize: 12,
                    fontWeight: 400,
                    color: 'var(--uc-indigo-xl)',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  Join link
                  <ExternalLink size={10} strokeWidth={1.5} />
                </a>
              )}
            </MetaRow>
          ) : (
            <MetaRow icon={<MapPin size={14} strokeWidth={1.5} />}>
              {event.location}
            </MetaRow>
          )}

          <MetaRow icon={<Users size={14} strokeWidth={1.5} />}>
            {counts.going} going · {counts.maybe} maybe · {counts.not_going} not going
            {event.capacity !== null && (
              <span style={{ marginLeft: 8, color: 'var(--text-tertiary)' }}>
                · {event.capacity} capacity
              </span>
            )}
          </MetaRow>
        </div>
      </div>

      {/* ── RSVP section ─────────────────────────────────────────────────── */}
      {!ended && (
        <div
          style={{
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-lg)',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--text-primary)',
            }}
          >
            Will you attend?
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <RsvpButton
              label="Going"
              count={counts.going}
              active={rsvp === 'going'}
              disabled={(!( rsvp === 'going') && full) || rsvpMutation.isPending}
              onClick={() => handleRsvp('going')}
              accentBg="var(--uc-indigo-bg)"
              accentColor="var(--uc-indigo-xl)"
            />
            <RsvpButton
              label="Maybe"
              count={counts.maybe}
              active={rsvp === 'maybe'}
              disabled={rsvpMutation.isPending}
              onClick={() => handleRsvp('maybe')}
              accentBg="rgba(240,90,40,0.08)"
              accentColor="var(--uc-orange-l)"
            />
            <RsvpButton
              label="Not going"
              count={counts.not_going}
              active={rsvp === 'not_going'}
              disabled={rsvpMutation.isPending}
              onClick={() => handleRsvp('not_going')}
              accentBg="var(--surface-raised)"
              accentColor="var(--text-secondary)"
            />
          </div>
          {full && (
            <p
              style={{
                margin: 0,
                fontSize: 12,
                fontWeight: 400,
                color: 'var(--text-tertiary)',
              }}
            >
              This event has reached capacity.
            </p>
          )}
        </div>
      )}

      {/* ── Organizer card ───────────────────────────────────────────────── */}
      <div
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--text-primary)',
          }}
        >
          Organized by
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {event.organizer.avatarUrl ? (
            <img
              src={event.organizer.avatarUrl}
              alt={event.organizer.fullName}
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                objectFit: 'cover',
                flexShrink: 0,
              }}
            />
          ) : (
            <Avatar
              initials={toInitials(event.organizer.fullName)}
              color={avatarColor(event.organizer.id)}
              size={40}
            />
          )}
          <span
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--text-primary)',
            }}
          >
            {event.organizer.fullName}
          </span>
        </div>
      </div>

      {/* ── Description ─────────────────────────────────────────────────── */}
      <div
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--text-primary)',
          }}
        >
          About this event
        </p>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 400,
            color: 'var(--text-secondary)',
            lineHeight: 1.7,
            whiteSpace: 'pre-wrap',
          }}
        >
          {event.description}
        </p>
        <AttachmentList attachments={event.attachments} />
      </div>

      {/* ── Attendees ───────────────────────────────────────────────────── */}
      <div
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
        }}
      >
        <p
          style={{
            margin: '0 0 14px',
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--text-primary)',
          }}
        >
          Attendees
          {attendees && (
            <span
              style={{
                marginLeft: 6,
                fontSize: 12,
                fontWeight: 400,
                color: 'var(--text-tertiary)',
              }}
            >
              ({attendees.total} going)
            </span>
          )}
        </p>

        {attendeesQuery.isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 0',
                  borderBottom: '0.5px solid var(--border-default)',
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: 'var(--surface-raised)',
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ height: 13, width: '45%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
                  <div style={{ height: 11, width: '30%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {attendees && attendees.items.length === 0 && (
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 400,
              color: 'var(--text-secondary)',
              padding: '12px 0',
            }}
          >
            No one has RSVP'd as going yet. Be the first!
          </p>
        )}

        {attendees && attendees.items.map((a) => (
          <AttendeeRow key={a.id} attendee={a} />
        ))}

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 14,
              marginTop: 4,
            }}
          >
            <button
              type="button"
              onClick={() => setAttendeePage((p) => Math.max(1, p - 1))}
              disabled={attendeePage === 1 || attendeesQuery.isFetching}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: 'none',
                border: '0.5px solid var(--border-default)',
                borderRadius: 'var(--r-pill)',
                padding: '5px 14px',
                fontSize: 12,
                fontWeight: 400,
                color: 'var(--text-secondary)',
                cursor: attendeePage === 1 ? 'not-allowed' : 'pointer',
                opacity: attendeePage === 1 ? 0.4 : 1,
              }}
            >
              <ChevronLeft size={13} strokeWidth={1.5} />
              Previous
            </button>

            <span
              style={{
                fontSize: 12,
                fontWeight: 400,
                color: 'var(--text-tertiary)',
              }}
            >
              Page {attendeePage} of {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setAttendeePage((p) => Math.min(totalPages, p + 1))}
              disabled={attendeePage === totalPages || attendeesQuery.isFetching}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: 'none',
                border: '0.5px solid var(--border-default)',
                borderRadius: 'var(--r-pill)',
                padding: '5px 14px',
                fontSize: 12,
                fontWeight: 400,
                color: 'var(--text-secondary)',
                cursor: attendeePage === totalPages ? 'not-allowed' : 'pointer',
                opacity: attendeePage === totalPages ? 0.4 : 1,
              }}
            >
              Next
              <ChevronRight size={13} strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>

      {editing && (
        <CreateEventForm
          onClose={() => setEditing(false)}
          initial={{
            id: event.id,
            title: event.title,
            type: event.type,
            description: event.description,
            isOnline: event.isOnline,
            location: event.location,
            onlineLink: event.onlineLink ?? '',
            startsAt: event.startsAt,
            endsAt: event.endsAt,
            capacity: event.capacity,
            coverUrl: event.coverUrl,
            isPublished: event.isPublished,
          }}
        />
      )}

      {lightboxOpen && event.coverUrl && (
        <ImageLightbox images={[event.coverUrl]} onClose={() => setLightboxOpen(false)} />
      )}
    </div>
  )
}
