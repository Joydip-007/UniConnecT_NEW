import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { AttachmentInput, FeedPost } from '@uniconnect/shared'
import { POSTS_FEED_KEY, type FeedInfiniteData, type FeedPage } from './usePosts'

export interface CreatePostInput {
  type: 'post' | 'announcement' | 'lost_found' | 'event_promo'
  content: string
  media_urls?: string[]
  attachments?: AttachmentInput[]
  poll?: { question: string; options: string[]; expires_at?: string | null }
  group_id?: string | null
  /** false → save as a private draft; it must NOT be inserted into the live feed. */
  is_published?: boolean
  /** Future ISO time → schedule the post; it stays out of the feed until then. */
  publish_at?: string
}

export function useCreatePost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreatePostInput) =>
      api.post<{ data: FeedPost }>('/posts', input).then((r) => r.data.data),
    onSuccess: (newPost, variables) => {
      if (variables.group_id) {
        queryClient.invalidateQueries({ queryKey: ['groups', variables.group_id, 'posts'] })
      }
      // Drafts never enter the feed cache — they live only in the Drafts view.
      if (variables.is_published === false) {
        queryClient.invalidateQueries({ queryKey: ['drafts', 'mine'] })
        return
      }
      queryClient.setQueriesData<FeedInfiniteData>(
        { queryKey: POSTS_FEED_KEY },
        (old) => {
          if (!old || old.pages.length === 0) return old
          const [first, ...rest] = old.pages as [FeedPage, ...FeedPage[]]
          return {
            ...old,
            pages: [{ ...first, items: [newPost, ...first.items], total: first.total + 1 }, ...rest],
          }
        },
      )
    },
  })
}
