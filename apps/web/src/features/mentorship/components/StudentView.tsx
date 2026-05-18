import { useEffect, useRef, useState } from 'react'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Users } from 'lucide-react'
import { api } from '@/lib/axios'
import { useAuthStore } from '@/stores/authStore'
import { EmptyState } from '@/components/EmptyState'
import type { AddToast, AlumniMentor, MyRequest, PageResult } from '../types'
import { AlumniCard } from './AlumniCard'
import { AlumniCardSkeleton, RequestRowSkeleton } from './Skeletons'
import { MyRequestRow } from './MyRequestRow'
import { RequestModal } from './RequestModal'

interface StudentViewProps {
  addToast: AddToast
}

export function StudentView({ addToast }: StudentViewProps) {
  const user = useAuthStore((s) => s.user)
  const universityId = user?.universityId ?? ''
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<'browse' | 'mine'>('browse')
  const [modalAlumni, setModalAlumni] = useState<AlumniMentor | null>(null)
  const browseRef = useRef<HTMLDivElement>(null)

  const alumniQueryKey = ['mentorship', 'alumni', { universityId }] as const
  const myRequestsQueryKey = ['mentorship', 'requests', 'mine'] as const

  const {
    data: alumniData,
    fetchNextPage: fetchMoreAlumni,
    hasNextPage: hasMoreAlumni,
    isFetchingNextPage: isFetchingMoreAlumni,
    isLoading: isLoadingAlumni,
  } = useInfiniteQuery<PageResult<AlumniMentor>>({
    queryKey: alumniQueryKey,
    queryFn: ({ pageParam }) =>
      api
        .get<{ data: PageResult<AlumniMentor> }>('/mentorship/alumni', {
          params: { page: pageParam, limit: 20 },
        })
        .then((r) => r.data.data),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  })

  const { data: myRequestsData, isLoading: isLoadingMine } = useQuery<PageResult<MyRequest>>({
    queryKey: myRequestsQueryKey,
    queryFn: () =>
      api
        .get<{ data: PageResult<MyRequest> }>('/mentorship/requests/mine', {
          params: { limit: 100 },
        })
        .then((r) => r.data.data),
  })

  const myRequests = myRequestsData?.items ?? []
  const sentAlumniIds = new Set(myRequests.map((r) => r.alumni.id))

  useEffect(() => {
    const sentinel = browseRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMoreAlumni && !isFetchingMoreAlumni) {
          fetchMoreAlumni()
        }
      },
      { threshold: 0.1 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMoreAlumni, isFetchingMoreAlumni, fetchMoreAlumni])

  const alumni = alumniData?.pages.flatMap((p) => p.items) ?? []

  function handleRequestSuccess(alumniName: string) {
    setModalAlumni(null)
    addToast(`Request sent to ${alumniName}`)
    void queryClient.invalidateQueries({ queryKey: myRequestsQueryKey })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <nav
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: '4px 8px',
          display: 'flex',
          gap: 2,
        }}
      >
        {(['browse', 'mine'] as const).map((tab) => {
          const active = activeTab === tab
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: '7px 12px',
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                borderRadius: 'var(--r-pill)',
                border: 'none',
                cursor: 'pointer',
                background: active ? 'var(--uc-indigo-bg)' : 'transparent',
                color: active ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
                transition: 'background 150ms, color 150ms',
              }}
            >
              {tab === 'browse' ? 'Browse mentors' : 'My requests'}
            </button>
          )
        })}
      </nav>

      {activeTab === 'browse' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {isLoadingAlumni && (
            <>
              <AlumniCardSkeleton />
              <AlumniCardSkeleton />
              <AlumniCardSkeleton />
            </>
          )}

          {alumni.map((alumnus) => (
            <AlumniCard
              key={alumnus.id}
              alumnus={alumnus}
              alreadySent={sentAlumniIds.has(alumnus.id)}
              onAsk={() => setModalAlumni(alumnus)}
            />
          ))}

          {!isLoadingAlumni && alumni.length === 0 && (
            <EmptyState
              icon={Users}
              title="No mentors available right now"
              description="Alumni who are open to mentorship will appear here."
            />
          )}

          {isFetchingMoreAlumni && (
            <>
              <AlumniCardSkeleton />
              <AlumniCardSkeleton />
            </>
          )}

          <div ref={browseRef} style={{ height: 1 }} />
        </div>
      )}

      {activeTab === 'mine' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {isLoadingMine && (
            <>
              <RequestRowSkeleton />
              <RequestRowSkeleton />
            </>
          )}

          {myRequests.map((req) => (
            <MyRequestRow key={req.id} request={req} />
          ))}

          {!isLoadingMine && myRequests.length === 0 && (
            <EmptyState
              icon={BookOpen}
              title="No mentorship requests yet"
              description="Browse alumni above to get started."
              action={{ label: 'Browse mentors', onClick: () => setActiveTab('browse') }}
            />
          )}
        </div>
      )}

      {modalAlumni && (
        <RequestModal
          alumni={modalAlumni}
          onClose={() => setModalAlumni(null)}
          onSuccess={handleRequestSuccess}
        />
      )}
    </div>
  )
}
