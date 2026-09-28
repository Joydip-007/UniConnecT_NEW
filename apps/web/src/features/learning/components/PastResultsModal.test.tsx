import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/msw/server'
import { PastResultsModal } from './PastResultsModal'

const review = (picked: number) => [
  { question: 'Which command finds a lost commit?', options: ['git log', 'git reflog'], selectedIndex: picked, correctIndex: 1, isCorrect: picked === 1 },
]

function renderResults(attempts: unknown[]) {
  server.use(
    http.get('*/learning/paths/:pathId', () =>
      HttpResponse.json({
        data: {
          id: 'path-1', title: 'Git', description: null, category: 'x', difficulty: 'beginner', estimated_days: 1, badge_name: null,
          badge_icon: null, unitCount: 1, enrolledCount: 1, enrollment: { status: 'active' },
          units: [{ id: 'u-q', display_order: 1, title: 'Checkpoint', type: 'quiz', completed: false, completion_rule: { passScore: 70 } }],
        },
      })),
    http.get('*/learning/units/:unitId/attempts', () => HttpResponse.json({ data: attempts })),
  )
  const onRetake = vi.fn()
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <PastResultsModal pathId="path-1" unitId="u-q" onClose={vi.fn()} onRetake={onRetake} />
    </QueryClientProvider>,
  )
  return { onRetake }
}

describe('PastResultsModal', () => {
  it('summarises attempts and opens the newest one', async () => {
    renderResults([
      { id: 'a2', createdAt: '2026-09-18T15:12:00Z', score: 100, correctCount: 1, totalQuestions: 1, passed: true, review: review(1) },
      { id: 'a1', createdAt: '2026-09-11T14:40:00Z', score: 0, correctCount: 0, totalQuestions: 1, passed: false, review: review(0) },
    ])
    expect(await screen.findByText('Attempt 2')).toBeInTheDocument()
    expect(screen.getByText('Best score').previousSibling).toHaveTextContent('100%')
    expect(screen.getByText('Below 70%')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Attempt 2/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /Attempt 1/ })).toHaveAttribute('aria-expanded', 'false')
  })

  it('shows the correct answer for a missed question when expanded', async () => {
    renderResults([
      { id: 'a1', createdAt: '2026-09-11T14:40:00Z', score: 0, correctCount: 0, totalQuestions: 1, passed: false, review: review(0) },
    ])
    expect(await screen.findByText('Your answer: git log')).toBeInTheDocument()
    expect(screen.getByText('Correct: git reflog')).toBeInTheDocument()
  })

  it('offers Start quiz when there are no attempts yet', async () => {
    const { onRetake } = renderResults([])
    expect(await screen.findByText('No attempts yet. Take the quiz to see your answers here.')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: /Start quiz/ }))
    expect(onRetake).toHaveBeenCalled()
  })
})
