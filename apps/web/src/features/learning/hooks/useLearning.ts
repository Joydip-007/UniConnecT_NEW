import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type {
  CompleteUnitResult, LearningPath, LearningStats, PathDetail, TodayEntry, UserBadge,
} from '../types'

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
