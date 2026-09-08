import { Flame } from 'lucide-react'
import { weekDots, type DayState } from '../weekDots'
import type { LearningStats } from '../types'

const DOT_STYLE: Record<DayState, React.CSSProperties> = {
  done: {
    background: 'var(--uc-orange-bg)',
    border: '0.5px solid var(--uc-orange-bdr)',
    color: 'var(--uc-orange-l)',
  },
  today: {
    background: 'transparent',
    border: '1.5px dashed var(--uc-orange)',
    color: 'var(--uc-orange-l)',
  },
  empty: {
    background: 'transparent',
    border: '0.5px solid var(--border-default)',
    color: 'var(--text-tertiary)',
  },
}

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`
}

const STATE_LABEL: Record<DayState, string> = {
  done: 'complete',
  today: 'today, not yet claimed',
  empty: 'no activity',
}

export function StreakBanner({ stats }: { stats: LearningStats }) {
  const { currentStreak, longestStreak, freezesRemaining } = stats
  const hasStreak = currentStreak > 0
  const dots = weekDots(stats)
  const claimedToday = dots.every((d) => d.state !== 'today')

  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <Flame
        size={24}
        color={hasStreak ? 'var(--uc-orange)' : 'var(--text-tertiary)'}
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
          {hasStreak ? `${currentStreak}-day streak` : 'Start your streak today'}
        </p>
        <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
          {dots.map((dot) => (
            <span
              key={dot.key}
              title={`${dot.key} · ${STATE_LABEL[dot.state]}`}
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 500,
                flexShrink: 0,
                ...DOT_STYLE[dot.state],
              }}
            >
              {dot.label}
            </span>
          ))}
        </div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)' }}>
          {claimedToday ? 'Today is claimed' : 'Today is unclaimed'}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>
          {`Longest ${plural(longestStreak, 'day')} · ${plural(freezesRemaining, 'freeze')} left`}
        </p>
      </div>
    </div>
  )
}
