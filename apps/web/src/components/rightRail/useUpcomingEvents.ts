import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'

export interface UpcomingEvent {
  id: string
  title: string
  location: string | null
  startsAt: string
}

export function formatEventDate(iso: string) {
  const d = new Date(iso)
  return {
    day: d.getDate(),
    month: d.toLocaleString('en-US', { month: 'short' }),
    time: d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
  }
}

/**
 * The next three events from today onward. Shared by the right-rail widget and the
 * mobile strip that stands in for it below 767px — one query key, so a phone that
 * rotates to tablet width reads the same cache instead of refetching.
 */
export function useUpcomingEvents() {
  return useQuery({
    queryKey: ['events', 'list', { from: 'today' }],
    queryFn: () => {
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      return api
        .get<{ data: { items: UpcomingEvent[] } }>('/events', {
          params: { from: startOfDay.toISOString(), limit: 3 },
        })
        .then((r) => r.data.data.items)
    },
  })
}
