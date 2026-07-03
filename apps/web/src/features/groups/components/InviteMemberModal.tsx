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
  const [selected, setSelected] = useState<UserHit | null>(null)

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
    mutationFn: (userId: string) => api.post(`/groups/${group.id}/invitations`, { userId }),
    onSuccess: () => {
      toast.success('Invitation sent')
      queryClient.invalidateQueries({ queryKey: ['groups', 'members', group.id] })
      onClose()
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.error ?? 'Failed to send invitation')
    },
  })

  const results = data?.items ?? []

  return (
    <Modal isOpen onClose={onClose} title="Invite a member" maxWidth={440}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setSelected(null)
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
              outline: 'none',
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
                const isSelected = selected?.id === user.id
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setSelected(user)}
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
            disabled={!selected || inviteMutation.isPending}
            onClick={() => selected && inviteMutation.mutate(selected.id)}
          >
            {inviteMutation.isPending ? 'Sending…' : 'Send invite'}
          </PrimaryBtn>
        </div>
    </Modal>
  )
}
