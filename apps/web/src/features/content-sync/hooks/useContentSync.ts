import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ContentSyncConfig, ContentSyncConfigInput, ContentSyncRun } from '@uniconnect/shared'
import { api } from '@/lib/axios'

interface Paginated<T> {
  items: T[]
  total: number
  page: number
  hasMore: boolean
}

export function useContentSyncConfig() {
  return useQuery<ContentSyncConfig>({
    queryKey: ['content-sync', 'config'],
    queryFn: () =>
      api.get<{ data: ContentSyncConfig }>('/admin/content-sync/config').then((r) => r.data.data),
  })
}

export function useUpdateContentSyncConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ContentSyncConfigInput) =>
      api.patch<{ data: ContentSyncConfig }>('/admin/content-sync/config', input).then((r) => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['content-sync', 'config'] })
    },
  })
}

export function useTriggerSync() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      api.post<{ data: { runId: string } }>('/admin/content-sync/run').then((r) => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['content-sync', 'runs'] })
    },
  })
}

export function useSyncRuns() {
  return useQuery<ContentSyncRun[]>({
    queryKey: ['content-sync', 'runs'],
    queryFn: () =>
      api
        .get<{ data: Paginated<ContentSyncRun> }>('/admin/content-sync/runs', { params: { limit: 10 } })
        .then((r) => r.data.data.items),
    // Poll while a run is in progress so the UI reflects completion without a manual refresh.
    refetchInterval: (query) =>
      (query.state.data ?? []).some((run) => run.status === 'running') ? 4000 : false,
  })
}
