import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CourseOutlineForm } from './CourseOutlineForm'

const mockUseCourseOutline = vi.fn()
const mockUseSaveCourseOutline = vi.fn()

vi.mock('../hooks/useGroupExtended', () => ({
  useCourseOutline: (...args: unknown[]) => mockUseCourseOutline(...args),
  useSaveCourseOutline: (...args: unknown[]) => mockUseSaveCourseOutline(...args),
}))

function pendingMutation(mutate = vi.fn()) {
  return { mutate, mutateAsync: vi.fn(), isPending: false }
}

describe('CourseOutlineForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseCourseOutline.mockReturnValue({ data: null, isLoading: false })
    mockUseSaveCourseOutline.mockReturnValue(pendingMutation())
  })

  it('shows a red weight-sum indicator when assessments do not sum to 100', async () => {
    render(<CourseOutlineForm groupId="g1" />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/course title/i), 'Data Structures')
    await user.click(screen.getByRole('button', { name: /add assessment/i }))
    await user.type(screen.getByLabelText(/weight percent/i), '50')

    expect(screen.getByText(/50%/)).toBeInTheDocument()
    expect(screen.getByTestId('weight-sum-indicator')).toHaveAttribute('data-valid', 'false')
  })

  it('enables submit only when weight sums to 100', async () => {
    render(<CourseOutlineForm groupId="g1" />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/course title/i), 'Data Structures')
    await user.click(screen.getByRole('button', { name: /add assessment/i }))
    await user.type(screen.getByLabelText(/weight percent/i), '100')

    expect(screen.getByRole('button', { name: /save course outline/i })).toBeEnabled()
  })

  it('readOnly renders the four-week summary rows and grading instead of the editor', () => {
    mockUseCourseOutline.mockReturnValue({
      isLoading: false,
      data: {
        id: 'o1',
        groupId: 'g1',
        courseCode: 'CSE 2218',
        courseTitle: 'Data Structures',
        gradingScale: 'uiu',
        assessments: [{ categoryName: 'CT', fullMarks: 20, weightPercent: 20, totalGiven: 3, bestNCounted: 2, displayOrder: 1 }],
        topics: [
          { weekNumber: 1, title: 'Arrays' },
          { weekNumber: 5, title: 'Trees' },
        ],
      },
    })
    render(<CourseOutlineForm groupId="g1" readOnly />)

    expect(screen.getByText('Week 1 to 4')).toBeInTheDocument()
    expect(screen.getByText('Week 5')).toBeInTheDocument()
    expect(screen.getByText('Grading')).toBeInTheDocument()
    expect(screen.getByText('CT 20%')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /save course outline/i })).not.toBeInTheDocument()
  })
})
