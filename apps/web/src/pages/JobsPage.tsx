import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Briefcase, Plus, Search } from 'lucide-react'
import { api } from '@/lib/axios'
import { useAuthStore } from '@/stores/authStore'
import { OrangeBtn } from '@/components/Button'
import { JobCard, type Job } from '@/features/jobs/components/JobCard'
import { PostJobForm } from '@/features/jobs/components/PostJobForm'
import { SkeletonJobCard } from '@/components/skeletons/SkeletonJobCard'
import { EmptyState } from '@/components/EmptyState'

// ── Types ─────────────────────────────────────────────────────────────────────

type JobType = 'all' | 'full_time' | 'part_time' | 'internship' | 'remote' | 'contract'

interface JobsPage {
  items: Job[]
  total: number
  page: number
  hasMore: boolean
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS: { label: string; value: JobType }[] = [
  { label: 'All', value: 'all' },
  { label: 'Full-time', value: 'full_time' },
  { label: 'Internship', value: 'internship' },
  { label: 'Remote', value: 'remote' },
  { label: 'Part-time', value: 'part_time' },
  { label: 'Contract', value: 'contract' },
]

// ── JobsPage ──────────────────────────────────────────────────────────────────

export default function JobsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawType = searchParams.get('type') as JobType | null
  const activeType: JobType =
    rawType !== null && TABS.some((t) => t.value === rawType) ? rawType : 'all'

  const [searchInput, setSearchInput] = useState(searchParams.get('q') ?? '')
  const [debouncedSearch, setDebouncedSearch] = useState(searchInput)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const role = useAuthStore((s) => s.user?.role)
  const canPostJob = role === 'alumni' || role === 'faculty' || role === 'admin'
  const [postFormOpen, setPostFormOpen] = useState(false)

  // Debounce search input 400ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 400)
    return () => clearTimeout(t)
  }, [searchInput])

  const queryKey = ['jobs', 'list', { type: activeType, search: debouncedSearch }]

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery<JobsPage>({
      queryKey,
      queryFn: ({ pageParam }) =>
        api
          .get<{ data: JobsPage }>('/jobs', {
            params: {
              page: pageParam,
              isActive: true,
              ...(activeType !== 'all' && { type: activeType }),
              ...(debouncedSearch && { search: debouncedSearch }),
            },
          })
          .then((r) => r.data.data),
      initialPageParam: 1,
      getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    })

  // Infinite scroll sentinel
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 0.1 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const jobs = data?.pages.flatMap((p) => p.items) ?? []
  const allCaughtUp = !isLoading && !hasNextPage && jobs.length > 0

  function setType(value: JobType) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === 'all') {
          next.delete('type')
        } else {
          next.set('type', value)
        }
        return next
      },
      { replace: true },
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Type filter tabs */}
      <nav
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: '4px 8px',
          display: 'flex',
          gap: 2,
          overflowX: 'auto',
        }}
      >
        {TABS.map(({ label, value }) => {
          const active = activeType === value
          return (
            <button
              key={value}
              type="button"
              onClick={() => setType(value)}
              style={{
                flex: '1 0 auto',
                padding: '7px 12px',
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                borderRadius: 'var(--r-pill)',
                border: 'none',
                cursor: 'pointer',
                background: active ? 'var(--uc-indigo-bg)' : 'transparent',
                color: active ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
                transition: 'background 150ms, color 150ms',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </button>
          )
        })}
      </nav>

      {/* Search input */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Search
          size={15}
          strokeWidth={1.5}
          color="var(--text-tertiary)"
          style={{ position: 'absolute', left: 14, pointerEvents: 'none', flexShrink: 0 }}
        />
        <input
          type="search"
          placeholder="Search jobs, companies, skills…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 14px 10px 38px',
            fontSize: 13,
            fontWeight: 400,
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-lg)',
            color: 'var(--text-primary)',
            outline: 'none',
            transition: 'border-color 150ms',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--uc-indigo-bdr)'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-default)'
          }}
        />
      </div>

      {/* Skeleton loading */}
      {isLoading && (
        <>
          <SkeletonJobCard />
          <SkeletonJobCard />
          <SkeletonJobCard />
        </>
      )}

      {/* Job list */}
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} queryKey={queryKey} />
      ))}

      {/* Empty state */}
      {!isLoading && jobs.length === 0 && (
        <EmptyState
          icon={Briefcase}
          title="No jobs found"
          description={
            debouncedSearch
              ? 'Try a different keyword or clear the search.'
              : 'Check back soon for new opportunities.'
          }
        />
      )}

      {/* Loading next page */}
      {isFetchingNextPage && (
        <>
          <SkeletonJobCard />
          <SkeletonJobCard />
        </>
      )}

      {/* Intersection sentinel */}
      <div ref={sentinelRef} style={{ height: 1 }} />

      {/* All caught up */}
      {allCaughtUp && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '4px 0 16px',
          }}
        >
          <div style={{ flex: 1, height: '0.5px', background: 'var(--border-default)' }} />
          <span
            style={{
              fontSize: 12,
              fontWeight: 400,
              color: 'var(--text-tertiary)',
              flexShrink: 0,
            }}
          >
            {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'} shown
          </span>
          <div style={{ flex: 1, height: '0.5px', background: 'var(--border-default)' }} />
        </div>
      )}

      {/* Floating post a job button — alumni / staff / admin only */}
      {canPostJob && (
        <OrangeBtn
          onClick={() => setPostFormOpen(true)}
          style={{
            position: 'fixed',
            bottom: 28,
            right: 28,
            zIndex: 50,
          }}
        >
          <Plus size={15} strokeWidth={2} />
          Post a job
        </OrangeBtn>
      )}

      {postFormOpen && <PostJobForm onClose={() => setPostFormOpen(false)} />}
    </div>
  )
}
