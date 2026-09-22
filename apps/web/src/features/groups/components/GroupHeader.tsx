import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Forward, MessagesSquare, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/axios'
import { avatarColor as seedColor, getInitials } from '@/utils/avatar'
import { Avatar } from '@/components/Avatar'
import { GhostBtn, PrimaryBtn } from '@/components/Button'
import { PATHS } from '@/router/paths'
import { AllowedRoleBadge, OfficialBadge, TypeBadge } from './GroupBadges'
import { MemberRoleTag } from './MemberRoleTag'
import { MembersPanel } from './MembersPanel'
import { InvitePanel } from './InvitePanel'
import { ShareGroupModal } from './ShareGroupModal'
import { useGroupMembers, useOpenGroupChat } from '../hooks/useGroupExtended'
import { GROUP_FACE_COUNT, othersBeyondFaces } from '../groupFaces'
import { useGroupModal } from '../groupDetailRoute'
import type { Group } from '../types'



export function GroupHeader({ group }: { group: Group }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  // `?modal=` — a shared link opens the same dialog, and Back closes it.
  const [overlay, setOverlay] = useGroupModal(group)

  const isAdmin = group.userRole === 'owner' || group.userRole === 'admin'
  // The brief shows Invite for any member, but `POST /groups/:id/invitations` is
  // owner/admin-only (`assertCanAdminGroup`) — a member's Invite would 403 on send.
  const canInvite = !group.isSystem && isAdmin
  const { data: facesPage } = useGroupMembers(group.id, {}, GROUP_FACE_COUNT)
  const faces = facesPage?.items ?? []
  const others = othersBeyondFaces(group.memberCount)

  const openChat = useOpenGroupChat(group.id)
  function goToChat() {
    openChat.mutate(undefined, {
      onSuccess: ({ conversationId }) => navigate(`${PATHS.MESSAGES}/${conversationId}`),
      onError: () => toast.error('Could not open the group chat'),
    })
  }

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
              {group.userRole && <MemberRoleTag role={group.userRole} hideOwner={group.isSystem} />}
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

        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: '0.5px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'nowrap',
            overflow: 'hidden',
          }}
        >
          {/* The faces and the "+N others" label are one control, not a stack beside a
              button: they name the same thing — this group's members — so they open the
              members dialog together and sit flush, with no gap to read as a separator. */}
          <button
            type="button"
            onClick={() => setOverlay('members')}
            aria-label={`Members — ${group.memberCount.toLocaleString()} in this group`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 0,
              minWidth: 0,
              padding: 0,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {faces.length > 0 && (
              <span style={{ display: 'flex', alignItems: 'center' }} aria-hidden>
                {faces.map((m, i) => (
                  <span
                    key={m.id}
                    style={{
                      marginLeft: i === 0 ? 0 : -9,
                      border: '2px solid var(--surface-card)',
                      borderRadius: '50%',
                      display: 'inline-flex',
                      zIndex: faces.length - i,
                      position: 'relative',
                    }}
                  >
                    <Avatar src={m.avatarUrl} initials={getInitials(m.fullName)} color={seedColor(m.id)} size={26} />
                  </span>
                ))}
              </span>
            )}
            {/* Nothing left over means the faces already are the membership — a count
                there would only repeat them. */}
            {others > 0 && (
              <span
                style={{
                  marginLeft: faces.length > 0 ? -8 : 0,
                  padding: '4px 12px 4px 16px',
                  fontSize: 12,
                  fontWeight: 400,
                  color: 'var(--text-secondary)',
                  background: 'var(--surface-raised)',
                  border: '0.5px solid var(--border-default)',
                  borderRadius: 'var(--r-pill)',
                  whiteSpace: 'nowrap',
                }}
              >
                +{others.toLocaleString()} others
              </span>
            )}
          </button>

          <span style={{ flex: 1 }} />

          {canInvite && (
            <GhostBtn onClick={() => setOverlay('invite')} style={{ padding: '4px 12px', fontSize: 12 }}>
              <UserPlus size={13} strokeWidth={1.5} />
              Invite
            </GhostBtn>
          )}
          <button
            type="button"
            onClick={() => setOverlay('share')}
            aria-label="Share group"
            className="press-feedback row-hover-bg"
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'transparent',
              border: '0.5px solid var(--border-hover)',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Forward size={15} strokeWidth={1.5} />
          </button>
          {group.type === 'academic' && group.isMember && (
            <button
              type="button"
              onClick={goToChat}
              disabled={openChat.isPending}
              aria-label="Open group chat"
              className="press-feedback"
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--uc-indigo-l)',
                background: 'var(--uc-indigo-bg)',
                border: '0.5px solid var(--uc-indigo-bdr)',
                borderRadius: 'var(--r-pill)',
                cursor: 'pointer',
              }}
            >
              <MessagesSquare size={15} strokeWidth={1.5} />
              Chat
              {!!group.chatUnread && group.chatUnread > 0 && (
                <span
                  style={{
                    minWidth: 16,
                    height: 16,
                    padding: '0 4px',
                    borderRadius: 'var(--r-pill)',
                    background: 'var(--uc-indigo)',
                    color: 'var(--on-accent)',
                    fontSize: 10,
                    fontWeight: 500,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {group.chatUnread > 99 ? '99+' : group.chatUnread}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {overlay === 'members' && (
        <MembersPanel
          group={group}
          onClose={() => setOverlay(null)}
          onInvite={canInvite ? () => setOverlay('invite') : undefined}
        />
      )}
      {overlay === 'invite' && <InvitePanel group={group} onClose={() => setOverlay(null)} />}
      {overlay === 'share' && <ShareGroupModal group={group} onClose={() => setOverlay(null)} />}
    </div>
  )
}
