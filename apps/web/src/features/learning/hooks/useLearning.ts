import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type {
  BadgeProgress, CompleteUnitResult, LearningPath, LearningStats, MyQuiz, PathDetail, SubmitUnitQuizResult,
  TodayEntry, UnitQuizAttempt, UserBadge,
} from '../types'

const STREAK_MILESTONES = new Set([7, 30, 100])

export function streakToastMessage(n: number): string {
  if (STREAK_MILESTONES.has(n)) {
    return `${n}-day streak — badge on its way`
  }
  return `Unit complete — streak: ${n} days`
}

export function usePaths() {
  return useQuery({
    queryKey: ['learning', 'paths', {}],
    queryFn: () => api.get<{ data: LearningPath[] }>('/learning/paths').then((r) => r.data.data),
  })
}

export function usePath(pathId: string | null) {
  return useQuery({
    queryKey: ['learning', 'path', { pathId }],
    queryFn: () => api.get<{ data: PathDetail }>(`/learning/paths/${pathId}`).then((r) => r.data.data),
    enabled: !!pathId,
  })
}

export function useToday() {
  return useQuery({
    queryKey: ['learning', 'today', {}],
    queryFn: () => api.get<{ data: TodayEntry[] }>('/learning/me/today').then((r) => r.data.data),
  })
}

export function useLearningStats() {
  return useQuery({
    queryKey: ['learning', 'stats', {}],
    queryFn: () => api.get<{ data: LearningStats }>('/learning/me/stats').then((r) => r.data.data),
  })
}

export function useMyBadges() {
  return useQuery({
    queryKey: ['learning', 'badges', { mine: true }],
    queryFn: () => api.get<{ data: UserBadge[] }>('/learning/me/badges').then((r) => r.data.data),
  })
}

export function useUserBadges(userId: string) {
  return useQuery({
    queryKey: ['learning', 'badges', { userId }],
    queryFn: () => api.get<{ data: UserBadge[] }>(`/learning/users/${userId}/badges`).then((r) => r.data.data),
    enabled: !!userId,
  })
}

function useInvalidateLearning() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['learning'] })
}

export function useEnroll() {
  const invalidate = useInvalidateLearning()
  return useMutation({
    mutationFn: (pathId: string) => api.post(`/learning/paths/${pathId}/enroll`),
    onSuccess: invalidate,
  })
}

export function useAbandon() {
  const invalidate = useInvalidateLearning()
  return useMutation({
    mutationFn: (pathId: string) => api.post(`/learning/paths/${pathId}/abandon`),
    onSuccess: invalidate,
  })
}

export function useCompleteUnit() {
  const invalidate = useInvalidateLearning()
  return useMutation({
    mutationFn: ({ unitId, score }: { unitId: string; score?: number }) =>
      api.post<{ data: CompleteUnitResult }>(`/learning/units/${unitId}/complete`, score === undefined ? {} : { score })
        .then((r) => r.data.data),
    onSuccess: invalidate,
  })
}

export function useShowcaseBadge() {
  const invalidate = useInvalidateLearning()
  return useMutation({
    mutationFn: (badgeId: string | null) => api.put('/learning/me/badges/showcase', { badgeId }),
    onSuccess: invalidate,
  })
}

export function useMyQuizzes() {
  return useQuery({
    queryKey: ['learning', 'quizzes', {}],
    queryFn: () => api.get<{ data: MyQuiz[] }>('/learning/me/quizzes').then((r) => r.data.data),
  })
}

export function useUnitAttempts(unitId: string | null) {
  return useQuery({
    queryKey: ['learning', 'attempts', { unitId }],
    queryFn: () =>
      api.get<{ data: UnitQuizAttempt[] }>(`/learning/units/${unitId}/attempts`).then((r) => r.data.data),
    enabled: !!unitId,
  })
}

export function useSubmitUnitQuiz() {
  const invalidate = useInvalidateLearning()
  return useMutation({
    mutationFn: ({ unitId, answers }: { unitId: string; answers: number[] }) =>
      api
        .post<{ data: SubmitUnitQuizResult }>(`/learning/units/${unitId}/attempts`, { answers })
        .then((r) => r.data.data),
    onSuccess: invalidate,
  })
}

export function useBadgeProgress(enabled = true) {
  return useQuery({
    queryKey: ['learning', 'badges', { progress: true }],
    queryFn: () => api.get<{ data: BadgeProgress[] }>('/learning/me/badges/progress').then((r) => r.data.data),
    enabled,
  })
}

export function usePinBadge() {
  const invalidate = useInvalidateLearning()
  return useMutation({
    mutationFn: ({ badgeId, pinned }: { badgeId: string; pinned: boolean }) =>
      api.put(`/learning/me/badges/${badgeId}/pin`, { pinned }),
    onSuccess: invalidate,
  })
}
