import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { FeedComment } from '@uniconnect/shared'
import { commentsQueryKey, type CommentsData, type CommentsPage } from './useComments'

export interface CreateCommentInput {
  content: string
  parent_id?: string | null
}

export function useCreateComment(postId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateCommentInput) =>
      api.post<{ data: FeedComment }>(`/posts/${postId}/comments`, input).then((r) => r.data.data),
    onSuccess: (comment) => {
      queryClient.setQueryData<CommentsData>(commentsQueryKey(postId), (old) => {
        if (!old || old.pages.length === 0) return old
        const [first, ...rest] = old.pages as [CommentsPage, ...CommentsPage[]]
        if (!comment.parentId) {
          if (first.items.some((c) => c.id === comment.id)) return old
          return {
            ...old,
            pages: [{ ...first, items: [{ ...comment, replies: [] }, ...first.items], total: first.total + 1 }, ...rest],
          }
        }
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((c) => {
              if (c.id === comment.parentId) {
                if (c.replies.some((r) => r.id === comment.id)) return c
                return { ...c, replies: [...c.replies, comment] }
              }
              return c
            }),
          })),
        }
      })
    },
  })
}
