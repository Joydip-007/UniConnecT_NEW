import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarX, Plus, X } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { usePageRails } from '@/stores/pageRailStore'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { OrangeBtn } from '@/components/Button'
import { SkeletonEventCard } from '@/components/skeletons/SkeletonEventCard'
import {
  CreateEventForm,
  EVENT_TYPE_TABS,
  EVENT_WHEN_TABS,
  EventCard,
  EventDatePicker,
  EventsRightRail,
  endOfDay,
  formatDayMonth,
  parseIsoDay,
  useEventsList,
} from '@/features/events'
import type { EventTypeFilter, EventWhen } from '@/features/events'

/** What the grid is showing: a picked day, a legacy from/to range, or a time segment. */
type Scope =
  | { kind: 'date'; day: Date; iso: string }
  | { kind: 'range'; from: Date | null; to: Date | null }
  | { kind: 'when'; when: EventWhen }

const SCOPE_CONTEXT: Record<EventWhen, string> = {
  upcoming: 'coming up',
  ongoing: 'happening now',
  past: 'that have ended',
}

function readScope(params: URLSearchParams): Scope {
  const date = params.get('date')
  const day = parseIsoDay(date)
  if (date && day) return { kind: 'date', day, iso: date }

  // `?from` / `?to` are the old range filter — kept so existing links still land.
  const from = parseIsoDay(params.get('from'))
  const to = parseIsoDay(params.get('to'))
  if (from || to) return { kind: 'range', from, to }

  const when = params.get('when')
  return { kind: 'when', when: EVENT_WHEN_TABS.some((t) => t.value === when) ? (when as EventWhen) : 'upcoming' }
}

