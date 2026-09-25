import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'

export interface TrendingTag {
  name: string
  postCount: number
}

export function useTrendingTags() {
  return useQuery({
    queryKey: ['feed', 'trending'],
    queryFn: () =>
      api
        .get<{ data: { trendingTags: TrendingTag[] } }>('/posts/trending')
        .then((r) => r.data.data.trendingTags),
    staleTime: 60_000,
  })
}
