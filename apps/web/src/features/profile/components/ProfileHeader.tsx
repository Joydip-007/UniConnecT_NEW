import { BadgeCheck, Briefcase } from 'lucide-react'
import type { PublicUserProfile, UserRole } from '@uniconnect/shared'
import { Avatar } from '@/components/Avatar'
import { Badge } from '@/components/Badge'
import { GhostBtn, PrimaryBtn } from '@/components/Button'
import type { FollowMode } from './FollowModal'
import { avatarColor as seedColor, getInitials } from '@/utils/avatar'

interface Props {
  user: PublicUserProfile
  isOwnProfile: boolean
  followPending: boolean
  onFollowToggle: () => void
  onEdit: () => void
  onOpenFollowers: (mode: FollowMode) => void
}


function roleBadgeVariant(role: UserRole): 'dept' | 'alumni' | 'neutral' {
  if (role === 'student') return 'dept'
  if (role === 'alumni') return 'alumni'
  return 'neutral'
}

function roleLabel(role: UserRole): string {
  if (role === 'faculty') return 'Faculty'
  if (role === 'admin') return 'Admin'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

export function ProfileHeader({
  user,
  isOwnProfile,
  followPending,
  onFollowToggle,
  onEdit,
  onOpenFollowers,
}: Props) {
  const fullName = user.profile.fullName
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
          height: 150,
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
            top: -30,
            left: 20,
            borderRadius: '50%',
            border: '3px solid var(--surface-card)',
            lineHeight: 0,
          }}
        >
          {user.profile.avatarUrl ? (
            <img
              src={user.profile.avatarUrl}
              alt={fullName}
              style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <Avatar initials={getInitials(fullName)} color={avatarColor} size={60} />
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 10 }}>
          {isOwnProfile ? (
            <GhostBtn onClick={onEdit}>Edit profile</GhostBtn>
          ) : (
            <PrimaryBtn
              onClick={onFollowToggle}
              disabled={followPending}
              style={
                user.isFollowing
                  ? {
                      background: 'transparent',
                      border: '0.5px solid var(--border-hover)',
                      color: 'var(--text-secondary)',
                    }
                  : undefined
              }
            >
              {user.isFollowing ? 'Following' : 'Follow'}
            </PrimaryBtn>
          )}
        </div>

        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
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
            <Badge variant={roleBadgeVariant(user.role)}>{roleLabel(user.role)}</Badge>
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

          {user.profile.headline && (
            <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {user.profile.headline}
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
              { label: 'following', value: user.stats.following, mode: 'following' as FollowMode },
              { label: 'followers', value: user.stats.followers, mode: 'followers' as FollowMode },
              { label: 'posts', value: user.stats.posts, mode: null },
            ] as const
          ).map(({ label, value, mode }, idx) => (
            <button
              key={label}
              type="button"
              onClick={mode ? () => onOpenFollowers(mode) : undefined}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                borderLeft: idx > 0 ? '0.5px solid var(--border-default)' : 'none',
                background: 'none',
                border: 'none',
                cursor: mode ? 'pointer' : 'default',
                padding: '4px 0',
                borderRadius: 'var(--r-sm)',
                transition: 'background 150ms',
              }}
              onMouseEnter={(e) => {
                if (mode) e.currentTarget.style.background = 'var(--surface-hover)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
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
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
