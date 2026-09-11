import { useQuery, type QueryKey } from '@tanstack/react-query'
import type { AdminContentSummary } from '@uniconnect/shared'
import { api } from '@/lib/axios'

/**
 * Shared by the content queue's stat strip and the Insights "Content mix" card, so both
 * read one cache entry and the per-type numbers on Insights are exactly what clicking
 * through to the queue lists.
 */
export const CONTENT_SUMMARY_KEY: QueryKey = ['admin', 'content', 'summary']

export function useContentSummary() {
  return useQuery<AdminContentSummary>({
    queryKey: CONTENT_SUMMARY_KEY,
    queryFn: () => api.get<{ data: AdminContentSummary }>('/admin/content/summary').then((r) => r.data.data),
    staleTime: 60_000,
  })
}
