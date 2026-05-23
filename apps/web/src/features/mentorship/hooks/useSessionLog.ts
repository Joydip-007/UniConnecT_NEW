import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { MentorshipSession } from '../types'

function sessionKey(requestId: string) {
  return ['mentorship', 'sessions', requestId] as const
}

// ── List ──────────────────────────────────────────────────────────────────────

export function useSessionLog(requestId: string) {
  return useQuery<MentorshipSession[]>({
    queryKey: sessionKey(requestId),
    queryFn: () =>
      api
        .get<{ data: MentorshipSession[] }>(`/mentorship/requests/${requestId}/sessions`)
        .then((r) => r.data.data),
    enabled: !!requestId,
  })
}

// ── Create ────────────────────────────────────────────────────────────────────

export interface CreateSessionPayload {
  sessionDate: string       // 'YYYY-MM-DD'
  durationMinutes: number
  topic: string
  notes?: string | null
}

export function useCreateSession(requestId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateSessionPayload) =>
      api
        .post<{ data: MentorshipSession }>(`/mentorship/requests/${requestId}/sessions`, payload)
        .then((r) => r.data.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sessionKey(requestId) })
    },
  })
}

// ── Update ────────────────────────────────────────────────────────────────────

export interface UpdateSessionPayload {
  sessionDate?: string
  durationMinutes?: number
  topic?: string
  notes?: string | null
}

export function useUpdateSession(requestId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ sessionId, ...payload }: UpdateSessionPayload & { sessionId: string }) =>
      api
        .patch<{ data: MentorshipSession }>(
          `/mentorship/requests/${requestId}/sessions/${sessionId}`,
          payload,
        )
        .then((r) => r.data.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sessionKey(requestId) })
    },
  })
}

// ── Delete ────────────────────────────────────────────────────────────────────

export function useDeleteSession(requestId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) =>
      api.delete(`/mentorship/requests/${requestId}/sessions/${sessionId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sessionKey(requestId) })
    },
  })
}
