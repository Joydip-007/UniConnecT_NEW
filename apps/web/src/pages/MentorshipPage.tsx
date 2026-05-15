import { useCallback, useEffect, useRef, useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, CheckCircle, XCircle, Users } from 'lucide-react'
import { api } from '@/lib/axios'
import { socket } from '@/lib/socket'
import { useAuthStore } from '@/stores/authStore'
import { Avatar } from '@/components/Avatar'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { GhostBtn, MintBtn, PrimaryBtn } from '@/components/Button'

// ── Types ─────────────────────────────────────────────────────────────────────

type RequestStatus = 'pending' | 'accepted' | 'declined' | 'completed'

interface AlumniMentor {
  id: string
  universityId: string
  fullName: string
  headline: string | null
  department: string | null
  batchYear: string | null
  skills: string[]
  avatarUrl: string | null
}

interface PageResult<T> {
  items: T[]
  total: number
  page: number
  hasMore: boolean
}

interface MyRequest {
  id: string
  message: string
  status: RequestStatus
  sessionNotes: string | null
  createdAt: string
  alumni: {
    id: string
    fullName: string
    avatarUrl: string | null
    headline: string | null
    department: string | null
    batchYear: string | null
  }
}

interface IncomingRequest {
  id: string
  message: string
  status: RequestStatus
  sessionNotes: string | null
  createdAt: string
  student: {
    id: string
    fullName: string
    avatarUrl: string | null
    headline: string | null
    department: string | null
    batchYear: string | null
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Brand-aligned palette for generated avatars
const AVATAR_PALETTE = ['#5B5BD6', '#F05A28', '#10B981', '#06B6D4', '#8B5CF6', '#F59E0B']

function avatarColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i)
    hash |= 0
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length]!
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ── Toast ─────────────────────────────────────────────────────────────────────

interface ToastItem {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const addToast = useCallback((message: string, type: ToastItem['type'] = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }, [])

  return { toasts, addToast }
}

function ToastContainer({ toasts }: { toasts: ToastItem[] }) {
  if (toasts.length === 0) return null
  return (
    <div
      style={{
        position: 'fixed',
        top: 20,
        right: 20,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            padding: '10px 16px',
            background:
              t.type === 'error'
                ? 'var(--uc-red)'
                : t.type === 'info'
                  ? 'var(--uc-indigo)'
                  : 'var(--uc-mint)',
            color: '#fff',
            borderRadius: 'var(--r-md)',
            fontSize: 13,
            fontWeight: 500,
            maxWidth: 340,
            lineHeight: 1.4,
          }}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: RequestStatus }) {
  if (status === 'pending') return <Badge variant="pinned">Pending</Badge>
  if (status === 'accepted') return <Badge variant="alumni">Accepted</Badge>
  if (status === 'completed') return <Badge variant="neutral">Completed</Badge>
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 11,
        fontWeight: 500,
        lineHeight: 1,
        padding: '2px 9px',
        borderRadius: 'var(--r-pill)',
        background: 'rgba(225, 29, 72, 0.12)',
        color: 'var(--uc-red)',
      }}
    >
      Declined
    </span>
  )
}

// ── Request modal (student → alumni) ──────────────────────────────────────────

interface RequestModalProps {
  alumni: AlumniMentor
  onClose: () => void
  onSuccess: (alumniName: string) => void
}

