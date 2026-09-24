import { RoleBadge } from '@/components/RoleBadge'
import { useTodayLeaderboard } from '../hooks/useQuiz'

interface Props { currentUserId?: string }

export function LeaderboardPanel({ currentUserId }: Props) {
  const { data: entries, isLoading } = useTodayLeaderboard()

  if (isLoading) {
    return (
      <div style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: 16,
        height: 120,
      }} />
    )
  }

  if (!entries || entries.length === 0) return null

  return (
    <section style={{
      background: 'var(--surface-card)',
      border: '0.5px solid var(--border-default)',
      borderRadius: 'var(--r-lg)',
      overflow: 'hidden',
    }}>
      <p style={{
        margin: 0,
        padding: '12px 14px',
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--text-primary)',
        borderBottom: '0.5px solid var(--border-default)',
      }}>
        Today's leaderboard
      </p>

      {entries.map((entry) => {
        const isMe = entry.userId === currentUserId
        return (
          <div
            key={entry.userId}
            style={{
              display: 'grid',
              gridTemplateColumns: '28px 1fr auto',
              gap: 10,
              alignItems: 'center',
              padding: '10px 14px',
              background: isMe ? 'var(--surface-raised)' : 'transparent',
              borderTop: '0.5px solid var(--border-default)',
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
              {entry.rank}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              {entry.role && <RoleBadge role={entry.role} size={13} tipPlacement="below" />}
              <span style={{
                fontSize: 13,
                color: isMe ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: isMe ? 500 : 400,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0,
              }}>
                {entry.fullName}
              </span>
            </span>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
              {entry.score}%
            </span>
          </div>
        )
      })}
    </section>
  )
}
