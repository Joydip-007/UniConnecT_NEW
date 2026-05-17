import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { POSTS_FEED_KEY, type FeedInfiniteData } from './usePosts'

export function useUpsertReaction(postId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ wasLiked }: { wasLiked: boolean }) =>
      wasLiked
        ? api.delete(`/posts/${postId}/reactions`).then((r) => r.data)
        : api.post(`/posts/${postId}/reactions`, { reaction_type: 'like' }).then((r) => r.data),
    onMutate: async ({ wasLiked }) => {
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
              items: page.items.map((p) =>
                p.id === postId
                  ? {
                      ...p,
                      myReaction: wasLiked ? null : ('like' as const),
                      reactionCounts: {
                        ...p.reactionCounts,
                        like: wasLiked ? p.reactionCounts.like - 1 : p.reactionCounts.like + 1,
                      },
                    }
                  : p,
              ),
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
