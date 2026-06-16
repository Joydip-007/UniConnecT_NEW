import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { FeedComment } from '@uniconnect/shared'
import type { ReactionKey } from '@/components/emoji/reactionConfig'
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

interface UpsertCommentReactionVars {
  current: ReactionKey | null
  next: ReactionKey
}

export function useUpsertCommentReaction(postId: string, commentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ current, next }: UpsertCommentReactionVars) =>
      current === next
        ? api.delete(`/posts/${postId}/comments/${commentId}/reactions`).then((r) => r.data)
        : api
            .post(`/posts/${postId}/comments/${commentId}/reactions`, { reaction_type: next })
            .then((r) => r.data),
    onMutate: async ({ current, next }) => {
      const removing = current === next
      await queryClient.cancelQueries({ queryKey: commentsQueryKey(postId) })
      const snapshot = queryClient.getQueryData<CommentsData>(commentsQueryKey(postId))
      queryClient.setQueryData<CommentsData>(commentsQueryKey(postId), (old) => {
        if (!old) return old
        return {
          ...old,
          pages: patchComment(old.pages, commentId, (c) => {
            const counts = { ...c.reactionCounts }
            if (current) counts[current] = Math.max(0, (counts[current] ?? 0) - 1)
            if (!removing) counts[next] = (counts[next] ?? 0) + 1
            return { ...c, ownReaction: removing ? null : next, reactionCounts: counts }
          }),
        }
      })
      return { snapshot }
    },
    onError: (_err, _vars, context) => {
      if (context?.snapshot) queryClient.setQueryData(commentsQueryKey(postId), context.snapshot)
    },
  })
}
