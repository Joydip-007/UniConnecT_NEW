import { useEffect, useRef, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Flag, Trash2, X,
  ShieldCheck, ShieldOff, ShieldCheck as ShieldCheckIcon, AlertTriangle, ChevronDown, ChevronUp,
  UserPlus
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { AccountDeletionRequest } from '@uniconnect/shared'
import { api } from '@/lib/axios'
import { useAuthStore } from '@/stores/authStore'
import { Avatar } from '@/components/Avatar'
import { Badge } from '@/components/Badge'
import { GhostBtn, PrimaryBtn } from '@/components/Button'
import { PATHS } from '@/router/paths'
import { ContentTab } from '@/pages/admin/ContentTab'
import { GroupsTab } from '@/pages/admin/GroupsTab'
import { AnnouncementsTab } from '@/pages/admin/AnnouncementsTab'
import { ShuttleTab } from '@/pages/admin/ShuttleTab'
import { InvitePeopleDialog } from '@/pages/admin/InvitePeopleDialog'
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
  usersByRole: { role: string; count: number }[]
  verificationsByRole: { role: string; count: number }[]
  postsByDay: { date: string; count: number }[]
  escalatedReports: number
  verificationRequests: number
  deletionRequests: number
  resolvedPct7d: number
  pendingInviteBatches: number
  moderationHealth: { reportsOpen: number; resolvedPct7d: number; medianResponseHours: number; repeatOffenders: number }
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

interface Invitation {
  id: string
  email: string
  role: string
  token: string
  isUsed: boolean
  expiresAt: string
  createdAt: string
}

interface InviteBatch {
  id: string
  label: string
  role: string
  total: number
  accepted: number
  expiresAt: string | null
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

function daysLeft(iso: string | null): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}

// ── Stat cards ────────────────────────────────────────────────────────────────

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

type Tab = 'insights' | 'moderation' | 'groups' | 'members' | 'announcements' | 'content' | 'content-sync' | 'learning' | 'shuttle'
/**
 * There is deliberately no tab bar on this page. Every value here is already a row in
 * the admin left rail — six fixed rows and three campus tools — so a horizontal nav
 * above the content was the same navigation twice on one screen, and the rail is the
 * more capable of the two. What the page owes the reader instead is which screen they
 * are on, which is what this copy is for: the heading becomes the route.
 */
const TAB_META: Record<Tab, { label: string; subtitle: string }> = {
  insights: { label: 'Insights', subtitle: 'Activity and membership across the last seven days.' },
  moderation: { label: 'Moderation', subtitle: 'Reports, verification and deletion requests from across campus.' },
  groups: { label: 'Groups', subtitle: 'Every campus group, its privacy setting and pending join requests.' },
  members: { label: 'Members & invites', subtitle: 'Manage members and roles, and track the invite batches you send.' },
  announcements: { label: 'Announcements', subtitle: 'Published, scheduled and draft announcements in one place.' },
  content: { label: 'Content moderation', subtitle: 'Review and manage every post, news item, event and job in the feed.' },
  'content-sync': { label: 'Content sync', subtitle: 'Scrape news, notices and events from the university website and import them as drafts for review.' },
  learning: { label: 'Learning', subtitle: 'Curate and publish learning units, grouped by department.' },
  shuttle: { label: 'Shuttle ops', subtitle: 'Live routes, stops and vehicle status across campus.' },
}

const TAB_VALUES = Object.keys(TAB_META) as Tab[]

// ── Helpers ───────────────────────────────────────────────────────────────────

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

/**
 * The admin counter: a 38px tone tile, then the number, then what it counts. Distinct
 * from `MetricTile` — that one is an eyebrow over a large figure and reads as a report;
 * this one reads as a queue you are about to open, which is what the moderation trio is.
 */
function CounterTile({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string
  value: string
  icon: LucideIcon
  tone: { color: string; bg: string }
}) {
  return (
    <div style={{
      background: 'var(--surface-card)',
      border: '0.5px solid var(--border-default)',
      borderRadius: 'var(--r-lg)',
      padding: 14,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}>
      <span style={{
        width: 38,
        height: 38,
        borderRadius: 'var(--r-md)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        background: tone.bg,
        color: tone.color,
      }}>
        <Icon size={18} strokeWidth={1.5} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
        <div style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          marginTop: 3,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {label}
        </div>
      </div>
    </div>
  )
}

function MetricTile({ label, value, hint, hot }: { label: string; value: string; hint: string; hot?: boolean }) {
  return (
    <div style={{
      background: hot ? 'var(--uc-orange-bg)' : 'var(--surface-card)',
      border: `0.5px solid ${hot ? 'var(--uc-orange-bdr)' : 'var(--border-default)'}`,
      borderRadius: 'var(--r-lg)',
      padding: '16px 20px',
    }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: hot ? 'var(--uc-orange-l)' : 'var(--text-label)', letterSpacing: '0.04em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{
        fontSize: 28,
        fontWeight: 500,
        color: hot ? 'var(--uc-orange-l)' : 'var(--text-primary)',
        lineHeight: 1,
        // A tile row is read across, so every figure has to sit on one baseline. A
        // value that wraps takes its whole tile out of alignment with its neighbours.
        whiteSpace: 'nowrap',
      }}>
        {value}
      </div>
      <div style={{ marginTop: 6, fontSize: 12, color: hot ? 'var(--uc-orange-l)' : 'var(--text-tertiary)' }}>{hint}</div>
    </div>
  )
}

function NeedsAttentionList({ stats, onNavigate }: { stats: Stats; onNavigate: (tab: Tab) => void }) {
  const rows = [
    { label: 'Escalated reports', value: stats.escalatedReports, tab: 'moderation' as Tab },
    { label: 'Verification requests', value: stats.verificationRequests, tab: 'members' as Tab },
    { label: 'Invite batches expiring', value: stats.pendingInviteBatches, tab: 'members' as Tab },
  ]
  return (
    <div style={{ background: 'var(--surface-card)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-lg)', padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 12 }}>Needs attention</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map((r) => (
          <button
            key={r.label}
            type="button"
            onClick={() => onNavigate(r.tab)}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '9px 10px', borderRadius: 'var(--r-md)', border: 'none',
              background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)',
              transition: 'background 150ms',
            }}
          >
            <span>{r.label}</span>
            <Badge variant={r.value > 0 ? 'neutral' : 'alumni'}>{r.value}</Badge>
          </button>
        ))}
      </div>
    </div>
  )
}

