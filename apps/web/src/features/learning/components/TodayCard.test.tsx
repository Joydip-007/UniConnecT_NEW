import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/msw/server'
import { TodayCard } from './TodayCard'
import { useToastStore } from '@/stores/toastStore'
import type { TodayEntry } from '../types'

const baseEntry: TodayEntry = {
  pathId: 'path-1',
  unit: { id: 'unit-1', display_order: 1, title: 'Intro to Git', type: 'read', completed: false, content: { body: 'Some content here.' } },
  completedToday: false,
}

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('TodayCard', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('renders the unit title', () => {
    renderWithClient(<TodayCard entry={baseEntry} pathTitle="Git basics" />)
    expect(screen.getByText('Intro to Git')).toBeInTheDocument()
  })

  it('marks complete and shows a streak toast on success', async () => {
    const user = userEvent.setup()
    renderWithClient(<TodayCard entry={baseEntry} pathTitle="Git basics" />)

    await user.click(screen.getByRole('button', { name: 'Mark complete' }))

    await vi.waitFor(() => {
      const toasts = useToastStore.getState().toasts
      expect(toasts.some((t) => t.message.includes('streak: 4 days') && t.type === 'success')).toBe(true)
    })
  })

  it('shows a milestone streak toast on a 7-day streak', async () => {
    server.use(
      http.post('*/learning/units/:unitId/complete', () =>
        HttpResponse.json({ data: { completed: true, pathCompleted: false, streak: { currentStreak: 7, longestStreak: 7 } } })),
    )
    const user = userEvent.setup()
    renderWithClient(<TodayCard entry={baseEntry} pathTitle="Git basics" />)

    await user.click(screen.getByRole('button', { name: 'Mark complete' }))

    await vi.waitFor(() => {
      const toasts = useToastStore.getState().toasts
      expect(toasts.some((t) => t.message === '7-day streak — badge on its way' && t.type === 'success')).toBe(true)
    })
  })

  it('shows an additional toast when the path is completed', async () => {
    server.use(
      http.post('*/learning/units/:unitId/complete', () =>
        HttpResponse.json({ data: { completed: true, pathCompleted: true, streak: { currentStreak: 1, longestStreak: 1 } } })),
    )
    const user = userEvent.setup()
    renderWithClient(<TodayCard entry={baseEntry} pathTitle="Git basics" />)

    await user.click(screen.getByRole('button', { name: 'Mark complete' }))

    await vi.waitFor(() => {
      const toasts = useToastStore.getState().toasts
      expect(toasts.some((t) => t.message === 'Path complete! Badge on its way')).toBe(true)
    })
  })

  it('shows an error toast on 429', async () => {
    server.use(
      http.post('*/learning/units/:unitId/complete', () =>
        HttpResponse.json({ error: 'Slow down', code: 'RATE_LIMITED' }, { status: 429 })),
    )
    const user = userEvent.setup()
    renderWithClient(<TodayCard entry={baseEntry} pathTitle="Git basics" />)

    await user.click(screen.getByRole('button', { name: 'Mark complete' }))

    await vi.waitFor(() => {
      const toasts = useToastStore.getState().toasts
      expect(toasts.some((t) => t.message === 'Slow down' && t.type === 'error')).toBe(true)
    })
  })

  it('renders the done-for-today state without a button when completedToday is true', () => {
    renderWithClient(<TodayCard entry={{ ...baseEntry, completedToday: true }} pathTitle="Git basics" />)
    expect(screen.getByText('Done for today — come back tomorrow')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mark complete' })).not.toBeInTheDocument()
  })

  it('renders start quiz button for quiz type units and calls onQuizStart', async () => {
    const quizEntry: TodayEntry = {
      pathId: 'path-1',
      unit: { id: 'unit-2', display_order: 2, title: 'Git quiz', type: 'quiz', completed: false, content: { questions: [] } },
      completedToday: false,
    }
    let called: unknown = null
    const user = userEvent.setup()
    renderWithClient(<TodayCard entry={quizEntry} pathTitle="Git basics" onQuizStart={(unit) => { called = unit }} />)

    await user.click(screen.getByRole('button', { name: 'Start quiz' }))
    expect(called).toMatchObject({ id: 'unit-2' })
  })
})
