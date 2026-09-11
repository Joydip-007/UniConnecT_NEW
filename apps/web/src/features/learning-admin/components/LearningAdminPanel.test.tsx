import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { LearningAdminPanel } from './LearningAdminPanel'

const { updateMutate, triggerMutate, configData } = vi.hoisted(() => ({
  updateMutate: vi.fn(),
  triggerMutate: vi.fn(),
  configData: {
    enabled: true,
    topics: [{ category: 'React', difficulty: 'intermediate' }],
    difficulty: 'intermediate',
    language: 'en',
    estimatedDays: 14,
    customInstructions: 'Test instructions',
    genHour: 2,
    countPerRun: 3,
    quizEnabled: true,
    quizRequireApproval: true,
    quizDifficulty: 'beginner',
    quizLanguage: 'bn',
    quizCount: 7,
    quizCustomInstructions: null,
    lastAiError: null,
    lastAiErrorAt: null,
  },
}))

// The panel renders without a QueryClientProvider, so the hooks module is replaced
// wholesale — this factory must list EVERY export of ../hooks/useLearningAdmin.
vi.mock('../hooks/useLearningAdmin', () => ({
  useLearningAdminConfig: () => ({ data: configData, isLoading: false }),
  useUpdateLearningAdminConfig: () => ({ mutate: updateMutate, mutateAsync: vi.fn(), isPending: false }),
  useTriggerLearningGenerate: () => ({ mutate: triggerMutate, isPending: false }),
  usePendingPaths: () => ({ data: [] }),
  usePendingPathDetail: () => ({ data: undefined, isLoading: false }),
  useApprovePath: () => ({ mutate: vi.fn(), isPending: false }),
  useDiscardPath: () => ({ mutate: vi.fn(), isPending: false }),
  usePendingQuizBatches: () => ({ data: [] }),
  usePendingQuizBatchDetail: () => ({ data: undefined, isLoading: false }),
  useApproveQuizBatch: () => ({ mutate: vi.fn(), isPending: false }),
  useDiscardQuizBatch: () => ({ mutate: vi.fn(), isPending: false }),
  useUpcomingQuizzes: () => ({ data: { today: [], queuedByDepartment: [] } }),
  useLearningAnalytics: () => ({ data: null, isLoading: false }),
  useAdminLearningPaths: () => ({ data: [], isLoading: false }),
  useSetPathPublished: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateLearningPath: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
  useUpdateLearningPath: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
  useCreatePathUnit: () => ({ mutate: vi.fn(), isPending: false }),
  useAdminQuizzes: () => ({ data: [], isLoading: false }),
  useAdminQuizQuestions: () => ({ data: undefined, isLoading: false }),
  useDraftPathWithAi: () => ({ mutate: vi.fn(), isPending: false }),
  useGenerateQuizWithAi: () => ({ mutate: vi.fn(), isPending: false }),
}))

function renderPanel() {
  return render(
    <MemoryRouter>
      <LearningAdminPanel />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('LearningAdminPanel', () => {
  it('has exactly two tabs, without counts, and no AI settings tab', () => {
    renderPanel()
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent?.trim())
    expect(tabs).toEqual(['Learning paths', 'Quizzes'])
    expect(screen.queryByText(/ai settings/i)).not.toBeInTheDocument()
  })

  it('keeps the learning schedule settings inside "Draft with AI" and saves only that half', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByRole('button', { name: /draft with ai/i }))
    await user.click(screen.getByRole('button', { name: /scheduled generation/i }))

    expect(screen.getByLabelText('Topic 1')).toHaveValue('React')
    await user.selectOptions(screen.getByLabelText('Language'), 'bn')
    await user.click(screen.getByRole('button', { name: /save schedule/i }))

    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'bn', topics: [{ category: 'React', difficulty: 'intermediate' }] }),
      expect.any(Object),
    )
    expect(updateMutate.mock.calls[0][0]).not.toHaveProperty('quizEnabled')
  })

  it('keeps the quiz schedule settings inside "Generate with AI" and can run the quiz job', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByRole('tab', { name: 'Quizzes' }))
    await user.click(screen.getByRole('button', { name: /generate with ai/i }))
    await user.click(screen.getByRole('button', { name: /daily quiz generation/i }))

    expect(screen.getByLabelText('Questions per department run')).toHaveValue(7)
    updateMutate.mockImplementation((_patch, opts) => opts.onSuccess())
    await user.click(screen.getByRole('button', { name: /run now/i }))

    expect(updateMutate).toHaveBeenCalledWith(expect.objectContaining({ quizEnabled: true, quizLanguage: 'bn' }), expect.any(Object))
    expect(updateMutate.mock.calls[0][0]).not.toHaveProperty('enabled')
    expect(triggerMutate).toHaveBeenCalledWith('quiz', expect.any(Object))
  })
})
