import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { ShuttleNotice, ShuttleRiderPrefs } from '../types'

const PREFS_KEY = ['shuttle', 'me', 'stop'] as const

export function useRiderStop() {
  return useQuery<ShuttleRiderPrefs>({
    queryKey: PREFS_KEY,
    queryFn: () => api.get<{ data: ShuttleRiderPrefs }>('/shuttle/me/stop').then((r) => r.data.data),
    staleTime: 5 * 60_000,
  })
}

export function useSaveRiderStop() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (prefs: ShuttleRiderPrefs) =>
      api
        .put<{ data: ShuttleRiderPrefs }>('/shuttle/me/stop', {
          route_id: prefs.routeId,
          stop_id: prefs.stopId,
          alert_enabled: prefs.alertEnabled,
        })
        .then((r) => r.data.data),
    // Optimistic so the alert switch flips under the finger.
    onMutate: async (prefs) => {
      await qc.cancelQueries({ queryKey: PREFS_KEY })
      const previous = qc.getQueryData<ShuttleRiderPrefs>(PREFS_KEY)
      qc.setQueryData(PREFS_KEY, prefs)
      return { previous }
    },
    onError: (_err, _prefs, context) => {
      if (context?.previous) qc.setQueryData(PREFS_KEY, context.previous)
    },
    onSuccess: (data) => {
      qc.setQueryData(PREFS_KEY, data)
    },
  })
}

export function useShuttleNotices() {
  return useQuery<ShuttleNotice[]>({
    queryKey: ['shuttle', 'notices'],
    queryFn: () => api.get<{ data: ShuttleNotice[] }>('/shuttle/notices').then((r) => r.data.data),
    staleTime: 5 * 60_000,
  })
}

export interface NewShuttleNotice {
  route_id: string | null
  tone: ShuttleNotice['tone']
  title: string
  detail: string | null
  expires_at: string | null
}

export function useNoticeMutations() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['shuttle', 'notices'] })
  const create = useMutation({
    mutationFn: (notice: NewShuttleNotice) => api.post('/shuttle/notices', notice),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/shuttle/notices/${id}`),
    onSuccess: invalidate,
  })
  return { create, remove }
}
