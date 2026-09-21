import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/axios'
import type { FeedPost } from '@uniconnect/shared'
import type {
  AcademicModule,
  Assignment,
  Attachment,
  CourseOutline,
  CourseOutlineInput,
  FileUrlEntry,
  Flashcard,
  FlashcardDeck,
  FlashcardReviewItem,
  FlashcardReviewResult,
  Gradebook,
  GradebookEntryInput,
  Group,
  GroupMember,
  MemberRole,
  MyGradeCard,
  ReviewRating,
  SessionNotes,
  SharedNote,
  Submission,
} from '../types'

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
  members: number
  active30d: number
  resources: number
  upcomingEvents: number
}

export interface ReviewSummary {
  pendingPosts: number
  pendingEvents: number
  pendingJoinRequests: number
  reportsOpen: number
}

export interface GroupAnalytics {
  members: number
  membersDelta7d: number
  posts30d: number
  postsDeltaPct: number | null
  activePct: number
  reportsOpen: number
  postsPerWeek: { label: string; count: number }[]
  topMembers: { id: string; fullName: string | null; avatarUrl: string | null; posts: number; replies: number }[]
}

export type ModLogKind = 'post' | 'member' | 'settings'

export interface ModLogEntry {
  id: string
  kind: ModLogKind
  action: string
  target: string
  createdAt: string
  actor: { id: string; fullName: string | null } | null
}

export interface GroupSettingsPatch {
  is_private?: boolean
  require_post_approval?: boolean
  require_event_approval?: boolean
}

interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  hasMore: boolean
}

type CreateFlashcardDeckInput = {
  title: string
  description?: string | null
}

type UpdateFlashcardDeckInput = Partial<CreateFlashcardDeckInput> & {
  is_archived?: boolean
}

type CreateFlashcardInput = {
  front: string
  back: string
  hint?: string | null
}

type UpdateFlashcardInput = Partial<CreateFlashcardInput>

type CreateSharedNoteInput = {
  title: string
  body: string
  attachments?: Attachment[]
}

type UpdateSharedNoteInput = Partial<CreateSharedNoteInput>

interface NoteUploadUrlResponse {
  uploadUrl: string
  publicUrl: string
  maxSizeBytes: number
}

const flashcardDecksKey = (groupId: string) => ['groups', 'flashcard-decks', { groupId }] as const
const flashcardsKey = (groupId: string, deckId: string) =>
  ['groups', 'flashcards', { groupId, deckId }] as const
const flashcardReviewKey = (groupId: string, deckId: string) =>
  ['groups', 'flashcard-review', { groupId, deckId }] as const
const sharedNotesKey = (groupId: string) => ['groups', 'shared-notes', { groupId }] as const

// ── Join requests ─────────────────────────────────────────────────────────────

/**
 * Admin-only endpoint — pass `enabled: false` for non-admins, otherwise every
 * plain member's group page fires a request that 403s.
 */
export function useJoinRequests(groupId: string, enabled = true) {
  return useQuery({
    queryKey: ['groups', 'join-requests', { groupId }],
    queryFn: () =>
      api
        .get<{ data: PaginatedResponse<JoinRequest> }>(`/groups/${groupId}/join-requests`)
        .then((r) => r.data.data),
    enabled: !!groupId && enabled,
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

// ── Manage card (right rail) ─────────────────────────────────────────────────

export const reviewSummaryKey = (groupId: string) => ['groups', 'review-summary', { groupId }] as const

/** Moderator+ only — gate with `enabled` so a member never 403s on every page. */
export function useReviewSummary(groupId: string, enabled = true) {
  return useQuery({
    queryKey: reviewSummaryKey(groupId),
    queryFn: () =>
      api.get<{ data: ReviewSummary }>(`/groups/${groupId}/review/summary`).then((r) => r.data.data),
    enabled: !!groupId && enabled,
    staleTime: 60_000,
  })
}

// ── Post review queue (Feed tab) ─────────────────────────────────────────────

export const pendingPostsKey = (groupId: string) => ['groups', 'pending-posts', { groupId }] as const

/** Moderator+ only — gate with `enabled` so a member never 403s on the group's own feed tab. */
export function usePendingPosts(groupId: string, enabled = true) {
  return useQuery({
    queryKey: pendingPostsKey(groupId),
    queryFn: () =>
      api
        .get<{ data: { items: FeedPost[] } }>(`/groups/${groupId}/review/posts`)
        .then((r) => r.data.data.items),
    enabled: !!groupId && enabled,
  })
}

export function useReviewPost(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ postId, action }: { postId: string; action: 'approve' | 'decline' }) =>
      api.patch(`/groups/${groupId}/review/posts/${postId}`, { action }).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pendingPostsKey(groupId) })
      queryClient.invalidateQueries({ queryKey: reviewSummaryKey(groupId) })
      queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'posts'] })
    },
  })
}

