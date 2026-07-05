import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/lib/axios'
import { useCreateFlashcardDeck, useReviewFlashcard } from './useGroupExtended'

vi.mock('@/lib/axios', () => ({
  api: {
    post: vi.fn(),
  },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }

  return { Wrapper, queryClient }
}

describe('useGroupExtended study hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('invalidates group flashcard decks after creating a deck', async () => {
    const groupId = 'group-1'
    const { Wrapper, queryClient } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    vi.mocked(api.post).mockResolvedValue({ data: { data: { id: 'deck-1' } } })

    const { result } = renderHook(() => useCreateFlashcardDeck(groupId), { wrapper: Wrapper })

    act(() => {
      result.current.mutate({ title: 'Midterm review', description: null })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(api.post).toHaveBeenCalledWith(`/groups/${groupId}/flashcard-decks`, {
      title: 'Midterm review',
      description: null,
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['groups', 'flashcard-decks', { groupId }],
    })
  })

  it('invalidates review queue, decks, and cards after reviewing a card', async () => {
    const groupId = 'group-1'
    const deckId = 'deck-1'
    const cardId = 'card-1'
    const { Wrapper, queryClient } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    vi.mocked(api.post).mockResolvedValue({
      data: {
        data: {
          cardId,
          userId: 'user-1',
          groupId,
          dueAt: '2026-07-06T00:00:00.000Z',
          lastRating: 'good',
        },
      },
    })

    const { result } = renderHook(() => useReviewFlashcard(groupId, deckId), { wrapper: Wrapper })

    act(() => {
      result.current.mutate({ cardId, rating: 'good' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(api.post).toHaveBeenCalledWith(`/groups/${groupId}/flashcards/${cardId}/review`, {
      rating: 'good',
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['groups', 'flashcard-review', { groupId, deckId }],
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['groups', 'flashcard-decks', { groupId }],
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['groups', 'flashcards', { groupId, deckId }],
    })
  })
})
