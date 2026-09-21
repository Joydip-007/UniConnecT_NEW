import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import { StudyToolsTab } from './StudyToolsTab'

const mockUseStudySessions = vi.fn()
const mockUseCreateStudySession = vi.fn()
const mockUseRsvpStudySession = vi.fn()
const mockUseFlashcardDecks = vi.fn()
const mockUseCreateFlashcardDeck = vi.fn()
const mockUseUpdateFlashcardDeck = vi.fn()
const mockUseDeleteFlashcardDeck = vi.fn()
const mockUseFlashcards = vi.fn()
const mockUseCreateFlashcard = vi.fn()
const mockUseUpdateFlashcard = vi.fn()
const mockUseDeleteFlashcard = vi.fn()
const mockUseReviewQueue = vi.fn()
const mockUseReviewFlashcard = vi.fn()
const mockUseSharedNotes = vi.fn()
const mockUseCreateSharedNote = vi.fn()
const mockUseUpdateSharedNote = vi.fn()
const mockUseDeleteSharedNote = vi.fn()
const mockUseSessionCreatorNotes = vi.fn()
const mockUseSaveSessionCreatorNotes = vi.fn()
const mockUseMySessionPrivateNotes = vi.fn()
const mockUseSaveMySessionPrivateNotes = vi.fn()

vi.mock('@/features/groups', () => ({
  useStudySessions: () => mockUseStudySessions(),
  useCreateStudySession: () => mockUseCreateStudySession(),
  useRsvpStudySession: () => mockUseRsvpStudySession(),
}))

vi.mock('../hooks/useGroupExtended', () => ({
  useFlashcardDecks: () => mockUseFlashcardDecks(),
  useCreateFlashcardDeck: () => mockUseCreateFlashcardDeck(),
  useUpdateFlashcardDeck: () => mockUseUpdateFlashcardDeck(),
  useDeleteFlashcardDeck: () => mockUseDeleteFlashcardDeck(),
  useFlashcards: (_groupId: string, deckId: string) => mockUseFlashcards(deckId),
  useCreateFlashcard: () => mockUseCreateFlashcard(),
  useUpdateFlashcard: () => mockUseUpdateFlashcard(),
  useDeleteFlashcard: () => mockUseDeleteFlashcard(),
  useReviewQueue: (_groupId: string, deckId: string) => mockUseReviewQueue(deckId),
  useReviewFlashcard: () => mockUseReviewFlashcard(),
  useSharedNotes: () => mockUseSharedNotes(),
  useCreateSharedNote: () => mockUseCreateSharedNote(),
  useUpdateSharedNote: () => mockUseUpdateSharedNote(),
  useDeleteSharedNote: () => mockUseDeleteSharedNote(),
  useSessionCreatorNotes: () => mockUseSessionCreatorNotes(),
  useSaveSessionCreatorNotes: () => mockUseSaveSessionCreatorNotes(),
  useMySessionPrivateNotes: () => mockUseMySessionPrivateNotes(),
  useSaveMySessionPrivateNotes: () => mockUseSaveMySessionPrivateNotes(),
}))

function pendingMutation(mutate = vi.fn()) {
  return { mutate, isPending: false }
}

function renderStudyTools(userRole: 'owner' | 'admin' | 'moderator' | 'member' = 'member') {
  render(<StudyToolsTab groupId="group-1" currentUserId="user-1" userRole={userRole} />)
}

function deck(overrides = {}) {
  return {
    id: 'deck-1',
    groupId: 'group-1',
    createdBy: 'user-2',
    title: 'Midterm deck',
    description: 'Core concepts for week five.',
    isArchived: false,
    cardCount: 12,
    dueCount: 3,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    creator: null,
    ...overrides,
  }
}

function card(overrides = {}) {
  return {
    id: 'card-1',
    deckId: 'deck-1',
    groupId: 'group-1',
    createdBy: 'user-1',
    front: 'What is polymorphism?',
    back: 'One interface can represent many concrete forms.',
    hint: 'Object-oriented design',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    creator: null,
    review: null,
    ...overrides,
  }
}

function forbiddenError() {
  return new AxiosError(
    'Request failed with status code 403',
    'ERR_BAD_REQUEST',
    { headers: new AxiosHeaders() },
    {},
    {
      status: 403,
      statusText: 'Forbidden',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: { error: 'Forbidden', code: 'FORBIDDEN' },
    },
  )
}