export function useUpdateGroupSettings(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: GroupSettingsPatch) =>
      api.patch<{ data: Group }>(`/groups/${groupId}/settings`, patch).then((r) => r.data.data),
    onSuccess: (group) => {
      queryClient.setQueryData(['groups', 'detail', groupId], group)
      queryClient.invalidateQueries({ queryKey: ['groups', 'detail', groupId] })
    },
  })
}

export function useDeleteGroup(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.delete<{ data: { deleted: true } }>(`/groups/${groupId}`).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['groups', 'detail', groupId] })
      queryClient.invalidateQueries({ queryKey: ['groups', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['groups', 'my'] })
    },
  })
}

export function useGroupAnalytics(groupId: string, enabled = true) {
  return useQuery({
    queryKey: ['groups', 'analytics', { groupId }],
    queryFn: () =>
      api.get<{ data: GroupAnalytics }>(`/groups/${groupId}/analytics`).then((r) => r.data.data),
    enabled: !!groupId && enabled,
    staleTime: 60_000,
  })
}

export function useModerationLog(groupId: string, kind: ModLogKind | 'all', enabled = true) {
  return useQuery({
    queryKey: ['groups', 'moderation-log', { groupId, kind }],
    queryFn: () =>
      api
        .get<{ data: PaginatedResponse<ModLogEntry> }>(`/groups/${groupId}/moderation-log`, {
          params: { kind, limit: 50 },
        })
        .then((r) => r.data.data),
    enabled: !!groupId && enabled,
    staleTime: 60_000,
  })
}

export function useGroupSuggestions(limit = 4, enabled = true) {
  return useQuery({
    queryKey: ['groups', 'suggestions', { limit }],
    queryFn: () =>
      api
        .get<{ data: { items: Group[] } }>('/groups/suggestions', { params: { limit } })
        .then((r) => r.data.data.items),
    enabled,
    staleTime: 60_000,
  })
}

export function useUpdateGroupDescription(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (description: string) =>
      api.patch<{ data: Group }>(`/groups/${groupId}`, { description }).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', 'detail', groupId] })
    },
  })
}

/**
 * Join (or request to join) / leave a group. Shared by `GroupCard` and the right-rail
 * suggestions so both surfaces invalidate the same caches and toast the same copy.
 */
export function useToggleGroupMembership(group: Pick<Group, 'id' | 'isMember'>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      group.isMember
        ? api.delete(`/groups/${group.id}/members/me`).then((r) => r.data)
        : api.post<{ data: { requested?: boolean } }>(`/groups/${group.id}/members`).then((r) => r.data.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['groups', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['groups', 'my'] })
      queryClient.invalidateQueries({ queryKey: ['groups', 'suggestions'] })
      queryClient.invalidateQueries({ queryKey: ['groups', 'detail', group.id] })
      if (group.isMember) {
        toast.success('Left group')
      } else if (data && 'requested' in data && data.requested) {
        toast.success('Join request sent')
      } else {
        toast.success('Joined group')
      }
    },
    onError: (error: unknown) => {
      const message =
        typeof error === 'object' && error && 'response' in error
          ? ((error as { response?: { data?: { error?: string } } }).response?.data?.error ?? null)
          : null
      toast.error(message ?? (group.isMember ? 'Failed to leave group' : 'Failed to join group'))
    },
  })
}

// ── Flashcards ───────────────────────────────────────────────────────────────

export function useFlashcardDecks(groupId: string) {
  return useQuery({
    queryKey: flashcardDecksKey(groupId),
    queryFn: () =>
      api.get<{ data: FlashcardDeck[] }>(`/groups/${groupId}/flashcard-decks`).then((r) => r.data.data),
    enabled: !!groupId,
  })
}

