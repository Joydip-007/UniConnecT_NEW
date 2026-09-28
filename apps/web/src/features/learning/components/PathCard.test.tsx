import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PathCard } from './PathCard'
import type { LearningPath } from '../types'

const base: LearningPath = {
  id: 'p1',
  title: 'Algorithms, properly',
  description: 'Sorting, greedy proofs and dynamic programming.',
  category: 'technical',
  difficulty: 'intermediate',
  estimated_days: 24,
  badge_name: 'Algorithmist',
  badge_icon: null,
  unitCount: 8,
  enrolledCount: 3,
  myEnrollmentStatus: 'active',
  completedUnitCount: 5,
  nextUnitTitle: 'Greedy proofs',
}

describe('PathCard', () => {
  it('shows progress, the resume point and what is left today for an active path', () => {
    render(<PathCard path={base} onOpen={vi.fn()} todayLeft={1} />)
    expect(screen.getByText('In progress')).toBeInTheDocument()
    expect(screen.getByText('5 of 8 units · next: Greedy proofs')).toBeInTheDocument()
    expect(screen.getByText('1 left today')).toBeInTheDocument()
    expect(screen.getByText('8 units · ~24 days · intermediate')).toBeInTheDocument()
    expect(screen.getByText('Algorithmist')).toBeInTheDocument()
  })

  it.each([
    [null, 'Not started'],
    ['completed', 'Completed'],
    ['abandoned', 'Dropped'],
  ] as const)('labels a %s enrollment as %s, without a progress bar', (status, label) => {
    render(<PathCard path={{ ...base, myEnrollmentStatus: status }} onOpen={vi.fn()} todayLeft={1} />)
    expect(screen.getByText(label)).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.queryByText('1 left today')).not.toBeInTheDocument()
  })

  it('drops the description and badge line in the compact phone layout', () => {
    render(<PathCard path={base} onOpen={vi.fn()} compact />)
    expect(screen.queryByText(base.description as string)).not.toBeInTheDocument()
    expect(screen.queryByText('Algorithmist')).not.toBeInTheDocument()
  })

  it('opens the path on click', async () => {
    const onOpen = vi.fn()
    render(<PathCard path={base} onOpen={onOpen} />)
    await userEvent.setup().click(screen.getByRole('button'))
    expect(onOpen).toHaveBeenCalledWith('p1')
  })
})
