import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/axios'
import { avatarColor as seedColor, getInitials } from '@/utils/avatar'
import { Avatar } from '@/components/Avatar'
import { Modal } from '@/components/Modal'
import { GhostBtn, PrimaryBtn } from '@/components/Button'
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

export function InviteMemberModal({ group, onClose }: { group: Group; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [selected, setSelected] = useState<Map<string, UserHit>>(new Map())

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
      if (sent > 0) toast.success(sent === 1 ? 'Invitation sent' : `${sent} invitations sent`)
      if (failed > 0) toast.error(`${failed} invitation${failed === 1 ? '' : 's'} failed`)
      queryClient.invalidateQueries({ queryKey: ['groups', 'members', group.id] })
      queryClient.invalidateQueries({ queryKey: ['groups', 'pending-invites', group.id] })
      onClose()
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.error ?? 'Failed to send invitations')
    },
  })

  const results = data?.items ?? []

  function toggleSelected(user: UserHit) {
    setSelected((prev) => {
      const next = new Map(prev)
      if (next.has(user.id)) next.delete(user.id)
      else next.set(user.id, user)
      return next
    })
  }

  return (
    <Modal isOpen onClose={onClose} title="Invite a member" maxWidth={440}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {selected.size > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {Array.from(selected.values()).map((user) => (
                <span
                  key={user.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 8px 4px 4px',
                    fontSize: 11,
                    fontWeight: 500,
                    color: 'var(--uc-indigo-l)',
                    background: 'var(--uc-indigo-bg)',
                    border: '0.5px solid var(--uc-indigo-bdr)',
                    borderRadius: 'var(--r-pill)',
                  }}
                >
                  <Avatar
                    src={user.profile.avatarUrl}
                    initials={getInitials(user.profile.fullName)}
                    color={seedColor(user.id)}
                    size={18}
                  />
                  {user.profile.fullName}
                  <button
                    type="button"
                    onClick={() => toggleSelected(user)}
                    aria-label={`Remove ${user.profile.fullName}`}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, lineHeight: 0 }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
            }}
            placeholder="Search by name…"
            style={{
              width: '100%',
              padding: '9px 12px',
              fontSize: 13,
              fontWeight: 400,
              color: 'var(--text-primary)',
              background: 'var(--surface-raised)',
              border: '0.5px solid var(--border-default)',
              borderRadius: 'var(--r-md)',
            }}
          />

          <div
            style={{
              maxHeight: 280,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              minHeight: 80,
            }}
          >
            {debounced.length === 0 ? (
              <p style={{ margin: 'auto', fontSize: 12, color: 'var(--text-tertiary)' }}>
                Start typing to find a member.
              </p>
            ) : isLoading ? (
              <p style={{ margin: 'auto', fontSize: 12, color: 'var(--text-tertiary)' }}>Searching…</p>
            ) : results.length === 0 ? (
              <p style={{ margin: 'auto', fontSize: 12, color: 'var(--text-tertiary)' }}>No matches.</p>
            ) : (
              results.map((user) => {
                const isSelected = selected.has(user.id)
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => toggleSelected(user)}
                    aria-pressed={isSelected}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 10px',
                      border: `0.5px solid ${isSelected ? 'var(--uc-indigo-bdr)' : 'transparent'}`,
                      borderRadius: 'var(--r-md)',
                      background: isSelected ? 'var(--uc-indigo-bg)' : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelected(user)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ pointerEvents: 'none' }}
                    />
                    <Avatar
                      src={user.profile.avatarUrl}
                      initials={getInitials(user.profile.fullName)}
                      color={seedColor(user.id)}
                      size={32}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                        {user.profile.fullName}
                      </p>
                      <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--text-tertiary)' }}>
                        {user.role}
                        {user.profile.department ? ` · ${user.profile.department}` : ''}
                      </p>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        <div
          style={{
            padding: '12px 18px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            borderTop: '0.5px solid var(--border-default)',
          }}
        >
          <GhostBtn onClick={onClose} disabled={inviteMutation.isPending}>
            Cancel
          </GhostBtn>
          <PrimaryBtn
            disabled={selected.size === 0 || inviteMutation.isPending}
            onClick={() => inviteMutation.mutate(Array.from(selected.values()))}
          >
            {inviteMutation.isPending
              ? 'Sending…'
              : selected.size > 1
                ? `Send ${selected.size} invites`
                : 'Send invite'}
          </PrimaryBtn>
        </div>
    </Modal>
  )
}
