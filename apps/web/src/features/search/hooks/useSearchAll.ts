import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { SearchAllResult } from '../types'

export function useSearchAll(q: string, limit = 3, options: { enabled?: boolean } = {}) {
  return useQuery<SearchAllResult>({
    queryKey: ['search', 'all', { q }],
    queryFn: () =>
      api
        .get<{ data: SearchAllResult }>('/search', { params: { q, limit } })
        .then((r) => r.data.data),
    enabled: q.length >= 2 && (options.enabled ?? true),
    staleTime: 30_000,
  })
}