function RequestModal({ alumni, onClose, onSuccess }: RequestModalProps) {
  const [message, setMessage] = useState('')
  const MAX_CHARS = 500

  const mutation = useMutation({
    mutationFn: () =>
      api
        .post('/mentorship/requests', { alumniId: alumni.id, message })
        .then((r) => r.data.data),
    onSuccess: () => onSuccess(alumni.fullName),
  })

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(6,13,26,0.80)',
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: 24,
          width: '100%',
          maxWidth: 480,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar initials={initials(alumni.fullName)} color={avatarColor(alumni.id)} size={40} />
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
              {alumni.fullName}
            </p>
            {alumni.headline && (
              <p
                style={{ margin: 0, fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}
              >
                {alumni.headline}
              </p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
            Your message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MAX_CHARS))}
            placeholder="Introduce yourself and describe what kind of guidance you're looking for…"
            rows={5}
            style={{
              width: '100%',
              background: 'var(--surface-raised)',
              border: '0.5px solid var(--border-default)',
              borderRadius: 'var(--r-md)',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontWeight: 400,
              padding: '10px 12px',
              resize: 'vertical',
              outline: 'none',
              fontFamily: 'inherit',
              lineHeight: 1.6,
              boxSizing: 'border-box',
              transition: 'border-color 150ms',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--uc-indigo-bdr)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-default)'
            }}
          />
          <span
            style={{
              fontSize: 11,
              fontWeight: 400,
              color: 'var(--text-tertiary)',
              textAlign: 'right',
            }}
          >
            {message.length}/{MAX_CHARS}
          </span>
        </div>

        {mutation.isError && (
          <p style={{ margin: 0, fontSize: 12, fontWeight: 400, color: 'var(--uc-red)' }}>
            Failed to send request. Please try again.
          </p>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <GhostBtn onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </GhostBtn>
          <PrimaryBtn
            onClick={() => mutation.mutate()}
            disabled={message.trim().length === 0 || mutation.isPending}
          >
            {mutation.isPending ? 'Sending…' : 'Send request'}
          </PrimaryBtn>
        </div>
      </div>
    </div>
  )
}

// ── Alumni card (student browse) ──────────────────────────────────────────────

function AlumniCard({
  alumnus,
  alreadySent,
  onAsk,
}: {
  alumnus: AlumniMentor
  alreadySent: boolean
  onAsk: () => void
}) {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: 16,
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start',
      }}
    >
      <Avatar initials={initials(alumnus.fullName)} color={avatarColor(alumnus.id)} size={44} />

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
          {alumnus.fullName}
        </p>
        {alumnus.headline && (
          <p
            style={{
              margin: 0,
              fontSize: 12,
              fontWeight: 400,
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}
          >
            {alumnus.headline}
          </p>
        )}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 2 }}>
          {alumnus.department && <Badge variant="dept">{alumnus.department}</Badge>}
          {alumnus.batchYear && <Badge variant="neutral">Batch {alumnus.batchYear}</Badge>}
        </div>
        {alumnus.skills.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
            {alumnus.skills.slice(0, 5).map((skill) => (
              <span
                key={skill}
                style={{
                  fontSize: 11,
                  fontWeight: 400,
                  color: 'var(--text-tertiary)',
                  background: 'var(--surface-raised)',
                  padding: '2px 8px',
                  borderRadius: 'var(--r-pill)',
                  border: '0.5px solid var(--border-default)',
                }}
              >
                {skill}
              </span>
            ))}
          </div>
        )}
      </div>

      <div style={{ flexShrink: 0 }}>
        {alreadySent ? (
          <GhostBtn disabled>Request sent</GhostBtn>
        ) : (
          <PrimaryBtn onClick={onAsk}>Ask for guidance</PrimaryBtn>
        )}
      </div>
    </div>
  )
}

// ── My request row (student history) ─────────────────────────────────────────

function MyRequestRow({ request }: { request: MyRequest }) {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: 16,
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start',
      }}
    >
      <Avatar
        initials={initials(request.alumni.fullName)}
        color={avatarColor(request.alumni.id)}
        size={40}
      />

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
            {request.alumni.fullName}
          </p>
          <StatusBadge status={request.status} />
        </div>
        {request.alumni.headline && (
          <p style={{ margin: 0, fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>
            {request.alumni.headline}
          </p>
        )}
        <p
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 400,
            color: 'var(--text-tertiary)',
            lineHeight: 1.5,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {request.message}
        </p>
        {request.status === 'accepted' && request.sessionNotes && (
          <div
            style={{
              marginTop: 6,
              padding: '10px 12px',
              background: 'var(--uc-mint-bg)',
              borderRadius: 'var(--r-sm)',
              border: '0.5px solid var(--border-default)',
            }}
          >
            <p
              style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 500, color: 'var(--uc-mint)' }}
            >
              Session notes
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                fontWeight: 400,
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
              }}
            >
              {request.sessionNotes}
            </p>
          </div>
        )}
      </div>

      <span
        style={{
          fontSize: 11,
          fontWeight: 400,
          color: 'var(--text-tertiary)',
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}
      >
        {formatDate(request.createdAt)}
      </span>
    </div>
  )
}

