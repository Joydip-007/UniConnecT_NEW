import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AISettingsPanel } from './AISettingsPanel'

const mockUseAiSettings = vi.fn()
const mockUseUpdateAiSettings = vi.fn()
const mockUsePendingAiContent = vi.fn()
const mockUseApprovePendingAiContent = vi.fn()
const mockUseDiscardPendingAiContent = vi.fn()
const mockUseCourseOutline = vi.fn()

vi.mock('../hooks/useGroupExtended', () => ({
  useAiSettings: () => mockUseAiSettings(),
  useUpdateAiSettings: () => mockUseUpdateAiSettings(),
  usePendingAiContent: () => mockUsePendingAiContent(),
  useApprovePendingAiContent: () => mockUseApprovePendingAiContent(),
  useDiscardPendingAiContent: () => mockUseDiscardPendingAiContent(),
  useCourseOutline: () => mockUseCourseOutline(),
}))

function aiSettings(overrides = {}) {
  return {
    ai_flashcards_enabled: false,
    ai_quiz_enabled: false,
    require_approval: false,
    language: 'en',
    items_per_run: 10,
    frequency: 'daily',
    run_hour: 2,
    ...overrides,
  }
}

describe('AISettingsPanel', () => {
  const updateMutate = vi.fn()
  const approveMutate = vi.fn()
  const discardMutate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAiSettings.mockReturnValue({ data: aiSettings(), isLoading: false })
    mockUseUpdateAiSettings.mockReturnValue({ mutate: updateMutate })
    mockUsePendingAiContent.mockReturnValue({ data: [] })
    mockUseApprovePendingAiContent.mockReturnValue({ mutate: approveMutate })
    mockUseDiscardPendingAiContent.mockReturnValue({ mutate: discardMutate })
    mockUseCourseOutline.mockReturnValue({ data: { id: 'o1' } })
  })

  it('shows a loading state', () => {
    mockUseAiSettings.mockReturnValue({ data: undefined, isLoading: true })
    render(<AISettingsPanel groupId="g1" />)
    expect(screen.getByText(/Loading AI settings/i)).toBeInTheDocument()
  })

  it('toggles ai_quiz_enabled and saves', () => {
    render(<AISettingsPanel groupId="g1" />)
    fireEvent.click(screen.getByLabelText(/daily quiz/i))
    expect(updateMutate).toHaveBeenCalledWith({ ai_quiz_enabled: true })
  })

  it('toggles ai_flashcards_enabled and saves', () => {
    render(<AISettingsPanel groupId="g1" />)
    fireEvent.click(screen.getByLabelText(/ai flashcards/i))
    expect(updateMutate).toHaveBeenCalledWith({ ai_flashcards_enabled: true })
  })

  it('toggles require_approval and saves', () => {
    render(<AISettingsPanel groupId="g1" />)
    fireEvent.click(screen.getByLabelText(/require approval/i))
    expect(updateMutate).toHaveBeenCalledWith({ require_approval: true })
  })

  it('lists pending content with approve/reject actions when require_approval is on', () => {
    mockUseAiSettings.mockReturnValue({ data: aiSettings({ require_approval: true }), isLoading: false })
    mockUsePendingAiContent.mockReturnValue({
      data: [{ id: 'deck1', type: 'flashcard_deck', title: 'Week 1 deck' }],
    })
    render(<AISettingsPanel groupId="g1" />)

    expect(screen.getByText('Week 1 deck')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /approve/i }))
    expect(approveMutate).toHaveBeenCalledWith('deck1')

    fireEvent.click(screen.getByRole('button', { name: /reject/i }))
    expect(discardMutate).toHaveBeenCalledWith('deck1')
  })

  it('does not show the pending content section when require_approval is off', () => {
    mockUsePendingAiContent.mockReturnValue({
      data: [{ id: 'deck1', type: 'flashcard_deck', title: 'Week 1 deck' }],
    })
    render(<AISettingsPanel groupId="g1" />)
    expect(screen.queryByText('Week 1 deck')).not.toBeInTheDocument()
  })

  it('shows a warning banner when AI is enabled but no course outline exists', () => {
    mockUseAiSettings.mockReturnValue({ data: aiSettings({ ai_quiz_enabled: true }), isLoading: false })
    mockUseCourseOutline.mockReturnValue({ data: null })
    render(<AISettingsPanel groupId="g1" />)
    expect(screen.getByText(/Set up your Course Outline/i)).toBeInTheDocument()
  })

  it('does not show the warning banner when AI is disabled', () => {
    mockUseCourseOutline.mockReturnValue({ data: null })
    render(<AISettingsPanel groupId="g1" />)
    expect(screen.queryByText(/Set up your Course Outline/i)).not.toBeInTheDocument()
  })

  it('saves the subject the creator types on blur', async () => {
    const user = userEvent.setup()
    render(<AISettingsPanel groupId="g1" />)

    const subject = screen.getByLabelText('Subject')
    await user.clear(subject)
    await user.type(subject, 'Binary trees')
    await user.tab()

    expect(updateMutate).toHaveBeenCalledWith({ subject: 'Binary trees' })
  })

  it('saves the number of items per run on blur', async () => {
    const user = userEvent.setup()
    render(<AISettingsPanel groupId="g1" />)

    const count = screen.getByLabelText('Items per run')
    await user.clear(count)
    await user.type(count, '5')
    await user.tab()

    expect(updateMutate).toHaveBeenCalledWith({ items_per_run: 5 })
  })

  it('does not save on every keystroke, only on blur', async () => {
    const user = userEvent.setup()
    render(<AISettingsPanel groupId="g1" />)

    const subject = screen.getByLabelText('Subject')
    await user.type(subject, 'abc')
    expect(updateMutate).not.toHaveBeenCalled()
  })

  it('saves difficulty on change', () => {
    render(<AISettingsPanel groupId="g1" />)
    fireEvent.change(screen.getByLabelText('Difficulty'), { target: { value: 'advanced' } })
    expect(updateMutate).toHaveBeenCalledWith({ difficulty: 'advanced' })
  })

  it('saves question style on change', () => {
    render(<AISettingsPanel groupId="g1" />)
    fireEvent.change(screen.getByLabelText('Question style'), { target: { value: 'true_false' } })
    expect(updateMutate).toHaveBeenCalledWith({ question_style: 'true_false' })
  })

  it('saves language on change', () => {
    render(<AISettingsPanel groupId="g1" />)
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'bn' } })
    expect(updateMutate).toHaveBeenCalledWith({ language: 'bn' })
  })

  it('saves frequency on change', () => {
    render(<AISettingsPanel groupId="g1" />)
    fireEvent.change(screen.getByLabelText('Frequency'), { target: { value: 'weekly' } })
    expect(updateMutate).toHaveBeenCalledWith({ frequency: 'weekly' })
  })

  it('saves run hour on blur and labels it as UTC', async () => {
    const user = userEvent.setup()
    render(<AISettingsPanel groupId="g1" />)

    const runHour = screen.getByLabelText('Run hour')
    expect(screen.getByText(/Run hour \(UTC\)/i)).toBeInTheDocument()
    await user.clear(runHour)
    await user.type(runHour, '14')
    await user.tab()

    expect(updateMutate).toHaveBeenCalledWith({ run_hour: 14 })
  })

  it('saves custom instructions on blur', async () => {
    const user = userEvent.setup()
    render(<AISettingsPanel groupId="g1" />)

    const instructions = screen.getByLabelText('Custom instructions')
    await user.type(instructions, 'Focus on recursion')
    await user.tab()

    expect(updateMutate).toHaveBeenCalledWith({ custom_instructions: 'Focus on recursion' })
  })

  it('shows the run weekday control only when frequency is weekly', () => {
    mockUseAiSettings.mockReturnValue({ data: aiSettings({ frequency: 'daily' }), isLoading: false })
    render(<AISettingsPanel groupId="g1" />)
    expect(screen.queryByLabelText('Run weekday')).not.toBeInTheDocument()
  })

  it('renders and saves run weekday when frequency is weekly', () => {
    mockUseAiSettings.mockReturnValue({
      data: aiSettings({ frequency: 'weekly', run_weekday: 1 }),
      isLoading: false,
    })
    render(<AISettingsPanel groupId="g1" />)
    fireEvent.change(screen.getByLabelText('Run weekday'), { target: { value: '3' } })
    expect(updateMutate).toHaveBeenCalledWith({ run_weekday: 3 })
  })
})
