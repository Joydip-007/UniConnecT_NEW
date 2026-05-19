import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { FilterTab, LFPage } from '../types'

export function useLostFoundList(activeTab: FilterTab, showResolved: boolean) {
  return useInfiniteQuery<LFPage>({
    queryKey: ['lost-found', 'list', { type: activeTab, resolved: showResolved }],
    queryFn: ({ pageParam }) =>
      api
        .get<{ data: LFPage }>('/lost-found', {
          params: {
            page: pageParam,
            ...(activeTab !== 'all' && { type: activeTab }),
            isResolved: showResolved,
          },
        })
        .then((r) => r.data.data),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  })
}