export function useCreateFlashcardDeck(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateFlashcardDeckInput) =>
      api.post<{ data: FlashcardDeck }>(`/groups/${groupId}/flashcard-decks`, input).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: flashcardDecksKey(groupId) })
    },
  })
}

export function useUpdateFlashcardDeck(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ deckId, input }: { deckId: string; input: UpdateFlashcardDeckInput }) =>
      api.patch<{ data: FlashcardDeck }>(`/groups/${groupId}/flashcard-decks/${deckId}`, input).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: flashcardDecksKey(groupId) })
    },
  })
}

export function useDeleteFlashcardDeck(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (deckId: string) =>
      api.delete<{ data: { deleted: true } }>(`/groups/${groupId}/flashcard-decks/${deckId}`).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: flashcardDecksKey(groupId) })
    },
  })
}

export function useFlashcards(groupId: string, deckId: string) {
  return useQuery({
    queryKey: flashcardsKey(groupId, deckId),
    queryFn: () =>
      api
        .get<{ data: Flashcard[] }>(`/groups/${groupId}/flashcard-decks/${deckId}/cards`)
        .then((r) => r.data.data),
    enabled: !!groupId && !!deckId,
  })
}

function useInvalidateFlashcards(groupId: string, deckId: string) {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: flashcardsKey(groupId, deckId) })
    queryClient.invalidateQueries({ queryKey: flashcardDecksKey(groupId) })
    queryClient.invalidateQueries({ queryKey: flashcardReviewKey(groupId, deckId) })
  }
}

export function useCreateFlashcard(groupId: string, deckId: string) {
  const invalidateFlashcards = useInvalidateFlashcards(groupId, deckId)
  return useMutation({
    mutationFn: (input: CreateFlashcardInput) =>
      api
        .post<{ data: Flashcard }>(`/groups/${groupId}/flashcard-decks/${deckId}/cards`, input)
        .then((r) => r.data.data),
    onSuccess: invalidateFlashcards,
  })
}

export function useUpdateFlashcard(groupId: string, deckId: string) {
  const invalidateFlashcards = useInvalidateFlashcards(groupId, deckId)
  return useMutation({
    mutationFn: ({ cardId, input }: { cardId: string; input: UpdateFlashcardInput }) =>
      api.patch<{ data: Flashcard }>(`/groups/${groupId}/flashcards/${cardId}`, input).then((r) => r.data.data),
    onSuccess: invalidateFlashcards,
  })
}

export function useDeleteFlashcard(groupId: string, deckId: string) {
  const invalidateFlashcards = useInvalidateFlashcards(groupId, deckId)
  return useMutation({
    mutationFn: (cardId: string) =>
      api.delete<{ data: { deleted: true } }>(`/groups/${groupId}/flashcards/${cardId}`).then((r) => r.data.data),
    onSuccess: invalidateFlashcards,
  })
}

export function useReviewQueue(groupId: string, deckId: string) {
  return useQuery({
    queryKey: flashcardReviewKey(groupId, deckId),
    queryFn: () =>
      api
        .get<{ data: PaginatedResponse<FlashcardReviewItem> }>(
          `/groups/${groupId}/flashcard-decks/${deckId}/review?limit=50`,
        )
        .then((r) => r.data.data),
    enabled: !!groupId && !!deckId,
  })
}

export function useReviewFlashcard(groupId: string, deckId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ cardId, rating }: { cardId: string; rating: ReviewRating }) =>
      api
        .post<{ data: FlashcardReviewResult }>(`/groups/${groupId}/flashcards/${cardId}/review`, { rating })
        .then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: flashcardReviewKey(groupId, deckId) })
      queryClient.invalidateQueries({ queryKey: flashcardDecksKey(groupId) })
      queryClient.invalidateQueries({ queryKey: flashcardsKey(groupId, deckId) })
    },
  })
}

// ── Shared notes ─────────────────────────────────────────────────────────────

export function useSharedNotes(groupId: string) {
  return useQuery({
    queryKey: sharedNotesKey(groupId),
    queryFn: () =>
      api.get<{ data: PaginatedResponse<SharedNote> }>(`/groups/${groupId}/shared-notes?limit=50`).then((r) => r.data.data),
    enabled: !!groupId,
  })
}

