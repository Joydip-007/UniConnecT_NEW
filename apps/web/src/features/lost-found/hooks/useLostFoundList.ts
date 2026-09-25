import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { FilterTab, LFPage } from '../types'

export function useLostFoundList(activeTab: FilterTab) {
  const resolved = activeTab === 'resolved'
  return useInfiniteQuery<LFPage>({
    queryKey: ['lost-found', 'list', { tab: activeTab }],
    queryFn: ({ pageParam }) =>
      api
        .get<{ data: LFPage }>('/lost-found', {
          params: {
            page: pageParam,
            ...((activeTab === 'lost' || activeTab === 'found') && { type: activeTab }),
            isResolved: resolved,
          },
        })
        .then((r) => r.data.data),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  })
}

export function useSavedLostFound() {
  return useInfiniteQuery<LFPage>({
    queryKey: ['lost-found', 'saved'],
    queryFn: ({ pageParam }) =>
      api.get<{ data: LFPage }>('/lost-found/saved', { params: { page: pageParam } }).then((r) => r.data.data),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  })
}
