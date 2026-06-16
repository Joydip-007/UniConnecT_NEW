import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { ReactionKey } from '@/components/emoji/reactionConfig'

export interface ReactionUser {
  userId: string
  fullName: string
  avatarUrl: string | null
  reactionType: ReactionKey
  connectionStatus: 'none' | 'pending_sent' | 'pending_received' | 'connected'
  connectionId: string | null
}

interface ReactionsPage {
  items: ReactionUser[]
  nextCursor: string | null
}

export function usePostReactions(postId: string, type: ReactionKey | 'all') {
  return useInfiniteQuery<ReactionsPage>({
    queryKey: ['posts', 'reactions', postId, type],
    queryFn: ({ pageParam }) =>
      api
        .get<{ data: ReactionsPage }>(`/posts/${postId}/reactions`, {
          params: {
            ...(type !== 'all' && { type }),
            ...(pageParam ? { cursor: pageParam } : {}),
            limit: 20,
          },
        })
        .then((r) => r.data.data),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!postId,
  })
}
