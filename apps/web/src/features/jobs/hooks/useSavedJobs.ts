import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { useAuthStore } from '@/stores/authStore'
import type { Job } from '@/features/jobs/components/JobCard'

export interface SavedJobsPage {
  items: Job[]
  total: number
  page: number
  hasMore: boolean
}

/**
 * `JobCard` invalidates whatever `queryKey` it is handed after a save toggle, so passing
 * this key through makes an unsave on the Saved page drop the row rather than leaving a
 * card whose bookmark no longer matches the list it is in.
 */
export const SAVED_JOBS_KEY = ['jobs', 'saved'] as const

export function useSavedJobs(enabled = true) {
  const universityId = useAuthStore((s) => s.user?.universityId)
  return useInfiniteQuery<SavedJobsPage>({
    queryKey: [...SAVED_JOBS_KEY, { universityId }],
    queryFn: ({ pageParam }) =>
      api
        .get<{ data: SavedJobsPage }>('/jobs/saved', { params: { page: pageParam } })
        .then((r) => r.data.data),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: enabled && !!universityId,
  })
}
