import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import { socket } from '@/lib/socket'
import type { FeedPost } from '@/features/feed/components/PostCard'

// ── Cache shapes ───────────────────────────────────────────────────────────────

interface FeedPage {
  items: FeedPost[]
  hasMore: boolean
  page: number
}

// NewsPage not yet built — key and shape follow project conventions.
interface NewsItem {
  id: string
}

interface NewsPage {
  items: NewsItem[]
  hasMore: boolean
  page: number
}

// ── Socket payload shapes (docs/socket-events.md#feed-events) ─────────────────

interface FeedPostNewPayload {
  post: FeedPost
}

interface FeedReactionNewPayload {
  postId: string
  reactionType: keyof FeedPost['reactionCounts']
  count: number
}

interface FeedCommentNewPayload {
  postId: string
  comment: unknown
}

interface NewsPublishedPayload {
  news: NewsItem
}

// ── Partial query key prefixes for fuzzy matching ─────────────────────────────

const FEED_KEY_PREFIX = ['posts', 'feed'] as const
const NEWS_KEY_PREFIX = ['news', 'list'] as const

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useFeedSocket(universityId: string | undefined) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!universityId) return

    function onPostNew({ post }: FeedPostNewPayload) {
      queryClient.setQueriesData<InfiniteData<FeedPage>>(
        { queryKey: FEED_KEY_PREFIX },
        (old) => {
          if (!old || old.pages.length === 0) return old
          const [first, ...rest] = old.pages as [FeedPage, ...FeedPage[]]
          return {
            ...old,
            pages: [{ ...first, items: [post, ...first.items] }, ...rest],
          }
        },
      )
    }

    function onReactionNew({ postId, reactionType, count }: FeedReactionNewPayload) {
      queryClient.setQueriesData<InfiniteData<FeedPage>>(
        { queryKey: FEED_KEY_PREFIX },
        (old) => {
          if (!old) return old
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((post) =>
                post.id === postId
                  ? {
                      ...post,
                      reactionCounts: { ...post.reactionCounts, [reactionType]: count },
                    }
                  : post,
              ),
            })),
          }
        },
      )
    }

    function onCommentNew({ postId }: FeedCommentNewPayload) {
      queryClient.setQueriesData<InfiniteData<FeedPage>>(
        { queryKey: FEED_KEY_PREFIX },
        (old) => {
          if (!old) return old
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((post) =>
                post.id === postId
                  ? { ...post, commentCount: post.commentCount + 1 }
                  : post,
              ),
            })),
          }
        },
      )
    }

    function onNewsPublished({ news }: NewsPublishedPayload) {
      queryClient.setQueriesData<InfiniteData<NewsPage>>(
        { queryKey: NEWS_KEY_PREFIX },
        (old) => {
          if (!old || old.pages.length === 0) return old
          const [first, ...rest] = old.pages as [NewsPage, ...NewsPage[]]
          return {
            ...old,
            pages: [{ ...first, items: [news, ...first.items] }, ...rest],
          }
        },
      )
    }

    socket.on('feed:post:new', onPostNew)
    socket.on('feed:reaction:new', onReactionNew)
    socket.on('feed:comment:new', onCommentNew)
    socket.on('news:published', onNewsPublished)

    return () => {
      socket.off('feed:post:new', onPostNew)
      socket.off('feed:reaction:new', onReactionNew)
      socket.off('feed:comment:new', onCommentNew)
      socket.off('news:published', onNewsPublished)
    }
  }, [universityId, queryClient])
}
