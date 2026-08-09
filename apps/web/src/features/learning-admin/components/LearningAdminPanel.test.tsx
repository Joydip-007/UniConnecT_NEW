import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { LearningAdminPanel } from './LearningAdminPanel'

const {
  updateMutate,
  updateMutateAsync,
  triggerMutate,
  approvePathMutate,
  discardPathMutate,
  approveQuizMutate,
  discardQuizMutate,
  configData,
} = vi.hoisted(() => ({
  updateMutate: vi.fn(),
  updateMutateAsync: vi.fn().mockResolvedValue({}),
  triggerMutate: vi.fn(),
  approvePathMutate: vi.fn(),
  discardPathMutate: vi.fn(),
  approveQuizMutate: vi.fn(),
  discardQuizMutate: vi.fn(),
  configData: {
    enabled: true,
    topics: [{ category: 'React', difficulty: 'intermediate' }],
    // Both are <select> controls — these must stay valid option values, or the
    // select renders blank and every display-value assertion below misses.
    difficulty: 'intermediate',
    language: 'en',
    estimatedDays: 14,
    customInstructions: 'Test instructions',
    genHour: 2,
    countPerRun: 3,
    quizRequireApproval: true,
  },
}))

// The panel renders without a QueryClientProvider, so the hooks module is replaced
// wholesale rather than partially — which means this factory must list EVERY export
// of ../hooks/useLearningAdmin. Adding a hook there without adding it here fails the
// whole file with "No <name> export is defined on the mock".
vi.mock('../hooks/useLearningAdmin', () => ({
  useLearningAdminConfig: () => ({ data: configData, isLoading: false }),
  useUpdateLearningAdminConfig: () => ({ mutate: updateMutate, mutateAsync: updateMutateAsync, isPending: false }),
  useTriggerLearningGenerate: () => ({ mutate: triggerMutate, isPending: false }),
  usePendingPaths: () => ({ data: [{ id: 'p1', title: 'Path 1', category: 'React', difficulty: 'intermediate', created_at: '2023-01-01' }] }),
  usePendingPathDetail: () => ({ data: undefined, isLoading: false }),
  useApprovePath: () => ({ mutate: approvePathMutate, isPending: false }),
  useDiscardPath: () => ({ mutate: discardPathMutate, isPending: false }),
  usePendingQuizBatches: () => ({ data: [{ id: 'q1', department: 'CS', generated_at: '2023-01-01' }] }),
  usePendingQuizBatchDetail: () => ({ data: undefined, isLoading: false }),
  useApproveQuizBatch: () => ({ mutate: approveQuizMutate, isPending: false }),
  useDiscardQuizBatch: () => ({ mutate: discardQuizMutate, isPending: false }),
  useUpcomingQuizzes: () => ({ data: { today: [], queuedByDepartment: [] } }),
  useLearningAnalytics: () => ({ data: null, isLoading: false }),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('LearningAdminPanel', () => {
  it('loads settings and saves with expected payload', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <LearningAdminPanel />
      </MemoryRouter>,
    )

    // Wait for load (synchronous with mocked data)
    expect(screen.getByDisplayValue('React')).toBeInTheDocument()
    expect(screen.getByLabelText('General difficulty')).toHaveValue('intermediate')

    // Change a setting
    await user.selectOptions(screen.getByLabelText('Language'), 'bn')

    await user.click(screen.getByRole('button', { name: /save settings/i }))

    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'bn' }),
      expect.any(Object)
    )
  })

  it('approve/discard buttons call the correct mutators', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <LearningAdminPanel />
      </MemoryRouter>,
    )

    // Path discard
    const discardBtns = screen.getAllByRole('button', { name: /discard/i })
    await user.click(discardBtns[0])
    expect(discardPathMutate).toHaveBeenCalledWith('p1')

    // Quiz approve
    const approveBtns = screen.getAllByRole('button', { name: /approve/i })
    await user.click(approveBtns[1])
    expect(approveQuizMutate).toHaveBeenCalledWith('q1')
  })

  it('hides quiz batches card when quizRequireApproval is false', () => {
    configData.quizRequireApproval = false
    render(
      <MemoryRouter>
        <LearningAdminPanel />
      </MemoryRouter>,
    )
    expect(screen.queryByText('Pending quiz batches')).not.toBeInTheDocument()
    configData.quizRequireApproval = true // reset
  })

  it('saves current settings before generating', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <LearningAdminPanel />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: /generate now/i }))
    expect(updateMutateAsync).toHaveBeenCalled()
    expect(triggerMutate).toHaveBeenCalled()
  })
})
