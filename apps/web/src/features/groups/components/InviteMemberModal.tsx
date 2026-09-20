import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, CheckCircle2, Search, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/axios'
import { avatarColor as seedColor, getInitials } from '@/utils/avatar'
import { Avatar } from '@/components/Avatar'
import { Modal } from '@/components/Modal'
import type { Group } from '../types'

interface UserHit {
  id: string
  email: string
  role: 'student' | 'alumni' | 'faculty' | 'admin'
  profile: {
    fullName: string
    avatarUrl: string | null
    department: string | null
    headline: string | null
  }
}

interface UsersResponse {
  items: UserHit[]
  total: number
  page: number
  limit: number
}

interface ApiError {
  response?: { data?: { error?: string } }
}

const ROLE_LABEL: Record<UserHit['role'], string> = {
  student: 'Student',
  alumni: 'Alumni',
  faculty: 'Faculty',
  admin: 'Admin',
}

/**
 * The invite panel, routed at `/groups/:id?modal=invite`.
 *
 * Search is by name only — that is what `GET /users?search=` matches — and every
 * invite goes through `POST /groups/:id/invitations { userId }`, which has no role
 * field, so the design's "Invite as" row is not offered. "Full directory" is the
 * people section of the groups page, the only directory the app has.
 */
export function InviteMemberModal({ group, onClose }: { group: Group; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [selected, setSelected] = useState<Map<string, UserHit>>(new Map())
  const [sentText, setSentText] = useState<string | null>(null)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search])

  const { data, isLoading } = useQuery<UsersResponse>({
    queryKey: ['groups', 'invite-search', group.id, debounced, group.allowedRole],
    enabled: debounced.length > 0,
    queryFn: () =>
      api
        .get<{ data: UsersResponse }>('/users', {
          params: {
            search: debounced,
            limit: 10,
            ...(group.allowedRole ? { role: group.allowedRole } : {}),
          },
        })
        .then((r) => r.data.data),
  })

  const inviteMutation = useMutation({
    mutationFn: async (users: UserHit[]) => {
      const results = await Promise.allSettled(
        users.map((u) => api.post(`/groups/${group.id}/invitations`, { userId: u.id })),
      )
      const failed = results.filter((r) => r.status === 'rejected').length
      return { total: users.length, failed }
    },
    onSuccess: ({ total, failed }) => {
      const sent = total - failed
      if (sent > 0) {
        setSentText(sent === 1 ? 'Invitation sent' : `${sent} invitations sent`)
        setSelected(new Map())
      }
      if (failed > 0) toast.error(`${failed} invitation${failed === 1 ? '' : 's'} failed`)
      queryClient.invalidateQueries({ queryKey: ['groups', 'members', group.id] })
      queryClient.invalidateQueries({ queryKey: ['groups', 'pending-invites', group.id] })
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.error ?? 'Failed to send invitations')
    },
  })

  const results = data?.items ?? []

  function toggleSelected(user: UserHit) {
    setSentText(null)
    setSelected((prev) => {
      const next = new Map(prev)
      if (next.has(user.id)) next.delete(user.id)
      else next.set(user.id, user)
      return next
    })
  }

  const count = selected.size
  const canSend = count > 0 && !inviteMutation.isPending
  const sendLabel = inviteMutation.isPending ? 'Sending…' : count > 1 ? `Send ${count} invites` : 'Send invite'

  return (
    <Modal
      isOpen
      onClose={onClose}
      variant="panel"
      maxWidth={560}
      icon={<UserPlus size={16} strokeWidth={1.5} />}
      title="Invite people"
      subtitle={`They get a notification and can accept from ${group.name}.`}
      footer={
        <>
          <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>
            {count === 0 ? 'No one selected yet' : `${count} selected`}
          </span>
          <Link
            to="/groups?section=people"
            style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)', textDecoration: 'none', whiteSpace: 'nowrap' }}
          >
            Full directory
          </Link>
          <button
            type="button"
            disabled={!canSend}
            onClick={() => inviteMutation.mutate(Array.from(selected.values()))}
            className={canSend ? 'press-feedback' : undefined}
            style={{
              minHeight: 34,
              padding: '0 16px',
              fontSize: 13,
              fontWeight: 500,
              fontFamily: 'inherit',
              borderRadius: 'var(--r-pill)',
              border: 'none',
              background: canSend ? 'var(--uc-indigo)' : 'var(--surface-raised)',
              color: canSend ? 'var(--on-accent)' : 'var(--text-tertiary)',
              cursor: canSend ? 'pointer' : 'default',
              whiteSpace: 'nowrap',
            }}
          >
            {sendLabel}
          </button>
        </>
      }
    >
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 12px',
          minHeight: 38,
          background: 'var(--surface-raised)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-pill)',
        }}
      >
        <Search size={15} strokeWidth={1.5} color="var(--text-tertiary)" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search people by name"
          aria-label="Search people"
          style={{
            flex: 1,
            minWidth: 0,
            background: 'none',
            border: 'none',
            outline: 'none',
            fontSize: 13,
            fontWeight: 400,
            fontFamily: 'inherit',
            color: 'var(--text-primary)',
          }}
        />
      </label>

      {sentText && (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 12px',
            background: 'var(--uc-mint-bg)',
            border: '0.5px solid var(--uc-mint-bdr)',
            borderRadius: 'var(--r-md)',
          }}
        >
          <CheckCircle2 size={14} strokeWidth={1.5} color="var(--uc-mint)" />
          <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--uc-mint)' }}>{sentText}</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Selections stay listed above the results so a new search never hides them. */}
        {Array.from(selected.values())
          .filter((u) => !results.some((r) => r.id === u.id))
          .map((user, i) => (
            <PersonRow key={user.id} user={user} selected onToggle={() => toggleSelected(user)} first={i === 0} />
          ))}
        {debounced.length === 0 && count === 0 ? (
          <EmptyText>Type a name to find people to invite.</EmptyText>
        ) : isLoading ? (
          <EmptyText>Searching…</EmptyText>
        ) : debounced.length > 0 && results.length === 0 ? (
          <EmptyText>No one matches “{debounced}”.</EmptyText>
        ) : (
          results.map((user, i) => (
            <PersonRow
              key={user.id}
              user={user}
              selected={selected.has(user.id)}
              onToggle={() => toggleSelected(user)}
              first={i === 0 && count === 0}
            />
          ))
        )}
      </div>
    </Modal>
  )
}

