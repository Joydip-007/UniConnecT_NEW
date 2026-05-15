import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { SearchPagedResult, PostSearchResult } from '../types'

export function useSearchPosts(q: string, limit = 20) {
  return useInfiniteQuery<SearchPagedResult<PostSearchResult>>({
    queryKey: ['search', 'posts', { q }],
    queryFn: ({ pageParam }) =>
      api
        .get<{ data: SearchPagedResult<PostSearchResult> }>('/search/posts', {
          params: { q, page: pageParam, limit },
        })
        .then((r) => r.data.data),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: q.length >= 2,
    staleTime: 30_000,
  })
}
