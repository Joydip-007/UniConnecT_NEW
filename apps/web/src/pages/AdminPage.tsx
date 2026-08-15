import { useEffect, useRef, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import {
  Users, FileText, Mail, Flag, Trash2, X,
  ShieldCheck, LayoutGrid, ShieldOff, ShieldCheck as ShieldCheckIcon, AlertTriangle, RefreshCw, Bus, GraduationCap
} from 'lucide-react'
import type { AccountDeletionRequest } from '@uniconnect/shared'
import { api } from '@/lib/axios'
import { useAuthStore } from '@/stores/authStore'
import { Avatar } from '@/components/Avatar'
import { Badge } from '@/components/Badge'
import { GhostBtn, PrimaryBtn } from '@/components/Button'
import { PATHS } from '@/router/paths'
import { ContentTab } from '@/pages/admin/ContentTab'
import { ShuttleTab } from '@/pages/admin/ShuttleTab'
import { ContentSyncPanel } from '@/features/content-sync'
import { LearningAdminPanel } from '@/features/learning-admin'
import { avatarColor as seedColor, getInitials } from '@/utils/avatar'

// ── Types ──────────────────────────────────────────────────────────────────────

type UserRole = 'student' | 'alumni' | 'faculty' | 'admin'

interface Stats {
  users: number
  posts: number
  jobs: number
  events: number
  groups: number
  news: number
  reports: number
  activeUsers: number
}

interface AdminUser {
  id: string
  email: string
  role: UserRole
  isVerified: boolean
  isActive: boolean
  lastActiveAt: string | null
  createdAt: string
  profile: { fullName: string; avatarUrl: string | null; department: string | null; batchYear: string | null }
}

interface Report {
  id: string
  reporterId: string
  reporterName: string | null
  targetId: string
  targetType: string
  reason: string
  description: string | null
  status: string
  createdAt: string
  resolvedAt: string | null
}

interface Invitation {
  id: string
  email: string
  role: string
  token: string
  isUsed: boolean
  expiresAt: string
  createdAt: string
}

interface Paginated<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Stat cards ────────────────────────────────────────────────────────────────

function UsersStatCard({ total, active }: { total: number; active: number }) {
  const pct = total > 0 ? Math.round((active / total) * 100) : 0
  return (
    <div style={{
      background: 'var(--surface-card)',
      border: '0.5px solid var(--border-default)',
      borderRadius: 'var(--r-lg)',
      padding: '20px 24px',
    }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-label)', letterSpacing: '0.04em', marginBottom: 10 }}>
        Total users
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
        <span style={{ fontSize: 40, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1 }}>
          {total.toLocaleString()}
        </span>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {active.toLocaleString()} active
        </span>
      </div>
      <div style={{ marginTop: 14, height: 3, borderRadius: 'var(--r-pill)', background: 'var(--surface-raised)', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: '100%',
          background: 'var(--uc-indigo)',
          borderRadius: 'var(--r-pill)',
          transform: `scaleX(${pct / 100})`,
          transformOrigin: 'left center',
          transition: 'transform 0.6s var(--ease-out-strong)',
        }} />
      </div>
      <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-tertiary)' }}>
        {pct}% active in 30 days
      </div>
    </div>
  )
}

function ReportsStatCard({ count }: { count: number }) {
  const hot = count > 0
  return (
    <div style={{
      background: hot ? 'var(--uc-orange-bg)' : 'var(--surface-card)',
      border: `0.5px solid ${hot ? 'var(--uc-orange-bdr)' : 'var(--border-default)'}`,
      borderRadius: 'var(--r-lg)',
      padding: '20px 24px',
      transition: 'background 0.3s, border-color 0.3s',
    }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: hot ? 'var(--uc-orange-l)' : 'var(--text-label)', letterSpacing: '0.04em', marginBottom: 10 }}>
        Open reports
      </div>
      <div style={{ fontSize: 40, fontWeight: 500, color: hot ? 'var(--uc-orange-l)' : 'var(--text-primary)', lineHeight: 1 }}>
        {count.toLocaleString()}
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: hot ? 'var(--uc-orange-l)' : 'var(--text-tertiary)', opacity: hot ? 0.85 : 1 }}>
        {hot ? 'Needs review' : 'All clear'}
      </div>
    </div>
  )
}