export function useCreateSharedNote(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateSharedNoteInput) =>
      api.post<{ data: SharedNote }>(`/groups/${groupId}/shared-notes`, input).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sharedNotesKey(groupId) })
    },
  })
}

export function useUpdateSharedNote(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ noteId, input }: { noteId: string; input: UpdateSharedNoteInput }) =>
      api.patch<{ data: SharedNote }>(`/groups/${groupId}/shared-notes/${noteId}`, input).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sharedNotesKey(groupId) })
    },
  })
}

export function useDeleteSharedNote(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (noteId: string) =>
      api.delete<{ data: { deleted: true } }>(`/groups/${groupId}/shared-notes/${noteId}`).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sharedNotesKey(groupId) })
    },
  })
}

export function useSharedNoteUpload(groupId: string) {
  return useMutation({
    mutationFn: async (file: File): Promise<Attachment> => {
      const { data } = await api.post<{ data: NoteUploadUrlResponse }>(
        `/groups/${groupId}/shared-notes/upload-url`,
        { fileName: file.name, contentType: file.type },
      )
      const { uploadUrl, publicUrl, maxSizeBytes } = data.data
      if (file.size > maxSizeBytes) {
        throw new Error('File exceeds the 25MB limit')
      }
      const s3Res = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })
      if (!s3Res.ok) throw new Error(`Upload failed: ${s3Res.status}`)
      return { name: file.name, url: publicUrl, contentType: file.type, size: file.size }
    },
  })
}

// ── Course outline ───────────────────────────────────────────────────────────

const courseOutlineKey = (groupId: string) => ['groups', 'course-outline', { groupId }] as const

export function useCourseOutline(groupId: string) {
  return useQuery({
    queryKey: courseOutlineKey(groupId),
    queryFn: () =>
      api.get<{ data: CourseOutline | null }>(`/groups/${groupId}/course-outline`).then((r) => r.data.data),
    enabled: !!groupId,
  })
}

export function useSaveCourseOutline(groupId: string, mode: 'create' | 'replace') {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CourseOutlineInput) =>
      mode === 'create'
        ? api.post<{ data: CourseOutline }>(`/groups/${groupId}/course-outline`, input).then((r) => r.data.data)
        : api.put<{ data: CourseOutline }>(`/groups/${groupId}/course-outline`, input).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: courseOutlineKey(groupId) })
    },
  })
}

// ── Gradebook ────────────────────────────────────────────────────────────────

const gradebookKey = (groupId: string) => ['groups', 'gradebook', { groupId }] as const
const myGradeCardKey = (groupId: string) => ['groups', 'gradebook', 'me', { groupId }] as const

export function useGradebook(groupId: string) {
  return useQuery({
    queryKey: gradebookKey(groupId),
    queryFn: () => api.get<{ data: Gradebook }>(`/groups/${groupId}/gradebook`).then((r) => r.data.data),
    enabled: !!groupId,
  })
}

export function useUpsertGradebookEntries(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (entries: GradebookEntryInput[]) =>
      api.put<{ data: { updated: number } }>(`/groups/${groupId}/gradebook/entries`, { entries }).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gradebookKey(groupId) })
    },
  })
}

export function useMyGradeCard(groupId: string) {
  return useQuery({
    queryKey: myGradeCardKey(groupId),
    queryFn: () => api.get<{ data: MyGradeCard }>(`/groups/${groupId}/gradebook/me`).then((r) => r.data.data),
    enabled: !!groupId,
  })
}

// ── Modules ──────────────────────────────────────────────────────────────────

type CreateModuleInput = {
  title: string
  description?: string
  weekNumber?: number
  displayOrder?: number
  fileUrls?: FileUrlEntry[]
}

interface ModuleUploadUrlResponse {
  uploadUrl: string
  publicUrl: string
  maxSizeBytes: number
}

const modulesKey = (groupId: string) => ['groups', 'modules', { groupId }] as const

export function useModules(groupId: string) {
  return useQuery({
    queryKey: modulesKey(groupId),
    queryFn: () => api.get<{ data: AcademicModule[] }>(`/groups/${groupId}/modules`).then((r) => r.data.data),
    enabled: !!groupId,
  })
}

export function useCreateModule(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateModuleInput) =>
      api.post<{ data: AcademicModule }>(`/groups/${groupId}/modules`, input).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: modulesKey(groupId) })
    },
  })
}

