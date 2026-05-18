import { useEffect, useRef, useState } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BookOpen, History, Inbox, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { api } from '@/lib/axios'
import { socket } from '@/lib/socket'
import { useAuthStore } from '@/stores/authStore'
import { EmptyState } from '@/components/EmptyState'
import type { AddToast, IncomingRequest, PageResult, RequestStatus } from '../types'
import { useMentorshipOptIn } from '../hooks/useMentorshipOptIn'
import { AlumniMentorToggle } from './AlumniMentorToggle'
import { IncomingRequestCard } from './IncomingRequestCard'
import { RequestRowSkeleton } from './Skeletons'
import { RewardsPanel } from './RewardsPanel'

type AlumniTab = 'active' | 'previous' | 'rewards'

const TABS: { value: AlumniTab; label: string; icon: LucideIcon }[] = [
  { value: 'active', label: 'Requests', icon: Inbox },
  { value: 'previous', label: 'Previous sessions', icon: History },
  { value: 'rewards', label: 'Rewards', icon: Sparkles },
]

interface AlumniViewProps {
  addToast: AddToast
}

export function AlumniView({ addToast }: AlumniViewProps) {
  const user = useAuthStore((s) => s.user)
  const isOpenToMentorship = user?.profile.isOpenToMentorship ?? false

  const [activeTab, setActiveTab] = useState<AlumniTab>('active')
  const optInMutation = useMentorshipOptIn()

  function handleToggle(next: boolean) {
    optInMutation.mutate(next, {
      onError: () => addToast('Failed to update mentorship status.', 'error'),
      onSuccess: () => {
        if (next) addToast('You are now visible to students seeking mentorship.')
      },
    })
  }

  if (!isOpenToMentorship) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <AlumniMentorToggle
          isOn={false}
          isUpdating={optInMutation.isPending}
          onChange={handleToggle}
        />
        <EmptyState
          icon={BookOpen}
          title="You're not listed as a mentor yet"
          description="Toggle 'Apply as a mentor' above to start receiving student requests, log sessions, and earn redeemable points."
        />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <AlumniMentorToggle
        isOn={true}
        isUpdating={optInMutation.isPending}
        onChange={handleToggle}
      />

      <nav
        role="tablist"
        aria-label="Mentor sections"
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: '4px 6px',
          display: 'flex',
          gap: 2,
          overflowX: 'auto',
        }}
      >
        {TABS.map(({ value, label, icon: Icon }) => {
          const active = activeTab === value
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(value)}
              style={{
                flex: '1 0 auto',
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                borderRadius: 'var(--r-pill)',
                border: 'none',
                cursor: 'pointer',
                background: active ? 'var(--uc-indigo-bg)' : 'transparent',
                color: active ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
                transition: 'background 150ms, color 150ms',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Icon size={14} strokeWidth={1.5} />
              {label}
            </button>
          )
        })}
      </nav>

      {activeTab === 'active' && <ActiveRequests addToast={addToast} />}
      {activeTab === 'previous' && <PreviousSessions />}
      {activeTab === 'rewards' && <RewardsPanel enabled addToast={addToast} />}
    </div>
  )
}

// ── ActiveRequests (pending + accepted) ───────────────────────────────────────

function ActiveRequests({ addToast }: { addToast: AddToast }) {
  const queryClient = useQueryClient()
  const sentinelRef = useRef<HTMLDivElement>(null)
  const queryKey = ['mentorship', 'requests', 'incoming', { scope: 'active' }] as const

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery<PageResult<IncomingRequest>>({
    queryKey,
    queryFn: ({ pageParam }) =>
      api
        .get<{ data: PageResult<IncomingRequest> }>('/mentorship/requests/incoming', {
          params: { page: pageParam, limit: 20 },
        })
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

  useEffect(() => {
    function onNewRequest(payload: { studentName: string }) {
      void queryClient.invalidateQueries({ queryKey: ['mentorship', 'requests', 'incoming'] })
      addToast(`${payload.studentName} sent you a mentorship request.`, 'info')
    }
    socket.on('mentorship:request:new', onNewRequest)
    return () => {
      socket.off('mentorship:request:new', onNewRequest)
    }
  }, [queryClient, addToast])

  type InfiniteCache = { pages: { items: IncomingRequest[] }[]; pageParams: unknown[] }

  const updateStatusMutation = useMutation({
    mutationFn: ({ requestId, status }: { requestId: string; status: RequestStatus }) =>
      api.patch(`/mentorship/requests/${requestId}`, { status }).then((r) => r.data.data),

    onMutate: async ({ requestId, status }) => {
      await queryClient.cancelQueries({ queryKey })
      const prev = queryClient.getQueryData<InfiniteCache>(queryKey)
      queryClient.setQueryData<InfiniteCache>(queryKey, (old) => {
        if (!old) return old
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
              item.id === requestId ? { ...item, status } : item,
            ),
          })),
        }
      })
      return { prev }
    },

    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(queryKey, context.prev)
      addToast('Failed to update request. Please try again.', 'error')
    },

    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ['mentorship', 'requests', 'incoming'] })
      if (vars.status === 'completed') {
        void queryClient.invalidateQueries({ queryKey: ['mentorship', 'rewards', 'me'] })
        addToast('Session completed. +10 points earned.', 'info')
      }
    },
  })

  const all = data?.pages.flatMap((p) => p.items) ?? []
  const active = all.filter((r) => r.status === 'pending' || r.status === 'accepted')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {isLoading && (
        <>
          <RequestRowSkeleton />
          <RequestRowSkeleton />
        </>
      )}

      {active.map((req) => (
        <IncomingRequestCard
          key={req.id}
          request={req}
          onStatusChange={(status) => updateStatusMutation.mutate({ requestId: req.id, status })}
          isUpdating={
            updateStatusMutation.isPending &&
            updateStatusMutation.variables?.requestId === req.id
          }
          addToast={addToast}
        />
      ))}

      {!isLoading && active.length === 0 && (
        <EmptyState
          icon={Inbox}
          title="No active requests"
          description="When students send you requests they will appear here."
        />
      )}

      {isFetchingNextPage && <RequestRowSkeleton />}
      <div ref={sentinelRef} style={{ height: 1 }} />
    </div>
  )
}

// ── PreviousSessions (completed + declined) ───────────────────────────────────

function PreviousSessions() {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const queryKey = ['mentorship', 'requests', 'incoming', { scope: 'previous' }] as const

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery<PageResult<IncomingRequest>>({
    queryKey,
    queryFn: ({ pageParam }) =>
      api
        .get<{ data: PageResult<IncomingRequest> }>('/mentorship/requests/incoming', {
          params: { page: pageParam, limit: 20, status: 'completed' },
        })
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {isLoading && (
        <>
          <RequestRowSkeleton />
          <RequestRowSkeleton />
        </>
      )}

      {items.map((req) => (
        <IncomingRequestCard
          key={req.id}
          request={req}
          onStatusChange={() => {
            /* read-only history view */
          }}
          isUpdating={false}
          addToast={() => {}}
        />
      ))}

      {!isLoading && items.length === 0 && (
        <EmptyState
          icon={History}
          title="No completed sessions yet"
          description="Sessions you mark complete will appear here."
        />
      )}

      {isFetchingNextPage && <RequestRowSkeleton />}
      <div ref={sentinelRef} style={{ height: 1 }} />
    </div>
  )
}
