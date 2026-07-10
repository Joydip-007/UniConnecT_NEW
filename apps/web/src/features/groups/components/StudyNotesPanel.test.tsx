import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StudyNotesPanel } from './StudyNotesPanel'

const mockUseSharedNotes = vi.fn()
const mockUseCreateSharedNote = vi.fn()
const mockUseUpdateSharedNote = vi.fn()
const mockUseDeleteSharedNote = vi.fn()
const mockUseSharedNoteUpload = vi.fn()

vi.mock('../hooks/useGroupExtended', () => ({
  useSharedNotes: () => mockUseSharedNotes(),
  useCreateSharedNote: () => mockUseCreateSharedNote(),
  useUpdateSharedNote: () => mockUseUpdateSharedNote(),
  useDeleteSharedNote: () => mockUseDeleteSharedNote(),
  useSharedNoteUpload: () => mockUseSharedNoteUpload(),
}))

function notes() {
  return [
    {
      id: 'n1',
      groupId: 'g1',
      createdBy: 'u1',
      title: 'Midterm review',
      body: 'Key formulas to remember',
      attachments: [{ name: 'formulas.pdf', url: 'https://cdn.example.com/formulas.pdf', contentType: 'application/pdf', size: 1000 }],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      creator: { id: 'u1', fullName: 'Ada', avatarUrl: null },
    },
  ]
}

describe('StudyNotesPanel', () => {
  const createMutate = vi.fn()
  const updateMutate = vi.fn()
  const deleteMutate = vi.fn()
  const uploadMutateAsync = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSharedNotes.mockReturnValue({ data: { items: notes() }, isLoading: false })
    mockUseCreateSharedNote.mockReturnValue({ mutate: createMutate, isPending: false })
    mockUseUpdateSharedNote.mockReturnValue({ mutate: updateMutate, isPending: false })
    mockUseDeleteSharedNote.mockReturnValue({ mutate: deleteMutate })
    mockUseSharedNoteUpload.mockReturnValue({ mutateAsync: uploadMutateAsync, isPending: false, isError: false, error: null })
    uploadMutateAsync.mockResolvedValue({
      name: 'lecture1.pdf',
      url: 'https://cdn.example.com/lecture1.pdf',
      contentType: 'application/pdf',
      size: 100,
    })
  })

  it('renders an existing attachment as a download link', () => {
    render(<StudyNotesPanel groupId="g1" currentUserId="u1" userRole="member" />)
    const link = screen.getByRole('link', { name: /formulas\.pdf/i })
    expect(link).toHaveAttribute('href', 'https://cdn.example.com/formulas.pdf')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('uploads a file and shows it as a chip before saving the note', async () => {
    render(<StudyNotesPanel groupId="g1" currentUserId="u1" userRole="member" />)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /new note/i }))

    const file = new File(['content'], 'lecture1.pdf', { type: 'application/pdf' })
    const input = screen.getByLabelText(/attach file/i)
    await user.upload(input, file)

    await waitFor(() => expect(uploadMutateAsync).toHaveBeenCalledWith(file))
    await waitFor(() => expect(screen.getByText('lecture1.pdf')).toBeInTheDocument())
  })

  it('removes an uploaded attachment chip', async () => {
    render(<StudyNotesPanel groupId="g1" currentUserId="u1" userRole="member" />)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /new note/i }))

    const file = new File(['content'], 'lecture1.pdf', { type: 'application/pdf' })
    await user.upload(screen.getByLabelText(/attach file/i), file)
    await waitFor(() => expect(screen.getByText('lecture1.pdf')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /remove lecture1\.pdf/i }))
    expect(screen.queryByText('lecture1.pdf')).not.toBeInTheDocument()
  })

  it('includes attachments in the create-note payload', async () => {
    render(<StudyNotesPanel groupId="g1" currentUserId="u1" userRole="member" />)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /new note/i }))

    const file = new File(['content'], 'lecture1.pdf', { type: 'application/pdf' })
    await user.upload(screen.getByLabelText(/attach file/i), file)
    await waitFor(() => expect(screen.getByText('lecture1.pdf')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('Note title'), { target: { value: 'New note' } })
    fireEvent.change(screen.getByPlaceholderText('Note'), { target: { value: 'Body text' } })
    fireEvent.click(screen.getByRole('button', { name: /^create$/i }))

    expect(createMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'New note',
        body: 'Body text',
        attachments: [
          { name: 'lecture1.pdf', url: 'https://cdn.example.com/lecture1.pdf', contentType: 'application/pdf', size: 100 },
        ],
      }),
      expect.anything(),
    )
  })
})
