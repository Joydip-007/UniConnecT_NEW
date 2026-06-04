import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { FeedPost } from '@uniconnect/shared'

interface ArchivedPage {
  items: FeedPost[]
  total: number
  page: number
  hasMore: boolean
}

/** The current user's archived posts (author-only). */
export function useArchivedPosts() {
  return useQuery({
    queryKey: ['posts', 'archived'],
    queryFn: () => api.get<{ data: ArchivedPage }>('/posts/archived').then((r) => r.data.data),
    staleTime: 15_000,
  })
}