function InsightsTab({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const { data } = useQuery<Stats>({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.get<{ data: Stats }>('/admin/stats').then((r) => r.data.data),
  })

  if (!data) return <Spinner />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <MetricTile label="Active members" value={data.activeUsers.toLocaleString()} hint={`of ${data.users.toLocaleString()} total`} />
        <MetricTile label="Posts today" value={String(data.postsByDay[data.postsByDay.length - 1]?.count ?? 0)} hint="vs. last 7-day avg" />
        <MetricTile label="Reports resolved" value={`${data.resolvedPct7d}%`} hint="last 7 days" />
        {/* The figure alone, like its three neighbours. Carrying the noun up into the
            28px value wrapped it onto a second line and knocked this tile's baseline
            out of line with the rest of the row. */}
        <MetricTile
          label="Pending invites"
          value={String(data.pendingInviteBatches)}
          hint={`batch${data.pendingInviteBatches === 1 ? '' : 'es'} expiring soon`}
          hot={data.pendingInviteBatches > 0}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
        <ActivityChart postsByDay={data.postsByDay} />
        <RoleBreakdown usersByRole={data.usersByRole} total={data.users} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Content mix</span>
            <GhostBtn onClick={() => onNavigate('moderation')} style={{ fontSize: 12, padding: '4px 10px' }}>
              Review all
            </GhostBtn>
          </div>
          <ContentMetricsStrip stats={data} />
        </div>
        <NeedsAttentionList stats={data} onNavigate={onNavigate} />
      </div>
      <AllowedDomainsPanel />
    </div>
  )
}

