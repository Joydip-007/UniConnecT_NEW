export type EventKind = 'general' | 'career_fair' | 'seminar' | 'workshop' | 'alumni_meetup' | 'club'

/** `waitlisted` is a queued RSVP on a full event (migration 115). */
export type RsvpStatus = 'going' | 'maybe' | 'not_going' | 'waitlisted'

/** The segment above the grid: where an event sits relative to now. */
export type EventWhen = 'upcoming' | 'ongoing' | 'past'

export interface EventAttendee {
  id: string
  fullName: string
  avatarUrl: string | null
}

/** The earliest other event the viewer is going to whose time overlaps this one. */
export interface EventConflict {
  id: string
  title: string
  startsAt: string
}

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
  myRsvp: RsvpStatus | null
  previewAttendees: EventAttendee[]
  totalAttendees: number
  waitlistCount: number
  /** 1-based place in the queue, or null when the viewer isn't waitlisted. */
  waitlistPosition: number | null
  conflict: EventConflict | null
  organizer: { id: string; fullName: string }
}

export interface EventsListPage {
  items: Event[]
  total: number
  page: number
  hasMore: boolean
}

export interface EventDate {
  startsAt: string
  type: EventKind
}

export interface TopOrganiser {
  kind: 'group' | 'user'
  id: string
  name: string
  avatarUrl: string | null
  upcomingCount: number
}
