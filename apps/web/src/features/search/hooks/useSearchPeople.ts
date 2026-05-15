import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { SearchPagedResult, UserSearchResult } from '../types'

export function useSearchPeople(q: string, limit = 20) {
  return useInfiniteQuery<SearchPagedResult<UserSearchResult>>({
    queryKey: ['search', 'people', { q }],
    queryFn: ({ pageParam }) =>
      api
        .get<{ data: SearchPagedResult<UserSearchResult> }>('/search/people', {
          params: { q, page: pageParam, limit },
        })
        .then((r) => r.data.data),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: q.length >= 2,
    staleTime: 30_000,
  })
}
