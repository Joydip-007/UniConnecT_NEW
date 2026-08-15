import { useInfiniteQuery } from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { useAuthStore } from '@/stores/authStore'
import type { FeedPost, FeedSort } from '@uniconnect/shared'

export type FeedFilter = 'all' | 'post' | 'news' | 'event_promo' | 'announcement' | 'lost_found' | 'job_promo'

export interface FeedPage {
  items: FeedPost[]
  total: number
  page: number
  hasMore: boolean
}

export type FeedInfiniteData = InfiniteData<FeedPage>

export const POSTS_FEED_KEY = ['posts', 'feed'] as const

/**
 * Narrows the feed by relationship rather than by post type. `my_groups` is the only
 * scope the API accepts; it cannot be expressed as a `type` because group membership
 * is a relationship, not a property of the post.
 */
export type FeedScope = 'my_groups'

export function usePosts(filter: FeedFilter, sort: FeedSort = 'recent', scope?: FeedScope) {
  const universityId = useAuthStore((s) => s.user?.universityId)
  return useInfiniteQuery<FeedPage>({
    queryKey: [...POSTS_FEED_KEY, { universityId, type: filter, sort, scope: scope ?? null }],
    queryFn: ({ pageParam }) =>
      api
        .get<{ data: FeedPage }>('/posts', {
          params: {
            page: pageParam,
            sort,
            ...(filter !== 'all' && { type: filter }),
            ...(scope && { scope }),
          },
        })
        .then((r) => r.data.data),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: !!universityId,
  })
}