describe('StudyToolsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseStudySessions.mockReturnValue({ data: { items: [], total: 0, page: 1, hasMore: false }, isLoading: false })
    mockUseCreateStudySession.mockReturnValue(pendingMutation())
    mockUseRsvpStudySession.mockReturnValue(pendingMutation())
    mockUseFlashcardDecks.mockReturnValue({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() })
    mockUseCreateFlashcardDeck.mockReturnValue(pendingMutation())
    mockUseUpdateFlashcardDeck.mockReturnValue(pendingMutation())
    mockUseDeleteFlashcardDeck.mockReturnValue(pendingMutation())
    mockUseFlashcards.mockReturnValue({ data: [], isLoading: false })
    mockUseCreateFlashcard.mockReturnValue(pendingMutation())
    mockUseUpdateFlashcard.mockReturnValue(pendingMutation())
    mockUseDeleteFlashcard.mockReturnValue(pendingMutation())
    mockUseReviewQueue.mockReturnValue({ data: { items: [], total: 0, page: 1, hasMore: false }, isLoading: false })
    mockUseReviewFlashcard.mockReturnValue(pendingMutation())
    mockUseSharedNotes.mockReturnValue({ data: { items: [], total: 0, page: 1, hasMore: false }, isLoading: false })
    mockUseCreateSharedNote.mockReturnValue(pendingMutation())
    mockUseUpdateSharedNote.mockReturnValue(pendingMutation())
    mockUseDeleteSharedNote.mockReturnValue(pendingMutation())
    mockUseSessionCreatorNotes.mockReturnValue({ data: null, isLoading: false })
    mockUseSaveSessionCreatorNotes.mockReturnValue({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false })
    mockUseMySessionPrivateNotes.mockReturnValue({ data: null, isLoading: false })
    mockUseSaveMySessionPrivateNotes.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
  })

  it('renders segmented controls for Sessions and Decks only — no Notes mode', () => {
    renderStudyTools()

    expect(screen.getByRole('tab', { name: 'Sessions' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Decks' })).toBeTruthy()
    expect(screen.queryByRole('tab', { name: 'Notes' })).not.toBeInTheDocument()
  })

  it('reaches shared notes from a Notes chip in the Sessions header', () => {
    renderStudyTools()

    expect(screen.queryByText('No shared notes yet')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^Notes$/i }))

    expect(screen.getByText('No shared notes yet')).toBeInTheDocument()
  })

  it('shows the empty decks state with a deck creation affordance', () => {
    renderStudyTools()

    fireEvent.click(screen.getByRole('tab', { name: 'Decks' }))

    expect(screen.getByText('No decks yet')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /New deck/i }).length).toBeGreaterThan(0)
  })

  it('reveals the answer and rating buttons in the review flow', () => {
    mockUseFlashcardDecks.mockReturnValue({
      data: [
        deck({ createdBy: 'user-1' }),
      ],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })
    mockUseReviewQueue.mockReturnValue({
      data: {
        items: [
          card(),
        ],
        total: 1,
        page: 1,
        hasMore: false,
      },
      isLoading: false,
    })

    renderStudyTools()

    fireEvent.click(screen.getByRole('tab', { name: 'Decks' }))
    fireEvent.click(screen.getByRole('button', { name: /Midterm deck/i }))

    expect(screen.getByText('What is polymorphism?')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Show answer/i }))

    expect(screen.getByText('One interface can represent many concrete forms.')).toBeTruthy()
    expect(screen.getByText('Hint: Object-oriented design')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Again' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Hard' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Good' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Easy' })).toBeTruthy()
  })

  it('moves to the next review card, then shows closure after rating the final card', () => {
    const reviewMutate = vi.fn((_input, options) => {
      options?.onSuccess?.({
        cardId: 'card-1',
        userId: 'user-1',
        groupId: 'group-1',
        easeFactor: 2.5,
        intervalDays: 0,
        repetitionCount: 1,
        dueAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        lastReviewedAt: '2026-07-05T00:00:00.000Z',
        lastRating: 'good',
        createdAt: '2026-07-05T00:00:00.000Z',
        updatedAt: '2026-07-05T00:00:00.000Z',
      })
    })
    mockUseFlashcardDecks.mockReturnValue({
      data: [deck()],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })
    mockUseReviewQueue.mockReturnValue({
      data: {
        items: [
          card({ id: 'card-1', front: 'First prompt', back: 'First answer' }),
          card({ id: 'card-2', front: 'Second prompt', back: 'Second answer' }),
        ],
        total: 2,
        page: 1,
        hasMore: false,
      },
      isLoading: false,
    })
    mockUseReviewFlashcard.mockReturnValue({ mutate: reviewMutate, isPending: false })

    renderStudyTools()

    fireEvent.click(screen.getByRole('tab', { name: 'Decks' }))
    fireEvent.click(screen.getByRole('button', { name: /Show answer/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Good' }))

    expect(screen.getByText(/Due in/)).toBeTruthy()
    expect(screen.getByText('Second prompt')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Show answer/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Easy' }))

    expect(screen.getByText('All reviewed for now')).toBeTruthy()
    expect(screen.queryByText('Second prompt')).toBeNull()
  })

  it('shows card edit and delete affordances for allowed users', () => {
    const updateMutate = vi.fn()
    const deleteMutate = vi.fn()
    mockUseFlashcardDecks.mockReturnValue({
      data: [deck()],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })
    mockUseFlashcards.mockReturnValue({ data: [card()], isLoading: false })
    mockUseUpdateFlashcard.mockReturnValue({ mutate: updateMutate, isPending: false })
    mockUseDeleteFlashcard.mockReturnValue({ mutate: deleteMutate, isPending: false })

    renderStudyTools()

    fireEvent.click(screen.getByRole('tab', { name: 'Decks' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit card What is polymorphism?' }))
    fireEvent.change(screen.getByPlaceholderText('Front'), { target: { value: 'Updated prompt' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(updateMutate).toHaveBeenCalledWith(
      { cardId: 'card-1', input: { front: 'Updated prompt', back: 'One interface can represent many concrete forms.', hint: 'Object-oriented design' } },
      expect.any(Object),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete card What is polymorphism?' }))

    expect(deleteMutate).toHaveBeenCalledWith('card-1')
  })

  it('shows a deck error state with retry for a non-403 failure', () => {
    const refetch = vi.fn()
    mockUseFlashcardDecks.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('network down'),
      refetch,
    })

    renderStudyTools()

    fireEvent.click(screen.getByRole('tab', { name: 'Decks' }))

    expect(screen.getByText('Could not load decks.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(refetch).toHaveBeenCalled()
  })
})

describe('StudyToolsTab — decks locked by the API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseStudySessions.mockReturnValue({ data: { items: [], total: 0, page: 1, hasMore: false }, isLoading: false })
    mockUseCreateStudySession.mockReturnValue(pendingMutation())
    mockUseRsvpStudySession.mockReturnValue(pendingMutation())
    mockUseCreateFlashcardDeck.mockReturnValue(pendingMutation())
    mockUseUpdateFlashcardDeck.mockReturnValue(pendingMutation())
    mockUseDeleteFlashcardDeck.mockReturnValue(pendingMutation())
    mockUseFlashcards.mockReturnValue({ data: [], isLoading: false })
    mockUseCreateFlashcard.mockReturnValue(pendingMutation())
    mockUseUpdateFlashcard.mockReturnValue(pendingMutation())
    mockUseDeleteFlashcard.mockReturnValue(pendingMutation())
    mockUseReviewQueue.mockReturnValue({ data: { items: [], total: 0, page: 1, hasMore: false }, isLoading: false })
    mockUseReviewFlashcard.mockReturnValue(pendingMutation())
    mockUseSharedNotes.mockReturnValue({ data: { items: [], total: 0, page: 1, hasMore: false }, isLoading: false })
    mockUseCreateSharedNote.mockReturnValue(pendingMutation())
    mockUseUpdateSharedNote.mockReturnValue(pendingMutation())
    mockUseDeleteSharedNote.mockReturnValue(pendingMutation())
    mockUseSessionCreatorNotes.mockReturnValue({ data: null, isLoading: false })
    mockUseSaveSessionCreatorNotes.mockReturnValue({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false })
    mockUseMySessionPrivateNotes.mockReturnValue({ data: null, isLoading: false })
    mockUseSaveMySessionPrivateNotes.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
  })

  it('shows the locked-decks notice when useFlashcardDecks 403s, regardless of group type', () => {
    mockUseFlashcardDecks.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: forbiddenError(), refetch: vi.fn() })

    renderStudyTools('member')

    fireEvent.click(screen.getByRole('tab', { name: 'Decks' }))

    expect(screen.getByText(/Flashcard decks are available in academic groups/i)).toBeInTheDocument()
    expect(screen.getByText('Sessions still work here.')).toBeInTheDocument()
  })

  it('shows StudyDecksPanel normally when the decks query succeeds', () => {
    mockUseFlashcardDecks.mockReturnValue({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() })

    renderStudyTools('member')

    fireEvent.click(screen.getByRole('tab', { name: 'Decks' }))

    expect(screen.queryByText(/Flashcard decks are available in academic groups/i)).not.toBeInTheDocument()
    expect(screen.getByText('No decks yet')).toBeInTheDocument()
  })
})
