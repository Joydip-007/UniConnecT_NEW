import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Lock } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/axios'
import { avatarColor as seedColor, getInitials } from '@/utils/avatar'
import { ShareMenu } from '@/components/ShareMenu'
import { AllowedRoleBadge, OfficialBadge } from './GroupBadges'
import { TYPE_LOOK } from '../groupTypeLook'
import type { Group } from '../types'


function memberLabel(count: number) {
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k members`
  return `${count} ${count === 1 ? 'member' : 'members'}`
}

/**
 * Overlapping faces of the first few members. Purely decorative next to the count, so it
 * is hidden from assistive tech — `socialProof` beside it carries the same information.
 */
function FaceStack({ group }: { group: Group }) {
  const faces = group.previewMembers ?? []
  if (faces.length === 0) return null

  return (
    <div aria-hidden style={{ display: 'flex', alignItems: 'center' }}>
      {faces.map((face, i) => (
        <span
          key={face.id}
          title={face.fullName}
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 500,
            color: 'var(--on-accent)',
            background: seedColor(face.id),
            border: '2px solid var(--surface-card)',
            marginLeft: i === 0 ? 0 : -8,
            backgroundImage: face.avatarUrl ? `url(${face.avatarUrl})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {face.avatarUrl ? '' : getInitials(face.fullName)}
        </span>
      ))}
    </div>
  )
}

export function GroupCard({ group }: { group: Group }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const look = TYPE_LOOK[group.type] ?? TYPE_LOOK.other
  const Glyph = look.icon

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

  const muted = group.isMuted ?? false
  const muteMutation = useMutation({
    mutationFn: (next: boolean) =>
      api.patch(`/groups/${group.id}/members/me/mute`, { muted: next }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['groups', 'detail', group.id] })
    },
    onError: () => toast.error('Could not change notifications'),
  })

  const known = group.knownMemberCount ?? 0
  const socialProof =
    known > 0
      ? `${known} ${known === 1 ? 'person' : 'people'} you know`
      : memberLabel(group.memberCount)

  const ctaLabel = group.isMember ? 'Joined' : group.isPrivate ? 'Request' : 'Join'

  return (
    <article
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        cursor: 'pointer',
        transition: 'border-color 150ms',
      }}
      // Mouse convenience only. The name below is the real, keyboard-reachable
      // link — making the whole card a button would nest the share menu, the mute
      // switch and the CTA inside it, which is invalid and unusable with a
      // screen reader.
      onClick={() => navigate(`/groups/${group.id}`)}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-default)')}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span
          aria-hidden
          style={{
            width: 44,
            height: 44,
            borderRadius: 'var(--r-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            background: look.bg,
            color: look.fg,
          }}
        >
          <Glyph size={20} strokeWidth={1.5} />
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <Link
              to={`/groups/${group.id}`}
              onClick={(e) => e.stopPropagation()}
              style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', textDecoration: 'none' }}
            >
              {group.name}
            </Link>
            {group.isPrivate && (
              <span
                title="Request to join"
                aria-label="Private group — request to join"
                style={{ color: 'var(--text-tertiary)', lineHeight: 0 }}
              >
                <Lock size={13} strokeWidth={1.5} />
              </span>
            )}
            <OfficialBadge isSystem={group.isSystem} />
            <AllowedRoleBadge allowedRole={group.allowedRole} />
          </div>
          <p style={{ margin: '3px 0 0', fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>
            {look.label} · {memberLabel(group.memberCount)}
          </p>
        </div>

        {/* Share lives up here, not in the footer: the footer already carries the
            avatar stack, the social proof, the mute switch and the CTA, and a fifth
            control there squeezes the proof line down to an ellipsis. */}
        <span style={{ flexShrink: 0, marginTop: -2 }} onClick={(e) => e.stopPropagation()}>
          <ShareMenu entityType="group" entityId={group.id} title={group.name} />
        </span>
      </div>

      {group.description && (
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 400,
            lineHeight: 1.5,
            color: 'var(--text-secondary)',
            textWrap: 'pretty',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {group.description}
        </p>
      )}

      {/* Cards sit in an auto-fill grid that can get down to ~280px, so the footer
          wraps rather than shrinking the proof line into an ellipsis. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          rowGap: 8,
          flexWrap: 'wrap',
          paddingTop: 12,
          marginTop: 'auto',
          borderTop: '0.5px solid var(--border-default)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <FaceStack group={group} />
        <span
          style={{
            fontSize: 12,
            fontWeight: 400,
            color: 'var(--text-tertiary)',
            flex: '1 1 auto',
            minWidth: 96,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {socialProof}
        </span>

        {/* The switch and the CTA travel together: wrapping them apart leaves the
            button alone on a second line while the toggle stays up beside the proof. */}
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexShrink: 0 }}>
        {group.isMember && (
          <button
            type="button"
            role="switch"
            aria-checked={!muted}
            aria-label={muted ? 'Notifications muted' : 'Notifications on'}
            title={muted ? 'Notifications muted' : 'Notifications on'}
            disabled={muteMutation.isPending}
            onClick={() => muteMutation.mutate(!muted)}
            style={{
              // The switch reads as 30x17, but a target that small is unreliable with a
              // mouse and below the touch-target minimum — so the button is a padded
              // 44x28 hit area and the track is drawn inside it.
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 28,
              padding: 0,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              flexShrink: 0,
              opacity: muteMutation.isPending ? 0.6 : 1,
            }}
          >
            <span
              aria-hidden
              style={{
                position: 'relative',
                display: 'block',
                width: 30,
                height: 17,
                borderRadius: 'var(--r-pill)',
                border: `0.5px solid ${muted ? 'var(--border-hover)' : 'var(--uc-indigo)'}`,
                background: muted ? 'var(--surface-raised)' : 'var(--uc-indigo)',
                transition: 'background 150ms, border-color 150ms',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: 2,
                  left: muted ? 2 : 15,
                  width: 11,
                  height: 11,
                  borderRadius: '50%',
                  background: 'var(--on-accent)',
                  transition: 'left 150ms',
                }}
              />
            </span>
          </button>
        )}

        {/* A system group has no join or leave — membership tracks your role. The
            header's Official badge already says so, so the slot stays empty. */}
        {!group.isSystem && (
          <button
            type="button"
            onClick={() => toggleMutation.mutate()}
            disabled={toggleMutation.isPending}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 500,
              fontFamily: 'inherit',
              borderRadius: 'var(--r-pill)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              opacity: toggleMutation.isPending ? 0.6 : 1,
              // Joined is your own state, so it reads in orange; joining is an action on
              // someone else's group, so the affordance stays indigo.
              background: group.isMember ? 'var(--uc-orange-bg)' : 'var(--uc-indigo)',
              color: group.isMember ? 'var(--uc-orange-l)' : 'var(--on-indigo)',
              border: `0.5px solid ${group.isMember ? 'var(--uc-orange-bdr)' : 'var(--uc-indigo)'}`,
            }}
          >
            {ctaLabel}
          </button>
        )}
        </span>
      </div>
    </article>
  )
}
