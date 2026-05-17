import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { FeedPost } from '@uniconnect/shared'
import { POSTS_FEED_KEY, type FeedInfiniteData } from './usePosts'
import { PROFILE_POSTS_KEY, type ProfilePostsPage } from './useProfilePosts'

export interface UpdatePostInput {
  content?: string
  media_urls?: string[]
  type?: 'post' | 'announcement' | 'lost_found' | 'event_promo'
  is_pinned?: boolean
}

export function useUpdatePost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ postId, input }: { postId: string; input: UpdatePostInput }) =>
      api.patch<{ data: FeedPost }>(`/posts/${postId}`, input).then((r) => r.data.data),
    onSuccess: (updated) => {
      queryClient.setQueriesData<FeedInfiniteData>(
        { queryKey: POSTS_FEED_KEY },
        (old) => {
          if (!old) return old
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((p) => (p.id === updated.id ? updated : p)),
            })),
          }
        },
      )
      queryClient.setQueriesData<ProfilePostsPage>(
        { queryKey: PROFILE_POSTS_KEY },
        (old) => {
          if (!old) return old
          return { ...old, items: old.items.map((p) => (p.id === updated.id ? updated : p)) }
        },
      )
    },
  })
}
