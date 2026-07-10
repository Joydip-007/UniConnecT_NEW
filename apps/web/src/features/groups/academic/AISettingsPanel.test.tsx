import { fireEvent, render, screen } from '@testing-library/react'
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
})
