import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Forward, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/axios'
import { avatarColor as seedColor, getInitials } from '@/utils/avatar'
import { Avatar } from '@/components/Avatar'
import { GhostBtn, PrimaryBtn } from '@/components/Button'
import { AllowedRoleBadge, OfficialBadge, TypeBadge } from './GroupBadges'
import type { Group } from '../types'

export interface GroupHeaderProps {
  group: Group
  /** Opens the members panel (`?modal=members`). */
  onOpenMembers?: () => void
  /** Opens the share dialog (`?modal=share`). */
  onShare?: () => void
  /** Opens the invite dialog (`?modal=invite`). Only passed when the viewer may invite. */
  onInvite?: () => void
}

export function GroupHeader({ group, onOpenMembers, onShare, onInvite }: GroupHeaderProps) {
  const queryClient = useQueryClient()
  const faces = group.previewMembers ?? []
  const moreCount = Math.max(0, group.memberCount - faces.length)
  const memberLabel = `${group.memberCount.toLocaleString()} ${group.memberCount === 1 ? 'member' : 'members'}`

  const toggleMutation = useMutation({
    mutationFn: () =>
      group.isMember
        ? api.delete(`/groups/${group.id}/members/me`).then((r) => r.data)
        : api.post<{ data: { requested?: boolean } }>(`/groups/${group.id}/members`).then((r) => r.data.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['groups', 'detail', group.id] })
      queryClient.invalidateQueries({ queryKey: ['groups', 'list'] })
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

        {/* The design's footer row: the member avatar stack on the left (the "+n" pill
            opens the members panel), the actions on the right. Every control here has a
            route — members, share and invite are all `?modal=` overlays. The group-chat
            button is not built: no endpoint links a group to a conversation yet. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 12,
            paddingTop: 12,
            borderTop: '0.5px solid var(--border-default)',
            flexWrap: 'nowrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, overflow: 'hidden' }} aria-label={memberLabel}>
            {faces.map((f, i) => (
              <span
                key={f.id}
                title={f.fullName}
                style={{
                  position: 'relative',
                  zIndex: faces.length - i,
                  flexShrink: 0,
                  borderRadius: '50%',
                  border: '1.5px solid var(--surface-card)',
                  marginLeft: i === 0 ? 0 : -7,
                  lineHeight: 0,
                }}
              >
                <Avatar src={f.avatarUrl} initials={getInitials(f.fullName)} color={seedColor(f.id)} size={24} />
              </span>
            ))}
            <button
              type="button"
              onClick={onOpenMembers}
              disabled={!onOpenMembers}
              aria-label={`${memberLabel} — open members`}
              style={{
                position: 'relative',
                zIndex: 1,
                minWidth: 24,
                height: 24,
                flexShrink: 0,
                padding: '0 8px',
                boxSizing: 'border-box',
                borderRadius: 'var(--r-pill)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 500,
                fontFamily: 'inherit',
                color: 'var(--text-secondary)',
                background: 'var(--surface-raised)',
                border: '1.5px solid var(--surface-card)',
                marginLeft: faces.length ? -7 : 0,
                cursor: onOpenMembers ? 'pointer' : 'default',
                whiteSpace: 'nowrap',
              }}
            >
              {faces.length && moreCount > 0 ? `+${moreCount.toLocaleString()}` : memberLabel}
            </button>
          </div>
          <span style={{ flex: 1, minWidth: 4 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {onInvite && (
              <button
                type="button"
                onClick={onInvite}
                className="press-feedback"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 12px',
                  fontSize: 12,
                  fontWeight: 500,
                  fontFamily: 'inherit',
                  color: 'var(--uc-indigo-xl)',
                  background: 'var(--uc-indigo-bg)',
                  border: '0.5px solid var(--uc-indigo-bdr)',
                  borderRadius: 'var(--r-pill)',
                  cursor: 'pointer',
                }}
              >
                <UserPlus size={13} strokeWidth={1.5} />
                Invite
              </button>
            )}
            {onShare && (
              <button
                type="button"
                onClick={onShare}
                aria-label="Share group"
                title="Share group"
                className="press-feedback"
                style={{
                  width: 30,
                  height: 30,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  background: 'var(--surface-raised)',
                  border: '0.5px solid var(--border-default)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                <Forward size={15} strokeWidth={1.5} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
