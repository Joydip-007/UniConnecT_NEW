import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionNotesPanel } from './SessionNotesPanel'

const mockUseSessionCreatorNotes = vi.fn()
const mockUseSaveSessionCreatorNotes = vi.fn()
const mockUseMySessionPrivateNotes = vi.fn()
const mockUseSaveMySessionPrivateNotes = vi.fn()

vi.mock('../hooks/useGroupExtended', () => ({
  useSessionCreatorNotes: () => mockUseSessionCreatorNotes(),
  useSaveSessionCreatorNotes: () => mockUseSaveSessionCreatorNotes(),
  useMySessionPrivateNotes: () => mockUseMySessionPrivateNotes(),
  useSaveMySessionPrivateNotes: () => mockUseSaveMySessionPrivateNotes(),
}))

describe('SessionNotesPanel', () => {
  const saveCreatorMutate = vi.fn()
  const savePrivateMutateAsync = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSessionCreatorNotes.mockReturnValue({ data: null, isLoading: false })
    mockUseSaveSessionCreatorNotes.mockReturnValue({ mutate: saveCreatorMutate, mutateAsync: vi.fn(), isPending: false })
    mockUseMySessionPrivateNotes.mockReturnValue({ data: null, isLoading: false })
    mockUseSaveMySessionPrivateNotes.mockReturnValue({ mutateAsync: savePrivateMutateAsync, isPending: false })
    savePrivateMutateAsync.mockResolvedValue({ body: 'my note' })
  })

  it('shows a placeholder when the creator has not posted notes yet', () => {
    render(<SessionNotesPanel groupId="g1" sessionId="s1" isCreator={false} />)
    expect(screen.getByText(/No shared notes for this session yet\./i)).toBeInTheDocument()
    expect(screen.getByText('Creator notes · empty')).toBeInTheDocument()
  })

  it('does not show an edit control for non-creators', () => {
    render(<SessionNotesPanel groupId="g1" sessionId="s1" isCreator={false} />)
    expect(screen.queryByRole('button', { name: /add notes/i })).not.toBeInTheDocument()
  })

  it('auto-saves private notes after a debounce', async () => {
    vi.useFakeTimers()
    render(<SessionNotesPanel groupId="g1" sessionId="s1" isCreator={false} />)

    const textarea = screen.getByLabelText(/my private notes/i)
    fireEvent.change(textarea, { target: { value: 'my note' } })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })

    expect(savePrivateMutateAsync).toHaveBeenCalledWith({ body: 'my note' })

    vi.useRealTimers()
    await waitFor(() => expect(screen.getByText(/saved/i)).toBeInTheDocument())
  })
})
