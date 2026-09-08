import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { Megaphone, Pin, PinOff, Trash2, AlertTriangle } from 'lucide-react'
import { api } from '@/lib/axios'
import { GhostBtn, PrimaryBtn } from '@/components/Button'
import { announcementStatus, type AnnouncementStatus } from './announcementStatus'

interface AuthorMeta {
  id: string
  fullName: string | null
  avatarUrl: string | null
}

interface AnnouncementItem {
  id: string
  content: string
  isPinned: boolean
  isPublished: boolean
  publishAt: string | null
  viewCount: number
  reactionCount: number
  commentCount: number
  createdAt: string
  author: AuthorMeta
}

const STATUS_META: Record<AnnouncementStatus, { label: string; color: string; bg: string; bdr: string }> = {
  published: { label: 'Published', color: 'var(--uc-mint)', bg: 'var(--uc-mint-bg)', bdr: 'var(--uc-mint-bdr)' },
  scheduled: { label: 'Scheduled', color: 'var(--uc-indigo-l)', bg: 'var(--uc-indigo-bg)', bdr: 'var(--uc-indigo-bdr)' },
  draft: { label: 'Draft', color: 'var(--text-tertiary)', bg: 'var(--surface-raised)', bdr: 'var(--border-default)' },
}

function StatusPill({ status }: { status: AnnouncementStatus }) {
  const meta = STATUS_META[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 'var(--r-pill)',
      fontSize: 11, fontWeight: 500, color: meta.color, background: meta.bg, border: `0.5px solid ${meta.bdr}`,
    }}>
      {meta.label}
    </span>
  )
}

interface Paginated<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

const LIMIT = 20

