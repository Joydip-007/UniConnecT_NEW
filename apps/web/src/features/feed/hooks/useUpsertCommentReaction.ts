import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { FeedComment } from '@uniconnect/shared'
import { commentsQueryKey, type CommentsData, type CommentsPage } from './useComments'

function patchComment(
  pages: CommentsPage[],
  commentId: string,
  updater: (c: FeedComment) => FeedComment,
): CommentsPage[] {
  return pages.map((page) => ({
    ...page,
    items: page.items.map((c) => {
      if (c.id === commentId) return updater(c)
      return { ...c, replies: c.replies.map((r) => (r.id === commentId ? updater(r) : r)) }
    }),
  }))
}

export function useUpsertCommentReaction(postId: string, commentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ wasLiked }: { wasLiked: boolean }) =>
      wasLiked
        ? api.delete(`/posts/${postId}/comments/${commentId}/reactions`).then((r) => r.data)
        : api.post(`/posts/${postId}/comments/${commentId}/reactions`, { reaction_type: 'like' }).then((r) => r.data),
    onMutate: async ({ wasLiked }) => {
      await queryClient.cancelQueries({ queryKey: commentsQueryKey(postId) })
      const snapshot = queryClient.getQueryData<CommentsData>(commentsQueryKey(postId))
      queryClient.setQueryData<CommentsData>(commentsQueryKey(postId), (old) => {
        if (!old) return old
        return {
          ...old,
          pages: patchComment(old.pages, commentId, (c) => ({
            ...c,
            ownReaction: wasLiked ? null : ('like' as const),
            reactionCounts: {
              ...c.reactionCounts,
              like: wasLiked ? c.reactionCounts.like - 1 : c.reactionCounts.like + 1,
            },
          })),
        }
      })
      return { snapshot }
    },
    onError: (_err, _vars, context) => {
      if (context?.snapshot) queryClient.setQueryData(commentsQueryKey(postId), context.snapshot)
    },
  })
}