export function useModuleUpload(groupId: string) {
  return useMutation({
    mutationFn: async (file: File): Promise<FileUrlEntry> => {
      const { data } = await api.post<{ data: ModuleUploadUrlResponse }>(
        `/groups/${groupId}/modules/upload-url`,
        { fileName: file.name, contentType: file.type },
      )
      const { uploadUrl, publicUrl, maxSizeBytes } = data.data
      if (file.size > maxSizeBytes) {
        throw new Error('File exceeds the 25MB limit')
      }
      const s3Res = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })
      if (!s3Res.ok) throw new Error(`Upload failed: ${s3Res.status}`)
      return { name: file.name, url: publicUrl, contentType: file.type, size: file.size }
    },
  })
}

export function useTogglePublishModule(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (moduleId: string) =>
      api.patch<{ data: AcademicModule }>(`/groups/${groupId}/modules/${moduleId}/publish`).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: modulesKey(groupId) })
    },
  })
}

export function useReorderModules(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (order: string[]) =>
      api.patch<{ data: { updated: number } }>(`/groups/${groupId}/modules/reorder`, { order }).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: modulesKey(groupId) })
    },
  })
}

// ── Assignments ──────────────────────────────────────────────────────────────

type CreateAssignmentInput = {
  title: string
  description?: string
  moduleId?: string
  fileUrls?: Assignment['fileUrls']
  deadline?: string
  maxScore: number
}

type SubmitAssignmentInput = {
  fileUrls?: Submission['fileUrls']
  textContent?: string
}

const assignmentsKey = (groupId: string) => ['groups', 'assignments', { groupId }] as const
const submissionsKey = (groupId: string, assignmentId: string) =>
  ['groups', 'assignments', 'submissions', { groupId, assignmentId }] as const

export function useAssignments(groupId: string) {
  return useQuery({
    queryKey: assignmentsKey(groupId),
    queryFn: () => api.get<{ data: Assignment[] }>(`/groups/${groupId}/assignments`).then((r) => r.data.data),
    enabled: !!groupId,
  })
}

export function useCreateAssignment(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateAssignmentInput) =>
      api.post<{ data: Assignment }>(`/groups/${groupId}/assignments`, input).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assignmentsKey(groupId) })
    },
  })
}

export function useSubmitAssignment(groupId: string, assignmentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SubmitAssignmentInput) =>
      api.post<{ data: Submission }>(`/groups/${groupId}/assignments/${assignmentId}/submit`, input).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assignmentsKey(groupId) })
      queryClient.invalidateQueries({ queryKey: submissionsKey(groupId, assignmentId) })
    },
  })
}

export function useSubmissions(groupId: string, assignmentId: string) {
  return useQuery({
    queryKey: submissionsKey(groupId, assignmentId),
    queryFn: () =>
      api
        .get<{ data: Submission[] }>(`/groups/${groupId}/assignments/${assignmentId}/submissions`)
        .then((r) => r.data.data),
    enabled: !!groupId && !!assignmentId,
  })
}

// ── AI settings ──────────────────────────────────────────────────────────────

export interface GroupAISettings {
  ai_flashcards_enabled: boolean
  ai_quiz_enabled: boolean
  require_approval: boolean
  subject?: string
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  question_style?: 'mcq' | 'true_false' | 'short_answer' | 'mixed'
  language: 'en' | 'bn'
  custom_instructions?: string
  items_per_run: number
  frequency: 'daily' | 'weekly'
  run_hour: number
  run_weekday?: number
}

export interface PendingAiContentItem {
  id: string
  type: 'flashcard_deck' | 'quiz'
  title?: string
  content?: unknown
  createdAt?: string
}

type UpdateAiSettingsInput = Partial<GroupAISettings>

const aiSettingsKey = (groupId: string) => ['groups', 'ai-settings', { groupId }] as const
const aiSettingsMutationKey = (groupId: string) => ['groups', 'ai-settings', 'update', { groupId }] as const
const pendingAiContentKey = (groupId: string) => ['groups', 'ai-settings', 'pending', { groupId }] as const

export function useAiSettings(groupId: string) {
  return useQuery({
    queryKey: aiSettingsKey(groupId),
    queryFn: () =>
      api
        .get<{ data: { aiSettings: GroupAISettings } }>(`/groups/${groupId}/ai-settings`)
        .then((r) => r.data.data.aiSettings),
    enabled: !!groupId,
  })
}

