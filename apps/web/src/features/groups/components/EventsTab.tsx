import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { Calendar, MapPin, Plus } from 'lucide-react'
import { GROUP_EVENTS } from '@uniconnect/shared'
import { socket } from '@/lib/socket'
import { api } from '@/lib/axios'
import { avatarColor as seedColor, getInitials } from '@/utils/avatar'
import { Avatar } from '@/components/Avatar'
import { GhostBtn, PrimaryBtn } from '@/components/Button'
import { CreateEventForm } from '@/features/events/components/CreateEventForm'
import type { GroupEventEntry, MemberRole } from '../types'
import { pendingEventsKey, usePendingEvents, useReviewEvent, type PendingGroupEvent } from '../hooks/useGroupExtended'

interface EventsPage {
  items: GroupEventEntry[]
  hasMore: boolean
  page: number
}

export function EventsTab({ groupId, userRole = null }: { groupId: string; userRole?: MemberRole | null }) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)

  const isModeratorOrAbove = userRole === 'owner' || userRole === 'admin' || userRole === 'moderator'
  const isAdmin = userRole === 'owner' || userRole === 'admin'
  const { data: pendingEvents } = usePendingEvents(groupId, isModeratorOrAbove)
  const reviewEvent = useReviewEvent(groupId)
  const pending = pendingEvents ?? []

  useEffect(() => {
    function onQueueChanged(payload: { groupId?: string } | undefined) {
      if (payload?.groupId && payload.groupId !== groupId) return
      queryClient.invalidateQueries({ queryKey: pendingEventsKey(groupId) })
    }
    socket.on(GROUP_EVENTS.REVIEW_QUEUE_CHANGED, onQueueChanged)
    return () => {
      socket.off(GROUP_EVENTS.REVIEW_QUEUE_CHANGED, onQueueChanged)
    }
  }, [groupId, queryClient])

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery<EventsPage>({
    queryKey: ['groups', 'events', groupId],
    queryFn: ({ pageParam }) =>
      api
        .get<{ data: EventsPage }>(`/groups/${groupId}/events`, { params: { page: pageParam } })
        .then((r) => r.data.data),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  })

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 0.1 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const items = data?.pages.flatMap((p) => p.items) ?? []

  const createEntry = isAdmin && (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <GhostBtn type="button" onClick={() => setShowCreate(true)}>
        <Plus size={13} strokeWidth={1.5} />
        Create event
      </GhostBtn>
    </div>
  )

  const pendingQueue = isModeratorOrAbove && pending.length > 0 && (
    <PendingEventQueue
      events={pending}
      onApprove={(eventId) => reviewEvent.mutate({ eventId, action: 'approve' })}
      onDecline={(eventId) => reviewEvent.mutate({ eventId, action: 'decline' })}
      isPending={reviewEvent.isPending}
    />
  )

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {createEntry}
        {pendingQueue}
        <SkeletonList />
        {showCreate && <CreateEventForm groupId={groupId} onClose={() => setShowCreate(false)} />}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {createEntry}
        {pendingQueue}
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
            No events yet
          </p>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)' }}>
            Group events and event posts will appear here.
          </p>
        </div>
        {showCreate && <CreateEventForm groupId={groupId} onClose={() => setShowCreate(false)} />}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {createEntry}
      {pendingQueue}
      {items.map((entry) =>
        entry.kind === 'event' ? (
          <EventRow key={`event-${entry.id}`} entry={entry} onClick={() => navigate(`/events/${entry.id}`)} />
        ) : (
          <PostRow key={`post-${entry.id}`} entry={entry} />
        ),
      )}
      <div ref={sentinelRef} style={{ height: 1 }} />
      {isFetchingNextPage && <SkeletonList />}
      {showCreate && <CreateEventForm groupId={groupId} onClose={() => setShowCreate(false)} />}
    </div>
  )
}

// ── Pending event approval queue ─────────────────────────────────────────────

