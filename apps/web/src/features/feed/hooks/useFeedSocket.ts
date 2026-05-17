import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import { socket } from '@/lib/socket'
import type { FeedPost, FeedPoll } from '@uniconnect/shared'
import { POSTS_FEED_KEY, type FeedInfiniteData, type FeedPage } from './usePosts'

// ── Cache shapes ───────────────────────────────────────────────────────────────

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

interface FeedPostNewPayload { post: FeedPost }
interface FeedReactionUpdatedPayload {
  postId: string
  reactionCounts: FeedPost['reactionCounts']
}
interface FeedCommentNewPayload { postId: string; comment: unknown }
interface FeedCommentDeletedPayload { postId: string; commentId: string }
interface FeedPollUpdatedPayload { pollId: string; options: FeedPoll['options'] }

interface NewsPublishedPayload {
  news: NewsItem
}

// ── Partial query key prefixes for fuzzy matching ─────────────────────────────

const NEWS_KEY_PREFIX = ['news', 'list'] as const

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useFeedSocket(universityId: string | undefined) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!universityId) return

    function onPostNew({ post }: FeedPostNewPayload) {
      queryClient.setQueriesData<FeedInfiniteData>(
        { queryKey: POSTS_FEED_KEY },
        (old) => {
          if (!old || old.pages.length === 0) return old
          const [first, ...rest] = old.pages as [FeedPage, ...FeedPage[]]
          // Avoid duplicates (post may already be in cache from optimistic insert)
          if (first.items.some((p) => p.id === post.id)) return old
          return { ...old, pages: [{ ...first, items: [post, ...first.items] }, ...rest] }
        },
      )
    }

    function onReactionUpdated({ postId, reactionCounts }: FeedReactionUpdatedPayload) {
      queryClient.setQueriesData<FeedInfiniteData>(
        { queryKey: POSTS_FEED_KEY },
        (old) => {
          if (!old) return old
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((p) => (p.id === postId ? { ...p, reactionCounts } : p)),
            })),
          }
        },
      )
    }

    function onCommentNew({ postId }: FeedCommentNewPayload) {
      queryClient.setQueriesData<FeedInfiniteData>(
        { queryKey: POSTS_FEED_KEY },
        (old) => {
          if (!old) return old
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((p) =>
                p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p,
              ),
            })),
          }
        },
      )
    }

    function onCommentDeleted({ postId }: FeedCommentDeletedPayload) {
      queryClient.setQueriesData<FeedInfiniteData>(
        { queryKey: POSTS_FEED_KEY },
        (old) => {
          if (!old) return old
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((p) =>
                p.id === postId ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p,
              ),
            })),
          }
        },
      )
    }

    function onPollUpdated({ pollId, options }: FeedPollUpdatedPayload) {
      queryClient.setQueriesData<FeedInfiniteData>(
        { queryKey: POSTS_FEED_KEY },
        (old) => {
          if (!old) return old
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((p) =>
                p.poll?.id === pollId
                  ? {
                      ...p,
                      poll: {
                        ...p.poll,
                        options,
                        totalVotes: options.reduce((sum, o) => sum + o.voteCount, 0),
                      },
                    }
                  : p,
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
    socket.on('feed:reaction:updated', onReactionUpdated)
    socket.on('feed:comment:new', onCommentNew)
    socket.on('feed:comment:deleted', onCommentDeleted)
    socket.on('feed:poll:updated', onPollUpdated)
    socket.on('news:published', onNewsPublished)

    return () => {
      socket.off('feed:post:new', onPostNew)
      socket.off('feed:reaction:updated', onReactionUpdated)
      socket.off('feed:comment:new', onCommentNew)
      socket.off('feed:comment:deleted', onCommentDeleted)
      socket.off('feed:poll:updated', onPollUpdated)
      socket.off('news:published', onNewsPublished)
    }
  }, [universityId, queryClient])
}
