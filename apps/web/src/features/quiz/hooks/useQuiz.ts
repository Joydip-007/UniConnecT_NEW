import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { DailyQuizSlot, QuizAttemptResult, LeaderboardEntry, QuizHistoryItem } from '../types'

interface PaginatedResponse<T> { items: T[]; total: number; page: number; limit: number }

const todayKey = () => ['quiz', 'today'] as const
const leaderboardKey = () => ['quiz', 'leaderboard', 'today'] as const
const historyKey = (page: number) => ['quiz', 'history', { page }] as const

export function useTodayQuiz() {
  return useQuery({
    queryKey: todayKey(),
    queryFn: () => api.get<{ data: DailyQuizSlot | null }>('/quiz/today').then((r) => r.data.data),
    staleTime: 60_000,
  })
}

export function useSubmitAttempt(slotId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (answers: number[]) =>
      api
        .post<{ data: QuizAttemptResult }>(`/quiz/today/${slotId}/attempt`, { answers })
        .then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: todayKey() })
      queryClient.invalidateQueries({ queryKey: leaderboardKey() })
    },
  })
}

export function useTodayLeaderboard() {
  return useQuery({
    queryKey: leaderboardKey(),
    queryFn: () =>
      api.get<{ data: LeaderboardEntry[] }>('/quiz/today/leaderboard').then((r) => r.data.data),
    staleTime: 30_000,
  })
}

export function useQuizHistory(page = 1) {
  return useQuery({
    queryKey: historyKey(page),
    queryFn: () =>
      api
        .get<{ data: PaginatedResponse<QuizHistoryItem> }>(`/quiz/me/history?page=${page}&limit=20`)
        .then((r) => r.data.data),
  })
}
