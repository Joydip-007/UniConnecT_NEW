import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { CreatePost } from './CreatePost'

// emoji-mart needs a real browser; stand in a single-emoji picker that honours the same props.
vi.mock('@/components/emoji/EmojiPicker', () => ({
  EmojiPicker: ({ onSelect }: { onSelect: (e: string) => void }) => (
    <button type="button" onClick={() => onSelect('🎉')}>
      pick party
    </button>
  ),
}))
vi.mock('@/features/feed/hooks/useCreatePost', () => ({
  useCreatePost: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@/features/feed/hooks/useUpdatePost', () => ({
  useUpdatePost: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

function renderComposer() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['users', 'me', 'progress'], { hasMadePost: true })
  render(
    <QueryClientProvider client={client}>
      <CreatePost />
    </QueryClientProvider>,
  )
  fireEvent.click(screen.getByText(/What's on your mind,/))
  return screen.getByPlaceholderText("What's on your mind?") as HTMLTextAreaElement
}

beforeEach(() => {
  useAuthStore.setState({
    user: { id: 'u1', role: 'student', profile: { fullName: 'Test Student' } } as never,
  })
})

describe('CreatePost emoji', () => {
  it('inserts the picked emoji at the cursor and keeps the picker open for more', async () => {
    const textarea = renderComposer()
    fireEvent.change(textarea, { target: { value: 'Hello campus' } })
    textarea.setSelectionRange(5, 5)

    fireEvent.click(screen.getByTitle('Emoji'))
    fireEvent.click(await screen.findByText('pick party'))

    expect(textarea.value).toBe('Hello🎉 campus')
    expect(screen.getByText('pick party')).toBeInTheDocument()
  })

  it('closes the picker on Escape without closing the composer', async () => {
    renderComposer()
    fireEvent.click(screen.getByTitle('Emoji'))
    await screen.findByText('pick party')

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByText('pick party')).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText("What's on your mind?")).toBeInTheDocument()
  })
})
