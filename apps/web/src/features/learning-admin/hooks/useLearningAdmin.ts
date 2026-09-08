import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  AdminLearningPath,
  CreateLearningPathInput,
  LearningAdminConfig,
  LearningAdminConfigInput,
  LearningAnalytics,
  PendingPath,
  PendingPathDetail,
  PendingQuizBatch,
  PendingQuizBatchDetail,
  UpcomingQuizzes,
  UpdateLearningPathInput,
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
    mutationFn: (task: 'learning' | 'quiz' | 'both' = 'both') =>
      api.post<{ data: { status: string } }>('/admin/learning/generate', { task }).then((r) => r.data.data),
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

interface AdminLearningPathDetail extends AdminLearningPath {
  units: Array<{
    id: string
    displayOrder: number
    title: string
    type: 'read' | 'video' | 'exercise' | 'quiz'
    content: { body?: string; questions?: Array<{ q: string; options: string[]; answer: number }> } | null
    completionRule: { passScore?: number } | null
  }>
}

export function useAdminLearningPaths(query: { status?: 'all' | 'published' | 'draft'; category?: string }) {
  return useQuery<AdminLearningPath[]>({
    queryKey: ['learning-admin', 'paths', query],
    queryFn: () =>
      api.get<{ data: AdminLearningPath[] }>('/admin/learning/paths', { params: query }).then((r) => r.data.data),
  })
}

export function usePathDetail(pathId: string | null) {
  return useQuery<AdminLearningPathDetail>({
    queryKey: ['learning-admin', 'path', pathId],
    queryFn: () => api.get<{ data: AdminLearningPathDetail }>(`/admin/learning/paths/${pathId}`).then((r) => r.data.data),
    enabled: !!pathId,
  })
}

export function useCreateLearningPath() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateLearningPathInput) =>
      api.post<{ data: AdminLearningPath }>('/admin/learning/paths', input).then((r) => r.data.data),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['learning-admin', 'paths'] }) },
  })
}

export function useUpdateLearningPath() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ pathId, patch }: { pathId: string; patch: UpdateLearningPathInput }) =>
      api.patch<{ data: AdminLearningPath }>(`/admin/learning/paths/${pathId}`, patch).then((r) => r.data.data),
    onSuccess: (_data, { pathId }) => {
      void qc.invalidateQueries({ queryKey: ['learning-admin', 'paths'] })
      void qc.invalidateQueries({ queryKey: ['learning-admin', 'path', pathId] })
    },
  })
}

export function useSetPathPublished() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ pathId, isPublished }: { pathId: string; isPublished: boolean }) =>
      api.patch<{ data: AdminLearningPath }>(`/admin/learning/paths/${pathId}/publish`, { isPublished }).then((r) => r.data.data),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['learning-admin', 'paths'] }) },
  })
}

export function useCreatePathUnit(pathId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (unit: { title: string; type: string; content: Record<string, unknown>; completionRule?: { passScore?: number } }) =>
      api.post(`/admin/learning/paths/${pathId}/units`, unit),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['learning-admin', 'path', pathId] }) },
  })
}

export function useUpdatePathUnit(pathId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ unitId, patch }: { unitId: string; patch: Record<string, unknown> }) =>
      api.patch(`/admin/learning/paths/${pathId}/units/${unitId}`, patch),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['learning-admin', 'path', pathId] }) },
  })
}

export function useDeletePathUnit(pathId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (unitId: string) => api.delete(`/admin/learning/paths/${pathId}/units/${unitId}`),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['learning-admin', 'path', pathId] }) },
  })
}

export function useReorderPathUnits(pathId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (unitIds: string[]) => api.patch(`/admin/learning/paths/${pathId}/units/reorder`, { unitIds }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['learning-admin', 'path', pathId] }) },
  })
}
