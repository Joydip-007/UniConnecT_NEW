import type { EventKind, EventWhen } from './types'

/**
 * Per-type colour, all on tokens so both themes hold. Club takes amber — the violet it
 * used to carry was the only colour on the card outside the palette.
 */
export const TYPE_META: Record<EventKind, { label: string; bdr: string; color: string; dot: string }> = {
  general: { label: 'General', bdr: 'var(--border-hover)', color: 'var(--text-secondary)', dot: 'var(--text-tertiary)' },
  career_fair: { label: 'Career fair', bdr: 'var(--uc-indigo-bdr)', color: 'var(--uc-indigo-xl)', dot: 'var(--uc-indigo)' },
  seminar: { label: 'Seminar', bdr: 'var(--uc-orange-bdr)', color: 'var(--uc-orange-l)', dot: 'var(--uc-orange)' },
  workshop: { label: 'Workshop', bdr: 'var(--uc-mint-bdr)', color: 'var(--uc-mint)', dot: 'var(--uc-mint)' },
  alumni_meetup: { label: 'Alumni meetup', bdr: 'var(--uc-cyan-bdr)', color: 'var(--uc-cyan)', dot: 'var(--uc-cyan)' },
  club: { label: 'Club', bdr: 'var(--uc-amber-bdr)', color: 'var(--uc-amber-l)', dot: 'var(--uc-amber)' },
}

export type EventTypeFilter = 'all' | Exclude<EventKind, 'general'>

export const EVENT_TYPE_TABS: { label: string; value: EventTypeFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Career fair', value: 'career_fair' },
  { label: 'Seminar', value: 'seminar' },
  { label: 'Workshop', value: 'workshop' },
  { label: 'Alumni meetup', value: 'alumni_meetup' },
  { label: 'Club', value: 'club' },
]

export const EVENT_WHEN_TABS: { label: string; value: EventWhen }[] = [
  { label: 'Upcoming', value: 'upcoming' },
  { label: 'Ongoing', value: 'ongoing' },
  { label: 'Past', value: 'past' },
]

const HOUR_MS = 60 * 60 * 1000

/**
 * When an event ends. One with no end time counts as an hour long — the same rule as the
 * API's `EVENT_END_SQL`, so the "Ended" badge agrees with the Past tab.
 */
export function eventEndsAt(event: { startDate: string; endDate: string | null }): Date {
  return event.endDate ? new Date(event.endDate) : new Date(new Date(event.startDate).getTime() + HOUR_MS)
}

/** `YYYY-MM-DD` in the viewer's own timezone. */
export function toIsoDay(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${m}-${d}`
}

/** Parses `YYYY-MM-DD` as a local calendar day, or null when it isn't one. */
export function parseIsoDay(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.getMonth() === m - 1 ? date : null
}

export function endOfDay(date: Date): Date {
  const end = new Date(date)
  end.setHours(23, 59, 59, 999)
  return end
}

/** "28 Aug" */
export function formatDayMonth(date: Date): string {
  return date.toLocaleString('en-GB', { day: 'numeric', month: 'short' })
}

/** "2:00 pm" */
export function formatTime(date: Date): string {
  return date.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()
}