/**
 * Every control in the AI settings panel PATCHes only its own field, and the server
 * merges it atomically. The cache still has to cooperate on two counts:
 *
 * 1. The inputs are controlled by this query, so without an optimistic update a click
 *    visibly snaps back until the refetch lands.
 * 2. Toggling a second control while the first is still in flight used to let the
 *    first one's refetch — a snapshot taken before the second write committed —
 *    overwrite the second change, so that checkbox appeared to switch itself off.
 *
 * So: apply the patch optimistically, roll back on error, and reconcile with the
 * server only once the LAST in-flight write settles.
 */
export function useUpdateAiSettings(groupId: string) {
  const queryClient = useQueryClient()
  const mutationKey = aiSettingsMutationKey(groupId)
  return useMutation({
    mutationKey,
    mutationFn: (patch: UpdateAiSettingsInput) =>
      api
        .patch<{ data: { aiSettings: GroupAISettings } }>(`/groups/${groupId}/ai-settings`, patch)
        .then((r) => r.data.data.aiSettings),
    onMutate: async (patch: UpdateAiSettingsInput) => {
      // Stop an in-flight refetch from landing on top of the optimistic value.
      await queryClient.cancelQueries({ queryKey: aiSettingsKey(groupId) })
      const previous = queryClient.getQueryData<GroupAISettings>(aiSettingsKey(groupId))
      if (previous) {
        queryClient.setQueryData<GroupAISettings>(aiSettingsKey(groupId), { ...previous, ...patch })
      }
      return { previous }
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) {
        queryClient.setQueryData<GroupAISettings>(aiSettingsKey(groupId), context.previous)
      }
    },
    onSettled: () => {
      // Counts this mutation too, so 1 means it is the last one finishing. Refetching
      // any earlier would race the writes that are still open.
      if (queryClient.isMutating({ mutationKey }) === 1) {
        queryClient.invalidateQueries({ queryKey: aiSettingsKey(groupId) })
      }
    },
  })
}

export function usePendingAiContent(groupId: string) {
  return useQuery({
    queryKey: pendingAiContentKey(groupId),
    queryFn: () =>
      api
        .get<{ data: PendingAiContentItem[] }>(`/groups/${groupId}/ai-settings/pending`)
        .then((r) => r.data.data),
    enabled: !!groupId,
  })
}

export function useApprovePendingAiContent(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (contentId: string) =>
      api
        .post<{ data: { approved: true } }>(`/groups/${groupId}/ai-settings/pending/${contentId}/approve`)
        .then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pendingAiContentKey(groupId) })
    },
  })
}

export function useDiscardPendingAiContent(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (contentId: string) =>
      api
        .delete<{ data: { discarded: true } }>(`/groups/${groupId}/ai-settings/pending/${contentId}`)
        .then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pendingAiContentKey(groupId) })
    },
  })
}

// ── Session notes (creator + private) ───────────────────────────────────────

type SaveSessionNotesInput = { title?: string; body?: string; attachments?: Attachment[] }

const sessionCreatorNotesKey = (groupId: string, sessionId: string) =>
  ['groups', 'session-notes', 'creator', { groupId, sessionId }] as const
const sessionPrivateNotesKey = (groupId: string, sessionId: string) =>
  ['groups', 'session-notes', 'private', { groupId, sessionId }] as const

export function useSessionCreatorNotes(groupId: string, sessionId: string) {
  return useQuery({
    queryKey: sessionCreatorNotesKey(groupId, sessionId),
    queryFn: () =>
      api
        .get<{ data: SessionNotes | null }>(`/groups/${groupId}/study-sessions/${sessionId}/notes/creator`)
        .then((r) => r.data.data),
    enabled: !!groupId && !!sessionId,
  })
}

export function useSaveSessionCreatorNotes(groupId: string, sessionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SaveSessionNotesInput) =>
      api
        .put<{ data: SessionNotes }>(`/groups/${groupId}/study-sessions/${sessionId}/notes/creator`, input)
        .then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionCreatorNotesKey(groupId, sessionId) })
    },
  })
}

