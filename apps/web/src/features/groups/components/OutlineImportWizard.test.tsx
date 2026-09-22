import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OutlineImportWizard } from './OutlineImportWizard'
import type { CourseOutlineDraft } from '../types'

const mockUpload = vi.fn()
vi.mock('@/hooks/usePresignedUpload', () => ({
  usePresignedUpload: () => ({ upload: mockUpload, uploading: false, error: null, reset: vi.fn() }),
}))

const mockDraftMutateAsync = vi.fn()
vi.mock('../hooks/useOutlineImport', () => ({
  useOutlineDraft: () => ({ mutateAsync: mockDraftMutateAsync, isPending: false }),
  useCreateGroupFromOutline: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useInviteMatch: () => ({ data: undefined }),
  useBulkInvite: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

function baseDraft(weightPercentA: number, weightPercentB: number): CourseOutlineDraft {
  return {
    courseCode: 'CSE 3422',
    courseTitle: 'Software Engineering Lab',
    section: 'A',
    gradingScale: 'uiu',
    assessments: [
      { categoryName: 'Quizzes', fullMarks: 20, weightPercent: weightPercentA, totalGiven: 4, bestNCounted: 3, displayOrder: 1 },
      { categoryName: 'Final', fullMarks: 100, weightPercent: weightPercentB, totalGiven: 1, bestNCounted: 1, displayOrder: 2 },
    ],
    topics: [{ weekNumber: 1, title: 'Intro', description: 'Jan 1 - Jan 7' }],
    assignments: [],
  }
}

function renderWizard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <OutlineImportWizard onClose={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function goToReview(draft: CourseOutlineDraft) {
  mockUpload.mockResolvedValue('https://uploads.example.com/course-outline/file.pdf')
  mockDraftMutateAsync.mockResolvedValue({ draft, rosterEmails: [] })

  renderWizard()

  const file = new File(['%PDF-1.4'], 'outline.pdf', { type: 'application/pdf' })
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, { target: { files: [file] } })

  fireEvent.click(screen.getByRole('button', { name: 'Upload and generate draft' }))

  await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm and create group' })).toBeInTheDocument())
}

describe('OutlineImportWizard — review step weights (Task 20)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the under-100 warning and disables Confirm when weights sum to 90', async () => {
    await goToReview(baseDraft(60, 30))

    expect(screen.getByText('90% of 100%')).toBeInTheDocument()
    expect(screen.getByText('Weights are under 100%. 10 points left to assign.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm and create group' })).toBeDisabled()
  })

  it('shows the over-100 warning when weights exceed 100', async () => {
    await goToReview(baseDraft(70, 40))

    expect(screen.getByText('110% of 100%')).toBeInTheDocument()
    expect(screen.getByText('Weights are over 100%. Lower one by 10 points.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm and create group' })).toBeDisabled()
  })

  it('enables Confirm once weights are edited to sum to exactly 100', async () => {
    await goToReview(baseDraft(60, 30))

    const weightInputs = screen.getAllByRole('spinbutton').filter((el) => el.getAttribute('aria-label')?.includes('weight percent'))
    fireEvent.change(weightInputs[1]!, { target: { value: '40' } })

    expect(screen.getByText('Adds up to 100%')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm and create group' })).toBeEnabled()
  })
})
