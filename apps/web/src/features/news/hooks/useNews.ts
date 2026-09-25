import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { NewsItem, NewsListPage, NewsRail, NewsWritePayload } from '../types'

interface NewsListParams {
  category?: string
  tag?: string
  limit?: number
}

export function useNewsList({ category = 'all', tag, limit }: NewsListParams = {}) {
  return useQuery({
    queryKey: ['news', 'list', { category, tag: tag ?? null, limit: limit ?? null }],
    queryFn: () =>
      api
        .get<{ data: NewsListPage }>('/news', {
          params: {
            ...(category !== 'all' && { category }),
            ...(tag && { tag }),
            ...(limit && { limit }),
          },
        })
        .then((r) => r.data.data.items),
  })
}

export function useNewsDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['news', 'detail', id],
    queryFn: () => api.get<{ data: NewsItem }>(`/news/${id}`).then((r) => r.data.data),
    enabled: Boolean(id),
  })
}

export function useNewsRail() {
  return useQuery({
    queryKey: ['news', 'rail'],
    queryFn: () => api.get<{ data: NewsRail }>('/news/rail').then((r) => r.data.data),
    staleTime: 60_000,
  })
}

function useInvalidateNews() {
  const queryClient = useQueryClient()
  return (id?: string) => {
    queryClient.invalidateQueries({ queryKey: ['news'] })
    if (id) queryClient.invalidateQueries({ queryKey: ['news', 'detail', id] })
    queryClient.invalidateQueries({ queryKey: ['drafts', 'mine'] })
    queryClient.invalidateQueries({ queryKey: ['content-sync', 'pending'] })
  }
}

/** Creates (no id) or updates an article; resolves to the saved article. */
export function useSaveNews() {
  const invalidate = useInvalidateNews()
  return useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: NewsWritePayload }) =>
      (id ? api.patch<{ data: NewsItem }>(`/news/${id}`, payload) : api.post<{ data: NewsItem }>('/news', payload)).then(
        (r) => r.data.data,
      ),
    onSuccess: (news) => invalidate(news.id),
  })
}

export function useSetNewsPublished(id: string) {
  const invalidate = useInvalidateNews()
  return useMutation({
    mutationFn: (isPublished: boolean) =>
      api.patch<{ data: NewsItem }>(`/news/${id}`, { is_published: isPublished }).then((r) => r.data.data),
    onSuccess: () => invalidate(id),
  })
}
