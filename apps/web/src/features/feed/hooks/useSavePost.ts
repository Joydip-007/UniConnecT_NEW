import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { POSTS_FEED_KEY, type FeedInfiniteData } from './usePosts'

export function useSavePost(postId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ wasSaved }: { wasSaved: boolean }) =>
      wasSaved
        ? api.delete(`/posts/${postId}/save`).then((r) => r.data)
        : api.post(`/posts/${postId}/save`).then((r) => r.data),
    onMutate: async ({ wasSaved }) => {
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
              items: page.items.map((p) => (p.id === postId ? { ...p, isSaved: !wasSaved } : p)),
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
