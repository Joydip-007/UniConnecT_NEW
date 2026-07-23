import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useTodayQuiz, useSubmitAttempt, useTodayLeaderboard } from './useQuiz'
import { api } from '@/lib/axios'
import type { DailyQuizSlot, QuizAttemptResult, LeaderboardEntry } from '../types'
import type { ReactNode } from 'react'

vi.mock('@/lib/axios', () => ({ api: { get: vi.fn(), post: vi.fn() } }))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const MOCK_SLOT: DailyQuizSlot = {
  id: 'slot-1', department: 'CS', date: '2026-07-06',
  questions: [{ q: 'Q?', options: ['A', 'B'] }], myAttempt: null,
}
const MOCK_RESULT: QuizAttemptResult = {
  score: 100, correctCount: 1, totalQuestions: 1, passed: true,
  review: [{ question: 'Q?', options: ['A', 'B'], selectedIndex: 0, correctIndex: 0, isCorrect: true }],
}
const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, userId: 'u1', fullName: 'Alice', avatarUrl: null, score: 100, correctCount: 1 },
]

beforeEach(() => vi.resetAllMocks())

describe('useTodayQuiz', () => {
  it('returns today slot data', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: MOCK_SLOT } })
    const { result } = renderHook(() => useTodayQuiz(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.id).toBe('slot-1')
    expect(result.current.data?.questions).toHaveLength(1)
  })
})

describe('useSubmitAttempt', () => {
  it('posts answers and returns result', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: MOCK_RESULT } })
    vi.mocked(api.get).mockResolvedValue({ data: { data: MOCK_SLOT } })
    const { result } = renderHook(() => useSubmitAttempt('slot-1'), { wrapper })
    result.current.mutate([0])
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.passed).toBe(true)
    expect(api.post).toHaveBeenCalledWith('/quiz/today/slot-1/attempt', { answers: [0] })
  })
})

describe('useTodayLeaderboard', () => {
  it('returns leaderboard entries', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: MOCK_LEADERBOARD } })
    const { result } = renderHook(() => useTodayLeaderboard(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0].rank).toBe(1)
  })
})
