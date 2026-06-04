import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { FeedPost } from '@uniconnect/shared'
import { api } from '@/lib/axios'
import { POSTS_FEED_KEY, type FeedInfiniteData } from './usePosts'
import { PROFILE_POSTS_KEY, type ProfilePostsPage } from './useProfilePosts'

function removeFromFeeds(queryClient: ReturnType<typeof useQueryClient>, postId: string) {
  queryClient.setQueriesData<FeedInfiniteData>({ queryKey: POSTS_FEED_KEY }, (old) =>
    old
      ? { ...old, pages: old.pages.map((page) => ({ ...page, items: page.items.filter((p) => p.id !== postId) })) }
      : old,
  )
  queryClient.setQueriesData<ProfilePostsPage>({ queryKey: PROFILE_POSTS_KEY }, (old) =>
    old ? { ...old, items: old.items.filter((p) => p.id !== postId) } : old,
  )
}

/** Archive a post — removes it from feeds and surfaces it in the author's Archived view. */
export function useArchivePost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (postId: string) => api.post<{ data: FeedPost }>(`/posts/${postId}/archive`).then((r) => r.data.data),
    onSuccess: (_post, postId) => {
      removeFromFeeds(queryClient, postId)
      queryClient.invalidateQueries({ queryKey: ['posts', 'archived'] })
      toast.success('Post archived')
    },
    onError: () => toast.error('Could not archive the post'),
  })
}

/** Restore an archived post back to the feed. */
export function useUnarchivePost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (postId: string) => api.post<{ data: FeedPost }>(`/posts/${postId}/unarchive`).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts', 'archived'] })
      queryClient.invalidateQueries({ queryKey: POSTS_FEED_KEY })
      toast.success('Post restored')
    },
    onError: () => toast.error('Could not restore the post'),
  })
}
