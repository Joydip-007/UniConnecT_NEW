import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AssignmentsPanel } from './AssignmentsPanel'

const mockUseAssignments = vi.fn()
const mockUseSubmitAssignment = vi.fn()
const mockUseCreateAssignment = vi.fn()
const mockUseSubmissions = vi.fn()
const mockUseGradeSubmission = vi.fn()

vi.mock('../hooks/useGroupExtended', () => ({
  useAssignments: () => mockUseAssignments(),
  useSubmitAssignment: () => mockUseSubmitAssignment(),
  useCreateAssignment: () => mockUseCreateAssignment(),
  useSubmissions: () => mockUseSubmissions(),
  useGradeSubmission: () => mockUseGradeSubmission(),
}))

function assignments() {
  return [{ id: 'a1', groupId: 'g1', title: 'HW1', maxScore: 100, fileUrls: [], isPublished: true }]
}

describe('AssignmentsPanel', () => {
  const submitMutateAsync = vi.fn().mockResolvedValue({ id: 's1', textContent: 'my answer' })
  const createMutateAsync = vi.fn().mockResolvedValue({ id: 'a2' })
  const gradeMutateAsync = vi.fn().mockResolvedValue({ id: 's1', score: 90 })

  beforeEach(() => {
    vi.clearAllMocks()
    submitMutateAsync.mockResolvedValue({ id: 's1', textContent: 'my answer' })
    createMutateAsync.mockResolvedValue({ id: 'a2' })
    gradeMutateAsync.mockResolvedValue({ id: 's1', score: 90 })
    mockUseAssignments.mockReturnValue({ data: assignments(), isLoading: false })
    mockUseSubmitAssignment.mockReturnValue({ mutateAsync: submitMutateAsync })
    mockUseCreateAssignment.mockReturnValue({ mutateAsync: createMutateAsync })
    mockUseSubmissions.mockReturnValue({ data: [], isLoading: false })
    mockUseGradeSubmission.mockReturnValue({ mutateAsync: gradeMutateAsync })
  })

  it('lists assignments and submits text content for a student', async () => {
    render(<AssignmentsPanel groupId="g1" isAdmin={false} />)
    const user = userEvent.setup()
    expect(screen.getByText('HW1')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /submit/i }))
    await user.type(screen.getByLabelText(/your answer/i), 'my answer')
    await user.click(screen.getByRole('button', { name: /confirm submit/i }))

    await waitFor(() => expect(screen.getByText(/submitted/i)).toBeInTheDocument())
    expect(submitMutateAsync).toHaveBeenCalledWith({ textContent: 'my answer' })
  })

  it('shows a loading state', () => {
    mockUseAssignments.mockReturnValue({ data: undefined, isLoading: true })
    render(<AssignmentsPanel groupId="g1" isAdmin={false} />)
    expect(screen.getByText(/Loading assignments/i)).toBeInTheDocument()
  })

  it('lets a faculty member create an assignment and view submissions', async () => {
    render(<AssignmentsPanel groupId="g1" isAdmin />)
    const user = userEvent.setup()

    expect(screen.queryByRole('button', { name: /^submit$/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /view submissions/i }))
    expect(mockUseSubmissions).toHaveBeenCalled()

    await user.type(screen.getByLabelText(/assignment title/i), 'HW2')
    await user.click(screen.getByRole('button', { name: /create assignment/i }))

    expect(createMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ title: 'HW2' }))
  })
})
