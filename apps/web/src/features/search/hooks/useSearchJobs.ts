import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { SearchPagedResult, JobSearchResult } from '../types'

export function useSearchJobs(q: string, limit = 20) {
  return useInfiniteQuery<SearchPagedResult<JobSearchResult>>({
    queryKey: ['search', 'jobs', { q }],
    queryFn: ({ pageParam }) =>
      api
        .get<{ data: SearchPagedResult<JobSearchResult> }>('/search/jobs', {
          params: { q, page: pageParam, limit },
        })
        .then((r) => r.data.data),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: q.length >= 2,
    staleTime: 30_000,
  })
}
