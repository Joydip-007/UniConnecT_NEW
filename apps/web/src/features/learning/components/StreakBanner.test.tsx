import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StreakBanner } from './StreakBanner'
import { weekDots } from '../weekDots'
import type { LearningStats } from '../types'

const baseStats: LearningStats = {
  currentStreak: 3,
  longestStreak: 7,
  lastActivityDate: '2026-07-03',
  freezesRemaining: 2,
}

// 2026-07-03 is a Friday, so the week runs Sun 06-28 … Sat 07-04.
const FRIDAY = new Date(2026, 6, 3, 10, 0, 0)

describe('weekDots', () => {
  it('fills the days covered by the streak and leaves the rest empty', () => {
    const dots = weekDots(baseStats, FRIDAY)
    expect(dots.map((d) => d.state)).toEqual([
      'empty', // Sun 06-28
      'empty', // Mon 06-29
      'empty', // Tue 06-30
      'done', // Wed 07-01
      'done', // Thu 07-02
      'done', // Fri 07-03 — today, already claimed
      'empty', // Sat 07-04
    ])
  })

  it('marks today as the dashed target when the streak stopped yesterday', () => {
    const dots = weekDots({ ...baseStats, lastActivityDate: '2026-07-02', currentStreak: 2 }, FRIDAY)
    expect(dots[5].state).toBe('today')
    expect(dots[4].state).toBe('done')
  })

  it('marks today as the target when there is no streak at all', () => {
    const dots = weekDots({ ...baseStats, lastActivityDate: null, currentStreak: 0 }, FRIDAY)
    expect(dots.filter((d) => d.state === 'done')).toHaveLength(0)
    expect(dots[5].state).toBe('today')
  })

  it('reads lastActivityDate in local time, not UTC', () => {
    // `new Date('2026-07-03')` is midnight UTC, which is 2 July anywhere west of Greenwich —
    // that would shift the whole row by a day.
    const dots = weekDots({ ...baseStats, currentStreak: 1 }, FRIDAY)
    expect(dots[5].state).toBe('done')
    expect(dots[4].state).toBe('empty')
  })
})

describe('StreakBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FRIDAY)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the current streak count', () => {
    render(<StreakBanner stats={baseStats} />)
    expect(screen.getByText('3-day streak')).toBeInTheDocument()
  })

  it('renders longest streak and freezes remaining', () => {
    render(<StreakBanner stats={baseStats} />)
    expect(screen.getByText('Longest 7 days · 2 freezes left')).toBeInTheDocument()
  })

  it('does not say "1 days" or "1 freezes"', () => {
    render(<StreakBanner stats={{ ...baseStats, longestStreak: 1, freezesRemaining: 1 }} />)
    expect(screen.getByText('Longest 1 day · 1 freeze left')).toBeInTheDocument()
  })

  it('renders the seven day dots of the current week', () => {
    render(<StreakBanner stats={baseStats} />)
    expect(screen.getAllByTitle(/complete|no activity|not yet claimed/)).toHaveLength(7)
  })

  it('says today is claimed once the streak reaches today', () => {
    render(<StreakBanner stats={baseStats} />)
    expect(screen.getByText('Today is claimed')).toBeInTheDocument()
  })

  it('says today is unclaimed when the streak stopped yesterday', () => {
    render(<StreakBanner stats={{ ...baseStats, lastActivityDate: '2026-07-02', currentStreak: 2 }} />)
    expect(screen.getByText('Today is unclaimed')).toBeInTheDocument()
  })

  it('shows the zero-state message when currentStreak is 0', () => {
    render(<StreakBanner stats={{ ...baseStats, currentStreak: 0 }} />)
    expect(screen.getByText('Start your streak today')).toBeInTheDocument()
  })
})
