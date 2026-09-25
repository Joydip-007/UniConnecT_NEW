import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { todayStartIso } from '../lib/schedule'
import type { ShuttleDuty, ShuttleShift } from '../types'

/** Shared with the left rail's driver card, so the rail and the page read one cache entry. */
export function shuttleDutyKey(since: string) {
  return ['shuttle', 'duty', { since }] as const
}

export function useShuttleDuty(enabled = true) {
  // Recomputed per mount: "today" only needs to be right when the page is opened.
  const since = useMemo(() => todayStartIso(), [])
  return useQuery<ShuttleDuty>({
    queryKey: shuttleDutyKey(since),
    queryFn: () => api.get<{ data: ShuttleDuty }>('/shuttle/duty', { params: { since } }).then((r) => r.data.data),
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

export function useShiftMutations() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['shuttle', 'duty'] })

  const start = useMutation({
    mutationFn: (routeId: string) =>
      api.post<{ data: ShuttleShift }>('/shuttle/shifts/start', { route_id: routeId }).then((r) => r.data.data),
    onSuccess: invalidate,
  })

  const stop = useMutation({
    mutationFn: () => api.post<{ data: ShuttleShift | null }>('/shuttle/shifts/stop').then((r) => r.data.data),
    onSuccess: invalidate,
  })

  const riders = useMutation({
    mutationFn: (delta: 1 | -1) =>
      api.post<{ data: ShuttleShift }>('/shuttle/shifts/riders', { delta }).then((r) => r.data.data),
    onSuccess: invalidate,
  })

  return { start, stop, riders }
}
