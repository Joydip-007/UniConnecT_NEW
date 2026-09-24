import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { MessageReactionKey } from '@/components/emoji/reactionConfig'

import type { MessageReactions } from '../types'

export type { MessageReactions }

/**
 * Reactions arrive inline on each message (`GET …/messages`), so this is a cache
 * slot seeded from the message rather than a fetch — the mutations below write
 * the server's fresh tally into it.
 */
export function useMessageReactions(msgId: string, initial: MessageReactions | undefined) {
  return useQuery({
    queryKey: ['message-reactions', msgId],
    queryFn: () => initial ?? {},
    initialData: initial ?? {},
    enabled: false,
    staleTime: Infinity,
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
