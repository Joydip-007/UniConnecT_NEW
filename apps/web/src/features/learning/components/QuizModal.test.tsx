import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/msw/server'
import { useToastStore } from '@/stores/toastStore'
import { QuizModal } from './QuizModal'
import type { PathDetail, UnitQuizAttempt } from '../types'

const QUESTIONS = [
  { q: 'Which command finds a lost commit?', options: ['git log', 'git reflog'], answer: 1 },
  { q: 'Safe force-push flag?', options: ['--force', '--force-with-lease'], answer: 1 },
]

const PATH: PathDetail = {
  id: 'path-1', title: 'Git for group projects', description: null, category: 'technical', difficulty: 'beginner',
  estimated_days: 9, badge_name: null, badge_icon: null, unitCount: 1, enrolledCount: 1, enrollment: { status: 'active' },
  units: [{ id: 'u-q', display_order: 1, title: 'Checkpoint: recovering a repo', type: 'quiz', completed: false, content: { questions: QUESTIONS }, completion_rule: { passScore: 70 } }],
}

function attempt(picks: number[]): UnitQuizAttempt {
  const review = QUESTIONS.map((q, i) => ({ question: q.q, options: q.options, selectedIndex: picks[i], correctIndex: q.answer, isCorrect: picks[i] === q.answer }))
  const correct = review.filter((r) => r.isCorrect).length
  return { id: `a-${picks.join('')}`, createdAt: new Date().toISOString(), score: correct * 50, correctCount: correct, totalQuestions: 2, passed: correct * 50 >= 70, review }
}

function renderQuiz(props: Partial<Parameters<typeof QuizModal>[0]> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const handlers = { onClose: vi.fn(), onShowResults: vi.fn(), ...props }
  render(
    <QueryClientProvider client={qc}>
      <QuizModal pathId="path-1" unitId="u-q" {...handlers} />
    </QueryClientProvider>,
  )
  return handlers
}

describe('QuizModal', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
    server.use(http.get('*/learning/paths/:pathId', () => HttpResponse.json({ data: PATH })))
  })

  it('keeps Submit inert until every question has an answer', async () => {
    const user = userEvent.setup()
    renderQuiz()
    await user.click(await screen.findByLabelText('git reflog'))
    expect(screen.getByRole('button', { name: 'Submit' })).toHaveAttribute('aria-disabled', 'true')
  })

  it('submits the picks, then locks correct answers and retries only the wrong ones', async () => {
    let body: unknown = null
    server.use(http.post('*/learning/units/:unitId/attempts', async ({ request }) => {
      body = await request.json()
      return HttpResponse.json({ data: { attempt: attempt([1, 0]), passScore: 70, completion: null, completionError: null } }, { status: 201 })
    }))
    const user = userEvent.setup()
    renderQuiz()
    await user.click(await screen.findByLabelText('git reflog'))
    await user.click(screen.getByLabelText('--force'))
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(body).toEqual({ answers: [1, 0] })
    expect(await screen.findByText('1 of 2 to fix. The rest stay locked in.')).toBeInTheDocument()
    expect(screen.getByText('Correct, locked')).toBeInTheDocument()
    expect(screen.getByText('Retry this one')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Retry 1 question' }))
    expect(screen.getByLabelText('git reflog')).toBeChecked()
    expect(screen.getByLabelText('--force')).not.toBeChecked()
  })

  it('clears the checkpoint, toasts the streak and returns to the unit', async () => {
    server.use(http.post('*/learning/units/:unitId/attempts', () =>
      HttpResponse.json({
        data: {
          attempt: attempt([1, 1]), passScore: 70, completionError: null,
          completion: { completed: true, alreadyCompleted: false, pathCompleted: false, streak: { currentStreak: 5, longestStreak: 7 } },
        },
      }, { status: 201 })))
    const onBack = vi.fn()
    const user = userEvent.setup()
    renderQuiz({ onBack })
    await user.click(await screen.findByLabelText('git reflog'))
    await user.click(screen.getByLabelText('--force-with-lease'))
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('All correct. Checkpoint cleared.')).toBeInTheDocument()
    expect(useToastStore.getState().toasts.map((t) => t.message)).toContain('Unit complete — streak: 5 days')
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(onBack).toHaveBeenCalled()
  })

  it('surfaces a pass the daily pace refused to count yet', async () => {
    server.use(http.post('*/learning/units/:unitId/attempts', () =>
      HttpResponse.json({
        data: { attempt: attempt([1, 1]), passScore: 70, completion: null, completionError: 'One unit per day — come back tomorrow' },
      }, { status: 201 })))
    const user = userEvent.setup()
    renderQuiz()
    await user.click(await screen.findByLabelText('git reflog'))
    await user.click(screen.getByLabelText('--force-with-lease'))
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() =>
      expect(useToastStore.getState().toasts.map((t) => t.message)).toContain('One unit per day — come back tomorrow'))
  })

  it('links to past results once there are attempts', async () => {
    server.use(http.get('*/learning/units/:unitId/attempts', () => HttpResponse.json({ data: [attempt([0, 0])] })))
    const user = userEvent.setup()
    const { onShowResults } = renderQuiz()
    await user.click(await screen.findByRole('button', { name: 'Past results' }))
    expect(onShowResults).toHaveBeenCalled()
  })
})
