import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/axios'
import { avatarColor as seedColor, getInitials } from '@/utils/avatar'
import { Avatar } from '@/components/Avatar'
import { GhostBtn, PrimaryBtn } from '@/components/Button'
import { ShareMenu } from '@/components/ShareMenu'
import { AllowedRoleBadge, OfficialBadge, TypeBadge } from './GroupBadges'
import type { Group } from '../types'

export function GroupCard({ group }: { group: Group }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const toggleMutation = useMutation({
    mutationFn: () =>
      group.isMember
        ? api.delete(`/groups/${group.id}/members/me`).then((r) => r.data)
        : api.post<{ data: { requested?: boolean } }>(`/groups/${group.id}/members`).then((r) => r.data.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['groups', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['groups', 'detail', group.id] })
      if (group.isMember) {
        toast.success('Left group')
      } else if (data && 'requested' in data && data.requested) {
        toast.success('Join request sent')
      } else {
        toast.success('Joined group')
      }
    },
    onError: (error: unknown) => {
      const message =
        typeof error === 'object' && error && 'response' in error
          ? ((error as { response?: { data?: { error?: string } } }).response?.data?.error ?? null)
          : null
      toast.error(message ?? (group.isMember ? 'Failed to leave group' : 'Failed to join group'))
    },
  })

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open ${group.name}`}
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        cursor: 'pointer',
        transition: 'border-color 150ms',
      }}
      onClick={() => navigate(`/groups/${group.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          navigate(`/groups/${group.id}`)
        }
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-default)')}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar src={group.avatarUrl} initials={getInitials(group.name)} color={seedColor(group.id)} size={48} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {group.name}
          </p>
          <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <TypeBadge type={group.type} />
            <OfficialBadge isSystem={group.isSystem} />
            <AllowedRoleBadge allowedRole={group.allowedRole} />
          </div>
        </div>
      </div>

      {group.description && (
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 400,
            color: 'var(--text-secondary)',
            lineHeight: 1.55,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {group.description}
        </p>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Users size={12} strokeWidth={1.5} color="var(--text-tertiary)" />
          <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>
            {group.memberCount.toLocaleString()} {group.memberCount === 1 ? 'member' : 'members'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ShareMenu entityType="group" entityId={group.id} title={group.name} />
          {group.isSystem ? (
            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>Auto-managed</span>
          ) : group.isMember ? (
            <GhostBtn
              onClick={() => toggleMutation.mutate()}
              disabled={toggleMutation.isPending}
              style={{ padding: '5px 14px', fontSize: 12 }}
            >
              {toggleMutation.isPending ? 'Leaving…' : 'Leave'}
            </GhostBtn>
          ) : (
            <PrimaryBtn
              onClick={() => toggleMutation.mutate()}
              disabled={toggleMutation.isPending}
              style={{ padding: '5px 14px', fontSize: 12 }}
            >
              {toggleMutation.isPending ? 'Joining…' : 'Join'}
            </PrimaryBtn>
          )}
        </div>
      </div>
    </div>
  )
}
