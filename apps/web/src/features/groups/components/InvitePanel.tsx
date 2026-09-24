import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Check, Search, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/axios'
import { avatarColor as seedColor, getInitials } from '@/utils/avatar'
import { Avatar } from '@/components/Avatar'
import { RoleBadge } from '@/components/RoleBadge'
import { PrimaryBtn } from '@/components/Button'
import { PATHS } from '@/router/paths'
import { GroupPanel } from './GroupPanel'
import { useInviteToGroup, type InviteRole } from '../hooks/useGroupExtended'
import type { Group } from '../types'

interface Candidate {
  id: string
  role: 'student' | 'alumni' | 'faculty' | 'admin' | 'driver'
  profile: {
    fullName: string
    avatarUrl?: string | null
    department: string | null
    batchYear?: string | null
    headline?: string | null
  }
  /** Only the directory (`GET /users`) answers this — absent on suggestions. */
  mutualConnections?: number
}

interface CandidatePage {
  items: Candidate[]
}

const ROLE_CHIPS: { value: InviteRole; label: string }[] = [
  { value: 'member', label: 'Member' },
  { value: 'moderator', label: 'Moderator' },
  { value: 'admin', label: 'Admin' },
]

function candidateMeta(c: Candidate) {
  const parts = [c.profile.department, c.profile.batchYear ? `Batch ${c.profile.batchYear}` : null].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : c.role
}

