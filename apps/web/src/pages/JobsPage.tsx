import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Briefcase, Plus, Search } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { usePageRails } from '@/stores/pageRailStore'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { JobCard } from '@/features/jobs/components/JobCard'
import { MyPostingsPanel } from '@/features/jobs/components/MyPostingsPanel'
import { PostJobForm } from '@/features/jobs/components/PostJobForm'
import { JobsRightRail } from '@/features/jobs/components/JobsRightRail'
import { jobsListQuery } from '@/features/jobs/hooks/useJobs'
import type { JobType } from '@/features/jobs/jobMeta'
import { SkeletonJobCard } from '@/components/skeletons/SkeletonJobCard'
import { EmptyState } from '@/components/EmptyState'

// ── Constants ─────────────────────────────────────────────────────────────────

type TypeFilter = 'all' | JobType

const TABS: { label: string; value: TypeFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Full-time', value: 'full_time' },
  { label: 'Internship', value: 'internship' },
  { label: 'Remote', value: 'remote' },
  { label: 'Part-time', value: 'part_time' },
  { label: 'Contract', value: 'contract' },
]

type JobsView = 'mine' | 'browse'

/**
 * Alumni open `/jobs` to author, not to browse — their rail row is literally "My
 * postings" — so their default view is their own listings with the applicants inline.
 * Faculty and admin may post too, but jobs are a secondary surface for them, so they
 * land on browse and switch in. Students never see the switch: they cannot post, and
 * `POST /jobs` is `requireRole('alumni','faculty','admin')`.
 */
function defaultView(role: string | undefined): JobsView {
  return role === 'alumni' ? 'mine' : 'browse'
}

// ── JobsPage ──────────────────────────────────────────────────────────────────

