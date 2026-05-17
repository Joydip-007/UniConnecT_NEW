import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { FeedPost } from '@uniconnect/shared'

export interface ProfilePostsPage {
  items: FeedPost[]
  total: number
  page: number
  hasMore: boolean
}

export const PROFILE_POSTS_KEY = ['posts', 'profile'] as const

export function useProfilePosts(userId: string) {
  return useQuery<ProfilePostsPage>({
    queryKey: [...PROFILE_POSTS_KEY, { userId }],
    queryFn: () =>
      api
        .get<{ data: ProfilePostsPage }>('/posts', { params: { authorId: userId, limit: 20 } })
        .then((r) => r.data.data),
    enabled: !!userId,
  })
}
