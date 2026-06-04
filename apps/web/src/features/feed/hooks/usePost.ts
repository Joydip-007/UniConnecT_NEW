import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { FeedPost } from '@uniconnect/shared'

/** Single post by id — backs the /feed/:id permalink. 404s for posts not visible to the viewer. */
export function usePost(postId: string | undefined) {
  return useQuery({
    queryKey: ['posts', 'detail', postId],
    queryFn: () => api.get<{ data: FeedPost }>(`/posts/${postId}`).then((r) => r.data.data),
    enabled: Boolean(postId),
  })
}
