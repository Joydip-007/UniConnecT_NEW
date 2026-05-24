import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/axios'
import { avatarColor as seedColor, getInitials } from '@/utils/avatar'
import { Avatar } from '@/components/Avatar'
import { GhostBtn, PrimaryBtn } from '@/components/Button'
import { AllowedRoleBadge, OfficialBadge, TypeBadge } from './GroupBadges'
import type { Group } from '../types'

export function GroupHeader({ group }: { group: Group }) {
  const queryClient = useQueryClient()

  const toggleMutation = useMutation({
    mutationFn: () =>
      group.isMember
        ? api.delete(`/groups/${group.id}/members/me`).then((r) => r.data)
        : api.post(`/groups/${group.id}/members`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', 'detail', group.id] })
      queryClient.invalidateQueries({ queryKey: ['groups', 'list'] })
      toast.success(group.isMember ? 'Left group' : 'Joined group')
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
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        overflow: 'hidden',
      }}
    >
      {group.coverUrl ? (
        <img
          src={group.coverUrl}
          alt={`${group.name} cover`}
          style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div
          style={{
            height: 120,
            background: `linear-gradient(135deg, var(--uc-indigo-bg), var(--surface-raised))`,
            borderBottom: '0.5px solid var(--border-default)',
          }}
        />
      )}

      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ marginTop: -28, marginBottom: 10 }}>
          <div style={{ border: '3px solid var(--surface-card)', borderRadius: '50%', display: 'inline-flex' }}>
            <Avatar src={group.avatarUrl} initials={getInitials(group.name)} color={seedColor(group.id)} size={56} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 500, color: 'var(--text-primary)' }}>
              {group.name}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <TypeBadge type={group.type} />
              <OfficialBadge isSystem={group.isSystem} />
              <AllowedRoleBadge allowedRole={group.allowedRole} />
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 12,
                  fontWeight: 400,
                  color: 'var(--text-secondary)',
                }}
              >
                <Users size={12} strokeWidth={1.5} color="var(--text-tertiary)" />
                {group.memberCount.toLocaleString()} {group.memberCount === 1 ? 'member' : 'members'}
              </span>
            </div>
          </div>

          {group.isSystem ? (
            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)', flexShrink: 0 }}>
              Auto-managed
            </span>
          ) : group.isMember ? (
            <GhostBtn
              onClick={() => toggleMutation.mutate()}
              disabled={toggleMutation.isPending}
              style={{ flexShrink: 0, padding: '6px 16px', fontSize: 13 }}
            >
              {toggleMutation.isPending ? 'Leaving…' : 'Leave group'}
            </GhostBtn>
          ) : (
            <PrimaryBtn
              onClick={() => toggleMutation.mutate()}
              disabled={toggleMutation.isPending}
              style={{ flexShrink: 0, padding: '6px 16px', fontSize: 13 }}
            >
              {toggleMutation.isPending ? 'Joining…' : 'Join group'}
            </PrimaryBtn>
          )}
        </div>

        {group.description && (
          <p
            style={{
              margin: '10px 0 0',
              fontSize: 13,
              fontWeight: 400,
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
            }}
          >
            {group.description}
          </p>
        )}

        {group.isSystem && (
          <p
            style={{
              margin: '10px 0 0',
              fontSize: 12,
              fontWeight: 400,
              color: 'var(--text-tertiary)',
              fontStyle: 'italic',
            }}
          >
            This is an official auto-managed group. Membership is updated automatically based on your role.
          </p>
        )}
      </div>
    </div>
  )
}
