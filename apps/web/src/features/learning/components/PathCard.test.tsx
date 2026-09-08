import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PathCard } from './PathCard'
import type { LearningPath } from '../types'

const basePath: LearningPath = {
  id: 'path-1',
  title: 'Git basics',
  description: 'Learn version control',
  category: 'engineering',
  difficulty: 'beginner',
  estimated_days: 5,
  badge_name: 'Git novice',
  badge_icon: 'git',
  unitCount: 3,
  enrolledCount: 12,
  myEnrollmentStatus: null,
  completedUnitCount: 0,
  nextUnitTitle: null,
}

describe('PathCard', () => {
  it('renders title, description, meta row, and badge hint', () => {
    render(<PathCard path={basePath} onOpen={vi.fn()} />)

    expect(screen.getByText('Git basics')).toBeInTheDocument()
    expect(screen.getByText('Learn version control')).toBeInTheDocument()
    expect(screen.getByText('3 units · ~5 days · beginner')).toBeInTheDocument()
    expect(screen.getByText('Git novice')).toBeInTheDocument()
  })

  it('fires onOpen with the path id when clicked', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    render(<PathCard path={basePath} onOpen={onOpen} />)

    await user.click(screen.getByRole('button'))

    expect(onOpen).toHaveBeenCalledWith('path-1')
  })

  it('shows an "In progress" chip when actively enrolled', () => {
    render(<PathCard path={{ ...basePath, myEnrollmentStatus: 'active' }} onOpen={vi.fn()} />)
    expect(screen.getByText('In progress')).toBeInTheDocument()
  })

  it('shows progress and the resume point while actively enrolled', () => {
    render(
      <PathCard
        path={{ ...basePath, myEnrollmentStatus: 'active', completedUnitCount: 1, nextUnitTitle: 'Branching' }}
        onOpen={vi.fn()}
      />,
    )
    expect(screen.getByText('1 of 3 units · next: Branching')).toBeInTheDocument()
  })

  it('drops the "next" clause when an enrolled path has no unit left', () => {
    render(
      <PathCard
        path={{ ...basePath, myEnrollmentStatus: 'active', completedUnitCount: 3, nextUnitTitle: null }}
        onOpen={vi.fn()}
      />,
    )
    expect(screen.getByText('3 of 3 units')).toBeInTheDocument()
  })

  it('shows no progress bar when the path is not started', () => {
    render(<PathCard path={basePath} onOpen={vi.fn()} />)
    expect(screen.queryByText(/of 3 units/)).not.toBeInTheDocument()
  })

  it('shows a "Completed" chip when the path is completed', () => {
    render(<PathCard path={{ ...basePath, myEnrollmentStatus: 'completed' }} onOpen={vi.fn()} />)
    expect(screen.getByText('Completed')).toBeInTheDocument()
  })
})
