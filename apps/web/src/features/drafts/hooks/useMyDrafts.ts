import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'

export type DraftKind = 'post' | 'job' | 'news' | 'event'

export interface DraftItem {
  kind: DraftKind
  id: string
  title: string
  excerpt: string | null
  createdAt: string
  updatedAt: string
}

export interface MyDrafts {
  items: DraftItem[]
  counts: Record<DraftKind, number>
}

export function useMyDrafts() {
  return useQuery({
    queryKey: ['drafts', 'mine'],
    queryFn: () => api.get<{ data: MyDrafts }>('/me/drafts').then((r) => r.data.data),
    staleTime: 15_000,
  })
}
