import { useEffect } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { socket } from '@/lib/socket'
import type { FeedComment } from '@uniconnect/shared'

export interface CommentsPage {
  items: FeedComment[]
  total: number
  page: number
  hasMore: boolean
}

export type CommentsData = InfiniteData<CommentsPage>

export function commentsQueryKey(postId: string) {
  return ['posts', 'comments', { postId }] as const
}

export function useComments(postId: string, enabled: boolean) {
  const queryClient = useQueryClient()

  const query = useInfiniteQuery<CommentsPage>({
    queryKey: commentsQueryKey(postId),
    queryFn: ({ pageParam }) =>
      api
        .get<{ data: CommentsPage }>(`/posts/${postId}/comments`, {
          params: { page: pageParam },
        })
        .then((r) => r.data.data),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled,
  })

  useEffect(() => {
    if (!enabled) return

    function onCommentNew({ postId: evPostId, comment }: { postId: string; comment: FeedComment }) {
      if (evPostId !== postId) return
      queryClient.setQueryData<CommentsData>(commentsQueryKey(postId), (old) => {
        if (!old || old.pages.length === 0) return old
        const [first, ...rest] = old.pages as [CommentsPage, ...CommentsPage[]]
        if (!comment.parentId) {
          return {
            ...old,
            pages: [{ ...first, items: [{ ...comment, replies: [] }, ...first.items], total: first.total + 1 }, ...rest],
          }
        }
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((c) =>
              c.id === comment.parentId ? { ...c, replies: [...c.replies, comment] } : c,
            ),
          })),
        }
      })
    }

    function onCommentDeleted({ postId: evPostId, commentId }: { postId: string; commentId: string }) {
      if (evPostId !== postId) return
      queryClient.setQueryData<CommentsData>(commentsQueryKey(postId), (old) => {
        if (!old) return old
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items
              .filter((c) => c.id !== commentId)
              .map((c) => ({ ...c, replies: c.replies.filter((r) => r.id !== commentId) })),
          })),
        }
      })
    }

    socket.on('feed:comment:new', onCommentNew)
    socket.on('feed:comment:deleted', onCommentDeleted)
    return () => {
      socket.off('feed:comment:new', onCommentNew)
      socket.off('feed:comment:deleted', onCommentDeleted)
    }
  }, [enabled, postId, queryClient])

  return query
}