function ActivityChart({ postsByDay }: { postsByDay: Stats['postsByDay'] }) {
  const max = Math.max(1, ...postsByDay.map((d) => d.count))
  return (
    <div style={{
      background: 'var(--surface-card)', border: '0.5px solid var(--border-default)',
      borderRadius: 'var(--r-lg)', padding: 16,
    }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 16 }}>
        Post activity this week
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, height: 140 }}>
        {postsByDay.map((d) => (
          <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: '100%', justifyContent: 'flex-end' }}>
            <div
              title={`${d.count} posts`}
              style={{
                width: '100%', maxWidth: 26, borderRadius: 'var(--r-sm) var(--r-sm) 0 0',
                background: 'var(--uc-indigo)', height: `${(d.count / max) * 100}%`, minHeight: d.count > 0 ? 4 : 0,
              }}
            />
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              {new Date(d.date).toLocaleDateString('en-GB', { weekday: 'short' })}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const ROLE_LABELS: Record<string, string> = {
  student: 'Students', alumni: 'Alumni', faculty: 'Faculty', admin: 'Admins', driver: 'Drivers',
}

function RoleBreakdown({ usersByRole, total }: { usersByRole: Stats['usersByRole']; total: number }) {
  return (
    <div style={{
      background: 'var(--surface-card)', border: '0.5px solid var(--border-default)',
      borderRadius: 'var(--r-lg)', padding: 16,
    }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 14 }}>
        Members by role
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {usersByRole.map((r) => {
          const pct = total > 0 ? Math.round((r.count / total) * 100) : 0
          return (
            <div key={r.role} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{ROLE_LABELS[r.role] ?? r.role}</span>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{r.count.toLocaleString()} · {pct}%</span>
              </div>
              <div style={{ height: 5, borderRadius: 'var(--r-pill)', background: 'var(--surface-raised)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 'var(--r-pill)',
                  background: `var(--role-${r.role}, var(--uc-indigo))`,
                  transform: `scaleX(${pct / 100})`, transformOrigin: 'left center',
                }} />
              </div>
            </div>
          )
        })}
      </div>
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

function UsersTab({
  onInvitePeople,
  inviteButtonRef,
}: {
  onInvitePeople: () => void
  inviteButtonRef?: React.RefObject<HTMLButtonElement>
}) {
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

  const { data: stats } = useQuery<Stats>({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.get<{ data: Stats }>('/admin/stats').then((r) => r.data.data),
  })

  const verifyMutation = useMutation({
    mutationFn: (userId: string) => api.patch(`/admin/users/${userId}/verify`, {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      void qc.invalidateQueries({ queryKey: ['admin', 'stats'] })
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

        {stats && stats.verificationsByRole.length > 0 && (
          <div style={{
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-lg)',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Verification queue</span>
              <Badge variant="pinned">
                {stats.verificationsByRole.reduce((sum, r) => sum + r.count, 0)} waiting
              </Badge>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {stats.verificationsByRole.map((r) => (
                <span key={r.role} style={{
                  fontSize: 12, color: 'var(--text-secondary)',
                  background: 'var(--surface-raised)', border: '0.5px solid var(--border-default)',
                  borderRadius: 'var(--r-pill)', padding: '4px 10px',
                }}>
                  {ROLE_LABELS[r.role] ?? r.role}: {r.count}
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '14px 16px',
            borderBottom: '0.5px solid var(--border-default)',
          }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Members</span>
            <button
              ref={inviteButtonRef}
              type="button"
              className="press-feedback"
              onClick={onInvitePeople}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--on-indigo)',
                background: 'var(--uc-indigo)',
                border: 'none',
                borderRadius: 'var(--r-pill)',
                padding: '6px 14px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <UserPlus size={14} strokeWidth={1.5} />
              Invite people
            </button>
          </div>
          {data.items.map((u, rowIndex) => {
            const isSelf = u.id === currentUser?.id
            return (
              <div key={u.id} style={{
                // A row, not a card: the list is one object now, so a deactivated
                // account is marked by its own tinted ground rather than by a border
                // that would double every divider it touches.
                background: !u.isActive ? 'var(--uc-orange-bg)' : undefined,
                borderTop: rowIndex === 0 ? undefined : '0.5px solid var(--border-default)',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                transition: 'background 200ms',
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
                  {/* Long addresses have to ellipsis rather than wrap: on a phone the
                      row is already avatar + name + role select + two actions, and a
                      second line pushes the whole list out of the card. */}
                  <span style={{
                    display: 'block',
                    fontSize: 12,
                    color: 'var(--text-tertiary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {u.email}
                  </span>
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
                      {!u.isVerified && (
                        <button
                          type="button"
                          title="Mark verified"
                          onClick={() => verifyMutation.mutate(u.id)}
                          disabled={verifyMutation.isPending}
                          style={{
                            background: 'var(--uc-mint-bg)',
                            border: '0.5px solid var(--uc-mint-bdr)',
                            borderRadius: 'var(--r-sm)',
                            cursor: verifyMutation.isPending ? 'not-allowed' : 'pointer',
                            padding: '5px 6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--uc-mint)',
                          }}
                        >
                          <ShieldCheckIcon size={15} />
                        </button>
                      )}

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

/** One invitee inside a batch, derived from the invitation row rather than stored. */
type BatchInviteStatus = 'Accepted' | 'Pending' | 'Expired'

const BATCH_STATUS_COLOR: Record<BatchInviteStatus, string> = {
  Accepted: 'var(--uc-mint)',
  Pending: 'var(--uc-amber-l)',
  Expired: 'var(--uc-red)',
}

function batchInviteStatus(inv: Invitation): BatchInviteStatus {
  if (inv.isUsed) return 'Accepted'
  return new Date(inv.expiresAt).getTime() < Date.now() ? 'Expired' : 'Pending'
}

/**
 * A batch summarises to one progress bar, which answers "how is it going" but never
 * "who has not accepted yet" — the question an admin actually opens this card to ask.
 * The row expands to the addresses, fetched only when opened: a page of batches would
 * otherwise pull every invitation on the campus to render bars nobody has clicked.
 */
function InviteBatchRow({ batch, isLast }: { batch: InviteBatch; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const pct = batch.total > 0 ? Math.round((batch.accepted / batch.total) * 100) : 0
  const left = daysLeft(batch.expiresAt)

  const { data: invites, isLoading } = useQuery<Invitation[]>({
    queryKey: ['admin', 'invite-batches', batch.id, 'invitations'],
    queryFn: () =>
      api.get<{ data: Invitation[] }>(`/admin/invitations/batches/${batch.id}`).then((r) => r.data.data),
    enabled: expanded,
    staleTime: 60_000,
  })

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      paddingBottom: isLast ? 0 : 12,
      borderBottom: isLast ? undefined : '0.5px solid var(--border-default)',
    }}>
      <button
        type="button"
        onClick={() => setExpanded((o) => !o)}
        aria-expanded={expanded}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
      >
        <span style={{
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--text-primary)',
          minWidth: 0,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {batch.label}
        </span>
        <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--text-secondary)',
            background: 'var(--surface-raised)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-pill)',
            padding: '1px 8px',
          }}>
            {batch.role}
          </span>
          {expanded
            ? <ChevronUp size={15} strokeWidth={1.5} style={{ color: 'var(--text-tertiary)' }} />
            : <ChevronDown size={15} strokeWidth={1.5} style={{ color: 'var(--text-tertiary)' }} />}
        </span>
      </button>

      <div style={{ height: 5, borderRadius: 'var(--r-pill)', background: 'var(--surface-raised)', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          borderRadius: 'var(--r-pill)',
          background: 'var(--uc-mint)',
          transform: `scaleX(${pct / 100})`,
          transformOrigin: 'left center',
        }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          {batch.accepted} of {batch.total} accepted · {pct}%
        </span>
        <span style={{
          fontSize: 12,
          fontWeight: 500,
          color: left !== null && left <= 3 ? 'var(--uc-amber-l)' : 'var(--text-tertiary)',
        }}>
          {left === null ? 'all resolved' : `${left} day${left === 1 ? '' : 's'} left`}
        </span>
      </div>

      {expanded && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          marginTop: 4,
          borderRadius: 'var(--r-md)',
          overflow: 'hidden',
          background: 'var(--surface-raised)',
        }}>
          {isLoading && (
            <div style={{ padding: '7px 10px', fontSize: 12, color: 'var(--text-tertiary)' }}>Loading…</div>
          )}
          {invites?.map((inv) => {
            const status = batchInviteStatus(inv)
            return (
              <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px' }}>
                <span style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {inv.email}
                </span>
                <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 500, color: BATCH_STATUS_COLOR[status] }}>
                  {status}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Invitations tab ───────────────────────────────────────────────────────────

/**
 * A record of what has been sent, not a place to send from. Composing an invitation —
 * for any role, one at a time or as a batch — lives in `InvitePeopleDialog`, behind the
 * "Invite people" button at the top of the Members card. Three send forms stacked down
 * this tab meant that button was the one control on the screen that could not invite.
 */
function InvitationsTab() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const limit = 20

  const { data, isLoading } = useQuery<Paginated<Invitation>>({
    queryKey: ['admin', 'invitations', page],
    queryFn: () =>
      api.get<{ data: Paginated<Invitation> }>(`/admin/invitations?page=${page}&limit=${limit}`)
        .then((r) => r.data.data),
  })

  const { data: batches } = useQuery<InviteBatch[]>({
    queryKey: ['admin', 'invite-batches'],
    queryFn: () => api.get<{ data: InviteBatch[] }>('/admin/invitations/batches').then((r) => r.data.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/invitations/${id}`),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin', 'invitations'] }) },
  })

  const totalPages = Math.ceil((data?.total ?? 0) / limit)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Invite batches ── */}
      {batches !== undefined && batches.length > 0 && (
        <div style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: 16,
        }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 12 }}>
            Invite batches
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {batches.map((b, i) => (
              <InviteBatchRow key={b.id} batch={b} isLast={i === batches.length - 1} />
            ))}
          </div>
        </div>
      )}

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

// ── Moderation tab (grouped reported content + health panel + per-kind content review) ──

interface ReportGroup {
  targetId: string
  targetType: string
  title: string
  severity: 'high' | 'medium' | 'low'
  reason: string
  reportCount: number
  lastReportedAt: string
  removable: boolean
}

const SEVERITY_STYLE: Record<ReportGroup['severity'], { bg: string; bdr: string; text: string; label: string }> = {
  high: { bg: 'var(--uc-red-bg)', bdr: 'var(--uc-red-bdr)', text: 'var(--uc-red)', label: 'High' },
  medium: { bg: 'var(--uc-amber-bg)', bdr: 'var(--uc-amber-bdr)', text: 'var(--uc-amber-l)', label: 'Medium' },
  low: { bg: 'var(--surface-raised)', bdr: 'var(--border-default)', text: 'var(--text-tertiary)', label: 'Low' },
}

/**
 * Report actions are tone-filled pills, not ghost buttons: Remove is destructive and
 * has to look it from across the row, and Dismiss has to look like its equal weight
 * rather than an afterthought beside it.
 */
function reportActionStyle(kind: 'remove' | 'dismiss'): React.CSSProperties {
  const destructive = kind === 'remove'
  return {
    fontSize: 12,
    fontWeight: 500,
    color: destructive ? 'var(--uc-red)' : 'var(--text-secondary)',
    background: destructive ? 'var(--uc-red-bg)' : 'var(--surface-raised)',
    border: `0.5px solid ${destructive ? 'var(--uc-red-bdr)' : 'var(--border-default)'}`,
    borderRadius: 'var(--r-pill)',
    padding: '5px 12px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  }
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

function ReportedContentTab() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery<{ items: ReportGroup[]; total: number }>({
    queryKey: ['admin', 'reports', 'grouped'],
    queryFn: () => api.get<{ data: { items: ReportGroup[]; total: number } }>('/admin/reports/grouped?limit=50').then((r) => r.data.data),
  })

  const actionMutation = useMutation({
    mutationFn: ({ targetType, targetId, action }: { targetType: string; targetId: string; action: 'remove' | 'dismiss' }) =>
      api.patch(`/admin/reports/target/${targetType}/${targetId}`, { action }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'reports', 'grouped'] })
      void qc.invalidateQueries({ queryKey: ['admin', 'stats'] })
    },
  })

  const items = data?.items ?? []

  return (
    <div style={{ background: 'var(--surface-card)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-lg)', padding: 4 }}>
      <h2 style={{ margin: 0, padding: '14px 16px 8px', fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Reported content</h2>
      {isLoading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>Nothing reported right now</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {items.map((item) => {
            const sev = SEVERITY_STYLE[item.severity]
            return (
              <div
                key={`${item.targetType}:${item.targetId}`}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', borderTop: '0.5px solid var(--border-default)' }}
              >
                {/* The glyph carries the severity, so the row reads as urgent before
                    the pill is read at all. */}
                <span style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  background: sev.bg,
                  color: sev.text,
                }}>
                  <AlertTriangle size={15} strokeWidth={1.5} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.title}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 12, color: 'var(--text-tertiary)' }}>
                    <span style={{ background: sev.bg, border: `0.5px solid ${sev.bdr}`, color: sev.text, borderRadius: 'var(--r-pill)', padding: '1px 8px', fontWeight: 500 }}>
                      {sev.label}
                    </span>
                    <span>{item.reason}</span>
                    <span>·</span>
                    <span>{item.reportCount} report{item.reportCount === 1 ? '' : 's'}</span>
                    <span>·</span>
                    <span>{relativeTime(item.lastReportedAt)}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {item.removable && (
                    <button
                      type="button"
                      className="press-feedback"
                      onClick={() => actionMutation.mutate({ targetType: item.targetType, targetId: item.targetId, action: 'remove' })}
                      disabled={actionMutation.isPending}
                      style={reportActionStyle('remove')}
                    >
                      Remove
                    </button>
                  )}
                  <button
                    type="button"
                    className="press-feedback"
                    onClick={() => actionMutation.mutate({ targetType: item.targetType, targetId: item.targetId, action: 'dismiss' })}
                    disabled={actionMutation.isPending}
                    style={reportActionStyle('dismiss')}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ModerationHealthTile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div style={{ background: 'var(--surface-raised)', borderRadius: 'var(--r-md)', padding: '12px 14px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-label)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 500, color: 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{hint}</div>
    </div>
  )
}

function ModerationHealthPanel({ health }: { health: Stats['moderationHealth'] }) {
  return (
    <div style={{ background: 'var(--surface-card)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-lg)', padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 12 }}>Moderation health</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <ModerationHealthTile label="Reports open" value={String(health.reportsOpen)} hint="awaiting action" />
        <ModerationHealthTile label="Resolved" value={`${health.resolvedPct7d}%`} hint="last 7 days" />
        <ModerationHealthTile label="Median response" value={`${health.medianResponseHours}h`} hint="target 6h" />
        <ModerationHealthTile label="Repeat offenders" value={String(health.repeatOffenders)} hint="flagged twice+" />
      </div>
    </div>
  )
}

function ModerationTab() {
  const { data: stats } = useQuery<Stats>({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.get<{ data: Stats }>('/admin/stats').then((r) => r.data.data),
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <CounterTile label="Escalated reports" value={String(stats.escalatedReports)} icon={Flag} tone={{ color: 'var(--uc-red)', bg: 'var(--uc-red-bg)' }} />
          <CounterTile label="Verification requests" value={String(stats.verificationRequests)} icon={ShieldCheck} tone={{ color: 'var(--uc-red)', bg: 'var(--uc-red-bg)' }} />
          <CounterTile label="Deletion requests" value={String(stats.deletionRequests)} icon={Trash2} tone={{ color: 'var(--uc-amber-l)', bg: 'var(--uc-amber-bg)' }} />
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 12, alignItems: 'start' }}>
        <ReportedContentTab />
        {stats && <ModerationHealthPanel health={stats.moderationHealth} />}
      </div>
      <div style={{ borderTop: '0.5px solid var(--border-default)', paddingTop: 20 }}>
        <DeletionRequestsTab />
      </div>
    </div>
  )
}

// ── Members tab (users + invitations, merged) ──────────────────────────────

function MembersTab() {
  const [inviting, setInviting] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <UsersTab onInvitePeople={() => setInviting(true)} inviteButtonRef={triggerRef} />
      <div style={{ borderTop: '0.5px solid var(--border-default)', paddingTop: 20 }}>
        <InvitationsTab />
      </div>
      <InvitePeopleDialog isOpen={inviting} onClose={() => setInviting(false)} triggerRef={triggerRef} />
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
  const activeTab: Tab = TAB_VALUES.includes(rawTab as Tab) ? (rawTab as Tab) : 'insights'
  const setActiveTab = (tab: Tab) => setSearchParams({ tab })

  // Normalise the bare /admin URL onto its default tab so the rail's tab-scoped rows
  // always have a param to match against, and a reload keeps the tab you were on.
  useEffect(() => {
    if (!rawTab) setSearchParams({ tab: 'insights' }, { replace: true })
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

      {/* The heading is the route. The shell's rail says where you can go; this says
          where you are, which is the one thing the rail cannot show once its own row
          is already lit. */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 500, color: 'var(--text-primary)' }}>
          {TAB_META[activeTab].label}
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {TAB_META[activeTab].subtitle}
        </p>
      </div>

      {activeTab === 'insights' && <InsightsTab onNavigate={setActiveTab} />}
      {activeTab === 'moderation' && <ModerationTab />}
      {activeTab === 'groups' && <GroupsTab />}
      {activeTab === 'members' && <MembersTab />}
      {activeTab === 'announcements' && <AnnouncementsTab />}
      {activeTab === 'content' && <ContentTab />}
      {activeTab === 'content-sync' && <ContentSyncPanel />}
      {activeTab === 'learning' && <LearningAdminPanel />}
      {activeTab === 'shuttle' && <ShuttleTab />}
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
