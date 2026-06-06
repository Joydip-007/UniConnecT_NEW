import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { SearchPagedResult, PostSearchResult } from '../types'

export interface PostsSearchParams {
  q?: string
  tag?: string
}

export function useSearchPosts(
  params: PostsSearchParams | string,
  limit = 20,
  options: { enabled?: boolean } = {},
) {
  // Accept either a plain string (legacy: q only) or a filters object
  const filters: PostsSearchParams = typeof params === 'string' ? { q: params } : params
  const enabled = ((!!filters.q && filters.q.length >= 2) || !!filters.tag) && (options.enabled ?? true)

  return useInfiniteQuery<SearchPagedResult<PostSearchResult>>({
    queryKey: ['search', 'posts', filters],
    queryFn: ({ pageParam }) =>
      api
        .get<{ data: SearchPagedResult<PostSearchResult> }>('/search/posts', {
          params: { ...filters, page: pageParam, limit },
        })
        .then((r) => r.data.data),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled,
    staleTime: 30_000,
  })
}
