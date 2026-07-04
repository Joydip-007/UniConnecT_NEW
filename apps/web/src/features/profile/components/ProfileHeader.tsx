import { BadgeCheck, Briefcase, MapPin } from 'lucide-react'
import type { PublicUserProfile } from '@uniconnect/shared'
import { Avatar } from '@/components/Avatar'
import { Badge } from '@/components/Badge'
import { RoleBadge } from '@/components/RoleBadge'
import { GhostBtn } from '@/components/Button'
import { ShareMenu } from '@/components/ShareMenu'
import { ConnectButton } from '@/features/connections'
import { UserActionsMenu } from '@/features/moderation'
import { PresenceLabel, usePresence } from '@/features/presence'
import { ShowcasedBadge } from '@/features/learning'
import { avatarColor as seedColor, getInitials } from '@/utils/avatar'

interface Props {
  user: PublicUserProfile
  isOwnProfile: boolean
  onEdit: () => void
}

export function ProfileHeader({
  user,
  isOwnProfile,
  onEdit,
}: Props) {
  const fullName = user.profile.fullName
  usePresence(isOwnProfile ? [] : [user.id])
  const avatarColor = seedColor(user.id)
  const showOpenToWork = user.profile.isOpenToWork && (user.role === 'student' || user.role === 'alumni')

  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: 180,
          position: 'relative',
          background: user.profile.coverUrl
            ? `center / cover no-repeat url(${user.profile.coverUrl})`
            : 'linear-gradient(135deg, var(--uc-indigo-bg) 0%, var(--overlay-bg-soft) 100%)',
          overflow: 'hidden',
        }}
      >
        {!user.profile.coverUrl && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage:
                'radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)',
              backgroundSize: '14px 14px',
            }}
          />
        )}
      </div>

      <div style={{ position: 'relative', padding: '0 20px 20px' }}>
        <div
          style={{
            position: 'absolute',
            top: -48,
            left: 20,
            borderRadius: '50%',
            border: '3px solid var(--surface-card)',
            lineHeight: 0,
          }}
        >
          <Avatar src={user.profile.avatarUrl} initials={getInitials(fullName)} color={avatarColor} size={96} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, paddingTop: 10 }}>
          <ShareMenu entityType="profile" entityId={user.username} title={fullName} />
          {isOwnProfile ? (
            <GhostBtn onClick={onEdit}>Edit profile</GhostBtn>
          ) : (
            <>
              <ConnectButton
                targetUserId={user.id}
                targetName={fullName}
                connectionStatus={user.connectionStatus}
                connectionId={user.connectionId}
                size="md"
              />
              <UserActionsMenu userId={user.id} userName={fullName} isMuted={user.isMutedByViewer ?? false} />
            </>
          )}
        </div>

        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <RoleBadge role={user.role} size={16} />
            <span style={{ fontSize: 17, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.3 }}>
              {fullName}
            </span>
            {user.isVerified && (
              <span
                aria-label="Verified"
                title="Verified"
                style={{ display: 'inline-flex', color: 'var(--uc-cyan)', lineHeight: 0 }}
              >
                <BadgeCheck size={14} strokeWidth={1.75} />
              </span>
            )}
            <ShowcasedBadge userId={user.id} />
            {user.profile.department && (
              <Badge variant="neutral">
                {user.profile.department}
                {user.profile.batchYear && ` '${user.profile.batchYear.slice(-2)}`}
              </Badge>
            )}
            {showOpenToWork && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px',
                  borderRadius: 'var(--r-pill)',
                  background: 'var(--uc-orange-bg)',
                  border: '0.5px solid var(--uc-orange-bdr)',
                  fontSize: 11,
                  fontWeight: 400,
                  color: 'var(--uc-orange-l)',
                }}
              >
                <Briefcase size={10} strokeWidth={1.75} />
                Open to work
              </span>
            )}
          </div>

          <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-tertiary)' }}>
            @{user.username}
          </span>

          {user.profile.headline && (
            <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {user.profile.headline}
            </p>
          )}

          {!isOwnProfile && <PresenceLabel userId={user.id} />}

          {user.profile.location && (
            <p
              style={{
                margin: 0,
                fontSize: 12,
                fontWeight: 400,
                color: 'var(--text-tertiary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <MapPin size={11} strokeWidth={1.5} />
              {user.profile.location}
            </p>
          )}

          {user.mutualConnections > 0 && (
            <p style={{ margin: 0, fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>
              {user.mutualConnections} mutual connection{user.mutualConnections !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            gap: 0,
            marginTop: 16,
            borderTop: '0.5px solid var(--border-default)',
            paddingTop: 14,
          }}
        >
          {(
            [
              { label: 'connections', value: user.stats.connections },
              { label: 'posts', value: user.stats.posts },
            ] as const
          ).map(({ label, value }, idx) => (
            <div
              key={label}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                borderLeft: idx > 0 ? '0.5px solid var(--border-default)' : 'none',
                padding: '4px 0',
              }}
            >
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {value.toLocaleString()}
              </span>
              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
