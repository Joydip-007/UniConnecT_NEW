import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LearningPathBuilder } from './LearningPathBuilder'

const { createAsync, publishAsync } = vi.hoisted(() => ({
  createAsync: vi.fn(),
  publishAsync: vi.fn(),
}))

vi.mock('../hooks/useLearningAdmin', () => ({
  useCreateLearningPath: () => ({ mutateAsync: createAsync, isPending: false }),
  useSetPathPublished: () => ({ mutateAsync: publishAsync, isPending: false }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  createAsync.mockResolvedValue({ id: 'new-path' })
  publishAsync.mockResolvedValue({})
})

describe('LearningPathBuilder', () => {
  it('adds a default unit, counts minutes, and publishes with the design’s field mapping', async () => {
    const user = userEvent.setup()
    const onExit = vi.fn()
    render(<LearningPathBuilder seed={null} onExit={onExit} onDraftWithAi={() => {}} />)

    // Nothing to save yet: no title, no units.
    expect(screen.getByRole('button', { name: /publish path/i })).toBeDisabled()

    await user.type(screen.getByLabelText('Path title'), 'Algorithms, properly')
    await user.click(screen.getByRole('button', { name: /add unit/i }))
    expect(screen.getByText('1 units · 10 min total')).toBeInTheDocument()
    expect(screen.getByText('Reading · 10 min')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Career' }))
    await user.click(screen.getByRole('button', { name: 'EEE' }))
    await user.click(screen.getByRole('button', { name: /publish path/i }))

    expect(createAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Algorithms, properly',
        category: 'career',
        department: 'EEE',
        difficulty: 'beginner',
        units: [expect.objectContaining({ title: 'Untitled unit', type: 'read', content: { body: '', estimatedMinutes: 10 } })],
      }),
    )
    expect(publishAsync).toHaveBeenCalledWith({ pathId: 'new-path', isPublished: true })
    expect(onExit).toHaveBeenCalled()
  })

  it('pre-fills from an AI seed and shows the review note', async () => {
    const user = userEvent.setup()
    render(
      <LearningPathBuilder
        seed={{
          department: 'CSE',
          draft: {
            title: 'Drafted path',
            description: 'From AI',
            difficulty: 'advanced',
            units: [
              { title: 'Orientation', type: 'read', content: { body: '' }, estimatedMinutes: 8 },
              { title: 'Checkpoint', type: 'quiz', content: { questions: [] }, estimatedMinutes: 10, completionRule: { passScore: 60 } },
            ],
          },
        }}
        onExit={() => {}}
        onDraftWithAi={() => {}}
      />,
    )
    expect(screen.getByText('AI drafted 2 units below. Review each one before publishing.')).toBeInTheDocument()
    expect(screen.getByLabelText('Path title')).toHaveValue('Drafted path')
    expect(screen.getByText('2 units · 18 min total')).toBeInTheDocument()
    expect(screen.getByText('Quiz · 10 min')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remove unit 2' }))
    expect(screen.getByText('1 units · 8 min total')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /save draft/i }))
    expect(createAsync).toHaveBeenCalledWith(expect.objectContaining({ department: 'CSE', difficulty: 'advanced' }))
    expect(publishAsync).not.toHaveBeenCalled()
  })
})
