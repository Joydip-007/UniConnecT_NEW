import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { Conversation } from '../types'

export function useConversation(convId: string) {
  const queryClient = useQueryClient()

  return useQuery<Conversation>({
    queryKey: ['conversation', convId],
    queryFn: () =>
      api
        .get<{ data: Conversation }>(`/conversations/${convId}`)
        .then((r) => r.data.data),
    initialData: () =>
      queryClient.getQueryData<Conversation[]>(['conversations'])?.find((c) => c.id === convId),
    staleTime: 60_000,
    enabled: !!convId,
  })
}
