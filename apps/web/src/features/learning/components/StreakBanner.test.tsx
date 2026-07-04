import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StreakBanner } from './StreakBanner'
import type { LearningStats } from '../types'

const baseStats: LearningStats = {
  currentStreak: 3,
  longestStreak: 7,
  lastActivityDate: '2026-07-03',
  freezesRemaining: 2,
}

describe('StreakBanner', () => {
  it('renders the current streak count', () => {
    render(<StreakBanner stats={baseStats} />)
    expect(screen.getByText('3-day streak')).toBeInTheDocument()
  })

  it('renders longest streak and freezes remaining', () => {
    render(<StreakBanner stats={baseStats} />)
    expect(screen.getByText('Longest: 7 days · 2 freezes left this month')).toBeInTheDocument()
  })

  it('shows the zero-state message when currentStreak is 0', () => {
    render(<StreakBanner stats={{ ...baseStats, currentStreak: 0 }} />)
    expect(screen.getByText('Start your streak — complete one unit today')).toBeInTheDocument()
  })
})
