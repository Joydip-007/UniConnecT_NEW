import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { POSTS_FEED_KEY, type FeedInfiniteData } from './usePosts'
import { PROFILE_POSTS_KEY, type ProfilePostsPage } from './useProfilePosts'

export function useDeletePost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (postId: string) =>
      api.delete(`/posts/${postId}`).then((r) => r.data),
    onSuccess: (_, postId) => {
      queryClient.setQueriesData<FeedInfiniteData>(
        { queryKey: POSTS_FEED_KEY },
        (old) => {
          if (!old) return old
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.filter((p) => p.id !== postId),
            })),
          }
        },
      )
      queryClient.setQueriesData<ProfilePostsPage>(
        { queryKey: PROFILE_POSTS_KEY },
        (old) => {
          if (!old) return old
          return { ...old, items: old.items.filter((p) => p.id !== postId) }
        },
      )
    },
  })
}