export default function EventsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawType = searchParams.get('type')
  const activeType: EventTypeFilter = EVENT_TYPE_TABS.some((t) => t.value === rawType) ? (rawType as EventTypeFilter) : 'all'
  const scope = readScope(searchParams)

  const role = useAuthStore((s) => s.user?.role)
  const canCreate = role === 'faculty' || role === 'admin'
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [showCreate, setShowCreate] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const rightRail = useMemo(() => <EventsRightRail />, [])
  usePageRails(null, rightRail)

  // Plain ISO strings, so the query key is stable across renders without memoising.
  const listWindow =
    scope.kind === 'date'
      ? { when: null, from: scope.day.toISOString(), to: endOfDay(scope.day).toISOString() }
      : scope.kind === 'range'
        ? { when: null, from: scope.from?.toISOString() ?? null, to: scope.to ? endOfDay(scope.to).toISOString() : null }
        : { when: scope.when, from: null, to: null }

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useEventsList({ type: activeType, ...listWindow })

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage()
      },
      { threshold: 0.1 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const events = data?.pages.flatMap((p) => p.items) ?? []
  const total = data?.pages[0]?.total ?? 0

  function update(mutate: (next: URLSearchParams) => void) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        mutate(next)
        return next
      },
      { replace: true },
    )
  }

  const clearDates = (next: URLSearchParams) => {
    next.delete('date')
    next.delete('from')
    next.delete('to')
  }

  const setType = (value: EventTypeFilter) =>
    update((next) => (value === 'all' ? next.delete('type') : next.set('type', value)))

  // Upcoming is the default, so it stays out of the URL.
  const setWhen = (value: EventWhen) =>
    update((next) => {
      clearDates(next)
      if (value === 'upcoming') next.delete('when')
      else next.set('when', value)
    })

  const setDate = (iso: string) =>
    update((next) => {
      clearDates(next)
      next.delete('when')
      next.set('date', iso)
    })

  const clearDate = () => update(clearDates)

  // ── Labels ────────────────────────────────────────────────────────────────
  const typeName = EVENT_TYPE_TABS.find((t) => t.value === activeType)?.label.toLowerCase()
  const context =
    scope.kind === 'date'
      ? `on ${formatDayMonth(scope.day)}`
      : scope.kind === 'range'
        ? scope.from && scope.to
          ? `from ${formatDayMonth(scope.from)} to ${formatDayMonth(scope.to)}`
          : scope.from
            ? `from ${formatDayMonth(scope.from)}`
            : `until ${formatDayMonth(scope.to!)}`
        : SCOPE_CONTEXT[scope.when]
  const typed = activeType === 'all' ? '' : `${typeName} `
  const countLabel = `${total} ${typed}${total === 1 ? 'event' : 'events'} ${context}`
  const emptyLabel = `No ${typed}events ${context}`

  const dateLabel =
    scope.kind === 'date'
      ? scope.day.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : scope.kind === 'range'
        ? [scope.from && formatDayMonth(scope.from), scope.to && formatDayMonth(scope.to)].filter(Boolean).join(' – ')
        : 'Pick a date'
  const hasDate = scope.kind !== 'when'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* ── Type tabs ──────────────────────────────────────────────────────── */}
      <div
        className="events-type-bar"
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: '4px 8px',
        }}
      >
        <nav className="events-type-tabs" aria-label="Event type">
          {EVENT_TYPE_TABS.map(({ label, value }) => {
            const on = activeType === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => setType(value)}
                aria-pressed={on}
                className="events-type-tab"
                style={{
                  padding: '8px 12px',
                  fontSize: 13,
                  fontWeight: on ? 500 : 400,
                  border: 'none',
                  borderRadius: 'var(--r-pill)',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  transition: 'background 150ms ease, color 150ms ease',
                  background: on ? 'var(--uc-indigo-bg)' : 'transparent',
                  color: on ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
                }}
              >
                {label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* ── Segment, date, count ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div
          role="group"
          aria-label="When"
          style={{
            display: 'flex',
            gap: 2,
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-pill)',
            padding: 3,
          }}
        >
          {EVENT_WHEN_TABS.map(({ label, value }) => {
            const on = scope.kind === 'when' && scope.when === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => setWhen(value)}
                aria-pressed={on}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  fontSize: 12,
                  fontWeight: 500,
                  border: 'none',
                  borderRadius: 'var(--r-pill)',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  background: on ? 'var(--surface-raised)' : 'transparent',
                  color: on ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
              >
                {value === 'ongoing' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--uc-mint)' }} />}
                {label}
              </button>
            )
          })}
        </div>

        <EventDatePicker
          selected={scope.kind === 'date' ? scope.iso : null}
          label={dateLabel}
          active={hasDate}
          type={activeType}
          onPick={setDate}
        />

        {!isLoading && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{countLabel}</span>}
        <div style={{ flex: 1 }} />
        {hasDate && (
          <button
            type="button"
            onClick={clearDate}
            className="events-clear-date"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 12px',
              fontSize: 12,
              border: '0.5px solid var(--border-hover)',
              borderRadius: 'var(--r-pill)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            <X size={12} strokeWidth={1.5} />
            Clear date
          </button>
        )}
      </div>

      {/* ── Grid ───────────────────────────────────────────────────────────── */}
      {!isLoading && events.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            padding: '40px 16px',
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-lg)',
            color: 'var(--text-tertiary)',
          }}
        >
          <CalendarX size={24} strokeWidth={1.5} />
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{emptyLabel}</span>
        </div>
      ) : (
        <div className="events-grid">
          {isLoading && (
            <>
              <SkeletonEventCard />
              <SkeletonEventCard />
              <SkeletonEventCard />
              <SkeletonEventCard />
            </>
          )}
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}

      <div ref={sentinelRef} style={{ height: 1 }} />
      {isFetchingNextPage && (
        <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, padding: 12 }}>Loading more…</p>
      )}

      {/* ── Create — faculty / admin only; clears the mobile tab bar ─────── */}
      {canCreate && (
        <OrangeBtn
          onClick={() => setShowCreate(true)}
          style={{ position: 'fixed', bottom: isMobile ? 82 : 28, right: isMobile ? 16 : 28, zIndex: 50, minHeight: 44 }}
        >
          <Plus size={15} strokeWidth={2} />
          Create event
        </OrangeBtn>
      )}

      {showCreate && <CreateEventForm onClose={() => setShowCreate(false)} />}
    </div>
  )
}
