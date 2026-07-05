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

function pendingMutation() {
  return { mutate: vi.fn(), isPending: false }
}

function renderStudyTools() {
  render(<StudyToolsTab groupId="group-1" currentUserId="user-1" userRole="member" />)
}

describe('StudyToolsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseStudySessions.mockReturnValue({ data: { items: [], total: 0, page: 1, hasMore: false }, isLoading: false })
    mockUseCreateStudySession.mockReturnValue(pendingMutation())
    mockUseRsvpStudySession.mockReturnValue(pendingMutation())
    mockUseFlashcardDecks.mockReturnValue({ data: [], isLoading: false })
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
        {
          id: 'deck-1',
          groupId: 'group-1',
          createdBy: 'user-1',
          title: 'Midterm deck',
          description: 'Core concepts for week five.',
          isArchived: false,
          cardCount: 12,
          dueCount: 3,
          createdAt: '2026-07-01T00:00:00.000Z',
          updatedAt: '2026-07-01T00:00:00.000Z',
          creator: null,
        },
      ],
      isLoading: false,
    })
    mockUseReviewQueue.mockReturnValue({
      data: {
        items: [
          {
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
          },
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
})
