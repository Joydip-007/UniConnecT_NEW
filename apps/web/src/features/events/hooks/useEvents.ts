import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { EventTypeFilter } from '../constants'
import type { Event, EventDate, EventsListPage, EventWhen, RsvpStatus, TopOrganiser } from '../types'

interface EventsListParams {
  type: EventTypeFilter
  /** Ignored by the API's callers when a from/to window is set — the page sends one or the other. */
  when: EventWhen | null
  from: string | null
  to: string | null
}

export function useEventsList({ type, when, from, to }: EventsListParams) {
  return useInfiniteQuery({
    queryKey: ['events', 'list', { type, when, from, to }],
    queryFn: ({ pageParam }) =>
      api
        .get<{ data: EventsListPage }>('/events', {
          params: {
            page: pageParam,
            limit: 20,
            ...(type !== 'all' && { type }),
            ...(when && { when }),
            ...(from && { from }),
            ...(to && { to }),
          },
        })
        .then((r) => r.data.data),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
  })
}

/** Start instants in a window, for the date picker's "has events" dots. */
export function useEventDates(from: Date, to: Date, type: EventTypeFilter, enabled: boolean) {
  return useQuery({
    queryKey: ['events', 'dates', { from: from.toISOString(), to: to.toISOString(), type }],
    queryFn: () =>
      api
        .get<{ data: EventDate[] }>('/events/dates', {
          params: { from: from.toISOString(), to: to.toISOString(), ...(type !== 'all' && { type }) },
        })
        .then((r) => r.data.data),
    enabled,
    staleTime: 60_000,
  })
}

/** The viewer's own "going" events from the start of today — the rail's week strip and list. */
export function useMyUpcomingEvents() {
  return useQuery({
    queryKey: ['events', 'my', { from: 'today' }],
    queryFn: () => {
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      return api
        .get<{ data: EventsListPage }>('/events/my', { params: { from: startOfDay.toISOString(), limit: 20 } })
        .then((r) => r.data.data.items)
    },
    staleTime: 60_000,
  })
}

export function useTopOrganisers() {
  return useQuery({
    queryKey: ['events', 'organisers'],
    queryFn: () => api.get<{ data: TopOrganiser[] }>('/events/organisers').then((r) => r.data.data),
    staleTime: 60_000,
  })
}

type ListCache = InfiniteData<EventsListPage, number>

function applyRsvp(event: Event, next: RsvpStatus | null): Event {
  const going = event.rsvpCounts.going - (event.myRsvp === 'going' ? 1 : 0) + (next === 'going' ? 1 : 0)
  const maybe = event.rsvpCounts.maybe - (event.myRsvp === 'maybe' ? 1 : 0) + (next === 'maybe' ? 1 : 0)
  const waitlistCount = event.waitlistCount - (event.myRsvp === 'waitlisted' ? 1 : 0) + (next === 'waitlisted' ? 1 : 0)
  return {
    ...event,
    myRsvp: next,
    rsvpCounts: { going: Math.max(0, going), maybe: Math.max(0, maybe) },
    waitlistCount: Math.max(0, waitlistCount),
    // The server settles the real place in line; the back of the queue is the honest guess.
    waitlistPosition: next === 'waitlisted' ? Math.max(1, waitlistCount) : null,
  }
}

/**
 * RSVP from a card: `null` clears it. Patches every cached event list optimistically so
 * the card, the count and the rail move together, then refetches all `['events']`.
 */
export function useEventRsvp(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (next: RsvpStatus | null) =>
      next === null ? api.delete(`/events/${eventId}/rsvp`) : api.post(`/events/${eventId}/rsvp`, { status: next }),
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: ['events', 'list'] })
      const snapshot = queryClient.getQueriesData<ListCache>({ queryKey: ['events', 'list'] })
      queryClient.setQueriesData<ListCache>({ queryKey: ['events', 'list'] }, (old) => {
        // Other `['events','list',…]` caches (the rail's upcoming strip) aren't paged.
        if (!old || !('pages' in old)) return old
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((e) => (e.id === eventId ? applyRsvp(e, next) : e)),
          })),
        }
      })
      return { snapshot }
    },
    onError: (_err, _next, ctx) => {
      ctx?.snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  })
}

/** Downloads the event's `.ics` — the endpoint needs the bearer token, so a plain link won't do. */
export function useAddToCalendar() {
  return useMutation({
    mutationFn: async ({ eventId, title }: { eventId: string; title: string }) => {
      const res = await api.get<Blob>(`/events/${eventId}/ical`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/calendar' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `${title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'event'}.ics`
      link.click()
      URL.revokeObjectURL(url)
    },
  })
}
