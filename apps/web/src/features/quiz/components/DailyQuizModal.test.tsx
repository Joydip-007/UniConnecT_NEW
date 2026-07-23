import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DailyQuizModal } from './DailyQuizModal'
import { api } from '@/lib/axios'

vi.mock('@/lib/axios', () => ({ api: { post: vi.fn(), get: vi.fn() } }))

const SLOT = {
  id: 'slot-1', department: 'CS', date: '2026-07-06',
  questions: [
    { q: 'What is 1+1?', options: ['1', '2', '3'] },
    { q: 'Capital of France?', options: ['London', 'Paris', 'Rome'] },
  ],
  myAttempt: null,
}

beforeEach(() => vi.resetAllMocks())

function Wrap({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
}

describe('DailyQuizModal', () => {
  it('renders first question when open', () => {
    render(<Wrap><DailyQuizModal slot={SLOT} open onClose={vi.fn()} /></Wrap>)
    expect(screen.getByText('What is 1+1?')).toBeInTheDocument()
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
  })

  it('does not show Submit with no selection', () => {
    render(<Wrap><DailyQuizModal slot={SLOT} open onClose={vi.fn()} /></Wrap>)
    expect(screen.queryByRole('button', { name: /submit/i })).not.toBeInTheDocument()
  })

  it('advances to next question after selection', async () => {
    render(<Wrap><DailyQuizModal slot={SLOT} open onClose={vi.fn()} /></Wrap>)
    fireEvent.click(screen.getByText('2'))
    await waitFor(() => expect(screen.getByText('Capital of France?')).toBeInTheDocument())
    expect(screen.getByText('2 / 2')).toBeInTheDocument()
  })

  it('shows Submit after all questions answered', async () => {
    render(<Wrap><DailyQuizModal slot={SLOT} open onClose={vi.fn()} /></Wrap>)
    fireEvent.click(screen.getByText('2'))
    await waitFor(() => screen.getByText('Capital of France?'))
    fireEvent.click(screen.getByText('Paris'))
    await waitFor(() => expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument())
  })

  it('submits and shows result screen with per-question review', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        data: {
          score: 100, correctCount: 2, totalQuestions: 2, passed: true,
          review: [
            { question: 'What is 1+1?', options: ['1', '2', '3'], selectedIndex: 1, correctIndex: 1, isCorrect: true },
            { question: 'Capital of France?', options: ['London', 'Paris', 'Rome'], selectedIndex: 1, correctIndex: 1, isCorrect: true },
          ],
        },
      },
    })
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
    render(<Wrap><DailyQuizModal slot={SLOT} open onClose={vi.fn()} /></Wrap>)
    fireEvent.click(screen.getByText('2'))
    await waitFor(() => screen.getByText('Capital of France?'))
    fireEvent.click(screen.getByText('Paris'))
    await waitFor(() => fireEvent.click(screen.getByRole('button', { name: /submit/i })))
    await waitFor(() => expect(screen.getByText(/100/)).toBeInTheDocument())
    expect(screen.getByText('1. What is 1+1?')).toBeInTheDocument()
    expect(screen.getByText('2. Capital of France?')).toBeInTheDocument()
  })

  it('shows correct answer for a wrong response in the review', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        data: {
          score: 50, correctCount: 1, totalQuestions: 2, passed: false,
          review: [
            { question: 'What is 1+1?', options: ['1', '2', '3'], selectedIndex: 1, correctIndex: 1, isCorrect: true },
            { question: 'Capital of France?', options: ['London', 'Paris', 'Rome'], selectedIndex: 0, correctIndex: 1, isCorrect: false },
          ],
        },
      },
    })
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
    render(<Wrap><DailyQuizModal slot={SLOT} open onClose={vi.fn()} /></Wrap>)
    fireEvent.click(screen.getByText('2'))
    await waitFor(() => screen.getByText('Capital of France?'))
    fireEvent.click(screen.getByText('London'))
    await waitFor(() => fireEvent.click(screen.getByRole('button', { name: /submit/i })))
    await waitFor(() => expect(screen.getByText('Your answer: London')).toBeInTheDocument())
    expect(screen.getByText('Correct answer: Paris')).toBeInTheDocument()
  })

  it('returns null when not open', () => {
    const { container } = render(<Wrap><DailyQuizModal slot={SLOT} open={false} onClose={vi.fn()} /></Wrap>)
    expect(container.firstChild).toBeNull()
  })
})
