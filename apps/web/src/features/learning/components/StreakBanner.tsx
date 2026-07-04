import { Flame } from 'lucide-react'
import type { LearningStats } from '../types'

export function StreakBanner({ stats }: { stats: LearningStats }) {
  const { currentStreak, longestStreak, freezesRemaining } = stats
  const hasStreak = currentStreak > 0

  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <Flame
        size={24}
        color={hasStreak ? 'var(--uc-orange)' : 'var(--text-tertiary)'}
        aria-hidden="true"
      />
      <div>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
          {hasStreak ? `${currentStreak}-day streak` : 'Start your streak — complete one unit today'}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)' }}>
          {`Longest: ${longestStreak} days · ${freezesRemaining} freezes left this month`}
        </p>
      </div>
    </div>
  )
}
