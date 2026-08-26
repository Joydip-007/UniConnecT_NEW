import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { useAuthStore } from '@/stores/authStore'
import type { FeedPage } from './usePosts'

/**
 * Deliberately *not* under `POSTS_FEED_KEY`. `useSavePost` optimistically rewrites every
 * query under that prefix, which would flip `isSaved` on a row the Saved page is showing
 * without removing it — a bookmark that reads "not saved" on the saved list. `PostCard`
 * holds its own `localSaved`, so the icon still responds instantly; the row leaves on the
 * next fetch, which is the behaviour the design asks for ("stays here until you remove it").
 */
export const SAVED_POSTS_KEY = ['posts', 'saved'] as const

export function useSavedPosts(enabled = true) {
  const universityId = useAuthStore((s) => s.user?.universityId)
  return useInfiniteQuery<FeedPage>({
    queryKey: [...SAVED_POSTS_KEY, { universityId }],
    queryFn: ({ pageParam }) =>
      api
        .get<{ data: FeedPage }>('/posts/saved', { params: { page: pageParam } })
        .then((r) => r.data.data),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: enabled && !!universityId,
  })
}
