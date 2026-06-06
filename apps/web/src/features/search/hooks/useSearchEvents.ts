import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { SearchPagedResult, EventSearchResult } from '../types'

export function useSearchEvents(q: string, limit = 20, options: { enabled?: boolean } = {}) {
  return useInfiniteQuery<SearchPagedResult<EventSearchResult>>({
    queryKey: ['search', 'events', { q }],
    queryFn: ({ pageParam }) =>
      api
        .get<{ data: SearchPagedResult<EventSearchResult> }>('/search/events', {
          params: { q, page: pageParam, limit },
        })
        .then((r) => r.data.data),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: q.length >= 2 && (options.enabled ?? true),
    staleTime: 30_000,
  })
}
