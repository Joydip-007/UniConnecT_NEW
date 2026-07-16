import { useEffect, useMemo, useRef, useState } from 'react'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Users } from 'lucide-react'
import { api } from '@/lib/axios'
import { socket } from '@/lib/socket'
import { useAuthStore } from '@/stores/authStore'
import { EmptyState } from '@/components/EmptyState'
import type { AddToast, AlumniMentor, MyRequest, PageResult } from '../types'
import { AlumniCard } from './AlumniCard'
import { AlumniCardSkeleton, RequestRowSkeleton } from './Skeletons'
import { MyRequestRow } from './MyRequestRow'
import { RequestModal } from './RequestModal'
import { SessionLogPanel } from './SessionLogPanel'

interface StudentViewProps {
  addToast: AddToast
}

export function StudentView({ addToast }: StudentViewProps) {
  const user = useAuthStore((s) => s.user)
  const universityId = user?.universityId ?? ''
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<'browse' | 'mine'>('browse')
  const [filterText, setFilterText] = useState('')
  const [modalAlumni, setModalAlumni] = useState<AlumniMentor | null>(null)
  const browseRef = useRef<HTMLDivElement>(null)

  const alumniQueryKey = ['mentorship', 'alumni', { universityId }] as const
  const myRequestsQueryKey = useMemo(() => ['mentorship', 'requests', 'mine'] as const, [])

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

  // Socket handlers for request lifecycle events
  useEffect(() => {
    function onAccepted() {
      void queryClient.invalidateQueries({ queryKey: myRequestsQueryKey })
      addToast('Your request was accepted! A chat thread has been opened.', 'success')
    }
    function onExpired() {
      void queryClient.invalidateQueries({ queryKey: myRequestsQueryKey })
      addToast('A mentorship request expired after 7 days without a response.', 'info')
    }
    socket.on('mentorship:request:accepted', onAccepted)
    socket.on('mentorship:request:expired', onExpired)
    return () => {
      socket.off('mentorship:request:accepted', onAccepted)
      socket.off('mentorship:request:expired', onExpired)
    }
  }, [queryClient, addToast, myRequestsQueryKey])

  function handleRequestSuccess(alumniName: string) {
    setModalAlumni(null)
    addToast(`Request sent to ${alumniName}`)
    void queryClient.invalidateQueries({ queryKey: myRequestsQueryKey })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <nav
        role="tablist"
        aria-label="Mentor sections"
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
              role="tab"
              aria-selected={active}
              id={`student-tab-${tab}`}
              onClick={() => {
                setActiveTab(tab)
                if (tab !== 'browse') setFilterText('')
              }}
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
        <div role="tabpanel" aria-labelledby="student-tab-browse">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              type="search"
              placeholder="Search by name, skill, or department…"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--surface-raised)',
                border: '0.5px solid var(--border-default)',
                borderRadius: 'var(--r-md)',
                color: 'var(--text-primary)',
                fontSize: 13,
                fontWeight: 400,
                padding: '8px 12px',
                boxSizing: 'border-box',
                transition: 'border-color 150ms',
                fontFamily: 'inherit',
              }}
            />

            {isLoadingAlumni && (
              <>
                <AlumniCardSkeleton />
                <AlumniCardSkeleton />
                <AlumniCardSkeleton />
              </>
            )}

            {(() => {
              const q = filterText.toLowerCase().trim()
              const filtered = q
                ? alumni.filter(
                    (a) =>
                      a.fullName.toLowerCase().includes(q) ||
                      (a.headline ?? '').toLowerCase().includes(q) ||
                      (a.department ?? '').toLowerCase().includes(q) ||
                      a.skills.some((s) => s.toLowerCase().includes(q)),
                  )
                : alumni

              if (!isLoadingAlumni && filtered.length === 0 && filterText) {
                return (
                  <EmptyState
                    icon={Users}
                    title="No mentors match your search"
                    description="Try a different skill, name, or department."
                  />
                )
              }

              return filtered.map((alumnus) => (
                <AlumniCard
                  key={alumnus.id}
                  alumnus={alumnus}
                  alreadySent={sentAlumniIds.has(alumnus.id)}
                  onAsk={() => setModalAlumni(alumnus)}
                />
              ))
            })()}

            {!isLoadingAlumni && alumni.length === 0 && !filterText && (
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
        </div>
      )}

      {activeTab === 'mine' && (
        <div role="tabpanel" aria-labelledby="student-tab-mine">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {isLoadingMine && (
              <>
                <RequestRowSkeleton />
                <RequestRowSkeleton />
              </>
            )}

            {myRequests.map((req) => (
              <div key={req.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <MyRequestRow request={req} />
                {req.status === 'accepted' && user && (
                  <SessionLogPanel requestId={req.id} currentUserId={user.id} />
                )}
              </div>
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