export default function JobsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawType = searchParams.get('type')
  const activeType: TypeFilter = TABS.find((t) => t.value === rawType)?.value ?? 'all'
  const isMobile = useMediaQuery('(max-width: 767px)')

  const [searchInput, setSearchInput] = useState(searchParams.get('q') ?? '')
  const [debouncedSearch, setDebouncedSearch] = useState(searchInput)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const role = useAuthStore((s) => s.user?.role)
  const canPostJob = role === 'alumni' || role === 'faculty' || role === 'admin'
  const [postFormOpen, setPostFormOpen] = useState(false)

  // The design's right rail is page-scoped: closing-soon for everyone, and the
  // student's own applications — not the role manifest's discovery widgets.
  const rightRail = useMemo(() => <JobsRightRail />, [])
  usePageRails(null, rightRail)

  const rawView = searchParams.get('view')
  const view: JobsView = !canPostJob
    ? 'browse'
    : rawView === 'mine' || rawView === 'browse'
      ? rawView
      : defaultView(role)

  function setView(next: JobsView) {
    const params = new URLSearchParams(searchParams)
    // Keep the role's own default out of the URL so a shared link stays clean.
    if (next === defaultView(role)) params.delete('view')
    else params.set('view', next)
    setSearchParams(params, { replace: true })
  }

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 400)
    return () => clearTimeout(t)
  }, [searchInput])

  const listQuery = jobsListQuery(activeType, debouncedSearch)
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    ...listQuery,
    // An alumnus landing on "My postings" should not also pay for the browse feed.
    enabled: view === 'browse',
  })

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage()
      },
      { threshold: 0.1 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const jobs = data?.pages.flatMap((p) => p.items) ?? []
  const allCaughtUp = !isLoading && !hasNextPage && jobs.length > 0

  function setType(value: TypeFilter) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === 'all') next.delete('type')
        else next.set('type', value)
        return next
      },
      { replace: true },
    )
  }

  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: isMobile ? '0 14px' : '7px 12px',
    minHeight: isMobile ? 36 : undefined,
    fontSize: 13,
    fontWeight: active ? 500 : 400,
    borderRadius: 'var(--r-pill)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
    color: active ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
    transition: 'background 150ms, color 150ms',
  })

  const typeTabs = isMobile ? (
    <div className="rail-scroll" style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
      {TABS.map(({ label, value }) => {
        const active = activeType === value
        return (
          <button
            key={value}
            type="button"
            onClick={() => setType(value)}
            aria-pressed={active}
            style={{ ...tabBtn(active), flexShrink: 0, border: '0.5px solid var(--border-default)', background: active ? 'var(--uc-indigo-bg)' : 'var(--surface-card)' }}
          >
            {label}
          </button>
        )
      })}
    </div>
  ) : (
    <nav
      aria-label="Job types"
      style={{ background: 'var(--surface-card)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-lg)', padding: '4px 8px', display: 'flex', gap: 2, overflowX: 'auto' }}
    >
      {TABS.map(({ label, value }) => {
        const active = activeType === value
        return (
          <button
            key={value}
            type="button"
            onClick={() => setType(value)}
            aria-pressed={active}
            style={{ ...tabBtn(active), flex: '1 0 auto', border: 'none', background: active ? 'var(--uc-indigo-bg)' : 'transparent' }}
          >
            {label}
          </button>
        )
      })}
    </nav>
  )

  const searchBox = (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <Search size={15} strokeWidth={1.5} color="var(--text-tertiary)" style={{ position: 'absolute', left: 14, pointerEvents: 'none' }} />
      <input
        type="search"
        aria-label="Search jobs"
        placeholder="Search jobs, companies, skills…"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className="jobs-search"
        style={{
          width: '100%',
          padding: isMobile ? '11px 14px 11px 38px' : '10px 14px 10px 38px',
          fontSize: 13,
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          color: 'var(--text-primary)',
          outline: 'none',
          boxSizing: 'border-box',
          fontFamily: 'inherit',
        }}
      />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 10 : 12 }}>
      {isMobile && <h1 style={{ margin: 0, fontSize: 18, fontWeight: 500, color: 'var(--text-primary)' }}>Jobs</h1>}

      {/* View switch + Post a job — only for roles the API lets post */}
      {canPostJob && (
        <div style={{ display: 'flex', alignItems: 'stretch', gap: isMobile ? 8 : 10 }}>
          <nav
            aria-label="Jobs views"
            style={{ flex: 1, minWidth: 0, display: 'flex', gap: 2, background: 'var(--surface-card)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-lg)', padding: '4px 6px' }}
          >
            {([
              { key: 'browse', label: 'Browse' },
              { key: 'mine', label: 'My postings' },
            ] as const).map(({ key, label }) => {
              const active = view === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setView(key)}
                  aria-current={active ? 'page' : undefined}
                  style={{
                    flex: 1,
                    padding: isMobile ? '0 14px' : '7px 14px',
                    minHeight: isMobile ? 40 : undefined,
                    fontSize: 13,
                    fontWeight: active ? 500 : 400,
                    borderRadius: 'var(--r-pill)',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                    background: active ? 'var(--uc-indigo-bg)' : 'transparent',
                    color: active ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
                    transition: 'background 150ms, color 150ms',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </nav>
          <button
            type="button"
            onClick={() => setPostFormOpen(true)}
            aria-label="Post a job"
            title="Post a job"
            className="press-feedback"
            style={{
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              border: 'none',
              borderRadius: 'var(--r-pill)',
              background: 'var(--uc-mint)',
              color: 'var(--on-accent)',
              fontFamily: 'inherit',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
              ...(isMobile ? { width: 50, minHeight: 50 } : { padding: '0 18px', minHeight: 44 }),
            }}
          >
            <Plus size={isMobile ? 20 : 15} strokeWidth={2} />
            {!isMobile && 'Post a job'}
          </button>
        </div>
      )}

      {view === 'mine' && <MyPostingsPanel />}

      {view === 'browse' && (
        <>
          {isMobile ? (
            <>
              {searchBox}
              {typeTabs}
            </>
          ) : (
            <>
              {typeTabs}
              {searchBox}
            </>
          )}

          {isLoading && (
            <>
              <SkeletonJobCard />
              <SkeletonJobCard />
              <SkeletonJobCard />
            </>
          )}

          {jobs.map((job) => (
            <JobCard key={job.id} job={job} queryKey={listQuery.queryKey} />
          ))}

          {!isLoading && jobs.length === 0 && (
            <EmptyState
              icon={Briefcase}
              title="No jobs found"
              description={debouncedSearch ? 'Try a different keyword or clear the search.' : 'Check back soon for new opportunities.'}
            />
          )}

          {isFetchingNextPage && (
            <>
              <SkeletonJobCard />
              <SkeletonJobCard />
            </>
          )}

          <div ref={sentinelRef} style={{ height: 1 }} />

          {allCaughtUp && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0 16px' }}>
              <div style={{ flex: 1, height: '0.5px', background: 'var(--border-default)' }} />
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'} shown
              </span>
              <div style={{ flex: 1, height: '0.5px', background: 'var(--border-default)' }} />
            </div>
          )}
        </>
      )}

      {postFormOpen && <PostJobForm onClose={() => setPostFormOpen(false)} onPosted={() => setView('mine')} />}
    </div>
  )
}
