import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { TagPostsResponse } from '../types'

export function useTagPosts(tag: string) {
  return useInfiniteQuery<TagPostsResponse>({
    queryKey: ['explore', 'tag', tag],
    queryFn: ({ pageParam }) =>
      api
        .get<{ data: TagPostsResponse }>(`/explore/tags/${encodeURIComponent(tag)}`, {
          params: { page: pageParam, limit: 20 },
        })
        .then((r) => r.data.data),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: tag.length > 0,
    staleTime: 60_000,
  })
}
