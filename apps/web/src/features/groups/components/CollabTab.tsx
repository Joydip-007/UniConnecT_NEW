import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import { differenceInDays, format, parseISO } from 'date-fns'
import { Briefcase, Clock, MapPin } from 'lucide-react'
import { api } from '@/lib/axios'
import type { Group, GroupCollabJob } from '../types'

interface CollabPage {
  items: GroupCollabJob[]
  hasMore: boolean
  page: number
}

export function CollabTab({ group }: { group: Group }) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery<CollabPage>({
    queryKey: ['groups', 'collaborations', group.id],
    queryFn: ({ pageParam }) =>
      api
        .get<{ data: CollabPage }>(`/groups/${group.id}/collaborations`, { params: { page: pageParam } })
        .then((r) => r.data.data),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  })

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

  const items = data?.pages.flatMap((p) => p.items) ?? []

  if (isLoading) {
    return <SkeletonList />
  }

  const emptyHint = group.type === 'department'
    ? "No jobs posted by people in this department yet."
    : "No jobs posted by members of this group yet."

  if (items.length === 0) {
    return (
      <div
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: '48px 24px',
          textAlign: 'center',
        }}
      >
        <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
          No collaborations yet
        </p>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)' }}>{emptyHint}</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((job) => (
        <JobRow key={job.id} job={job} onClick={() => navigate(`/jobs/${job.id}`)} />
      ))}
      <div ref={sentinelRef} style={{ height: 1 }} />
      {isFetchingNextPage && <SkeletonList />}
    </div>
  )
}

function JobRow({ job, onClick }: { job: GroupCollabJob; onClick: () => void }) {
  const daysLeft = differenceInDays(parseISO(job.deadline), new Date())
  const deadlineLabel =
    daysLeft < 0
      ? 'Expired'
      : daysLeft === 0
      ? 'Closes today'
      : `Closes ${format(parseISO(job.deadline), 'MMM d')}`

  return (
    <div
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      role="button"
      tabIndex={0}
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: '14px 16px',
        cursor: 'pointer',
        display: 'flex',
        gap: 12,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 'var(--r-md)',
          background: 'var(--uc-orange-bg)',
          border: '0.5px solid var(--uc-orange-bdr)',
          color: 'var(--uc-orange-l)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Briefcase size={18} strokeWidth={1.5} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {job.title}
        </h3>
        <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>{job.company}</p>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginTop: 6,
            fontSize: 12,
            color: 'var(--text-tertiary)',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <MapPin size={11} strokeWidth={1.5} />
            {job.location}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Clock size={11} strokeWidth={1.5} />
            {deadlineLabel}
          </span>
          <span style={{ color: 'var(--text-tertiary)' }}>by {job.postedBy.fullName}</span>
        </div>
      </div>
    </div>
  )
}

function SkeletonList() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          style={{
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-lg)',
            padding: '14px 16px',
            display: 'flex',
            gap: 12,
          }}
        >
          <div style={{ width: 40, height: 40, background: 'var(--surface-raised)', borderRadius: 'var(--r-md)' }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ height: 13, width: '50%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
            <div style={{ height: 11, width: '35%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
          </div>
        </div>
      ))}
    </div>
  )
}
