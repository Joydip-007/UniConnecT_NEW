import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/msw/server'
import { QuizModal } from './QuizModal'
import { useToastStore } from '@/stores/toastStore'
import type { LearningUnit } from '../types'

const quizUnit: LearningUnit = {
  id: 'unit-quiz-1',
  display_order: 1,
  title: 'Git quiz',
  type: 'quiz',
  completed: false,
  content: {
    questions: [
      { q: 'What command initializes a repo?', options: ['git init', 'git start', 'git new'], answer: 0 },
      { q: 'What command stages a file?', options: ['git stage', 'git add', 'git track'], answer: 1 },
    ],
  },
  completion_rule: { passScore: 70 },
}

function renderModal(overrides: Partial<{ unit: LearningUnit | null; open: boolean; onClose: () => void }> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const onClose = overrides.onClose ?? vi.fn()
  const utils = render(
    <QueryClientProvider client={qc}>
      <QuizModal unit={overrides.unit ?? quizUnit} open={overrides.open ?? true} onClose={onClose} />
    </QueryClientProvider>,
  )
  return { ...utils, onClose }
}

describe('QuizModal', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('renders nothing when unit is null', () => {
    const { container } = renderModal({ unit: null })
    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument()
  })

  it('renders one fieldset per question with labelled radio options', () => {
    renderModal()
    expect(screen.getByText('What command initializes a repo?')).toBeInTheDocument()
    expect(screen.getByText('What command stages a file?')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'git init' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'git add' })).toBeInTheDocument()
  })

  it('disables submit until every question is answered', async () => {
    const user = userEvent.setup()
    renderModal()

    const submit = screen.getByRole('button', { name: 'Submit' })
    expect(submit).toBeDisabled()

    await user.click(screen.getByRole('radio', { name: 'git init' }))
    expect(submit).toBeDisabled()

    await user.click(screen.getByRole('radio', { name: 'git add' }))
    expect(submit).toBeEnabled()
  })

  it('posts the computed score and shows the streak toast on pass', async () => {
    let postedBody: unknown = null
    server.use(
      http.post('*/learning/units/:unitId/complete', async ({ request }) => {
        postedBody = await request.json()
        return HttpResponse.json({ data: { completed: true, pathCompleted: false, streak: { currentStreak: 5, longestStreak: 5 } } })
      }),
    )
    const user = userEvent.setup()
    renderModal()

    await user.click(screen.getByRole('radio', { name: 'git init' }))
    await user.click(screen.getByRole('radio', { name: 'git add' }))
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    await vi.waitFor(() => {
      expect(postedBody).toEqual({ score: 100 })
    })
    expect(await screen.findByText('Score: 100% — passed')).toBeInTheDocument()

    await vi.waitFor(() => {
      const toasts = useToastStore.getState().toasts
      expect(toasts.some((t) => t.message.includes('streak: 5 days') && t.type === 'success')).toBe(true)
    })
  })

  it('shows a milestone streak toast on a 30-day streak', async () => {
    server.use(
      http.post('*/learning/units/:unitId/complete', () =>
        HttpResponse.json({ data: { completed: true, pathCompleted: false, streak: { currentStreak: 30, longestStreak: 30 } } })),
    )
    const user = userEvent.setup()
    renderModal()

    await user.click(screen.getByRole('radio', { name: 'git init' }))
    await user.click(screen.getByRole('radio', { name: 'git add' }))
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    await vi.waitFor(() => {
      const toasts = useToastStore.getState().toasts
      expect(toasts.some((t) => t.message === '30-day streak — badge on its way' && t.type === 'success')).toBe(true)
    })
  })

  it('shows the inline retry state on a failing (400) response and resets answers on try again', async () => {
    server.use(
      http.post('*/learning/units/:unitId/complete', () =>
        HttpResponse.json({ error: 'Score too low', code: 'QUIZ_FAILED' }, { status: 400 })),
    )
    const user = userEvent.setup()
    renderModal()

    await user.click(screen.getByRole('radio', { name: 'git init' }))
    await user.click(screen.getByRole('radio', { name: 'git track' }))
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('Score: 50% — you need 70%')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'git init' })).not.toBeChecked()
  })

  it('shows an error toast and closes the modal on 429', async () => {
    server.use(
      http.post('*/learning/units/:unitId/complete', () =>
        HttpResponse.json({ error: 'Slow down', code: 'RATE_LIMITED' }, { status: 429 })),
    )
    const user = userEvent.setup()
    const { onClose } = renderModal()

    await user.click(screen.getByRole('radio', { name: 'git init' }))
    await user.click(screen.getByRole('radio', { name: 'git add' }))
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    await vi.waitFor(() => {
      const toasts = useToastStore.getState().toasts
      expect(toasts.some((t) => t.message === 'Slow down' && t.type === 'error')).toBe(true)
    })
    expect(onClose).toHaveBeenCalled()
  })
})
