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
  /** Posts only: a future publish time means this is scheduled, not a plain draft. */
  publishAt: string | null
}

export interface MyDrafts {
  items: DraftItem[]
  counts: Record<DraftKind, number>
}

/**
 * `enabled` exists for the left rail, which mounts on every page: roles with no
 * authoring surface (driver) have no drafts row, so they should not pay the request.
 */
export function useMyDrafts(enabled = true) {
  return useQuery({
    queryKey: ['drafts', 'mine'],
    queryFn: () => api.get<{ data: MyDrafts }>('/me/drafts').then((r) => r.data.data),
    staleTime: 15_000,
    enabled,
  })
}