function PersonRow({
  user,
  selected,
  onToggle,
  first,
}: {
  user: UserHit
  selected: boolean
  onToggle: () => void
  first: boolean
}) {
  const meta = [ROLE_LABEL[user.role], user.profile.department].filter(Boolean).join(' · ')
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className="row-hover-bg"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        width: '100%',
        padding: '10px 8px',
        textAlign: 'left',
        background: selected ? 'var(--uc-indigo-bg)' : 'transparent',
        border: 'none',
        borderTop: first ? 'none' : '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-sm)',
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      <Avatar src={user.profile.avatarUrl} initials={getInitials(user.profile.fullName)} color={seedColor(user.id)} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{user.profile.fullName}</p>
        {meta && <p style={{ margin: '1px 0 0', fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>{meta}</p>}
        {user.profile.headline && (
          <p
            style={{
              margin: '1px 0 0',
              fontSize: 12,
              fontWeight: 400,
              color: 'var(--text-tertiary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {user.profile.headline}
          </p>
        )}
      </div>
      <span
        aria-hidden
        style={{
          width: 18,
          height: 18,
          flexShrink: 0,
          borderRadius: 'var(--r-sm)',
          border: `0.5px solid ${selected ? 'var(--uc-indigo)' : 'var(--border-hover)'}`,
          background: selected ? 'var(--uc-indigo)' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--on-accent)',
        }}
      >
        {selected && <Check size={12} strokeWidth={2} />}
      </span>
    </button>
  )
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: 0, padding: '26px 12px', textAlign: 'center', fontSize: 13, fontWeight: 400, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
      {children}
    </p>
  )
}
