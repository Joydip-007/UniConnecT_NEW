import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { POSTS_FEED_KEY, type FeedInfiniteData } from './usePosts'
import { PROFILE_POSTS_KEY, type ProfilePostsPage } from './useProfilePosts'

export function useDeletePost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (postId: string) =>
      api.delete(`/posts/${postId}`).then((r) => r.data),
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: POSTS_FEED_KEY })
      await queryClient.cancelQueries({ queryKey: PROFILE_POSTS_KEY })

      const prevFeed = queryClient.getQueriesData<FeedInfiniteData>({ queryKey: POSTS_FEED_KEY })
      const prevProfile = queryClient.getQueriesData<ProfilePostsPage>({ queryKey: PROFILE_POSTS_KEY })

      queryClient.setQueriesData<FeedInfiniteData>({ queryKey: POSTS_FEED_KEY }, (old) => {
        if (!old) return old
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.filter((p) => p.id !== postId),
          })),
        }
      })
      queryClient.setQueriesData<ProfilePostsPage>({ queryKey: PROFILE_POSTS_KEY }, (old) => {
        if (!old) return old
        return { ...old, items: old.items.filter((p) => p.id !== postId) }
      })

      return { prevFeed, prevProfile }
    },
    onError: (_err, _postId, ctx) => {
      if (!ctx) return
      for (const [key, data] of ctx.prevFeed) queryClient.setQueryData(key, data)
      for (const [key, data] of ctx.prevProfile) queryClient.setQueryData(key, data)
    },
  })
}
