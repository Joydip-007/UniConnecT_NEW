import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { CreatePost } from './CreatePost'

const uploadMock = vi.fn()
vi.mock('@/hooks/usePresignedUpload', () => ({
  usePresignedUpload: () => ({ upload: uploadMock, uploading: false, error: null, reset: vi.fn() }),
}))

const createMock = vi.fn()
vi.mock('@/features/feed/hooks/useCreatePost', () => ({
  useCreatePost: () => ({ mutateAsync: createMock, isPending: false }),
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
  fireEvent.change(screen.getByPlaceholderText("What's on your mind?"), { target: { value: 'Hello campus' } })
  fireEvent.click(screen.getByTitle('Photo'))
}

function pickPhotos(...files: File[]) {
  const input = document.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement
  fireEvent.change(input, { target: { files } })
}

const photo = (name: string) => new File(['x'], name, { type: 'image/png' })

beforeEach(() => {
  // The composer renders nothing without a signed-in user.
  useAuthStore.setState({
    user: { id: 'u1', role: 'student', profile: { fullName: 'Test Student' } } as never,
  })
  uploadMock.mockReset()
  createMock.mockReset().mockResolvedValue({})
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: (f: File) => `blob:${f.name}` }))
})

describe('CreatePost photos', () => {
  it('submits the uploaded photo URLs as media_urls', async () => {
    uploadMock
      .mockResolvedValueOnce('https://cdn.example.com/a.png')
      .mockResolvedValueOnce('https://cdn.example.com/b.png')
    renderComposer()

    pickPhotos(photo('a.png'), photo('b.png'))
    await waitFor(() => expect(screen.queryByText('Uploading…')).not.toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Post' }))

    await waitFor(() => expect(createMock).toHaveBeenCalled())
    expect(createMock.mock.calls[0][0]).toMatchObject({
      media_urls: ['https://cdn.example.com/a.png', 'https://cdn.example.com/b.png'],
    })
  })

  it('flags a failed upload and blocks posting instead of dropping the photo', async () => {
    uploadMock.mockRejectedValueOnce(new Error('S3 upload failed: 403'))
    renderComposer()

    pickPhotos(photo('a.png'))

    expect(await screen.findByText(/Upload failed/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Post' })).toBeDisabled()

    fireEvent.click(screen.getByLabelText('Remove photo'))
    expect(screen.getByRole('button', { name: 'Post' })).toBeEnabled()
  })
})
