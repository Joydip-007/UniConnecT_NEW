import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { SearchPagedResult, GroupSearchResult } from '../types'

export function useSearchGroups(q: string, limit = 20, options: { enabled?: boolean } = {}) {
  return useInfiniteQuery<SearchPagedResult<GroupSearchResult>>({
    queryKey: ['search', 'groups', { q }],
    queryFn: ({ pageParam }) =>
      api
        .get<{ data: SearchPagedResult<GroupSearchResult> }>('/search/groups', {
          params: { q, page: pageParam, limit },
        })
        .then((r) => r.data.data),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: q.length >= 2 && (options.enabled ?? true),
    staleTime: 30_000,
  })
}