// ── Incoming request card (alumni) ────────────────────────────────────────────

function IncomingRequestCard({
  request,
  onStatusChange,
  isUpdating,
  addToast,
}: {
  request: IncomingRequest
  onStatusChange: (status: RequestStatus) => void
  isUpdating: boolean
  addToast: (msg: string, type?: ToastItem['type']) => void
}) {
  const queryClient = useQueryClient()
  const [notes, setNotes] = useState(request.sessionNotes ?? '')
  const [isSavingNotes, setIsSavingNotes] = useState(false)

  useEffect(() => {
    setNotes(request.sessionNotes ?? '')
  }, [request.sessionNotes])

  async function saveNotes() {
    if (notes === (request.sessionNotes ?? '')) return
    setIsSavingNotes(true)
    try {
      await api.patch(`/mentorship/requests/${request.id}`, { sessionNotes: notes })
      void queryClient.invalidateQueries({ queryKey: ['mentorship', 'requests', 'incoming'] })
    } catch {
      addToast('Failed to save notes. Please try again.', 'error')
    } finally {
      setIsSavingNotes(false)
    }
  }

  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <Avatar
          initials={initials(request.student.fullName)}
          color={avatarColor(request.student.id)}
          size={40}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
              {request.student.fullName}
            </p>
            <StatusBadge status={request.status} />
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
            {request.student.department && (
              <Badge variant="dept">{request.student.department}</Badge>
            )}
            {request.student.batchYear && (
              <Badge variant="neutral">Batch {request.student.batchYear}</Badge>
            )}
          </div>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 400,
            color: 'var(--text-tertiary)',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          {formatDate(request.createdAt)}
        </span>
      </div>

      {/* Student's message */}
      <p
        style={{
          margin: 0,
          fontSize: 13,
          fontWeight: 400,
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          padding: '10px 12px',
          background: 'var(--surface-raised)',
          borderRadius: 'var(--r-sm)',
          border: '0.5px solid var(--border-default)',
        }}
      >
        {request.message}
      </p>

      {/* Session notes — editable when accepted */}
      {request.status === 'accepted' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>
            Session notes{' '}
            {isSavingNotes && (
              <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>— saving…</span>
            )}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--uc-indigo-bdr)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-default)'
              void saveNotes()
            }}
            placeholder="Add notes about your session with this student…"
            rows={3}
            style={{
              width: '100%',
              background: 'var(--surface-raised)',
              border: '0.5px solid var(--border-default)',
              borderRadius: 'var(--r-md)',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontWeight: 400,
              padding: '10px 12px',
              resize: 'vertical',
              outline: 'none',
              fontFamily: 'inherit',
              lineHeight: 1.6,
              boxSizing: 'border-box',
              transition: 'border-color 150ms',
            }}
          />
        </div>
      )}

      {/* Actions */}
      {request.status === 'pending' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <MintBtn onClick={() => onStatusChange('accepted')} disabled={isUpdating}>
            <CheckCircle size={14} strokeWidth={2} />
            Accept
          </MintBtn>
          <GhostBtn onClick={() => onStatusChange('declined')} disabled={isUpdating}>
            <XCircle size={14} strokeWidth={2} />
            Decline
          </GhostBtn>
        </div>
      )}

      {request.status === 'accepted' && (
        <div>
          <GhostBtn onClick={() => onStatusChange('completed')} disabled={isUpdating}>
            <CheckCircle size={14} strokeWidth={2} />
            Mark complete
          </GhostBtn>
        </div>
      )}
    </div>
  )
}

