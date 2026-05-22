import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'

// ── Types ────────────────────────────────────────────────────────────────────

export interface JoinRequest {
  id: string
  groupId: string
  userId: string
  message: string | null
  status: 'pending' | 'approved' | 'declined'
  createdAt: string
  requester: {
    id: string
    fullName: string | null
    avatarUrl: string | null
    department: string | null
  }
}

export interface GroupResource {
  id: string
  groupId: string
  uploadedBy: string | null
  title: string
  url: string
  category: 'notes' | 'syllabus' | 'past_papers' | 'assignments' | 'other'
  description: string | null
  clickCount: number
  createdAt: string
  uploader: { id: string; fullName: string | null; avatarUrl: string | null } | null
}

export interface StudySession {
  id: string
  groupId: string
  createdBy: string | null
  title: string
  description: string | null
  location: string | null
  isOnline: boolean
  onlineLink: string | null
  startsAt: string
  endsAt: string | null
  capacity: number | null
  rsvpCount: number
  ownRsvp: 'going' | 'not_going' | null
  creator: { id: string; fullName: string | null; avatarUrl: string | null } | null
}

export interface GroupStats {
  newMembersThisWeek: number
  postsThisWeek: number
  activeContributors: number
  pendingJoinRequests: number
  upcomingStudySessions: number
}

interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  hasMore: boolean
}

// ── Join requests ─────────────────────────────────────────────────────────────

export function useJoinRequests(groupId: string) {
  return useQuery({
    queryKey: ['groups', 'join-requests', { groupId }],
    queryFn: () =>
      api
        .get<{ data: PaginatedResponse<JoinRequest> }>(`/groups/${groupId}/join-requests`)
        .then((r) => r.data.data),
    enabled: !!groupId,
  })
}

export function useReviewJoinRequest(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ requestId, action }: { requestId: string; action: 'approve' | 'decline' }) =>
      api.patch(`/groups/${groupId}/join-requests/${requestId}`, { action }).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', 'join-requests', { groupId }] })
      queryClient.invalidateQueries({ queryKey: ['groups', 'detail', groupId] })
    },
  })
}

export function useCancelJoinRequest(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      api.delete(`/groups/${groupId}/join-requests/me`).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', 'join-requests', { groupId }] })
    },
  })
}

// ── Resources ─────────────────────────────────────────────────────────────────

export function useGroupResources(groupId: string, category?: string) {
  return useQuery({
    queryKey: ['groups', 'resources', { groupId, category }],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '50' })
      if (category) params.set('category', category)
      return api
        .get<{ data: PaginatedResponse<GroupResource> }>(`/groups/${groupId}/resources?${params}`)
        .then((r) => r.data.data)
    },
    enabled: !!groupId,
  })
}

export function useCreateResource(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { title: string; url: string; category: string; description?: string }) =>
      api.post(`/groups/${groupId}/resources`, input).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', 'resources', { groupId }] })
    },
  })
}

export function useDeleteResource(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (resourceId: string) =>
      api.delete(`/groups/${groupId}/resources/${resourceId}`).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', 'resources', { groupId }] })
    },
  })
}

export function useTrackResource(groupId: string) {
  return useMutation({
    mutationFn: (resourceId: string) =>
      api.patch(`/groups/${groupId}/resources/${resourceId}/track`).then((r) => r.data.data),
    // No cache invalidation — fire-and-forget side effect
  })
}

// ── Study sessions ────────────────────────────────────────────────────────────

export function useStudySessions(groupId: string) {
  return useQuery({
    queryKey: ['groups', 'study-sessions', { groupId }],
    queryFn: () =>
      api
        .get<{ data: PaginatedResponse<StudySession> }>(`/groups/${groupId}/study-sessions?limit=50`)
        .then((r) => r.data.data),
    enabled: !!groupId,
  })
}

export function useCreateStudySession(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      title: string
      description?: string
      location?: string
      is_online: boolean
      online_link?: string
      starts_at: string
      ends_at?: string
      capacity?: number
    }) => api.post(`/groups/${groupId}/study-sessions`, input).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', 'study-sessions', { groupId }] })
    },
  })
}

export function useRsvpStudySession(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ sessionId, status }: { sessionId: string; status: 'going' | 'not_going' }) =>
      api
        .post(`/groups/${groupId}/study-sessions/${sessionId}/rsvp`, { status })
        .then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', 'study-sessions', { groupId }] })
    },
  })
}

// ── Pinned + Rules ────────────────────────────────────────────────────────────

export function useSetPinned(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (text: string | null) =>
      api.patch(`/groups/${groupId}/pinned`, { text }).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', 'detail', groupId] })
    },
  })
}

export function useSetRules(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (content: string) =>
      api.patch(`/groups/${groupId}/rules`, { content }).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', 'detail', groupId] })
    },
  })
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export function useGroupStats(groupId: string) {
  return useQuery({
    queryKey: ['groups', 'stats', { groupId }],
    queryFn: () =>
      api.get<{ data: GroupStats }>(`/groups/${groupId}/stats`).then((r) => r.data.data),
    enabled: !!groupId,
  })
}
