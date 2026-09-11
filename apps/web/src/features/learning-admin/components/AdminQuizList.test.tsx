import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AdminQuiz } from '@uniconnect/shared'
import { AdminQuizList } from './AdminQuizList'

const quiz = (over: Partial<AdminQuiz>): AdminQuiz => ({
  id: 'q1',
  kind: 'path_unit',
  title: 'Sorting and complexity checkpoint',
  pathId: 'p1',
  pathTitle: 'Algorithms, properly',
  questionCount: 12,
  passMark: 60,
  attempts: 186,
  avgScore: 74,
  status: 'published',
  source: 'ai',
  updatedAt: new Date().toISOString(),
  ...over,
})

const noop = () => {}

describe('AdminQuizList', () => {
  it('labels a live row Results / Manage and a draft row Preview / Continue draft', async () => {
    const onSecondary = vi.fn()
    const onPrimary = vi.fn()
    render(
      <AdminQuizList
        quizzes={[quiz({}), quiz({ id: 'q2', title: 'Gradient descent basics', pathTitle: 'Applied machine learning', status: 'draft', attempts: 0, avgScore: null })]}
        isLoading={false}
        onGenerateWithAi={noop}
        onNewQuiz={noop}
        onSecondary={onSecondary}
        onPrimary={onPrimary}
      />,
    )
    expect(screen.getByText('Algorithms, properly · 12 questions · pass 60%')).toBeInTheDocument()
    expect(screen.getByText('186 attempts')).toBeInTheDocument()
    expect(screen.getByText('Avg score 74%')).toBeInTheDocument()
    expect(screen.getByText('Not live yet')).toBeInTheDocument()
    expect(screen.getByText('AI draft, edited')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Results' }))
    expect(onSecondary).toHaveBeenCalledWith(expect.objectContaining({ id: 'q1' }))
    await userEvent.click(screen.getByRole('button', { name: 'Continue draft' }))
    expect(onPrimary).toHaveBeenCalledWith(expect.objectContaining({ id: 'q2' }))
  })

  it('filters by status with counts in the chips', async () => {
    render(
      <AdminQuizList
        quizzes={[quiz({}), quiz({ id: 'q2', title: 'Needs a look', status: 'needs_review', kind: 'ai_batch', pathId: null })]}
        isLoading={false}
        onGenerateWithAi={noop}
        onNewQuiz={noop}
        onSecondary={noop}
        onPrimary={noop}
      />,
    )
    expect(screen.getByRole('button', { name: 'All 2' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Needs review 1' }))
    expect(screen.getByText('Needs a look')).toBeInTheDocument()
    expect(screen.queryByText('Sorting and complexity checkpoint')).not.toBeInTheDocument()
  })
})
