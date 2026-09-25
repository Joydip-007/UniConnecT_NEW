/**
 * Dev-auth fixtures for the events page (Events Page.dc.html), dated relative to today so
 * the upcoming / ongoing / past split, the week strip and the picker dots always have data.
 */
import type { Event, EventKind, RsvpStatus } from '@/features/events'

const DAY = 24 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000

function at(dayOffset: number, hour: number, minute = 0): Date {
  const d = new Date()
  d.setHours(hour, minute, 0, 0)
  return new Date(d.getTime() + dayOffset * DAY)
}

const people = [
  { id: 'dev-ev-sa', fullName: 'Sadia Afrin', avatarUrl: null },
  { id: 'dev-ev-nh', fullName: 'Nafis Hasan', avatarUrl: null },
  { id: 'dev-ev-rk', fullName: 'Rafi Karim', avatarUrl: null },
  { id: 'dev-ev-fa', fullName: 'Farhan Ahmed', avatarUrl: null },
  { id: 'dev-ev-mi', fullName: 'Mehjabin Islam', avatarUrl: null },
  { id: 'dev-ev-ta', fullName: 'Tahmid Alam', avatarUrl: null },
]

function ev(
  id: string,
  type: EventKind,
  title: string,
  location: string,
  start: Date,
  hours: number,
  going: number,
  opts: { capacity?: number; myRsvp?: RsvpStatus; faces?: number[]; conflict?: Event['conflict']; waitlistCount?: number } = {},
): Event & { startsAt: string; endsAt: string } {
  const endsAt = new Date(start.getTime() + hours * HOUR).toISOString()
  return {
    // The real payload carries both spellings; the rail's contextual zone reads `startsAt`.
    startsAt: start.toISOString(),
    endsAt,
    id,
    title,
    type,
    startDate: start.toISOString(),
    endDate: endsAt,
    location,
    description: '',
    coverUrl: null,
    rsvpCounts: { going, maybe: 0 },
    capacity: opts.capacity ?? null,
    myRsvp: opts.myRsvp ?? null,
    previewAttendees: (opts.faces ?? []).map((i) => people[i]),
    totalAttendees: going,
    waitlistCount: opts.waitlistCount ?? 0,
    waitlistPosition: null,
    conflict: opts.conflict ?? null,
    organizer: { id: 'dev-ev-org', fullName: 'Career services' },
  }
}

const debate = ev('dev-ev-debate', 'club', 'Debate club selections', 'Room 209', at(2, 16, 30), 2, 18, { myRsvp: 'going' })

const EVENTS: Event[] = [
  ev('dev-ev-career', 'career_fair', 'UIU career fair 2026: 40 employers on campus', 'Multipurpose hall, level 5', at(0, 10), 30, 246, {
    capacity: 300,
    myRsvp: 'going',
    faces: [0, 1, 2],
  }),
  ev('dev-ev-seminar', 'seminar', 'Research seminar: applied NLP for Bangla', 'Room 512, academic building', at(2, 16), 2, 31, {
    myRsvp: 'maybe',
    faces: [3, 4],
    conflict: { id: debate.id, title: debate.title, startsAt: debate.startDate },
  }),
  ev('dev-ev-docker', 'workshop', 'Hands-on Docker for final-year projects', 'Lab 3, level 8', at(4, 14), 3, 40, {
    capacity: 40,
    waitlistCount: 6,
    faces: [5, 0],
  }),
  ev('dev-ev-reunion', 'alumni_meetup', 'CSE batch 18 reunion and networking evening', 'Gulshan, Dhaka', at(9, 18), 4, 0),
  ev('dev-ev-robotics', 'club', 'Robotics club open build night', 'Innovation lab, level 9', at(13, 17), 4, 12, { faces: [5] }),
  debate,
  ev('dev-ev-orientation', 'general', 'Orientation day, trimester 253', 'Auditorium', at(-16, 9), 6, 418),
]

const ORGANISERS = [
  { kind: 'group', id: 'dev-org-career', name: 'Career services', avatarUrl: null, upcomingCount: 4 },
  { kind: 'group', id: 'dev-org-robotics', name: 'Robotics club', avatarUrl: null, upcomingCount: 2 },
  { kind: 'user', id: 'dev-org-cse', name: 'Dept. of CSE', avatarUrl: null, upcomingCount: 1 },
]

const page = (items: Event[]) => ({ data: { items, total: items.length, page: 1, hasMore: false } })

function endOf(e: Event) {
  return new Date(e.endDate ?? e.startDate).getTime()
}

/** Returns the HTTP body to fake for a GET, or null when the URL is not an events list. */
export function resolveEventsMock(url: string, params?: Record<string, unknown>): unknown | null {
  const now = Date.now()
  const type = typeof params?.type === 'string' ? params.type : null
  const from = typeof params?.from === 'string' ? new Date(params.from).getTime() : null
  const to = typeof params?.to === 'string' ? new Date(params.to).getTime() : null
  const byType = (e: Event) => !type || e.type === type
  const inWindow = (e: Event) => {
    const start = new Date(e.startDate).getTime()
    return (from === null || start >= from) && (to === null || start <= to)
  }

  if (url === '/events') {
    const when = params?.when
    const items = EVENTS.filter(byType)
      .filter(inWindow)
      .filter((e) => {
        const start = new Date(e.startDate).getTime()
        if (when === 'upcoming') return start > now
        if (when === 'ongoing') return start <= now && endOf(e) >= now
        if (when === 'past') return endOf(e) < now
        return true
      })
      .sort((a, b) => (when === 'past' ? -1 : 1) * (new Date(a.startDate).getTime() - new Date(b.startDate).getTime()))
    const limit = typeof params?.limit === 'number' ? params.limit : items.length
    return page(items.slice(0, limit))
  }
  if (url === '/events/my') {
    return page(EVENTS.filter((e) => e.myRsvp === 'going').filter(inWindow).sort((a, b) => a.startDate.localeCompare(b.startDate)))
  }
  if (url === '/events/dates') {
    return { data: EVENTS.filter(byType).filter(inWindow).map((e) => ({ startsAt: e.startDate, type: e.type })) }
  }
  if (url === '/events/organisers') return { data: ORGANISERS }
  return null
}