// ── Skeletons ─────────────────────────────────────────────────────────────────

function AlumniCardSkeleton() {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: 16,
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start',
      }}
    >
      <div
        style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--surface-raised)' }}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div
          style={{
            height: 14,
            width: 160,
            borderRadius: 'var(--r-sm)',
            background: 'var(--surface-raised)',
          }}
        />
        <div
          style={{
            height: 12,
            width: 240,
            borderRadius: 'var(--r-sm)',
            background: 'var(--surface-raised)',
          }}
        />
        <div
          style={{
            height: 20,
            width: 100,
            borderRadius: 'var(--r-pill)',
            background: 'var(--surface-raised)',
          }}
        />
      </div>
    </div>
  )
}

function RequestRowSkeleton() {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: 16,
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start',
      }}
    >
      <div
        style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--surface-raised)' }}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div
          style={{
            height: 14,
            width: 140,
            borderRadius: 'var(--r-sm)',
            background: 'var(--surface-raised)',
          }}
        />
        <div
          style={{
            height: 12,
            width: 280,
            borderRadius: 'var(--r-sm)',
            background: 'var(--surface-raised)',
          }}
        />
      </div>
    </div>
  )
}

// ── Student view ──────────────────────────────────────────────────────────────

function StudentView({
  addToast,
}: {
  addToast: (msg: string, type?: ToastItem['type']) => void
}) {
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
      {/* Tab switcher */}
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

      {/* Browse tab */}
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

      {/* My requests tab */}
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

      {/* Request modal */}
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

// ── Alumni view ───────────────────────────────────────────────────────────────

type IncomingFilter = 'all' | RequestStatus

const FILTER_TABS: { label: string; value: IncomingFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Accepted', value: 'accepted' },
  { label: 'Completed', value: 'completed' },
]

function AlumniView({
  addToast,
}: {
  addToast: (msg: string, type?: ToastItem['type']) => void
}) {
  const user = useAuthStore((s) => s.user)
  const updateProfile = useAuthStore((s) => s.updateProfile)
  const queryClient = useQueryClient()

  const [activeFilter, setActiveFilter] = useState<IncomingFilter>('all')
  const sentinelRef = useRef<HTMLDivElement>(null)

  const incomingQueryKey = ['mentorship', 'requests', 'incoming', { status: activeFilter }] as const

  const {
    data: incomingData,
    fetchNextPage: fetchMoreIncoming,
    hasNextPage: hasMoreIncoming,
    isFetchingNextPage: isFetchingMoreIncoming,
    isLoading: isLoadingIncoming,
  } = useInfiniteQuery<PageResult<IncomingRequest>>({
    queryKey: incomingQueryKey,
    queryFn: ({ pageParam }) =>
      api
        .get<{ data: PageResult<IncomingRequest> }>('/mentorship/requests/incoming', {
          params: {
            page: pageParam,
            limit: 20,
            ...(activeFilter !== 'all' && { status: activeFilter }),
          },
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
        if (entries[0]?.isIntersecting && hasMoreIncoming && !isFetchingMoreIncoming) {
          fetchMoreIncoming()
        }
      },
      { threshold: 0.1 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMoreIncoming, isFetchingMoreIncoming, fetchMoreIncoming])

  // Real-time: new incoming request notification
  useEffect(() => {
    function onNewRequest(payload: { request: IncomingRequest; studentName: string }) {
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
      await queryClient.cancelQueries({ queryKey: incomingQueryKey })
      const prev = queryClient.getQueryData<InfiniteCache>(incomingQueryKey)
      queryClient.setQueryData<InfiniteCache>(incomingQueryKey, (old) => {
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
      if (context?.prev) queryClient.setQueryData(incomingQueryKey, context.prev)
      addToast('Failed to update request. Please try again.', 'error')
    },

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['mentorship', 'requests', 'incoming'] })
    },
  })

  const availabilityMutation = useMutation({
    mutationFn: (isOpenToWork: boolean) =>
      api.patch('/users/me/profile', { isOpenToWork }).then((r) => r.data.data),
    onMutate: (isOpenToWork) => {
      updateProfile({ isOpenToWork })
    },
    onError: (_err, isOpenToWork) => {
      updateProfile({ isOpenToWork: !isOpenToWork })
      addToast('Failed to update availability. Please try again.', 'error')
    },
  })

  const requests = incomingData?.pages.flatMap((p) => p.items) ?? []
  const isOpenToWork = user?.profile.isOpenToWork ?? false

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Availability toggle card */}
      <div
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: 16,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 14,
          justifyContent: 'space-between',
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
            Open to mentorship requests
          </p>
          <p
            style={{
              margin: '4px 0 0',
              fontSize: 12,
              fontWeight: 400,
              color: 'var(--text-tertiary)',
              lineHeight: 1.5,
            }}
          >
            When on, students can see you in the alumni browse list.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={isOpenToWork}
          onClick={() => availabilityMutation.mutate(!isOpenToWork)}
          disabled={availabilityMutation.isPending}
          style={{
            flexShrink: 0,
            marginTop: 2,
            width: 44,
            height: 24,
            borderRadius: 'var(--r-pill)',
            border: 'none',
            background: isOpenToWork ? 'var(--uc-mint)' : 'var(--surface-raised)',
            cursor: 'pointer',
            position: 'relative',
            transition: 'background 200ms',
            outline: 'none',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 3,
              left: isOpenToWork ? 23 : 3,
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: '#fff',
              transition: 'left 200ms',
            }}
          />
        </button>
      </div>

      {/* Filter tabs */}
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
        {FILTER_TABS.map(({ label, value }) => {
          const active = activeFilter === value
          return (
            <button
              key={value}
              type="button"
              onClick={() => setActiveFilter(value)}
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

      {/* Incoming cards */}
      {isLoadingIncoming && (
        <>
          <RequestRowSkeleton />
          <RequestRowSkeleton />
          <RequestRowSkeleton />
        </>
      )}

      {requests.map((req) => (
        <IncomingRequestCard
          key={req.id}
          request={req}
          onStatusChange={(status) =>
            updateStatusMutation.mutate({ requestId: req.id, status })
          }
          isUpdating={
            updateStatusMutation.isPending &&
            updateStatusMutation.variables?.requestId === req.id
          }
          addToast={addToast}
        />
      ))}

      {!isLoadingIncoming && requests.length === 0 && (
        <EmptyState
          icon={BookOpen}
          title="No requests here"
          description={
            activeFilter === 'all'
              ? 'When students send you mentorship requests, they will appear here.'
              : `No ${activeFilter} requests.`
          }
        />
      )}

      {isFetchingMoreIncoming && (
        <>
          <RequestRowSkeleton />
          <RequestRowSkeleton />
        </>
      )}

      <div ref={sentinelRef} style={{ height: 1 }} />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MentorshipPage() {
  const role = useAuthStore((s) => s.user?.role)
  const { toasts, addToast } = useToast()

  if (role === 'faculty' || role === 'admin') {
    return (
      <div
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: 48,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <BookOpen size={32} strokeWidth={1.5} style={{ color: 'var(--text-tertiary)' }} />
        <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
          Mentorship is available for students and alumni.
        </p>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 400,
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            maxWidth: 360,
          }}
        >
          Students can browse and request alumni mentors. Alumni can manage incoming
          requests and track sessions.
        </p>
      </div>
    )
  }

  return (
    <div>
      <ToastContainer toasts={toasts} />

      <div style={{ marginBottom: 20 }}>
        <h1
          style={{
            margin: '0 0 4px',
            fontSize: 20,
            fontWeight: 500,
            color: 'var(--text-primary)',
          }}
        >
          Mentorship
        </h1>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)' }}>
          {role === 'student'
            ? 'Connect with alumni mentors for career guidance.'
            : 'Manage mentorship requests from students.'}
        </p>
      </div>

      {role === 'student' && <StudentView addToast={addToast} />}
      {role === 'alumni' && <AlumniView addToast={addToast} />}
    </div>
  )
}
