import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type {
  AlumniMentor,
  IncomingRequest,
  MentorSettings,
  MentorshipSession,
  MyRequest,
  PageResult,
  RequestStatus,
  SessionHistory,
  SessionRequest,
} from '../types'

// One page is the whole directory: the design filters it client-side (accepting now,
// department, topics), which only works on the full list.
const DIRECTORY_LIMIT = 100
const LIST_LIMIT = 100

export const mentorshipKeys = {
  all: ['mentorship'] as const,
  directory: ['mentorship', 'alumni', { limit: DIRECTORY_LIMIT }] as const,
  mine: ['mentorship', 'requests', 'mine'] as const,
  incoming: (status: RequestStatus) => ['mentorship', 'requests', 'incoming', { status }] as const,
  settings: ['mentorship', 'settings'] as const,
  history: ['mentorship', 'history'] as const,
  sessions: (requestId: string) => ['mentorship', 'sessions', requestId] as const,
}

export function useMentorDirectory(enabled = true) {
  return useQuery<PageResult<AlumniMentor>>({
    queryKey: mentorshipKeys.directory,
    queryFn: () =>
      api
        .get<{ data: PageResult<AlumniMentor> }>('/mentorship/alumni', { params: { limit: DIRECTORY_LIMIT } })
        .then((r) => r.data.data),
    enabled,
  })
}

export function useMyMentorshipRequests(enabled = true) {
  return useQuery<MyRequest[]>({
    queryKey: mentorshipKeys.mine,
    queryFn: () =>
      api
        .get<{ data: PageResult<MyRequest> }>('/mentorship/requests/mine', { params: { limit: LIST_LIMIT } })
        .then((r) => r.data.data.items),
    enabled,
  })
}

export function useIncomingRequests(status: RequestStatus, enabled = true) {
  return useQuery<IncomingRequest[]>({
    queryKey: mentorshipKeys.incoming(status),
    queryFn: () =>
      api
        .get<{ data: PageResult<IncomingRequest> }>('/mentorship/requests/incoming', {
          params: { status, limit: LIST_LIMIT },
        })
        .then((r) => r.data.data.items),
    enabled,
  })
}

export function useMentorSettings(enabled = true) {
  return useQuery<MentorSettings>({
    queryKey: mentorshipKeys.settings,
    queryFn: () => api.get<{ data: MentorSettings }>('/mentorship/settings').then((r) => r.data.data),
    enabled,
  })
}

export function useSessionHistory(enabled = true) {
  return useQuery<SessionHistory>({
    queryKey: mentorshipKeys.history,
    queryFn: () => api.get<{ data: SessionHistory }>('/mentorship/sessions/mine').then((r) => r.data.data),
    enabled,
  })
}

export function useRequestSessions(requestId: string | null) {
  return useQuery<MentorshipSession[]>({
    queryKey: mentorshipKeys.sessions(requestId ?? ''),
    queryFn: () =>
      api
        .get<{ data: MentorshipSession[] }>(`/mentorship/requests/${requestId}/sessions`)
        .then((r) => r.data.data),
    enabled: !!requestId,
  })
}

/**
 * Every mentorship write can move a count somewhere else on the page (the left rail's
 * pending badge, the capacity meter, points), so each one refreshes the whole domain.
 */
function useMentorshipMutation<TVars, TResult = unknown>(fn: (vars: TVars) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mentorshipKeys.all })
    },
  })
}

export function useRequestMentor() {
  return useMentorshipMutation((vars: { alumniId: string; message: string }) =>
    api.post('/mentorship/requests', vars),
  )
}

export function useDecideRequest() {
  return useMentorshipMutation((vars: { requestId: string; status: 'accepted' | 'declined' | 'pending' }) =>
    api
      .patch<{ data: { conversation_id: string | null } }>(`/mentorship/requests/${vars.requestId}`, {
        status: vars.status,
      })
      .then((r) => r.data.data),
  )
}

export function useEndMentorship() {
  return useMentorshipMutation((vars: { requestId: string; reason: string; note?: string }) =>
    api.post(`/mentorship/requests/${vars.requestId}/end`, { reason: vars.reason, note: vars.note }),
  )
}

export function useReopenMentorship() {
  return useMentorshipMutation((requestId: string) => api.post(`/mentorship/requests/${requestId}/reopen`))
}

export function useCreateSessionRequest() {
  return useMentorshipMutation((vars: { requestId: string; slotLabel: string | null; topic?: string }) =>
    api
      .post<{ data: SessionRequest }>(`/mentorship/requests/${vars.requestId}/session-requests`, {
        slotLabel: vars.slotLabel,
        topic: vars.topic,
      })
      .then((r) => r.data.data),
  )
}

export function useWithdrawSessionRequest() {
  return useMentorshipMutation((vars: { requestId: string; sessionRequestId: string }) =>
    api.delete(`/mentorship/requests/${vars.requestId}/session-requests/${vars.sessionRequestId}`),
  )
}

export interface LogSessionPayload {
  requestId: string
  sessionDate: string
  durationMinutes: number
  topic: string
  notes?: string | null
}

export function useLogSession() {
  return useMentorshipMutation(({ requestId, ...body }: LogSessionPayload) =>
    api
      .post<{ data: MentorshipSession }>(`/mentorship/requests/${requestId}/sessions`, body)
      .then((r) => r.data.data),
  )
}

export function useDeleteLoggedSession() {
  return useMentorshipMutation((vars: { requestId: string; sessionId: string }) =>
    api.delete(`/mentorship/requests/${vars.requestId}/sessions/${vars.sessionId}`),
  )
}

export function useUpdateMentorSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<Pick<MentorSettings, 'isOpenToMentorship' | 'maxMentees' | 'topics' | 'availability'>>) =>
      api.patch<{ data: MentorSettings }>('/mentorship/settings', patch).then((r) => r.data.data),
    // Toggles and steppers should move on click, not after the round trip.
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: mentorshipKeys.settings })
      const prev = queryClient.getQueryData<MentorSettings>(mentorshipKeys.settings)
      if (prev) queryClient.setQueryData<MentorSettings>(mentorshipKeys.settings, { ...prev, ...patch })
      return { prev }
    },
    onError: (_err, _patch, context) => {
      if (context?.prev) queryClient.setQueryData(mentorshipKeys.settings, context.prev)
    },
    onSuccess: (data) => {
      queryClient.setQueryData(mentorshipKeys.settings, data)
      void queryClient.invalidateQueries({ queryKey: mentorshipKeys.all })
    },
  })
}

export function useWaitlist() {
  return useMentorshipMutation((vars: { alumniId: string; join: boolean }) =>
    vars.join
      ? api.post(`/mentorship/alumni/${vars.alumniId}/waitlist`)
      : api.delete(`/mentorship/alumni/${vars.alumniId}/waitlist`),
  )
}