// datetime-local inputs read/write local wall-clock time with no timezone
// conversion, so the floor passed to `min` must be built from local getters
// (getFullYear/getMonth/getDate/getHours/getMinutes) — never toISOString(),
// which is UTC-based and silently disables the "no past scheduling" guard
// outside UTC+0 (including UIU Dhaka, UTC+6).
function toLocalDateTimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function relativeTime(iso: string) {
  const date = new Date(iso)
  const diff = Date.now() - date.getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── AnnouncementsTab ─────────────────────────────────────────────────────────

export function AnnouncementsTab() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [draft, setDraft] = useState('')
  const queryKey: QueryKey = ['admin', 'content', 'posts', 'announcement', page]

  const { data, isLoading } = useQuery<Paginated<AnnouncementItem>>({
    queryKey,
    queryFn: () =>
      api
        .get<{ data: Paginated<AnnouncementItem> }>('/admin/content/posts', {
          params: { page, limit: LIMIT, filter: 'announcement' },
        })
        .then((r) => ({ ...r.data.data, limit: LIMIT })),
  })

  const { data: stats } = useQuery<{ activeUsers: number }>({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.get<{ data: { activeUsers: number } }>('/admin/stats').then((r) => r.data.data),
    staleTime: 60_000,
  })

  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleAt, setScheduleAt] = useState('')

  const postMutation = useMutation({
    mutationFn: (payload: { content: string; is_published?: boolean; publish_at?: string }) =>
      api.post('/posts', { type: 'announcement', ...payload }),
    onSuccess: () => {
      setDraft('')
      setScheduleAt('')
      setScheduleOpen(false)
      void qc.invalidateQueries({ queryKey: ['admin', 'content', 'posts', 'announcement'] })
      void qc.invalidateQueries({ queryKey: ['admin', 'stats'] })
    },
  })

  function publishNow() {
    postMutation.mutate({ content: draft.trim() })
  }
  function saveAsDraft() {
    postMutation.mutate({ content: draft.trim(), is_published: false })
  }
  function schedule() {
    if (!scheduleAt) return
    if (new Date(scheduleAt).getTime() <= Date.now()) return
    postMutation.mutate({ content: draft.trim(), publish_at: new Date(scheduleAt).toISOString() })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        background: 'var(--surface-card)', border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)', padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write an announcement for the whole campus…"
          rows={3}
          style={{
            resize: 'vertical', background: 'var(--surface-raised)', border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-md)', padding: '10px 12px', fontSize: 13, color: 'var(--text-primary)',
            fontFamily: 'inherit', outline: 'none',
          }}
        />

        {scheduleOpen && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label htmlFor="announcement-schedule-at" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Schedule date and time
            </label>
            <input
              id="announcement-schedule-at"
              aria-label="Schedule date and time"
              type="datetime-local"
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
              min={toLocalDateTimeInputValue(new Date(Date.now() + 60_000))}
              style={{
                background: 'var(--surface-raised)', border: '0.5px solid var(--border-default)',
                borderRadius: 'var(--r-sm)', padding: '7px 10px', fontSize: 13, color: 'var(--text-primary)',
                fontFamily: 'inherit', outline: 'none',
              }}
            />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
          <GhostBtn
            disabled={!draft.trim() || postMutation.isPending}
            onClick={saveAsDraft}
          >
            Save as draft
          </GhostBtn>
          {scheduleOpen ? (
            <>
              <GhostBtn onClick={() => { setScheduleOpen(false); setScheduleAt('') }}>Cancel</GhostBtn>
              <PrimaryBtn disabled={!draft.trim() || !scheduleAt || postMutation.isPending} onClick={schedule}>
                {postMutation.isPending ? 'Scheduling…' : 'Schedule'}
              </PrimaryBtn>
            </>
          ) : (
            <GhostBtn disabled={!draft.trim() || postMutation.isPending} onClick={() => setScheduleOpen(true)}>
              Schedule for…
            </GhostBtn>
          )}
          <PrimaryBtn
            disabled={!draft.trim() || postMutation.isPending}
            onClick={publishNow}
          >
            {postMutation.isPending ? 'Posting…' : 'Publish now'}
          </PrimaryBtn>
        </div>
      </div>

      {isLoading || !data ? (
        <SkeletonList />
      ) : data.items.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.items.map((item) => (
            <AnnouncementRow key={item.id} item={item} queryKey={queryKey} activeUsers={stats?.activeUsers} />
          ))}
          {Math.ceil(data.total / LIMIT) > 1 && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 4 }}>
              <GhostBtn disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</GhostBtn>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', alignSelf: 'center' }}>
                {page} / {Math.ceil(data.total / LIMIT)}
              </span>
              <GhostBtn disabled={page === Math.ceil(data.total / LIMIT)} onClick={() => setPage((p) => p + 1)}>Next</GhostBtn>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AnnouncementRow({ item, queryKey, activeUsers }: { item: AnnouncementItem; queryKey: QueryKey; activeUsers?: number }) {
  const qc = useQueryClient()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const status = announcementStatus(item)

  const pinMutation = useMutation({
    mutationFn: (next: boolean) => api.patch(`/admin/content/posts/${item.id}/pin`, { is_pinned: next }),
    onSuccess: () => void qc.invalidateQueries({ queryKey }),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/admin/content/posts/${item.id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey })
      void qc.invalidateQueries({ queryKey: ['admin', 'stats'] })
    },
  })

  function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
      confirmTimerRef.current = setTimeout(() => setConfirmingDelete(false), 3000)
      return
    }
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
    setConfirmingDelete(false)
    deleteMutation.mutate()
  }

  return (
    <div style={{
      background: 'var(--surface-card)', border: '0.5px solid var(--border-default)',
      borderRadius: 'var(--r-lg)', padding: 16, display: 'flex', alignItems: 'flex-start', gap: 14,
    }}>
      <span style={{
        width: 38, height: 38, borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexShrink: 0, background: 'var(--uc-orange-bg)', color: 'var(--uc-orange-l)',
      }}>
        <Megaphone size={18} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* The pill states what this announcement *is* — published, scheduled, draft —
            so it belongs on the title line, level with it, not buried in the meta run
            where it reads as one more comma-separated fact. */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.4 }}>
            {item.content}
          </div>
          <span style={{ flexShrink: 0 }}><StatusPill status={status} /></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 6, fontSize: 12, color: 'var(--text-tertiary)' }}>
          <span>{item.author.fullName ?? 'Unknown'}</span>
          <span>· {relativeTime(item.createdAt)}</span>
          {status === 'published' ? (
            <span>· ≈{(activeUsers ?? 0).toLocaleString()} members reached · {item.reactionCount + item.commentCount} engagement</span>
          ) : status === 'scheduled' && item.publishAt ? (
            <span>· publishes {new Date(item.publishAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
          ) : null}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button
          type="button"
          className="admin-icon-btn"
          data-active={item.isPinned ? 'true' : undefined}
          title={item.isPinned ? 'Unpin' : 'Pin'}
          aria-label={item.isPinned ? 'Unpin' : 'Pin'}
          onClick={() => pinMutation.mutate(!item.isPinned)}
        >
          {item.isPinned ? <PinOff size={14} /> : <Pin size={14} />}
        </button>
        <button
          type="button"
          className="admin-icon-btn"
          data-danger={confirmingDelete ? 'true' : undefined}
          title={confirmingDelete ? 'Click again to confirm' : 'Delete'}
          aria-label={confirmingDelete ? 'Click again to confirm delete' : 'Delete'}
          onClick={handleDelete}
        >
          {confirmingDelete ? <AlertTriangle size={14} /> : <Trash2 size={14} />}
        </button>
      </div>
    </div>
  )
}

function SkeletonList() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="admin-skeleton-card" />
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{
      background: 'var(--surface-card)', border: '0.5px solid var(--border-default)',
      borderRadius: 'var(--r-lg)', padding: '56px 24px', display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 12, textAlign: 'center',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 'var(--r-md)', background: 'var(--surface-raised)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)',
      }}>
        <Megaphone size={20} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>No announcements yet</div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', maxWidth: 320 }}>
        Post one above to reach every member of the campus.
      </div>
    </div>
  )
}
