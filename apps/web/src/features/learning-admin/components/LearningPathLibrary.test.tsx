import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AdminLearningPath } from '@uniconnect/shared'
import { LearningPathLibrary } from './LearningPathLibrary'

const path = (over: Partial<AdminLearningPath>): AdminLearningPath => ({
  id: 'p1',
  title: 'Algorithms, properly',
  description: null,
  department: 'CSE',
  category: 'technical',
  difficulty: 'intermediate',
  estimatedDays: 7,
  isPublished: true,
  source: 'manual',
  unitCount: 11,
  enrolledCount: 214,
  completedCount: 100,
  completionRate: 0.46,
  updatedAt: new Date().toISOString(),
  ...over,
})

const noop = () => {}

describe('LearningPathLibrary', () => {
  it('renders the design card and calls Edit / Manage', async () => {
    const onManagePath = vi.fn()
    const onEditPath = vi.fn()
    render(
      <LearningPathLibrary
        paths={[path({})]}
        isLoading={false}
        onCreatePath={noop}
        onDraftWithAi={noop}
        onEditPath={onEditPath}
        onManagePath={onManagePath}
      />,
    )

    expect(screen.getByText('Algorithms, properly')).toBeInTheDocument()
    expect(screen.getByText('CSE · 11 units · Intermediate')).toBeInTheDocument()
    expect(screen.getByText('214 enrolled')).toBeInTheDocument()
    expect(screen.getByText('46% avg completion')).toBeInTheDocument()
    expect(screen.getByText('Published')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /manage/i }))
    expect(onManagePath).toHaveBeenCalledWith('p1')

    await userEvent.click(screen.getByRole('button', { name: /^edit$/i }))
    expect(onEditPath).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }))
  })

  it('filters by status and by category, with counts in the chip labels', async () => {
    render(
      <LearningPathLibrary
        paths={[
          path({ id: 'p1', title: 'Published path' }),
          path({ id: 'p2', title: 'Draft path', isPublished: false, category: 'career' }),
        ]}
        isLoading={false}
        onCreatePath={noop}
        onDraftWithAi={noop}
        onEditPath={noop}
        onManagePath={noop}
      />,
    )
    expect(screen.getByRole('button', { name: 'All 2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Published 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Drafts 1' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Drafts 1' }))
    expect(screen.getByText('Draft path')).toBeInTheDocument()
    expect(screen.queryByText('Published path')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Technical 1' }))
    expect(screen.getByText('Published path')).toBeInTheDocument()
    expect(screen.queryByText('Draft path')).not.toBeInTheDocument()
  })

  it('exposes both create actions', async () => {
    const onCreatePath = vi.fn()
    const onDraftWithAi = vi.fn()
    render(
      <LearningPathLibrary paths={[]} isLoading={false} onCreatePath={onCreatePath} onDraftWithAi={onDraftWithAi} onEditPath={noop} onManagePath={noop} />,
    )
    await userEvent.click(screen.getByRole('button', { name: /new learning path/i }))
    expect(onCreatePath).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: /draft with ai/i }))
    expect(onDraftWithAi).toHaveBeenCalled()
  })
})
