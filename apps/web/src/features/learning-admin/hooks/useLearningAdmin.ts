import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  LearningAdminConfig,
  LearningAdminConfigInput,
  LearningAnalytics,
  PendingPath,
  PendingPathDetail,
  PendingQuizBatch,
  PendingQuizBatchDetail,
  UpcomingQuizzes,
} from '@uniconnect/shared'
import { api } from '@/lib/axios'

export function useLearningAdminConfig() {
  return useQuery<LearningAdminConfig>({
    queryKey: ['learning-admin', 'config'],
    queryFn: () =>
      api.get<{ data: LearningAdminConfig }>('/admin/learning/config').then((r) => r.data.data),
    refetchInterval: 60000,
  })
}

export function useUpdateLearningAdminConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: LearningAdminConfigInput) =>
      api.patch<{ data: LearningAdminConfig }>('/admin/learning/config', input).then((r) => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['learning-admin', 'config'] })
    },
  })
}

export function useTriggerLearningGenerate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      api.post<{ data: { status: string } }>('/admin/learning/generate').then((r) => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['learning-admin'] })
    },
  })
}

export function usePendingPaths() {
  return useQuery<PendingPath[]>({
    queryKey: ['learning-admin', 'pending-paths'],
    queryFn: () =>
      api.get<{ data: PendingPath[] }>('/admin/learning/pending-paths').then((r) => r.data.data),
    refetchInterval: 60000,
  })
}

export function usePendingPathDetail(pathId: string | null) {
  return useQuery<PendingPathDetail>({
    queryKey: ['learning-admin', 'pending-path', pathId],
    queryFn: () =>
      api.get<{ data: PendingPathDetail }>(`/admin/learning/pending-paths/${pathId}`).then((r) => r.data.data),
    enabled: !!pathId,
  })
}

export function useApprovePath() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.post(`/admin/learning/pending-paths/${id}/approve`).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['learning-admin', 'pending-paths'] })
      void qc.invalidateQueries({ queryKey: ['learning'] })
    },
  })
}

export function useDiscardPath() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.post(`/admin/learning/pending-paths/${id}/discard`).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['learning-admin', 'pending-paths'] })
    },
  })
}

export function usePendingQuizBatches(enabled: boolean) {
  return useQuery<PendingQuizBatch[]>({
    queryKey: ['learning-admin', 'pending-quiz-batches'],
    queryFn: () =>
      api.get<{ data: PendingQuizBatch[] }>('/admin/learning/pending-quiz').then((r) => r.data.data),
    refetchInterval: 60000,
    enabled,
  })
}

export function usePendingQuizBatchDetail(batchId: string | null) {
  return useQuery<PendingQuizBatchDetail>({
    queryKey: ['learning-admin', 'pending-quiz-batch', batchId],
    queryFn: () =>
      api.get<{ data: PendingQuizBatchDetail }>(`/admin/learning/pending-quiz/${batchId}`).then((r) => r.data.data),
    enabled: !!batchId,
  })
}

export function useApproveQuizBatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.post(`/admin/learning/pending-quiz/${id}/approve`).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['learning-admin', 'pending-quiz-batches'] })
      void qc.invalidateQueries({ queryKey: ['quiz'] })
    },
  })
}

export function useDiscardQuizBatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.post(`/admin/learning/pending-quiz/${id}/discard`).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['learning-admin', 'pending-quiz-batches'] })
    },
  })
}

/** Today's already-generated quiz slots (with live attempt counts) plus the AI question
 *  pool queued per department — slots aren't pre-scheduled ahead of today, so the queued
 *  pool is the closest honest signal of what upcoming days will draw from. */
export function useUpcomingQuizzes() {
  return useQuery<UpcomingQuizzes>({
    queryKey: ['learning-admin', 'upcoming-quizzes'],
    queryFn: () =>
      api.get<{ data: UpcomingQuizzes }>('/admin/learning/upcoming-quizzes').then((r) => r.data.data),
    refetchInterval: 60000,
  })
}

export function useLearningAnalytics(days: number) {
  return useQuery<LearningAnalytics>({
    queryKey: ['learning-admin', 'analytics', days],
    queryFn: () =>
      api
        .get<{ data: LearningAnalytics }>('/admin/learning/analytics', { params: { days } })
        .then((r) => r.data.data),
    refetchInterval: 60000,
  })
}