function ContentMetricsStrip({ stats }: { stats: Stats }) {
  const metrics: { label: string; value: number }[] = [
    { label: 'Posts',  value: stats.posts   },
    { label: 'Jobs',   value: stats.jobs    },
    { label: 'Events', value: stats.events  },
    { label: 'Groups', value: stats.groups  },
    { label: 'News',   value: stats.news    },
  ]
  return (
    <div style={{
      background: 'var(--surface-card)',
      border: '0.5px solid var(--border-default)',
      borderRadius: 'var(--r-lg)',
      display: 'flex',
      overflow: 'hidden',
    }}>
      {metrics.map(({ label, value }, i) => (
        <div key={label} style={{
          flex: '1 1 0',
          minWidth: 80,
          padding: '16px 20px',
          borderLeft: i > 0 ? '0.5px solid var(--border-default)' : 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-label)', letterSpacing: '0.04em' }}>
            {label}
          </div>
          <div style={{ fontSize: 24, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1 }}>
            {value.toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Tab nav type ──────────────────────────────────────────────────────────────

type Tab = 'overview' | 'users' | 'invitations' | 'content' | 'content-sync' | 'learning' | 'shuttle' | 'reports' | 'deletion'
const TABS: { label: string; value: Tab; icon: React.ReactNode }[] = [
  { label: 'Overview', value: 'overview', icon: <FileText size={14} /> },
  { label: 'Users', value: 'users', icon: <Users size={14} /> },
  { label: 'Invite', value: 'invitations', icon: <Mail size={14} /> },
  { label: 'Content', value: 'content', icon: <LayoutGrid size={14} /> },
  { label: 'Content sync', value: 'content-sync', icon: <RefreshCw size={14} /> },
  { label: 'Learning', value: 'learning', icon: <GraduationCap size={14} /> },
  { label: 'Shuttle', value: 'shuttle', icon: <Bus size={14} /> },
  { label: 'Reports', value: 'reports', icon: <Flag size={14} /> },
  { label: 'Deletion requests', value: 'deletion', icon: <Trash2 size={14} /> },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDomainError(err: unknown): string | null {
  if (!isAxiosError(err)) return null
  const code: string = err.response?.data?.code ?? ''
  if (code === 'EMAIL_DOMAIN_NOT_ALLOWED') return err.response?.data?.error ?? 'Email domain not allowed.'
  return null
}

// ── Allowed email domains panel ───────────────────────────────────────────────

function AllowedDomainsPanel() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const { data, isLoading } = useQuery<{ allowedEmailDomains: string[] }>({
    queryKey: ['admin', 'university', 'domains'],
    queryFn: () =>
      api.get<{ data: { allowedEmailDomains: string[] } }>('/admin/university/domains')
        .then((r) => r.data.data),
  })

  const saveMutation = useMutation({
    mutationFn: (domains: string[]) =>
      api.patch('/admin/university/domains', { allowed_email_domains: domains }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'university', 'domains'] })
      setEditing(false)
      setSuccessMsg('Allowed domains saved.')
      setTimeout(() => setSuccessMsg(null), 4000)
    },
  })

  function startEditing() {
    setDraft(data?.allowedEmailDomains ?? [])
    setInput('')
    setInputError(null)
    setEditing(true)
  }

  function addDomain() {
    const val = input.trim().toLowerCase()
    if (!val) return
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(val)) {
      setInputError('Enter a valid domain (e.g. bscse.uiu.ac.bd)')
      return
    }
    if (draft.includes(val)) {
      setInputError('Domain already in the list')
      return
    }
    setDraft((d) => [...d, val])
    setInput('')
    setInputError(null)
  }

  function removeDomain(domain: string) {
    setDraft((d) => d.filter((x) => x !== domain))
  }

  const domains = data?.allowedEmailDomains ?? []

  return (
    <div style={{
      background: 'var(--surface-card)',
      border: '0.5px solid var(--border-default)',
      borderRadius: 'var(--r-lg)',
      padding: '24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
            Allowed email domains
          </span>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
            Only these domains may register. Leave empty to allow any domain.
          </p>
        </div>
        {!editing && (
          <GhostBtn onClick={startEditing} style={{ fontSize: 12, padding: '4px 12px' }}>
            Edit
          </GhostBtn>
        )}
      </div>

      {isLoading ? (
        <Spinner />
      ) : !editing ? (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {domains.length === 0 ? (
              <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Any domain allowed</span>
            ) : (
              domains.map((d) => (
                <span key={d} style={{
                  background: 'var(--uc-indigo-bg)',
                  border: '0.5px solid var(--uc-indigo-bdr)',
                  borderRadius: 'var(--r-pill)',
                  padding: '3px 10px',
                  fontSize: 13,
                  color: 'var(--uc-indigo-l)',
                  fontFamily: 'monospace',
                }}>
                  @{d}
                </span>
              ))
            )}
          </div>
          {successMsg && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--uc-mint-bg)',
              border: '0.5px solid var(--uc-mint-bdr)',
              borderRadius: 'var(--r-md)',
              padding: '10px 14px',
            }}>
              <span style={{ fontSize: 13, color: 'var(--uc-mint)' }}>{successMsg}</span>
              <button
                type="button"
                onClick={() => setSuccessMsg(null)}
                aria-label="Dismiss message"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--uc-mint)' }}
              >
                <X size={14} />
              </button>
            </div>
          )}
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, minHeight: 32 }}>
            {draft.length === 0 ? (
              <span style={{ fontSize: 13, color: 'var(--text-tertiary)', alignSelf: 'center' }}>
                No domains — any email will be accepted
              </span>
            ) : (
              draft.map((d) => (
                <span key={d} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'var(--uc-indigo-bg)',
                  border: '0.5px solid var(--uc-indigo-bdr)',
                  borderRadius: 'var(--r-pill)',
                  padding: '3px 8px 3px 10px',
                  fontSize: 13,
                  color: 'var(--uc-indigo-l)',
                  fontFamily: 'monospace',
                }}>
                  @{d}
                  <button
                    type="button"
                    onClick={() => removeDomain(d)}
                    aria-label={`Remove domain @${d}`}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--uc-indigo-l)', opacity: 0.7 }}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <input
              type="text"
              value={input}
              onChange={(e) => { setInput(e.target.value); setInputError(null) }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDomain() } }}
              placeholder="Type a domain and press Enter, e.g. bscse.uiu.ac.bd"
              style={inputStyle}
            />
            {inputError && (
              <span style={{ fontSize: 12, color: 'var(--uc-orange-l)' }}>{inputError}</span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <PrimaryBtn
              disabled={saveMutation.isPending}
              onClick={() => {
                // Flush any text still in the input field into draft before saving
                const val = input.trim().toLowerCase()
                let finalDraft = draft
                if (val && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(val) && !draft.includes(val)) {
                  finalDraft = [...draft, val]
                  setDraft(finalDraft)
                  setInput('')
                }
                saveMutation.mutate(finalDraft)
              }}
            >
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </PrimaryBtn>
            <GhostBtn onClick={() => setEditing(false)}>Cancel</GhostBtn>
          </div>

          {saveMutation.isError && (
            <span style={{ fontSize: 13, color: 'var(--uc-orange-l)' }}>
              Failed to save. Please try again.
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab() {
  const { data } = useQuery<Stats>({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.get<{ data: Stats }>('/admin/stats').then((r) => r.data.data),
  })

  if (!data) return <Spinner />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <UsersStatCard total={data.users} active={data.activeUsers} />
        <ReportsStatCard count={data.reports} />
      </div>
      <ContentMetricsStrip stats={data} />
      <AllowedDomainsPanel />
    </div>
  )
}

// ── Confirm modal ─────────────────────────────────────────────────────────────

type ModalVariant = 'ban' | 'unban' | 'delete'

interface ConfirmModalProps {
  variant: ModalVariant
  user: AdminUser
  isPending: boolean
  onConfirm: () => void
  onClose: () => void
}

function ConfirmModal({ variant, user, isPending, onConfirm, onClose }: ConfirmModalProps) {
  const isBan = variant === 'ban'
  const isDelete = variant === 'delete'

  const palette = isDelete
    ? { accent: 'var(--uc-red)', bg: 'var(--uc-red-bg)', bdr: 'var(--uc-red-bdr)', text: 'var(--uc-red)' }
    : isBan
      ? { accent: 'var(--uc-orange)', bg: 'var(--uc-orange-bg)', bdr: 'var(--uc-orange-bdr)', text: 'var(--uc-orange-l)' }
      : { accent: 'var(--uc-mint)', bg: 'var(--uc-mint-bg)', bdr: 'var(--uc-mint-bdr)', text: 'var(--uc-mint)' }

  const title = isDelete ? 'Delete account?' : isBan ? 'Ban user?' : 'Remove ban?'
  const description = isDelete
    ? `This permanently disables ${user.profile.fullName}'s account. Their posts and content remain visible.`
    : isBan
      ? `${user.profile.fullName} won't be able to log in until you remove the ban.`
      : `${user.profile.fullName} will regain access and be able to log in again.`
  const confirmLabel = isDelete ? 'Delete account' : isBan ? 'Ban user' : 'Remove ban'
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="modal-title"
      onClose={onClose}
      onCancel={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        margin: 0,
        padding: '0 16px',
        width: '100%',
        height: '100%',
        maxWidth: 'none',
        maxHeight: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        background: 'var(--overlay-bg-strong)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        animation: 'modal-backdrop-in 180ms var(--ease-out-expo) both',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: '100%',
        maxWidth: 420,
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-strong)',
        borderRadius: 'var(--r-lg)',
        overflow: 'hidden',
        animation: 'modal-card-in 200ms var(--ease-out-expo) both',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 20px 0',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 14,
        }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 'var(--r-md)',
            background: palette.bg,
            border: `0.5px solid ${palette.bdr}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            {isDelete
              ? <Trash2 size={16} color={palette.text} />
              : isBan
                ? <ShieldOff size={16} color={palette.text} />
                : <ShieldCheckIcon size={16} color={palette.text} />}
          </div>

          <div style={{ flex: 1, paddingTop: 2 }}>
            <p id="modal-title" style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
              {title}
            </p>
            <p style={{ margin: '5px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {description}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              color: 'var(--text-tertiary)',
              borderRadius: 'var(--r-sm)',
              flexShrink: 0,
              marginTop: -2,
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* User preview */}
        <div style={{
          margin: '16px 20px',
          padding: '12px 14px',
          background: 'var(--surface-raised)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-md)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          {user.profile.avatarUrl
            ? <img src={user.profile.avatarUrl} alt={user.profile.fullName}
                style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            : <Avatar initials={getInitials(user.profile.fullName)} color={seedColor(user.id)} size={32} />}
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.profile.fullName}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.email}
            </p>
          </div>
        </div>

        {/* Warning strip — delete only */}
        {isDelete && (
          <div style={{
            margin: '0 20px 16px',
            padding: '10px 12px',
            background: 'var(--uc-red-bg)',
            border: `0.5px solid var(--uc-red-bdr)`,
            borderRadius: 'var(--r-sm)',
            display: 'flex',
            gap: 8,
            alignItems: 'flex-start',
          }}>
            <AlertTriangle size={13} color="var(--uc-red)" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ margin: 0, fontSize: 12, color: 'var(--uc-red)', lineHeight: 1.5 }}>
              This action cannot be undone. The account will be permanently disabled.
            </p>
          </div>
        )}

        {/* Footer */}
        <div style={{
          padding: '0 20px 20px',
          display: 'flex',
          gap: 8,
          justifyContent: 'flex-end',
        }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            style={{
              background: 'none',
              border: '0.5px solid var(--border-default)',
              borderRadius: 'var(--r-pill)',
              padding: '8px 16px',
              fontSize: 13,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'border-color 150ms, color 150ms',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            style={{
              background: palette.bg,
              border: `0.5px solid ${palette.bdr}`,
              borderRadius: 'var(--r-pill)',
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 500,
              color: palette.text,
              cursor: isPending ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              opacity: isPending ? 0.6 : 1,
              transition: 'opacity 150ms',
            }}
          >
            {isPending ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}

// ── Users tab ─────────────────────────────────────────────────────────────────

function UsersTab() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const limit = 20
  const currentUser = useAuthStore((s) => s.user)
  const [modal, setModal] = useState<{ variant: ModalVariant; user: AdminUser } | null>(null)

  const { data, isLoading } = useQuery<Paginated<AdminUser>>({
    queryKey: ['admin', 'users', page],
    queryFn: () =>
      api.get<{ data: Paginated<AdminUser> }>(`/admin/users?page=${page}&limit=${limit}`)
        .then((r) => r.data.data),
  })

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) =>
      api.patch(`/admin/users/${userId}/role`, { role }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin', 'users'] }) },
  })

  const banMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      api.patch(`/admin/users/${userId}/status`, { is_active: isActive }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      setModal(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/admin/users/${userId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      setModal(null)
    },
  })

  function handleConfirm() {
    if (!modal) return
    if (modal.variant === 'delete') {
      deleteMutation.mutate(modal.user.id)
    } else {
      banMutation.mutate({ userId: modal.user.id, isActive: modal.variant === 'unban' })
    }
  }

  if (isLoading || !data) return <Spinner />

  const totalPages = Math.ceil(data.total / limit)
  const mutationPending = banMutation.isPending || deleteMutation.isPending

  return (
    <>
      {modal && (
        <ConfirmModal
          variant={modal.variant}
          user={modal.user}
          isPending={mutationPending}
          onConfirm={handleConfirm}
          onClose={() => setModal(null)}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>
          {data.total.toLocaleString()} users total
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.items.map((u) => {
            const isSelf = u.id === currentUser?.id
            return (
              <div key={u.id} style={{
                background: 'var(--surface-card)',
                border: `0.5px solid ${!u.isActive ? 'var(--uc-orange-bdr)' : 'var(--border-default)'}`,
                borderRadius: 'var(--r-md)',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                transition: 'border-color 200ms',
              }}>
                {/* Avatar */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  {u.profile.avatarUrl
                    ? <img src={u.profile.avatarUrl} alt={u.profile.fullName}
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: '50%',
                          objectFit: 'cover',
                          opacity: u.isActive ? 1 : 0.45,
                          transition: 'opacity 200ms',
                        }} />
                    : <div style={{ opacity: u.isActive ? 1 : 0.45, transition: 'opacity 200ms' }}>
                        <Avatar initials={getInitials(u.profile.fullName)} color={seedColor(u.id)} size={38} />
                      </div>}
                </div>

                {/* Identity */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: u.isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                      transition: 'color 200ms',
                    }}>
                      {u.profile.fullName}
                    </span>
                    {!u.isVerified && <Badge variant="neutral">unverified</Badge>}
                    {!u.isActive && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        background: 'var(--uc-orange-bg)',
                        border: '0.5px solid var(--uc-orange-bdr)',
                        borderRadius: 'var(--r-pill)',
                        padding: '2px 8px',
                        fontSize: 12,
                        fontWeight: 500,
                        color: 'var(--uc-orange-l)',
                        letterSpacing: '0.02em',
                      }}>
                        <ShieldOff size={10} />
                        banned
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{u.email}</span>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <select
                    aria-label={`Change role for ${u.profile.fullName}`}
                    value={u.role}
                    onChange={(e) => roleMutation.mutate({ userId: u.id, role: e.target.value as UserRole })}
                    disabled={roleMutation.isPending || isSelf}
                    style={{ ...selectStyle, opacity: isSelf ? 0.5 : 1 }}
                  >
                    {(['student', 'alumni', 'faculty', 'admin'] as UserRole[]).map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>

                  {!isSelf && (
                    <>
                      {/* Ban / Unban */}
                      <button
                        type="button"
                        title={u.isActive ? 'Ban user' : 'Remove ban'}
                        onClick={() => setModal({ variant: u.isActive ? 'ban' : 'unban', user: u })}
                        className={u.isActive ? 'user-action-btn-ban' : ''}
                        style={{
                          background: u.isActive ? 'none' : 'var(--uc-mint-bg)',
                          border: u.isActive ? '0.5px solid transparent' : '0.5px solid var(--uc-mint-bdr)',
                          borderRadius: 'var(--r-sm)',
                          cursor: 'pointer',
                          padding: '5px 6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background 150ms, border-color 150ms, color 150ms',
                          color: u.isActive ? 'var(--text-tertiary)' : 'var(--uc-mint)',
                        }}
                      >
                        {u.isActive
                          ? <ShieldOff size={15} />
                          : <ShieldCheckIcon size={15} />}
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        title="Delete account"
                        onClick={() => setModal({ variant: 'delete', user: u })}
                        className="user-action-btn-delete"
                        style={{
                          background: 'none',
                          border: '0.5px solid transparent',
                          borderRadius: 'var(--r-sm)',
                          cursor: 'pointer',
                          padding: '5px 6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background 150ms, border-color 150ms, color 150ms',
                          color: 'var(--text-tertiary)',
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 4 }}>
            <GhostBtn disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</GhostBtn>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', alignSelf: 'center' }}>
              {page} / {totalPages}
            </span>
            <GhostBtn disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Next</GhostBtn>
          </div>
        )}
      </div>
    </>
  )
}

// ── Add driver panel (staff: driver sub-type) ───────────────────────────────────
// Drivers are transport staff who broadcast GPS. Unlike faculty (who self-register
// via invite + OTP), admin creates driver accounts directly — no invitation, no
// OTP, no allowed-domain check.

function AddDriverPanel() {
  const qc = useQueryClient()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => api.post('/admin/users/driver', { full_name: fullName, email, password }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      const who = email
      setFullName('')
      setEmail('')
      setPassword('')
      setMsg(`Driver account created for ${who}`)
      setTimeout(() => setMsg(null), 5000)
    },
  })

  const inputStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 400,
    color: 'var(--text-primary)',
    background: 'var(--surface-raised)',
    border: '0.5px solid var(--border-default)',
    borderRadius: 'var(--r-md)',
    padding: '9px 12px',
    width: '100%',
  }

  const valid = fullName.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && password.length >= 8

  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div>
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Add driver</span>
        <p style={{ margin: '4px 0 0', fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>
          Creates a transport driver account directly. They sign in with these credentials to broadcast their shuttle's
          location — no app access.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input style={inputStyle} placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <input style={inputStyle} placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input
          style={inputStyle}
          placeholder="Temporary password (min 8 chars)"
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {mutation.isError && (
        <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--uc-red)' }}>
          Could not create driver. The email may already be in use.
        </span>
      )}
      {msg && <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--uc-mint)' }}>{msg}</span>}

      <button
        type="button"
        disabled={!valid || mutation.isPending}
        onClick={() => mutation.mutate()}
        style={{
          alignSelf: 'flex-start',
          padding: '9px 18px',
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--on-accent)',
          background: valid ? 'var(--uc-orange)' : 'var(--surface-raised)',
          border: 'none',
          borderRadius: 'var(--r-pill)',
          cursor: valid && !mutation.isPending ? 'pointer' : 'not-allowed',
        }}
      >
        {mutation.isPending ? 'Creating…' : 'Create driver'}
      </button>
    </div>
  )
}

// ── Invitations tab ───────────────────────────────────────────────────────────

function InvitationsTab() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [mode, setMode] = useState<'single' | 'multiple'>('single')
  const [formEmail, setFormEmail] = useState('')
  const [formRole, setFormRole] = useState<UserRole>('student')
  const [formDays, setFormDays] = useState(7)
  const [bulkText, setBulkText] = useState('')
  const [bulkRole, setBulkRole] = useState<UserRole>('student')
  const [bulkDays, setBulkDays] = useState(7)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const limit = 20

  const { data, isLoading } = useQuery<Paginated<Invitation>>({
    queryKey: ['admin', 'invitations', page],
    queryFn: () =>
      api.get<{ data: Paginated<Invitation> }>(`/admin/invitations?page=${page}&limit=${limit}`)
        .then((r) => r.data.data),
  })

  const singleMutation = useMutation({
    mutationFn: () =>
      api.post('/admin/invitations', { email: formEmail, role: formRole, expires_in_days: formDays }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'invitations'] })
      const sent = formEmail
      setFormEmail('')
      setFormRole('student')
      setFormDays(7)
      flash(`Invitation sent to ${sent}`)
    },
  })

  const bulkMutation = useMutation({
    mutationFn: (emails: string[]) =>
      api.post('/admin/invitations/bulk', { emails, role: bulkRole, expires_in_days: bulkDays }),
    onSuccess: (_data, emails) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'invitations'] })
      setBulkText('')
      flash(`${emails.length} invitation${emails.length === 1 ? '' : 's'} sent`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/invitations/${id}`),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin', 'invitations'] }) },
  })

  function flash(msg: string) {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 5000)
  }

  function parseEmails(text: string): string[] {
    return [
      ...new Set(
        text
          .split(/[,\n]/)
          .map((e) => e.trim().toLowerCase())
          .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)),
      ),
    ]
  }

  const parsedEmails = parseEmails(bulkText)

  function handleToggle(next: 'single' | 'multiple') {
    setMode(next)
    setSuccessMsg(null)
    singleMutation.reset()
    bulkMutation.reset()
  }

  const totalPages = Math.ceil((data?.total ?? 0) / limit)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Add driver (staff) ── */}
      <AddDriverPanel />

      {/* ── Send panel ── */}
      <div style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
            Send invite
          </span>
          <div style={{
            display: 'flex',
            background: 'var(--surface-raised)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-pill)',
            padding: '3px',
          }}>
            {(['single', 'multiple'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => handleToggle(m)}
                style={{
                  padding: '4px 14px',
                  fontSize: 12,
                  borderRadius: 'var(--r-pill)',
                  border: 'none',
                  cursor: 'pointer',
                  background: mode === m ? 'var(--uc-indigo-bg)' : 'transparent',
                  color: mode === m ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
                  fontWeight: mode === m ? 500 : 400,
                  transition: 'background 150ms, color 150ms',
                }}
              >
                {m === 'single' ? 'Single' : 'Multiple'}
              </button>
            ))}
          </div>
        </div>

        {mode === 'single' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input
                type="email"
                placeholder="Email address"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') singleMutation.mutate() }}
                style={{ ...inputStyle, flex: '2 1 200px' }}
              />
              <select
                aria-label="Invitee role"
                value={formRole}
                onChange={(e) => setFormRole(e.target.value as UserRole)}
                style={{ ...selectStyle, flex: '1 1 120px' }}
              >
                {(['student', 'alumni', 'faculty', 'admin'] as UserRole[]).map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <select
                aria-label="Invitation expiry"
                value={formDays}
                onChange={(e) => setFormDays(Number(e.target.value))}
                style={{ ...selectStyle, flex: '1 1 120px' }}
              >
                {[1, 3, 7, 14, 30].map((d) => (
                  <option key={d} value={d}>Expires in {d}d</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <PrimaryBtn
                disabled={!formEmail.trim() || singleMutation.isPending}
                onClick={() => singleMutation.mutate()}
              >
                {singleMutation.isPending ? 'Sending…' : 'Send invite'}
              </PrimaryBtn>
              {singleMutation.isError && (
                <span style={{ fontSize: 13, color: 'var(--uc-orange-l)' }}>
                  {getDomainError(singleMutation.error) ?? 'Failed to send. Try again.'}
                </span>
              )}
            </div>
          </div>
        )}

        {mode === 'multiple' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <select
                aria-label="Bulk invitee role"
                value={bulkRole}
                onChange={(e) => setBulkRole(e.target.value as UserRole)}
                style={{ ...selectStyle, flex: '1 1 120px' }}
              >
                {(['student', 'alumni', 'faculty', 'admin'] as UserRole[]).map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <select
                aria-label="Bulk invitation expiry"
                value={bulkDays}
                onChange={(e) => setBulkDays(Number(e.target.value))}
                style={{ ...selectStyle, flex: '1 1 120px' }}
              >
                {[1, 3, 7, 14, 30].map((d) => (
                  <option key={d} value={d}>Expires in {d}d</option>
                ))}
              </select>
            </div>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="Enter emails separated by commas or new lines, e.g.&#10;alice@uiu.ac.bd, bob@uiu.ac.bd, carol@uiu.ac.bd"
              rows={5}
              style={{
                ...inputStyle,
                resize: 'vertical',
                minHeight: 110,
                lineHeight: 1.6,
              }}
            />
            {parsedEmails.length > 50 && (
              <span style={{ fontSize: 12, color: 'var(--uc-orange-l)' }}>
                Maximum 50 emails per send — {parsedEmails.length} detected. Remove some before sending.
              </span>
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <PrimaryBtn
                disabled={parsedEmails.length === 0 || parsedEmails.length > 50 || bulkMutation.isPending}
                onClick={() => bulkMutation.mutate(parsedEmails)}
              >
                {bulkMutation.isPending
                  ? 'Sending…'
                  : parsedEmails.length === 0
                    ? 'Send invites'
                    : `Send ${parsedEmails.length} invite${parsedEmails.length === 1 ? '' : 's'}`}
              </PrimaryBtn>
              {bulkMutation.isError && (
                <span style={{ fontSize: 13, color: 'var(--uc-orange-l)' }}>
                  {getDomainError(bulkMutation.error) ?? 'Failed to send. Try again.'}
                </span>
              )}
            </div>
          </div>
        )}

        {successMsg !== null && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--uc-mint-bg)',
            border: '0.5px solid var(--uc-mint-bdr)',
            borderRadius: 'var(--r-md)',
            padding: '10px 14px',
          }}>
            <span style={{ fontSize: 13, color: 'var(--uc-mint)' }}>{successMsg}</span>
            <button
              type="button"
              onClick={() => setSuccessMsg(null)}
              aria-label="Dismiss message"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--uc-mint)' }}
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {/* ── Past invitations ── */}
      {isLoading || !data ? (
        <Spinner />
      ) : (
        <>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>
            {data.total.toLocaleString()} invitation{data.total === 1 ? '' : 's'} sent
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.items.map((inv) => (
              <div key={inv.id} style={{
                background: 'var(--surface-card)',
                border: '0.5px solid var(--border-default)',
                borderRadius: 'var(--r-md)',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{inv.email}</span>
                    <Badge variant="neutral">{inv.role}</Badge>
                    {inv.isUsed
                      ? <Badge variant="alumni">used</Badge>
                      : new Date(inv.expiresAt) < new Date()
                        ? <Badge variant="neutral">expired</Badge>
                        : <Badge variant="dept">active</Badge>}
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    Expires {fmtDate(inv.expiresAt)}
                  </span>
                </div>
                {!inv.isUsed && (
                  <button
                    type="button"
                    title="Delete invitation"
                    onClick={() => deleteMutation.mutate(inv.id)}
                    disabled={deleteMutation.isPending}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', color: 'var(--text-tertiary)' }}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 4 }}>
              <GhostBtn disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</GhostBtn>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', alignSelf: 'center' }}>
                {page} / {totalPages}
              </span>
              <GhostBtn disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Next</GhostBtn>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Reports tab ───────────────────────────────────────────────────────────────

function ReportsTab() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const limit = 20

  const { data, isLoading } = useQuery<Paginated<Report>>({
    queryKey: ['admin', 'reports', page],
    queryFn: () =>
      api.get<{ data: Paginated<Report> }>(`/admin/reports?page=${page}&limit=${limit}`)
        .then((r) => r.data.data),
  })

  const resolveMutation = useMutation({
    mutationFn: ({ reportId, status }: { reportId: string; status: string }) =>
      api.patch(`/admin/reports/${reportId}`, { status }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin', 'reports'] }) },
  })

  if (isLoading || !data) return <Spinner />

  const totalPages = Math.ceil(data.total / limit)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>
        {data.total.toLocaleString()} reports
      </p>

      {data.items.length === 0 && (
        <div style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: '48px 0',
          textAlign: 'center',
          fontSize: 14,
          color: 'var(--text-tertiary)',
        }}>
          No reports yet
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.items.map((r) => (
          <div key={r.id} style={{
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-md)',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{r.reason}</span>
                  <Badge variant="neutral">{r.targetType}</Badge>
                  <Badge variant={r.status === 'pending' ? 'dept' : r.status === 'resolved' ? 'alumni' : 'neutral'}>
                    {r.status}
                  </Badge>
                </div>
                {r.description && (
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                    {r.description}
                  </p>
                )}
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  Reported by {r.reporterName ?? 'unknown'} · {fmtDate(r.createdAt)}
                </span>
              </div>

              {r.status === 'pending' && (
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <GhostBtn
                    onClick={() => resolveMutation.mutate({ reportId: r.id, status: 'resolved' })}
                    disabled={resolveMutation.isPending}
                    style={{ fontSize: 12, padding: '4px 10px' }}
                  >
                    Resolve
                  </GhostBtn>
                  <GhostBtn
                    onClick={() => resolveMutation.mutate({ reportId: r.id, status: 'dismissed' })}
                    disabled={resolveMutation.isPending}
                    style={{ fontSize: 12, padding: '4px 10px' }}
                  >
                    Dismiss
                  </GhostBtn>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 4 }}>
          <GhostBtn disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</GhostBtn>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', alignSelf: 'center' }}>
            {page} / {totalPages}
          </span>
          <GhostBtn disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Next</GhostBtn>
        </div>
      )}
    </div>
  )
}

// ── Deletion requests tab ───────────────────────────────────────────────────

function DeletionRequestsTab() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const limit = 20

  const { data, isLoading } = useQuery<Paginated<AccountDeletionRequest>>({
    queryKey: ['admin', 'deletion-requests', page],
    queryFn: () =>
      api.get<{ data: Paginated<AccountDeletionRequest> }>(`/admin/deletion-requests?page=${page}&limit=${limit}`)
        .then((r) => r.data.data),
  })

  const resolveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'approved' | 'declined' }) =>
      api.patch(`/admin/deletion-requests/${id}`, { status }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin', 'deletion-requests'] }) },
  })

  if (isLoading || !data) return <Spinner />

  const totalPages = Math.ceil(data.total / limit)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>
        {data.total.toLocaleString()} requests · approving deactivates the account and signs the user out
        everywhere
      </p>

      {data.items.length === 0 && (
        <div style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: '48px 0',
          textAlign: 'center',
          fontSize: 14,
          color: 'var(--text-tertiary)',
        }}>
          No deletion requests
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.items.map((r) => (
          <div key={r.id} style={{
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-md)',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {r.requesterName ?? r.requesterEmail ?? 'Unknown user'}
                  </span>
                  <Badge variant={r.status === 'pending' ? 'dept' : r.status === 'approved' ? 'alumni' : 'neutral'}>
                    {r.status}
                  </Badge>
                </div>
                <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>{r.reason}</p>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {r.requesterEmail} · {fmtDate(String(r.createdAt))}
                </span>
              </div>

              {r.status === 'pending' && (
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <GhostBtn
                    onClick={() => resolveMutation.mutate({ id: r.id, status: 'approved' })}
                    disabled={resolveMutation.isPending}
                    style={{ fontSize: 12, padding: '4px 10px', color: 'var(--uc-red)' }}
                  >
                    Approve
                  </GhostBtn>
                  <GhostBtn
                    onClick={() => resolveMutation.mutate({ id: r.id, status: 'declined' })}
                    disabled={resolveMutation.isPending}
                    style={{ fontSize: 12, padding: '4px 10px' }}
                  >
                    Decline
                  </GhostBtn>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 4 }}>
          <GhostBtn disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</GhostBtn>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', alignSelf: 'center' }}>
            {page} / {totalPages}
          </span>
          <GhostBtn disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Next</GhostBtn>
        </div>
      )}
    </div>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{ padding: '40px 0', display: 'flex', justifyContent: 'center' }}>
      <div style={{
        width: 24,
        height: 24,
        borderRadius: '50%',
        border: '2px solid var(--border-default)',
        borderTopColor: 'var(--uc-indigo)',
        animation: 'spin 0.7s linear infinite',
      }} />
    </div>
  )
}

// ── AdminPage ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const user = useAuthStore((s) => s.user)
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('tab')
  const activeTab: Tab = TABS.some((t) => t.value === rawTab) ? (rawTab as Tab) : 'overview'
  const setActiveTab = (tab: Tab) => setSearchParams({ tab })

  // Normalise the bare /admin URL onto its default tab so the rail's tab-scoped rows
  // always have a param to match against, and a reload keeps the tab you were on.
  useEffect(() => {
    if (!rawTab) setSearchParams({ tab: 'overview' }, { replace: true })
  }, [rawTab, setSearchParams])

  if (user && user.role !== 'admin') {
    return <Navigate to={PATHS.FEED} replace />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes modal-backdrop-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes modal-card-in {
          from { opacity: 0; transform: scale(0.95) translateY(6px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);   }
        }
        .user-action-btn:hover {
          background: var(--surface-hover) !important;
          border-color: var(--border-hover) !important;
          color: var(--text-primary) !important;
        }
        .user-action-btn-ban:hover {
          background: var(--uc-orange-bg) !important;
          border-color: var(--uc-orange-bdr) !important;
          color: var(--uc-orange-l) !important;
        }
        .user-action-btn-delete:hover {
          background: var(--uc-red-bg) !important;
          border-color: var(--uc-red-bdr) !important;
          color: var(--uc-red) !important;
        }
      `}</style>

      {/* Page heading — the shell's top nav and rail supply the branding and the way
          back, so this keeps only what identifies the panel itself. */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>
            Admin panel
          </h1>
          <p style={{ margin: '5px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
            Manage users, invitations, and content for United International University
          </p>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          background: 'var(--uc-indigo-bg)',
          border: '0.5px solid var(--uc-indigo-bdr)',
          borderRadius: 'var(--r-pill)',
          padding: '5px 12px',
          flexShrink: 0,
        }}>
          <ShieldCheck size={13} color="var(--uc-indigo-l)" />
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--uc-indigo-xl)' }}>Admin panel</span>
        </div>
      </div>

      {/* Tab nav — scrolls rather than squashing, since the shell column is narrower
          than the old full-bleed page. */}
      <nav
        aria-label="Admin sections"
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: '5px 6px',
          display: 'flex',
          gap: 3,
          marginBottom: 20,
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        {TABS.map(({ label, value, icon }) => {
          const active = activeTab === value
          return (
            <button
              key={value}
              type="button"
              onClick={() => setActiveTab(value)}
              aria-current={active ? 'page' : undefined}
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                padding: '9px 14px',
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                borderRadius: 'var(--r-pill)',
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                background: active ? 'var(--uc-indigo-bg)' : 'transparent',
                color: active ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
                transition: 'background 150ms, color 150ms',
              }}
            >
              {icon} {label}
            </button>
          )
        })}
      </nav>

      {activeTab === 'overview' && <OverviewTab />}
      {activeTab === 'users' && <UsersTab />}
      {activeTab === 'invitations' && <InvitationsTab />}
      {activeTab === 'content' && <ContentTab />}
      {activeTab === 'content-sync' && <ContentSyncPanel />}
      {activeTab === 'learning' && <LearningAdminPanel />}
      {activeTab === 'shuttle' && <ShuttleTab />}
      {activeTab === 'reports' && <ReportsTab />}
      {activeTab === 'deletion' && <DeletionRequestsTab />}
    </div>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-raised)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-sm)',
  padding: '9px 14px',
  fontSize: 13,
  color: 'var(--text-primary)',
  outline: 'none',
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  width: 'auto',
  cursor: 'pointer',
}