export function useMySessionPrivateNotes(groupId: string, sessionId: string) {
  return useQuery({
    queryKey: sessionPrivateNotesKey(groupId, sessionId),
    queryFn: () =>
      api
        .get<{ data: SessionNotes | null }>(`/groups/${groupId}/study-sessions/${sessionId}/notes/private`)
        .then((r) => r.data.data),
    enabled: !!groupId && !!sessionId,
  })
}

export function useSaveMySessionPrivateNotes(groupId: string, sessionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SaveSessionNotesInput) =>
      api
        .put<{ data: SessionNotes }>(`/groups/${groupId}/study-sessions/${sessionId}/notes/private`, input)
        .then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionPrivateNotesKey(groupId, sessionId) })
    },
  })
}

export function useGradeSubmission(groupId: string, assignmentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ submissionId, score, feedback }: { submissionId: string; score: number; feedback?: string }) =>
      api
        .patch<{ data: Submission }>(`/groups/${groupId}/assignments/${assignmentId}/submissions/${submissionId}/grade`, {
          score,
          feedback,
        })
        .then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: submissionsKey(groupId, assignmentId) })
    },
  })
}

/** "Your groups" list for the group-detail left rail. */
export function useMyGroups() {
  return useQuery({
    queryKey: ['groups', 'my'],
    queryFn: () =>
      api.get<{ data: PaginatedResponse<Group> }>('/groups/my?limit=20').then((r) => r.data.data),
    staleTime: 60_000,
  })
}

// ── Members (header face stack + Members panel) ───────────────────────────────

export interface MembersFilters {
  search?: string
  role?: MemberRole
}

const membersKey = (groupId: string, filters: MembersFilters, limit: number) =>
  ['groups', 'members', { groupId, search: filters.search ?? '', role: filters.role ?? '', limit }] as const

/**
 * First page of a group's members. The header's face stack reads it with `limit: 5`;
 * the Members panel reads it with the default page size and its own search/role.
 */
export function useGroupMembers(groupId: string, filters: MembersFilters = {}, limit = 20) {
  return useQuery({
    queryKey: membersKey(groupId, filters, limit),
    queryFn: () =>
      api
        .get<{ data: PaginatedResponse<GroupMember> }>(`/groups/${groupId}/members`, {
          params: {
            page: 1,
            limit,
            ...(filters.search ? { search: filters.search } : {}),
            ...(filters.role ? { role: filters.role } : {}),
          },
        })
        .then((r) => r.data.data),
    enabled: !!groupId,
    staleTime: 60_000,
  })
}

function invalidateMembers(queryClient: ReturnType<typeof useQueryClient>, groupId: string) {
  // Matches every `['groups','members',{ groupId, … }]` key regardless of filters.
  queryClient.invalidateQueries({
    predicate: (q) => {
      const [a, b, c] = q.queryKey as [unknown, unknown, { groupId?: string } | undefined]
      return a === 'groups' && b === 'members' && c?.groupId === groupId
    },
  })
  queryClient.invalidateQueries({ queryKey: ['groups', 'detail', groupId] })
}

export function useUpdateMemberRole(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Exclude<MemberRole, 'owner'> }) =>
      api.patch(`/groups/${groupId}/members/${userId}`, { role }).then((r) => r.data.data),
    onSuccess: () => invalidateMembers(queryClient, groupId),
  })
}

export function useRemoveMember(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => api.delete(`/groups/${groupId}/members/${userId}`).then((r) => r.data.data),
    onSuccess: () => invalidateMembers(queryClient, groupId),
  })
}

/** `POST /groups/:id/chat` — creates or returns the academic group conversation. */
export function useOpenGroupChat(groupId: string) {
  return useMutation({
    mutationFn: () =>
      api.post<{ data: { conversationId: string } }>(`/groups/${groupId}/chat`).then((r) => r.data.data),
  })
}

export type InviteRole = Exclude<MemberRole, 'owner'>

/** One `POST /groups/:id/invitations` per user; resolves with how many failed. */
export function useInviteToGroup(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userIds, role }: { userIds: string[]; role: InviteRole }) => {
      const results = await Promise.allSettled(
        userIds.map((userId) => api.post(`/groups/${groupId}/invitations`, { userId, role })),
      )
      const failed = results.filter((r) => r.status === 'rejected').length
      return { total: userIds.length, sent: userIds.length - failed, failed }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', 'pending-invites', groupId] })
    },
  })
}
