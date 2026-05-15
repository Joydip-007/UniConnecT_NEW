import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Users, FileText, Mail, Flag, CheckCircle, XCircle, Trash2, X } from 'lucide-react'
import { api } from '@/lib/axios'
import { Avatar } from '@/components/Avatar'
import { Badge } from '@/components/Badge'
import { GhostBtn, PrimaryBtn } from '@/components/Button'

// ── Types ──────────────────────────────────────────────────────────────────────

type UserRole = 'student' | 'alumni' | 'staff' | 'admin'

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

const AVATAR_PALETTE = ['var(--uc-indigo)', 'var(--uc-orange)', 'var(--uc-cyan)', 'var(--uc-mint)']
function seedColor(id: string) {
  const sum = [...id].reduce((a, c) => a + c.charCodeAt(0), 0)
  return AVATAR_PALETTE[sum % AVATAR_PALETTE.length]
}
function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase()
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div style={{
      background: 'var(--surface-card)',
      border: '0.5px solid var(--border-default)',
      borderRadius: 'var(--r-lg)',
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}>
      <span style={{ fontSize: 26, fontWeight: 500, color: 'var(--text-primary)' }}>
        {value.toLocaleString()}
      </span>
      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
      {sub && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{sub}</span>}
    </div>
  )
}

// ── Tab nav type ──────────────────────────────────────────────────────────────

type Tab = 'overview' | 'users' | 'invitations' | 'reports'
const TABS: { label: string; value: Tab; icon: React.ReactNode }[] = [
  { label: 'Overview', value: 'overview', icon: <FileText size={14} /> },
  { label: 'Users', value: 'users', icon: <Users size={14} /> },
  { label: 'Invite', value: 'invitations', icon: <Mail size={14} /> },
  { label: 'Reports', value: 'reports', icon: <Flag size={14} /> },
]

// ── Allowed email domains panel ───────────────────────────────────────────────

function AllowedDomainsPanel() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)

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
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
            Allowed email domains
          </span>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
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
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--uc-indigo-l)', opacity: 0.7 }}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <input
                type="text"
                value={input}
                onChange={(e) => { setInput(e.target.value); setInputError(null) }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDomain() } }}
                placeholder="e.g. bscse.uiu.ac.bd"
                style={inputStyle}
              />
              {inputError && (
                <span style={{ fontSize: 12, color: 'var(--uc-orange-l)' }}>{inputError}</span>
              )}
            </div>
            <GhostBtn onClick={addDomain} style={{ alignSelf: 'flex-start' }}>
              Add
            </GhostBtn>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <PrimaryBtn
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate(draft)}
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

  const cards: { label: string; value: number; sub?: string }[] = [
    { label: 'Total users', value: data.users, sub: `${data.activeUsers} active in last 30 days` },
    { label: 'Posts', value: data.posts },
    { label: 'Jobs', value: data.jobs },
    { label: 'Events', value: data.events },
    { label: 'Groups', value: data.groups },
    { label: 'News articles', value: data.news },
    { label: 'Open reports', value: data.reports },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
        {cards.map((c) => <StatCard key={c.label} {...c} />)}
      </div>
      <AllowedDomainsPanel />
    </div>
  )
}

// ── Users tab ─────────────────────────────────────────────────────────────────

function UsersTab() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const limit = 20

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

  const statusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      api.patch(`/admin/users/${userId}/status`, { is_active: isActive }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin', 'users'] }) },
  })

  if (isLoading || !data) return <Spinner />

  const totalPages = Math.ceil(data.total / limit)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>
        {data.total.toLocaleString()} users total
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {data.items.map((u) => (
          <div key={u.id} style={{
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-md)',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            {u.profile.avatarUrl ? (
              <img src={u.profile.avatarUrl} alt={u.profile.fullName}
                style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <Avatar initials={getInitials(u.profile.fullName)} color={seedColor(u.id)} size={36} />
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                  {u.profile.fullName}
                </span>
                {!u.isVerified && <Badge variant="neutral">unverified</Badge>}
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{u.email}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <select
                value={u.role}
                onChange={(e) => roleMutation.mutate({ userId: u.id, role: e.target.value as UserRole })}
                disabled={roleMutation.isPending}
                style={selectStyle}
              >
                {(['student', 'alumni', 'staff', 'admin'] as UserRole[]).map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              <button
                type="button"
                title={u.isActive ? 'Deactivate' : 'Activate'}
                onClick={() => statusMutation.mutate({ userId: u.id, isActive: !u.isActive })}
                disabled={statusMutation.isPending}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}
              >
                {u.isActive
                  ? <CheckCircle size={18} color="var(--uc-mint)" />
                  : <XCircle size={18} color="var(--uc-orange)" />}
              </button>
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
      {/* ── Send panel ── */}
      <div style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: '20px',
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
                value={formRole}
                onChange={(e) => setFormRole(e.target.value as UserRole)}
                style={{ ...selectStyle, flex: '1 1 120px' }}
              >
                {(['student', 'alumni', 'staff', 'admin'] as UserRole[]).map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <select
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
                  Failed to send. Try again.
                </span>
              )}
            </div>
          </div>
        )}

        {mode === 'multiple' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <select
                value={bulkRole}
                onChange={(e) => setBulkRole(e.target.value as UserRole)}
                style={{ ...selectStyle, flex: '1 1 120px' }}
              >
                {(['student', 'alumni', 'staff', 'admin'] as UserRole[]).map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <select
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
                  Failed to send. Try again.
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
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-md)',
            padding: '10px 14px',
          }}>
            <span style={{ fontSize: 13, color: 'var(--uc-mint)' }}>{successMsg}</span>
            <button
              type="button"
              onClick={() => setSuccessMsg(null)}
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {data.items.map((inv) => (
              <div key={inv.id} style={{
                background: 'var(--surface-card)',
                border: '0.5px solid var(--border-default)',
                borderRadius: 'var(--r-md)',
                padding: '12px 16px',
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
        <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 14, color: 'var(--text-tertiary)' }}>
          No reports yet
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {data.items.map((r) => (
          <div key={r.id} style={{
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-md)',
            padding: '14px 16px',
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

// ── Spinner ───────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{ padding: '40px 0', display: 'flex', justifyContent: 'center' }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%',
        border: '2px solid var(--border-default)',
        borderTopColor: 'var(--uc-indigo)',
        animation: 'spin 0.7s linear infinite',
      }} />
    </div>
  )
}

// ── AdminPage ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 500, color: 'var(--text-primary)' }}>
          Admin panel
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
          Manage users, invitations, and content for United International University
        </p>
      </div>

      <nav style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: '4px 8px',
        display: 'flex',
        gap: 2,
      }}>
        {TABS.map(({ label, value, icon }) => {
          const active = activeTab === value
          return (
            <button
              key={value}
              type="button"
              onClick={() => setActiveTab(value)}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '7px 0',
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
              {icon} {label}
            </button>
          )
        })}
      </nav>

      {activeTab === 'overview' && <OverviewTab />}
      {activeTab === 'users' && <UsersTab />}
      {activeTab === 'invitations' && <InvitationsTab />}
      {activeTab === 'reports' && <ReportsTab />}
    </div>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-raised)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-sm)',
  padding: '8px 12px',
  fontSize: 13,
  color: 'var(--text-primary)',
  outline: 'none',
  fontFamily: 'inherit',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
}
