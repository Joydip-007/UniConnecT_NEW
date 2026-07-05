import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

describe('StudyToolsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseStudySessions.mockReturnValue({ data: { items: [], total: 0, page: 1, hasMore: false }, isLoading: false })
    mockUseCreateStudySession.mockReturnValue(pendingMutation())
    mockUseRsvpStudySession.mockReturnValue(pendingMutation())
    mockUseFlashcardDecks.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: vi.fn() })
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
  })

  it('renders segmented controls for study tools', () => {
    renderStudyTools()

    expect(screen.getByRole('tab', { name: 'Sessions' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Decks' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Notes' })).toBeTruthy()
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

  it('shows the empty notes state with a note creation affordance', () => {
    renderStudyTools()

    fireEvent.click(screen.getByRole('tab', { name: 'Notes' }))

    expect(screen.getByText('No shared notes yet')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /New note/i }).length).toBeGreaterThan(0)
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

  it('shows a deck error state with retry', () => {
    const refetch = vi.fn()
    mockUseFlashcardDecks.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch })

    renderStudyTools()

    fireEvent.click(screen.getByRole('tab', { name: 'Decks' }))

    expect(screen.getByText('Could not load decks.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(refetch).toHaveBeenCalled()
  })
})
