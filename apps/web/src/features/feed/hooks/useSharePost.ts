import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { POSTS_FEED_KEY, type FeedInfiniteData } from './usePosts'

export function useSharePost(postId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (caption?: string) =>
      api.post(`/posts/${postId}/share`, { caption }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: POSTS_FEED_KEY })
    },
  })
}

export function useUnsharePost(sharePostId: string, originalPostId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.delete(`/posts/${sharePostId}/share`).then((r) => r.data),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: POSTS_FEED_KEY })
      const snapshot = qc.getQueriesData<FeedInfiniteData>({ queryKey: POSTS_FEED_KEY })
      // Optimistically remove the share card and decrement share_count on original
      qc.setQueriesData<FeedInfiniteData>({ queryKey: POSTS_FEED_KEY }, (old) => {
        if (!old) return old
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items
              .filter((p) => p.id !== sharePostId)
              .map((p) =>
                p.id === originalPostId
                  ? { ...p, shareCount: Math.max(0, p.shareCount - 1) }
                  : p,
              ),
          })),
        }
      })
      return { snapshot }
    },
    onError: (_err, _vars, context) => {
      if (context?.snapshot) {
        for (const [key, data] of context.snapshot) qc.setQueryData(key, data)
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: POSTS_FEED_KEY }),
  })
}
