import { Award } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { useUserBadges, useShowcaseBadge, type UserBadge } from '@/features/learning'

interface Props {
  userId: string
  isOwnProfile: boolean
}

const RARITY_LABEL: Record<UserBadge['rarity'], string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
}

const RARITY_STYLE: Record<UserBadge['rarity'], { bg: string; text: string }> = {
  epic: { bg: 'var(--uc-amber-bg)', text: 'var(--uc-amber-l)' },
  rare: { bg: 'var(--uc-indigo-bg)', text: 'var(--uc-indigo-l)' },
  common: { bg: 'var(--surface-raised)', text: 'var(--text-secondary)' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function BadgesPanel({ userId, isOwnProfile }: Props) {
  const { data: badges } = useUserBadges(userId)
  const showcase = useShowcaseBadge()

  if (badges && badges.length === 0) {
    return (
      <EmptyState
        icon={Award}
        title="No badges yet"
        description={
          isOwnProfile
            ? 'Earn badges by completing your profile, posting regularly, and connecting with peers.'
            : 'Badges will appear here as this person reaches milestones.'
        }
      />
    )
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 12,
      }}
    >
      {(badges ?? []).map((badge) => {
        const rarityStyle = RARITY_STYLE[badge.rarity]
        return (
          <div
            key={badge.id}
            style={{
              background: 'var(--surface-card)',
              border: '0.5px solid var(--border-default)',
              borderRadius: 'var(--r-lg)',
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: 'var(--r-pill)',
                  background: rarityStyle.bg,
                  fontSize: 16,
                  flexShrink: 0,
                }}
              >
                {badge.iconUrl ?? '\u{1F3C5}'}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                  {badge.name}
                </span>
                <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>
                  {formatDate(badge.awardedAt)}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '2px 8px',
                  borderRadius: 'var(--r-pill)',
                  background: rarityStyle.bg,
                  color: rarityStyle.text,
                  fontSize: 12,
                  fontWeight: 400,
                }}
              >
                {RARITY_LABEL[badge.rarity]}
              </span>

              {isOwnProfile && (
                <button
                  type="button"
                  onClick={() => showcase.mutate(badge.isShowcased ? null : badge.id)}
                  style={{
                    fontFamily: 'inherit',
                    fontSize: 12,
                    fontWeight: 400,
                    padding: '3px 10px',
                    borderRadius: 'var(--r-pill)',
                    border: badge.isShowcased
                      ? '0.5px solid var(--uc-amber-bdr)'
                      : '0.5px solid var(--border-default)',
                    background: badge.isShowcased ? 'var(--uc-amber-bg)' : 'transparent',
                    color: badge.isShowcased ? 'var(--uc-amber-l)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {badge.isShowcased ? 'Showcased ✓' : 'Showcase'}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
