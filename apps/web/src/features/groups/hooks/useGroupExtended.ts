import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type {
  AcademicModule,
  Assignment,
  CourseOutline,
  CourseOutlineInput,
  Flashcard,
  FlashcardDeck,
  FlashcardReviewItem,
  FlashcardReviewResult,
  Gradebook,
  GradebookEntryInput,
  MyGradeCard,
  ReviewRating,
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
}

type UpdateSharedNoteInput = Partial<CreateSharedNoteInput>

const flashcardDecksKey = (groupId: string) => ['groups', 'flashcard-decks', { groupId }] as const
const flashcardsKey = (groupId: string, deckId: string) =>
  ['groups', 'flashcards', { groupId, deckId }] as const
const flashcardReviewKey = (groupId: string, deckId: string) =>
  ['groups', 'flashcard-review', { groupId, deckId }] as const
const sharedNotesKey = (groupId: string) => ['groups', 'shared-notes', { groupId }] as const

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