export function InvitePanel({ group, onClose }: { group: Group; onClose: () => void }) {
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [role, setRole] = useState<InviteRole>('member')
  const [selected, setSelected] = useState<Map<string, Candidate>>(new Map())
  const [sentCount, setSentCount] = useState(0)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search])

  // Academic groups never mint admins from the invite flow, and only an owner may anywhere.
  const chips = ROLE_CHIPS.filter(
    (c) => c.value !== 'admin' || (group.type !== 'academic' && group.userRole === 'owner'),
  )

  const suggestions = useQuery({
    queryKey: ['users', 'suggestions', { limit: 20 }],
    queryFn: () =>
      api.get<{ data: Candidate[] }>('/users/suggestions', { params: { limit: 20 } }).then((r) => r.data.data),
    enabled: debounced.length === 0,
    staleTime: 60_000,
  })

  const results = useQuery({
    queryKey: ['users', 'directory', { search: debounced, role: group.allowedRole ?? undefined, limit: 20 }],
    queryFn: () =>
      api
        .get<{ data: CandidatePage }>('/users', {
          params: { search: debounced, limit: 20, ...(group.allowedRole ? { role: group.allowedRole } : {}) },
        })
        .then((r) => r.data.data.items),
    enabled: debounced.length > 0,
  })

  const candidates = (debounced ? results.data : suggestions.data) ?? []
  const loading = debounced ? results.isLoading : suggestions.isLoading

  const invite = useInviteToGroup(group.id)

  function toggle(c: Candidate) {
    setSelected((prev) => {
      const next = new Map(prev)
      if (next.has(c.id)) next.delete(c.id)
      else next.set(c.id, c)
      return next
    })
  }

  function send() {
    const userIds = Array.from(selected.keys())
    invite.mutate(
      { userIds, role },
      {
        onSuccess: ({ sent, failed }) => {
          if (sent > 0) setSentCount((n) => n + sent)
          if (failed > 0) toast.error(`${failed} ${failed === 1 ? 'invite' : 'invites'} failed`)
          setSelected(new Map())
        },
        onError: () => toast.error('Failed to send invites'),
      },
    )
  }

  const count = selected.size
  const footer = (
    <>
      <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>
        {count} {count === 1 ? 'person' : 'people'} selected
      </span>
      <Link
        to={`${PATHS.GROUPS}?section=people`}
        onClick={onClose}
        style={{ fontSize: 12, fontWeight: 500, color: 'var(--uc-indigo-l)', textDecoration: 'none' }}
      >
        Full directory
      </Link>
      <span style={{ flex: 1 }} />
      <PrimaryBtn
        onClick={send}
        disabled={count === 0 || invite.isPending}
        style={
          count === 0
            ? { padding: '6px 14px', fontSize: 12, background: 'var(--surface-raised)', color: 'var(--text-tertiary)' }
            : { padding: '6px 14px', fontSize: 12 }
        }
      >
        {invite.isPending ? 'Sending…' : `Send ${count} ${count === 1 ? 'invite' : 'invites'}`}
      </PrimaryBtn>
    </>
  )

  return (
    <GroupPanel icon={UserPlus} title="Invite people" subtitle={group.name} onClose={onClose} footer={footer}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: 38,
          padding: '0 14px',
          background: 'var(--surface-raised)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-pill)',
          flexShrink: 0,
        }}
      >
        <Search size={13} strokeWidth={1.5} color="var(--text-tertiary)" aria-hidden />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search people by name, department or batch"
          aria-label="Search people"
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: 13,
            fontWeight: 400,
          }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', color: 'var(--text-label)', marginRight: 2 }}>
          Invite as
        </span>
        {chips.map((chip) => {
          const active = chip.value === role
          return (
            <button
              key={chip.value}
              type="button"
              onClick={() => setRole(chip.value)}
              aria-pressed={active}
              className="press-feedback"
              style={{
                padding: '4px 12px',
                fontSize: 12,
                fontWeight: 500,
                borderRadius: 'var(--r-pill)',
                cursor: 'pointer',
                background: active ? 'var(--uc-indigo-bg)' : 'transparent',
                border: `0.5px solid ${active ? 'var(--uc-indigo-bdr)' : 'var(--border-default)'}`,
                color: active ? 'var(--uc-indigo-l)' : 'var(--text-secondary)',
              }}
            >
              {chip.label}
            </button>
          )
        })}
      </div>

      {sentCount > 0 && (
        <div
          role="status"
          style={{
            padding: '8px 12px',
            fontSize: 12,
            fontWeight: 400,
            color: 'var(--uc-mint)',
            background: 'var(--uc-mint-bg)',
            border: '0.5px solid var(--uc-mint-bdr)',
            borderRadius: 'var(--r-md)',
          }}
        >
          {sentCount} {sentCount === 1 ? 'invite' : 'invites'} sent · they appear under Members once accepted
        </div>
      )}

      {loading ? (
        <p style={{ margin: '24px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>Searching…</p>
      ) : candidates.length === 0 ? (
        <p style={{ margin: '24px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>
          {debounced ? 'No matches' : 'No suggestions right now — try searching'}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {candidates.map((c) => {
            const isSelected = selected.has(c.id)
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c)}
                aria-pressed={isSelected}
                className="row-hover-bg"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 8px',
                  background: isSelected ? 'var(--uc-indigo-bg)' : 'transparent',
                  border: 'none',
                  borderBottom: '0.5px solid var(--border-default)',
                  borderRadius: 'var(--r-sm)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <Avatar src={c.profile.avatarUrl} initials={getInitials(c.profile.fullName)} color={seedColor(c.id)} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <RoleBadge role={c.role} size={14} tipPlacement="below" />
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                      {c.profile.fullName}
                    </p>
                  </div>
                  <p style={{ margin: '1px 0 0', fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>
                    {candidateMeta(c)}
                  </p>
                  {typeof c.mutualConnections === 'number' && c.mutualConnections > 0 && (
                    <p style={{ margin: '1px 0 0', fontSize: 11, fontWeight: 400, color: 'var(--uc-indigo-l)' }}>
                      {c.mutualConnections} mutual {c.mutualConnections === 1 ? 'connection' : 'connections'}
                    </p>
                  )}
                </div>
                <span
                  aria-hidden
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isSelected ? 'var(--uc-indigo)' : 'transparent',
                    border: `0.5px solid ${isSelected ? 'var(--uc-indigo)' : 'var(--border-hover)'}`,
                    color: 'var(--on-accent)',
                    flexShrink: 0,
                  }}
                >
                  {isSelected && <Check size={11} strokeWidth={2} />}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </GroupPanel>
  )
}