function PendingEventQueue({
  events,
  onApprove,
  onDecline,
  isPending,
}: {
  events: PendingGroupEvent[]
  onApprove: (eventId: string) => void
  onDecline: (eventId: string) => void
  isPending: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '0.04em',
          color: 'var(--uc-orange-l)',
        }}
      >
        {events.length} event{events.length !== 1 ? 's' : ''} awaiting approval
      </span>
      {events.map((event) => (
        <PendingEventCard
          key={event.id}
          event={event}
          isPending={isPending}
          onApprove={() => onApprove(event.id)}
          onDecline={() => onDecline(event.id)}
        />
      ))}
    </div>
  )
}

function PendingEventCard({
  event,
  onApprove,
  onDecline,
  isPending,
}: {
  event: PendingGroupEvent
  onApprove: () => void
  onDecline: () => void
  isPending: boolean
}) {
  const day = format(parseISO(event.startDate), 'd')
  const month = format(parseISO(event.startDate), 'MMM').toUpperCase()
  const time = format(parseISO(event.startDate), 'h:mm a')

  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--uc-orange-bdr)',
        borderRadius: 'var(--r-lg)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            width: 50,
            flexShrink: 0,
            textAlign: 'center',
            padding: '8px 0',
            borderRadius: 'var(--r-md)',
            background: 'var(--uc-orange-bg)',
            border: '0.5px solid var(--uc-orange-bdr)',
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--uc-orange-l)', lineHeight: 1 }}>{day}</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2, letterSpacing: '0.05em' }}>
            {month}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{event.title}</h3>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 4,
              fontSize: 12,
              color: 'var(--text-secondary)',
            }}
          >
            <Calendar size={11} strokeWidth={1.5} />
            <span>{time}</span>
            <MapPin size={11} strokeWidth={1.5} />
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 200,
              }}
            >
              {event.location}
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>
            Submitted by {event.organizer.fullName}
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <PrimaryBtn type="button" disabled={isPending} onClick={onApprove}>
          Approve
        </PrimaryBtn>
        <GhostBtn type="button" disabled={isPending} onClick={onDecline}>
          Decline
        </GhostBtn>
      </div>
    </div>
  )
}

function EventRow({
  entry,
  onClick,
}: {
  entry: Extract<GroupEventEntry, { kind: 'event' }>
  onClick: () => void
}) {
  const day = format(parseISO(entry.startDate), 'd')
  const month = format(parseISO(entry.startDate), 'MMM').toUpperCase()
  const time = format(parseISO(entry.startDate), 'h:mm a')

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          width: 50,
          flexShrink: 0,
          textAlign: 'center',
          padding: '8px 0',
          borderRadius: 'var(--r-md)',
          background: 'var(--uc-indigo-bg)',
          border: '0.5px solid var(--uc-indigo-bdr)',
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--uc-indigo-xl)', lineHeight: 1 }}>{day}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, letterSpacing: '0.05em' }}>
          {month}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {entry.title}
        </h3>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 4,
            fontSize: 12,
            color: 'var(--text-secondary)',
          }}
        >
          <Calendar size={11} strokeWidth={1.5} />
          <span>{time}</span>
          <MapPin size={11} strokeWidth={1.5} />
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 240,
            }}
          >
            {entry.location}
          </span>
        </div>
      </div>
      <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }}>
        {entry.totalAttendees} going
      </span>
    </div>
  )
}

function PostRow({ entry }: { entry: Extract<GroupEventEntry, { kind: 'post' }> }) {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: '14px 16px',
        display: 'flex',
        gap: 12,
      }}
    >
      {entry.author.avatarUrl ? (
        <img
          src={entry.author.avatarUrl}
          alt={entry.author.fullName}
          style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
        />
      ) : (
        <Avatar initials={getInitials(entry.author.fullName)} color={seedColor(entry.author.id)} size={36} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>
          {entry.author.fullName} · event post
        </p>
        <p
          style={{
            margin: '4px 0 0',
            fontSize: 13,
            color: 'var(--text-primary)',
            lineHeight: 1.55,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {entry.content}
        </p>
      </div>
    </div>
  )
}

function SkeletonList() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          style={{
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-lg)',
            padding: '14px 16px',
            display: 'flex',
            gap: 14,
          }}
        >
          <div style={{ width: 50, height: 50, background: 'var(--surface-raised)', borderRadius: 'var(--r-md)' }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ height: 13, width: '50%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
            <div style={{ height: 11, width: '30%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
          </div>
        </div>
      ))}
    </div>
  )
}
