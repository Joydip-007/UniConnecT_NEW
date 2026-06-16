import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { SearchPagedResult, UserSearchResult } from '../types'

export interface PeopleSearchParams {
  q?: string
  role?: string
  department?: string
  batch?: string
}

export function useSearchPeople(
  params: PeopleSearchParams | string,
  limit = 20,
  options: { enabled?: boolean } = {},
) {
  // Accept either a plain string (legacy: q only) or a filters object
  const filters: PeopleSearchParams = typeof params === 'string' ? { q: params } : params
  const enabled =
    (typeof filters.q === 'string' ||
      !!(filters.role || filters.department || filters.batch)) &&
    (options.enabled ?? true)

  return useInfiniteQuery<SearchPagedResult<UserSearchResult>>({
    queryKey: ['search', 'people', filters],
    queryFn: ({ pageParam }) =>
      api
        .get<{ data: SearchPagedResult<UserSearchResult> }>('/search/people', {
          params: { ...filters, page: pageParam, limit },
        })
        .then((r) => r.data.data),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled,
    staleTime: 30_000,
  })
}
