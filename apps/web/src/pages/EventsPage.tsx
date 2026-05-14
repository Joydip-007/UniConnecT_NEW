import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CalendarX, Plus } from 'lucide-react'
import { api } from '@/lib/axios'
import { useAuthStore } from '@/stores/authStore'
import { OrangeBtn } from '@/components/Button'
import { EventCard, type Event } from '@/features/events/components/EventCard'
import { CreateEventForm } from '@/features/events/components/CreateEventForm'
import { SkeletonEventCard } from '@/components/skeletons/SkeletonEventCard'
import { EmptyState } from '@/components/EmptyState'

// ── Types ─────────────────────────────────────────────────────────────────────

type EventType = 'all' | 'career_fair' | 'seminar' | 'workshop' | 'alumni_meetup' | 'club'

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS: { label: string; value: EventType }[] = [
  { label: 'All', value: 'all' },
  { label: 'Career fair', value: 'career_fair' },
  { label: 'Seminar', value: 'seminar' },
  { label: 'Workshop', value: 'workshop' },
  { label: 'Alumni meetup', value: 'alumni_meetup' },
  { label: 'Club', value: 'club' },
]

// ── EventsPage ────────────────────────────────────────────────────────────────

export default function EventsPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const rawType = searchParams.get('type') as EventType | null
  const activeType: EventType =
    rawType !== null && TABS.some((t) => t.value === rawType) ? rawType : 'all'

  const from = searchParams.get('from') ?? ''
  const to = searchParams.get('to') ?? ''

  const role = useAuthStore((s) => s.user?.role)
  const canCreate = role === 'staff' || role === 'admin'
  const [showCreate, setShowCreate] = useState(false)

  const queryKey = ['events', 'list', { type: activeType, from, to }] as const

  const { data, isLoading } = useQuery<Event[]>({
    queryKey,
    queryFn: () =>
      api
        .get<{ data: { items: Event[] } }>('/events', {
          params: {
            ...(activeType !== 'all' && { type: activeType }),
            ...(from && { from: new Date(from).toISOString() }),
            ...(to && { to: new Date(to).toISOString() }),
          },
        })
        .then((r) => r.data.data.items),
  })

  const events = data ?? []

  function setType(value: EventType) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === 'all') {
          next.delete('type')
        } else {
          next.set('type', value)
        }
        return next
      },
      { replace: true },
    )
  }

  function setDate(key: 'from' | 'to', value: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) {
          next.set(key, value)
        } else {
          next.delete(key)
        }
        return next
      },
      { replace: true },
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* ── Filter row ─────────────────────────────────────────────────────── */}
      <div
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: '4px 8px',
          display: 'flex',
          gap: 2,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        {/* Type tabs */}
        <nav style={{ display: 'flex', gap: 2, flex: '1 0 auto', overflowX: 'auto' }}>
          {TABS.map(({ label, value }) => {
            const active = activeType === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => setType(value)}
                style={{
                  flex: '1 0 auto',
                  padding: '7px 12px',
                  fontSize: 13,
                  fontWeight: active ? 500 : 400,
                  borderRadius: 'var(--r-pill)',
                  border: 'none',
                  cursor: 'pointer',
                  background: active ? 'var(--uc-indigo-bg)' : 'transparent',
                  color: active ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
                  transition: 'background 150ms, color 150ms',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </button>
            )
          })}
        </nav>

        {/* Date range */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 4px 4px 8px', flexShrink: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
            From
          </span>
          <input
            type="date"
            value={from}
            onChange={(e) => setDate('from', e.target.value)}
            style={{
              background: 'var(--surface-raised)',
              border: '0.5px solid var(--border-default)',
              borderRadius: 'var(--r-sm)',
              color: 'var(--text-secondary)',
              fontSize: 12,
              fontWeight: 400,
              padding: '5px 8px',
              outline: 'none',
              cursor: 'pointer',
            }}
          />
          <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>to</span>
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => setDate('to', e.target.value)}
            style={{
              background: 'var(--surface-raised)',
              border: '0.5px solid var(--border-default)',
              borderRadius: 'var(--r-sm)',
              color: 'var(--text-secondary)',
              fontSize: 12,
              fontWeight: 400,
              padding: '5px 8px',
              outline: 'none',
              cursor: 'pointer',
            }}
          />
        </div>
      </div>

      {/* ── Grid ───────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 12,
        }}
      >
        {isLoading && (
          <>
            <SkeletonEventCard />
            <SkeletonEventCard />
            <SkeletonEventCard />
          </>
        )}

        {events.map((event) => (
          <EventCard key={event.id} event={event} queryKey={queryKey} />
        ))}
      </div>

      {/* ── Empty state ────────────────────────────────────────────────────── */}
      {!isLoading && events.length === 0 && (
        <EmptyState
          icon={CalendarX}
          title="No events this week"
          description={
            from || to
              ? 'No events in the selected date range. Try adjusting the dates.'
              : 'No events have been scheduled yet. Check back soon.'
          }
        />
      )}

      {/* ── Floating create button — staff / admin only ─────────────────── */}
      {canCreate && (
        <OrangeBtn
          onClick={() => setShowCreate(true)}
          style={{
            position: 'fixed',
            bottom: 28,
            right: 28,
            boxShadow: '0 4px 16px rgba(240,90,40,0.30)',
            zIndex: 50,
          }}
        >
          <Plus size={15} strokeWidth={2} />
          Create event
        </OrangeBtn>
      )}

      {showCreate && <CreateEventForm onClose={() => setShowCreate(false)} />}
    </div>
  )
}
