import { ChevronRight, Flame } from 'lucide-react'
import { weekDots, type DayState } from '../weekDots'
import { BADGE_CATEGORY_META, type BadgeCard } from '../badgeLadders'
import type { LearningStats } from '../types'
import { plural } from '../learnFormat'

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

const STATE_LABEL: Record<DayState, string> = {
  done: 'complete',
  today: 'today, not yet claimed',
  empty: 'no activity',
}

const STACK_MAX = 4

interface StreakBannerProps {
  stats: LearningStats
  /** `rail` is the right-rail card; `compact` is the phone card in the centre column. */
  variant?: 'rail' | 'compact'
  /** Earned badges, pinned first. `null` hides the badges row (it is student-only). */
  earned?: BadgeCard[] | null
  onOpenBadges?: (focus?: BadgeCard) => void
}

export function StreakBanner({ stats, variant = 'rail', earned = null, onOpenBadges }: StreakBannerProps) {
  const { currentStreak, longestStreak, freezesRemaining } = stats
  const hasStreak = currentStreak > 0
  const dots = weekDots(stats)
  const claimedToday = dots.every((d) => d.state !== 'today')
  const compact = variant === 'compact'
  const dotSize = compact ? 21 : 26
  const stackSize = compact ? 32 : 26

  const dotRow = (
    <div style={{ display: 'flex', gap: compact ? 4 : 0, justifyContent: compact ? 'flex-start' : 'space-between', marginTop: compact ? 7 : 0 }}>
      {dots.map((dot) => (
        <span
          key={dot.key}
          title={`${dot.key} · ${STATE_LABEL[dot.state]}`}
          style={{
            width: dotSize,
            height: dotSize,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: compact ? 10 : 11,
            fontWeight: 500,
            flexShrink: 0,
            boxSizing: 'border-box',
            ...DOT_STYLE[dot.state],
          }}
        >
          {dot.label}
        </span>
      ))}
    </div>
  )

  const title = hasStreak ? `${currentStreak}-day streak` : 'Start your streak today'

  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: compact ? 14 : 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {compact ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Flame size={22} color={hasStreak ? 'var(--uc-orange)' : 'var(--text-tertiary)'} aria-hidden="true" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{title}</p>
            {dotRow}
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Flame size={18} color={hasStreak ? 'var(--uc-orange)' : 'var(--text-tertiary)'} aria-hidden="true" style={{ flexShrink: 0 }} />
            <p style={{ margin: 0, flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{title}</p>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {claimedToday ? 'Today is claimed' : 'Today is unclaimed'}
            </span>
          </div>
          {dotRow}
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>
            {`Longest ${plural(longestStreak, 'day')} · ${plural(freezesRemaining, 'freeze')} left`}
          </p>
        </>
      )}

      {earned && onOpenBadges && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            paddingTop: 10,
            borderTop: '0.5px solid var(--border-default)',
            minHeight: compact ? 44 : undefined,
          }}
        >
          <div style={{ display: 'flex', paddingLeft: 8, flexShrink: 0 }}>
            {earned.slice(0, STACK_MAX).map((card) => {
              const { icon: Icon, tone } = BADGE_CATEGORY_META[card.category]
              return (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => onOpenBadges(card)}
                  title={card.name}
                  aria-label={card.name}
                  className="badge-stack-item"
                  style={{
                    width: stackSize,
                    height: stackSize,
                    marginLeft: -8,
                    padding: 0,
                    flexShrink: 0,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: `var(--uc-${tone})`,
                    color: 'var(--on-accent)',
                    border: '2px solid var(--surface-card)',
                    cursor: 'pointer',
                  }}
                >
                  <Icon size={compact ? 18 : 13} strokeWidth={2.5} aria-hidden="true" />
                </button>
              )
            })}
            {earned.length > STACK_MAX && (
              <button
                type="button"
                onClick={() => onOpenBadges()}
                aria-label="View all badges"
                style={{
                  width: stackSize,
                  height: stackSize,
                  marginLeft: -8,
                  padding: 0,
                  flexShrink: 0,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--surface-raised)',
                  color: 'var(--text-secondary)',
                  border: '2px solid var(--surface-card)',
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                +{earned.length - STACK_MAX}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => onOpenBadges()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 2,
              minWidth: 0,
              minHeight: 32,
              padding: compact ? '0 4px 0 8px' : 0,
              background: 'transparent',
              border: 'none',
              borderRadius: 'var(--r-pill)',
              fontSize: 12,
              fontWeight: 500,
              whiteSpace: 'nowrap',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            {plural(earned.length, 'badge')} earned
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}
