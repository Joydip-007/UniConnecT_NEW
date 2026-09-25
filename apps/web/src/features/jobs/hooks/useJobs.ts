import { infiniteQueryOptions, useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query'
import { evaluateJobEligibility, type ApplicationStatus } from '@uniconnect/shared'
import { api } from '@/lib/axios'
import { queryClient } from '@/lib/queryClient'
import { useAuthStore } from '@/stores/authStore'
import type { Job } from '@/features/jobs/components/JobCard'
import type { JobType } from '@/features/jobs/jobMeta'

export interface JobsListPage {
  items: Job[]
  total: number
  page: number
  hasMore: boolean
}

/**
 * The browse board. The server already orders it closing-soonest first, so the right
 * rail's "Closing this week" reads the first page of the unfiltered board from this
 * same cache entry instead of asking for a second list.
 */
export function jobsListQuery(type: JobType | 'all', search: string) {
  return infiniteQueryOptions({
    queryKey: ['jobs', 'list', { type, search }],
    queryFn: ({ pageParam }) =>
      api
        .get<{ data: JobsListPage }>('/jobs', {
          params: {
            page: pageParam,
            ...(type !== 'all' && { type }),
            ...(search && { search }),
          },
        })
        .then((r) => r.data.data),
    initialPageParam: 1,
    getNextPageParam: (last: JobsListPage) => (last.hasMore ? last.page + 1 : undefined),
  })
}

export function useClosingThisWeek() {
  const query = useInfiniteQuery({ ...jobsListQuery('all', ''), staleTime: 60_000 })
  const now = Date.now()
  const weekOut = now + 7 * 24 * 60 * 60 * 1000
  const items = (query.data?.pages[0]?.items ?? []).filter((j) => {
    if (!j.deadline) return false
    const t = new Date(j.deadline).getTime()
    return t >= now && t <= weekOut
  })
  return { ...query, items: items.slice(0, 3) }
}

export interface MyApplication {
  id: string
  jobId: string
  status: ApplicationStatus
  createdAt: string
  updatedAt: string
  job: {
    id: string
    title: string
    company: string
    deadline: string | null
    isActive: boolean
  }
}

export const MY_APPLICATIONS_KEY = ['jobs', 'applications', 'my'] as const

export function useMyApplications(enabled: boolean) {
  return useQuery({
    queryKey: MY_APPLICATIONS_KEY,
    queryFn: () =>
      api
        .get<{ data: { items: MyApplication[]; total: number } }>('/jobs/applications/my', {
          params: { limit: 20 },
        })
        .then((r) => r.data.data),
    enabled,
    staleTime: 60_000,
  })
}

/** Every jobs cache that renders an application state: the boards, saved, and mine. */
function invalidateJobs() {
  return queryClient.invalidateQueries({ queryKey: ['jobs'] })
}

export function useWithdrawApplication() {
  return useMutation({
    mutationFn: (jobId: string) => api.post(`/jobs/${jobId}/withdraw`).then((r) => r.data),
    onSuccess: invalidateJobs,
  })
}

export function useApplyToJob(jobId: string) {
  return useMutation({
    mutationFn: (body: { resumeUrl: string | null; coverLetter?: string }) =>
      api.post(`/jobs/${jobId}/apply`, body).then((r) => r.data),
    onSuccess: invalidateJobs,
  })
}

/** The signed-in viewer's eligibility for a job; students only — the rules are written for them. */
export function useJobEligibility(job: Job) {
  const user = useAuthStore((s) => s.user)
  const p = user?.profile
  const isStudent = user?.role === 'student'
  const verdict = evaluateJobEligibility(
    {
      eligibleDepartments: job.eligibleDepartments ?? null,
      eligibleBatches: job.eligibleBatches ?? null,
      minCgpa: job.minCgpa ?? null,
      requirements: job.requirements,
    },
    {
      department: p?.department ?? null,
      batchYear: p?.batchYear ?? null,
      cgpa: p?.cgpa ?? null,
      skills: p?.skills ?? [],
    },
  )
  return { isStudent, verdict }
}
