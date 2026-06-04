import { useInfiniteQuery } from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { useAuthStore } from '@/stores/authStore'
import type { FeedPost, FeedSort } from '@uniconnect/shared'

export type FeedFilter = 'all' | 'post' | 'news' | 'event_promo' | 'announcement' | 'lost_found'

export interface FeedPage {
  items: FeedPost[]
  total: number
  page: number
  hasMore: boolean
}

export type FeedInfiniteData = InfiniteData<FeedPage>

export const POSTS_FEED_KEY = ['posts', 'feed'] as const

export function usePosts(filter: FeedFilter, sort: FeedSort = 'recent') {
  const universityId = useAuthStore((s) => s.user?.universityId)
  return useInfiniteQuery<FeedPage>({
    queryKey: [...POSTS_FEED_KEY, { universityId, type: filter, sort }],
    queryFn: ({ pageParam }) =>
      api
        .get<{ data: FeedPage }>('/posts', {
          params: { page: pageParam, sort, ...(filter !== 'all' && { type: filter }) },
        })
        .then((r) => r.data.data),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: !!universityId,
  })
}
