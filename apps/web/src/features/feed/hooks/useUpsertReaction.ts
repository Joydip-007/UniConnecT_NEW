import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { ReactionKey } from '@/components/emoji/reactionConfig'
import { POSTS_FEED_KEY, type FeedInfiniteData } from './usePosts'

interface UpsertReactionVars {
  /** The current reaction the user has (null if none) */
  current: ReactionKey | null
  /** The reaction the user clicked */
  next: ReactionKey
}

export function useUpsertReaction(postId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ current, next }: UpsertReactionVars) =>
      current === next
        ? api.delete(`/posts/${postId}/reactions`).then((r) => r.data)
        : api.post(`/posts/${postId}/reactions`, { reaction_type: next }).then((r) => r.data),
    onMutate: async ({ current, next }) => {
      const removing = current === next
      await queryClient.cancelQueries({ queryKey: POSTS_FEED_KEY })
      const snapshot = queryClient.getQueriesData<FeedInfiniteData>({ queryKey: POSTS_FEED_KEY })
      queryClient.setQueriesData<FeedInfiniteData>(
        { queryKey: POSTS_FEED_KEY },
        (old) => {
          if (!old) return old
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((p) => {
                if (p.id !== postId) return p
                const counts = { ...p.reactionCounts }
                if (current) counts[current] = Math.max(0, (counts[current] ?? 0) - 1)
                if (!removing) counts[next] = (counts[next] ?? 0) + 1
                return { ...p, myReaction: removing ? null : next, reactionCounts: counts }
              }),
            })),
          }
        },
      )
      return { snapshot }
    },
    onError: (_err, _vars, context) => {
      if (context?.snapshot) {
        for (const [key, data] of context.snapshot) {
          queryClient.setQueryData(key, data)
        }
      }
    },
  })
}
