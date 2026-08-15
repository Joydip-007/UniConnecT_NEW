import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Briefcase, ChevronDown, Users } from 'lucide-react'
import { api } from '@/lib/axios'
import { PATHS } from '@/router/paths'
import { EmptyState } from '@/components/EmptyState'
import { SkeletonJobCard } from '@/components/skeletons/SkeletonJobCard'
import { ApplicationsList } from './ApplicationsList'
import type { Job } from './JobCard'

interface MyJobsPage {
  items: Job[]
  total: number
  page: number
  hasMore: boolean
}

function deadlineLabel(deadline: string | null): { text: string; expired: boolean } {
  if (!deadline) return { text: 'No deadline', expired: false }
  const d = new Date(deadline)
  const expired = d.getTime() < Date.now()
  const text = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return { text: expired ? `Closed ${text}` : `Open until ${text}`, expired }
}

/**
 * The authoring view of `/jobs`: what this user posted, and who applied. Alumni land
 * here by default because posting is why they open the page — browsing is the other
 * tab, not the other way round.
 */
export function MyPostingsPanel() {
  const navigate = useNavigate()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery<MyJobsPage>({
      queryKey: ['jobs', 'my'],
      queryFn: ({ pageParam }) =>
        api
          .get<{ data: MyJobsPage }>('/jobs/my', { params: { page: pageParam } })
          .then((r) => r.data.data),
      initialPageParam: 1,
      getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    })

  const jobs = data?.pages.flatMap((p) => p.items) ?? []

  if (isLoading) {
    return (
      <>
        <SkeletonJobCard />
        <SkeletonJobCard />
      </>
    )
  }

  if (jobs.length === 0) {
    return (
      <EmptyState
        icon={Briefcase}
        title="You have not posted a job yet"
        description="Share an opportunity and applicants will show up here."
      />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {jobs.map((job) => {
        const expanded = expandedId === job.id
        const { text: deadlineText, expired } = deadlineLabel(job.deadline)

        return (
          <div
            key={job.id}
            style={{
              background: 'var(--surface-card)',
              border: '0.5px solid var(--border-default)',
              borderRadius: 'var(--r-lg)',
              padding: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <button
                  type="button"
                  onClick={() => navigate(PATHS.JOB_DETAIL.replace(':id', job.id))}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: 15,
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    lineHeight: 1.35,
                  }}
                >
                  {job.title}
                </button>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>
                  {job.company} · {job.location}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: expired ? 'var(--uc-amber-l)' : 'var(--text-tertiary)',
                    marginTop: 6,
                  }}
                >
                  {deadlineText} · {job.viewCount} {job.viewCount === 1 ? 'view' : 'views'}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : job.id)}
                aria-expanded={expanded}
                className="press-feedback"
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  minHeight: 44,
                  padding: '0 14px',
                  borderRadius: 'var(--r-pill)',
                  border: '0.5px solid var(--border-default)',
                  background: expanded ? 'var(--uc-indigo-bg)' : 'var(--surface-raised)',
                  color: expanded ? 'var(--uc-indigo-xl)' : 'var(--text-primary)',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <Users size={14} />
                {job.applicationCount}
                <ChevronDown
                  size={14}
                  style={{
                    transition: 'transform var(--dur-med, 200ms) var(--ease-out-strong)',
                    transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                />
              </button>
            </div>

            {expanded && (
              <div style={{ marginTop: 14, borderTop: '0.5px solid var(--border-default)', paddingTop: 10 }}>
                <ApplicationsList jobId={job.id} />
              </div>
            )}
          </div>
        )
      })}

      {hasNextPage && (
        <button
          type="button"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="press-feedback"
          style={{
            alignSelf: 'center',
            minHeight: 44,
            padding: '0 18px',
            borderRadius: 'var(--r-pill)',
            border: '0.5px solid var(--border-default)',
            background: 'var(--surface-card)',
            color: 'var(--text-primary)',
            fontSize: 13,
            fontWeight: 500,
            cursor: isFetchingNextPage ? 'default' : 'pointer',
          }}
        >
          {isFetchingNextPage ? 'Loading…' : 'Show more'}
        </button>
      )}
    </div>
  )
}
