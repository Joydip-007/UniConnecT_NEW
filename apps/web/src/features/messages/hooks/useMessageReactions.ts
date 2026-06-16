import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { MessageReactionKey } from '@/components/emoji/reactionConfig'

export type MessageReactions = Record<string, { userId: string; fullName: string }[]>

export function useMessageReactions(convId: string, msgId: string) {
  return useQuery({
    queryKey: ['message-reactions', msgId],
    queryFn: () =>
      api
        .get<{ data: MessageReactions }>(`/conversations/${convId}/messages/${msgId}/reactions`)
        .then((r) => r.data.data),
    staleTime: 30_000,
  })
}

export function useUpsertMessageReaction(convId: string, msgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (reaction_type: MessageReactionKey) =>
      api
        .post<{ data: MessageReactions }>(
          `/conversations/${convId}/messages/${msgId}/reactions`,
          { reaction_type },
        )
        .then((r) => r.data.data),
    onSuccess: (data) => {
      qc.setQueryData(['message-reactions', msgId], data)
    },
  })
}

export function useRemoveMessageReaction(convId: string, msgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      api
        .delete<{ data: MessageReactions }>(
          `/conversations/${convId}/messages/${msgId}/reactions`,
        )
        .then((r) => r.data.data),
    onSuccess: (data) => {
      qc.setQueryData(['message-reactions', msgId], data)
    },
  })
}
