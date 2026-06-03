import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { DraftKind } from './useMyDrafts'

const ENDPOINT: Record<DraftKind, (id: string) => string> = {
  post: (id) => `/posts/${id}`,
  job: (id) => `/jobs/${id}`,
  news: (id) => `/news/${id}`,
  event: (id) => `/events/${id}`,
}

const LIST_KEY: Record<DraftKind, string[]> = {
  post: ['posts', 'feed'],
  job: ['jobs'],
  news: ['news'],
  event: ['events'],
}

/** Publishes a draft of any kind by flipping is_published true via its own PATCH endpoint. */
export function usePublishDraft() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ kind, id }: { kind: DraftKind; id: string }) =>
      api.patch(ENDPOINT[kind](id), { is_published: true }).then((r) => r.data),
    onSuccess: (_data, { kind }) => {
      queryClient.invalidateQueries({ queryKey: ['drafts', 'mine'] })
      queryClient.invalidateQueries({ queryKey: LIST_KEY[kind] })
    },
  })
}
