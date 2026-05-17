import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { commentsQueryKey, type CommentsData } from './useComments'
import { POSTS_FEED_KEY, type FeedInfiniteData } from './usePosts'

export function useDeleteComment(postId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (commentId: string) =>
      api.delete(`/posts/${postId}/comments/${commentId}`).then((r) => r.data),
    onSuccess: (_, commentId) => {
      queryClient.setQueryData<CommentsData>(commentsQueryKey(postId), (old) => {
        if (!old) return old
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items
              .filter((c) => c.id !== commentId)
              .map((c) => ({ ...c, replies: c.replies.filter((r) => r.id !== commentId) })),
          })),
        }
      })
      queryClient.setQueriesData<FeedInfiniteData>(
        { queryKey: POSTS_FEED_KEY },
        (old) => {
          if (!old) return old
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((p) =>
                p.id === postId ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p,
              ),
            })),
          }
        },
      )
    },
  })
}
