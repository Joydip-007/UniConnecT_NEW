import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StudySessionsTab } from './StudySessionsTab'

const mockUseStudySessions = vi.fn()
const mockUseCreateStudySession = vi.fn()
const mockUseRsvpStudySession = vi.fn()
const mockUseSessionCreatorNotes = vi.fn()
const mockUseSaveSessionCreatorNotes = vi.fn()
const mockUseMySessionPrivateNotes = vi.fn()
const mockUseSaveMySessionPrivateNotes = vi.fn()
const mockUseSharedNotes = vi.fn()
const mockUseCreateSharedNote = vi.fn()
const mockUseUpdateSharedNote = vi.fn()
const mockUseDeleteSharedNote = vi.fn()

vi.mock('@/features/groups', () => ({
  useStudySessions: () => mockUseStudySessions(),
  useCreateStudySession: () => mockUseCreateStudySession(),
  useRsvpStudySession: () => mockUseRsvpStudySession(),
}))

vi.mock('../hooks/useGroupExtended', () => ({
  useSessionCreatorNotes: () => mockUseSessionCreatorNotes(),
  useSaveSessionCreatorNotes: () => mockUseSaveSessionCreatorNotes(),
  useMySessionPrivateNotes: () => mockUseMySessionPrivateNotes(),
  useSaveMySessionPrivateNotes: () => mockUseSaveMySessionPrivateNotes(),
  useSharedNotes: () => mockUseSharedNotes(),
  useCreateSharedNote: () => mockUseCreateSharedNote(),
  useUpdateSharedNote: () => mockUseUpdateSharedNote(),
  useDeleteSharedNote: () => mockUseDeleteSharedNote(),
}))

function pendingMutation(mutate = vi.fn()) {
  return { mutate, isPending: false }
}

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-1',
    groupId: 'group-1',
    createdBy: 'user-2',
    title: 'Midterm review',
    description: 'Cover chapters 4-6',
    location: 'Library room 2',
    isOnline: false,
    onlineLink: null,
    startsAt: '2026-08-22T17:30:00.000Z',
    endsAt: null,
    capacity: 10,
    rsvpCount: 3,
    ownRsvp: null,
    creator: null,
    ...overrides,
  }
}

describe('StudySessionsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseCreateStudySession.mockReturnValue(pendingMutation())
    mockUseRsvpStudySession.mockReturnValue(pendingMutation())
    mockUseSessionCreatorNotes.mockReturnValue({ data: null, isLoading: false })
    mockUseSaveSessionCreatorNotes.mockReturnValue({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false })
    mockUseMySessionPrivateNotes.mockReturnValue({ data: null, isLoading: false })
    mockUseSaveMySessionPrivateNotes.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
    mockUseSharedNotes.mockReturnValue({ data: { items: [], total: 0, page: 1, hasMore: false }, isLoading: false })
    mockUseCreateSharedNote.mockReturnValue(pendingMutation())
    mockUseUpdateSharedNote.mockReturnValue(pendingMutation())
    mockUseDeleteSharedNote.mockReturnValue(pendingMutation())
  })

  it('splits sessions under Upcoming and Past eyebrows', () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    mockUseStudySessions.mockReturnValue({
      data: {
        items: [
          session({ id: 'upcoming-1', title: 'Upcoming session', startsAt: future }),
          session({ id: 'past-1', title: 'Past session', startsAt: pastDate, ownRsvp: 'going' }),
        ],
        total: 2,
        page: 1,
        hasMore: false,
      },
      isLoading: false,
    })

    render(<StudySessionsTab groupId="group-1" currentUserId="user-1" userRole="member" />)

    expect(screen.getByText('Upcoming')).toBeInTheDocument()
    expect(screen.getByText('Past')).toBeInTheDocument()

    const upcomingHeading = screen.getByText('Upcoming')
    const upcomingSection = upcomingHeading.closest('section') as HTMLElement
    expect(within(upcomingSection).getByText('Upcoming session')).toBeInTheDocument()

    const pastHeading = screen.getByText('Past')
    const pastSection = pastHeading.closest('section') as HTMLElement
    expect(within(pastSection).getByText('Past session')).toBeInTheDocument()
  })

  it('shows a non-interactive Ended pill for past sessions instead of RSVP/Going', () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    mockUseStudySessions.mockReturnValue({
      data: { items: [session({ id: 'past-1', title: 'Past session', startsAt: pastDate, ownRsvp: 'going' })], total: 1, page: 1, hasMore: false },
      isLoading: false,
    })

    render(<StudySessionsTab groupId="group-1" currentUserId="user-1" userRole="member" />)

    expect(screen.getByText('Ended')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Going' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'RSVP' })).not.toBeInTheDocument()
  })

  it('shows an indigo-filled Going pill for an upcoming session the user has RSVPed to', () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    mockUseStudySessions.mockReturnValue({
      data: { items: [session({ id: 'upcoming-1', title: 'Upcoming session', startsAt: future, ownRsvp: 'going' })], total: 1, page: 1, hasMore: false },
      isLoading: false,
    })

    render(<StudySessionsTab groupId="group-1" currentUserId="user-1" userRole="member" />)

    const goingButton = screen.getByRole('button', { name: 'Going' })
    expect(goingButton).toBeInTheDocument()
    expect(goingButton).toHaveStyle({ background: 'var(--uc-indigo)' })
  })

  it('toggles the per-session creator notes disclosure, showing the empty-state copy', () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    mockUseStudySessions.mockReturnValue({
      data: { items: [session({ id: 'upcoming-1', title: 'Upcoming session', startsAt: future })], total: 1, page: 1, hasMore: false },
      isLoading: false,
    })

    render(<StudySessionsTab groupId="group-1" currentUserId="user-1" userRole="member" />)

    expect(screen.queryByText('Creator notes · empty')).not.toBeInTheDocument()

    const sessionCard = screen.getByText('Upcoming session').closest('div')!.parentElement!.parentElement as HTMLElement
    fireEvent.click(within(sessionCard).getByRole('button', { name: /Notes/i }))

    expect(screen.getByText('Creator notes · empty')).toBeInTheDocument()
    expect(screen.getByText('No shared notes for this session yet.')).toBeInTheDocument()
  })

  it('hides the New session pill for a visitor with no group role', () => {
    mockUseStudySessions.mockReturnValue({ data: { items: [], total: 0, page: 1, hasMore: false }, isLoading: false })

    render(<StudySessionsTab groupId="group-1" currentUserId="user-1" userRole={null} />)

    expect(screen.queryByRole('button', { name: /New session/i })).not.toBeInTheDocument()
  })

  it('shows the New session pill for a group member', () => {
    mockUseStudySessions.mockReturnValue({ data: { items: [], total: 0, page: 1, hasMore: false }, isLoading: false })

    render(<StudySessionsTab groupId="group-1" currentUserId="user-1" userRole="member" />)

    expect(screen.getByRole('button', { name: /New session/i })).toBeInTheDocument()
  })

  it('reaches shared notes from the header Notes chip without losing the feature', () => {
    mockUseStudySessions.mockReturnValue({ data: { items: [], total: 0, page: 1, hasMore: false }, isLoading: false })

    render(<StudySessionsTab groupId="group-1" currentUserId="user-1" userRole="member" />)

    expect(screen.queryByText('No shared notes yet')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^Notes$/i }))

    expect(screen.getByText('No shared notes yet')).toBeInTheDocument()
  })
})
