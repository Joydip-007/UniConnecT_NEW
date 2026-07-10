import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GradebookPanel } from './GradebookPanel'

const mockUseGradebook = vi.fn()
const mockUseUpsertGradebookEntries = vi.fn()

vi.mock('../hooks/useGroupExtended', () => ({
  useGradebook: () => mockUseGradebook(),
  useUpsertGradebookEntries: () => mockUseUpsertGradebookEntries(),
}))

function gradebook(overrides = {}) {
  return {
    outline: { id: 'o1', groupId: 'g1', courseTitle: 'Data Structures', gradingScale: 'uiu', assessments: [], topics: [] },
    columns: [
      { assessmentId: 'a1', categoryName: 'CT', fullMarks: 20, bestNCounted: 1, totalGiven: 1, label: 'CT-1' },
    ],
    rows: [
      {
        student: { id: 's1', fullName: 'Jane Doe' },
        cells: { a1_1: { marksObtained: null, graded: false } },
        calculated: { percentage: null, letterGrade: null },
      },
    ],
    ...overrides,
  }
}

describe('GradebookPanel', () => {
  const mutateAsync = vi.fn().mockResolvedValue({ updated: 1 })

  beforeEach(() => {
    vi.clearAllMocks()
    mutateAsync.mockResolvedValue({ updated: 1 })
    mockUseGradebook.mockReturnValue({ data: gradebook(), isLoading: false })
    mockUseUpsertGradebookEntries.mockReturnValue({ mutateAsync, isPending: false })
  })

  it('renders student rows with editable cells', () => {
    render(<GradebookPanel groupId="g1" />)

    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByLabelText(/CT-1 for Jane Doe/i)).toBeInTheDocument()
  })

  it('saves the entered value on blur', () => {
    render(<GradebookPanel groupId="g1" />)

    const cell = screen.getByLabelText(/CT-1 for Jane Doe/i)
    fireEvent.change(cell, { target: { value: '18' } })
    fireEvent.blur(cell)

    expect(mutateAsync).toHaveBeenCalledWith([
      { studentId: 's1', assessmentId: 'a1', instanceNumber: 1, marksObtained: 18 },
    ])
  })

  it('shows a loading state', () => {
    mockUseGradebook.mockReturnValue({ data: undefined, isLoading: true })

    render(<GradebookPanel groupId="g1" />)

    expect(screen.getByText(/Loading gradebook/i)).toBeInTheDocument()
  })
})
