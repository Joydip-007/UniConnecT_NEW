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
    difficulty: 'Undergraduate',
    language: 'English',
    estimatedDays: 14,
    customInstructions: 'Test instructions',
    genHour: 2,
    countPerRun: 3,
    quizRequireApproval: true,
  },
}))

vi.mock('../hooks/useLearningAdmin', () => ({
  useLearningAdminConfig: () => ({ data: configData, isLoading: false }),
  useUpdateLearningAdminConfig: () => ({ mutate: updateMutate, mutateAsync: updateMutateAsync, isPending: false }),
  useTriggerLearningGenerate: () => ({ mutate: triggerMutate, isPending: false }),
  usePendingPaths: () => ({ data: [{ id: 'p1', title: 'Path 1', category: 'React', difficulty: 'intermediate', created_at: '2023-01-01' }] }),
  useApprovePath: () => ({ mutate: approvePathMutate, isPending: false }),
  useDiscardPath: () => ({ mutate: discardPathMutate, isPending: false }),
  usePendingQuizBatches: () => ({ data: [{ id: 'q1', department: 'CS', generated_at: '2023-01-01' }] }),
  useApproveQuizBatch: () => ({ mutate: approveQuizMutate, isPending: false }),
  useDiscardQuizBatch: () => ({ mutate: discardQuizMutate, isPending: false }),
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
    expect(screen.getByDisplayValue('Undergraduate')).toBeInTheDocument()

    // Change a setting
    const languageInput = screen.getByDisplayValue('English')
    await user.clear(languageInput)
    await user.type(languageInput, 'Spanish')

    await user.click(screen.getByRole('button', { name: /save settings/i }))

    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'Spanish' }),
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
