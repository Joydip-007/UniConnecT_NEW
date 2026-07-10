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
})
