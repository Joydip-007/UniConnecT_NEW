import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserRole } from '@uniconnect/shared'
import { LeftSidebar } from './LeftSidebar'
import { RAILS } from './leftSidebar.config'

const navigate = vi.fn()
let mockRole: UserRole = 'student'
let mockDraftCount = 0

vi.mock('@/hooks/useViewTransitionNavigate', () => ({
  useViewTransitionNavigate: () => navigate,
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    user: {
      id: 'user-1',
      role: mockRole,
      profile: {
        fullName: 'Ada Lovelace',
        avatarUrl: null,
        coverUrl: null,
        department: 'CSE',
        batchYear: '2026',
      },
    },
  }),
}))

vi.mock('@/features/drafts/hooks/useMyDrafts', () => ({
  useMyDrafts: () => ({
    data: { items: Array.from({ length: mockDraftCount }), counts: {} },
  }),
}))

vi.mock('@/lib/axios', () => ({
  api: {
    get: vi.fn().mockResolvedValue({
      data: {
        data: {
          id: 'user-1',
          email: 'ada@example.edu',
          role: 'student',
          isVerified: true,
          profile: {
            fullName: 'Ada Lovelace',
            username: 'ada',
            avatarUrl: null,
            coverUrl: null,
            headline: null,
            department: 'CSE',
            batchYear: '2026',
            bio: null,
            location: null,
            website: null,
            skills: [],
          },
          stats: { posts: 0, connections: 12, pendingReceived: 2 },
        },
      },
    }),
  },
}))

function renderSidebar(collapsed: boolean, onToggleCollapsed = vi.fn(), route = '/feed') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>
        <LeftSidebar collapsed={collapsed} onToggleCollapsed={onToggleCollapsed} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function activeRowNames(): string[] {
  return screen
    .getAllByRole('button')
    .filter((el) => el.getAttribute('aria-current') === 'page')
    .map((el) => el.textContent ?? '')
}

describe('LeftSidebar', () => {
  beforeEach(() => {
    navigate.mockClear()
    mockRole = 'student'
    mockDraftCount = 0
  })

  it('renders the expanded sidebar with visible profile and labels', () => {
    renderSidebar(false)
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument()
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument()
    expect(screen.getByText('Campus tools')).toBeInTheDocument()
  })

  it('keeps the active route marked with aria-current page', () => {
    renderSidebar(false)
    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Groups & people' })).not.toHaveAttribute('aria-current')
  })

  it('renders collapsed nav as accessible icon buttons without visible labels', () => {
    const { container } = renderSidebar(true)
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('title', 'Home')
    expect(screen.getByRole('button', { name: 'Shuttle live' })).toHaveAttribute('title', 'Shuttle live')
    expect(container.querySelector('.left-sidebar--collapsed')).toBeInTheDocument()
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument()
  })

  it('calls the collapse toggle from the rail button', async () => {
    const onToggleCollapsed = vi.fn()
    renderSidebar(false, onToggleCollapsed)
    await userEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
    expect(onToggleCollapsed).toHaveBeenCalledOnce()
  })

  it('hides the contextual zone when its condition is false', () => {
    mockDraftCount = 0
    renderSidebar(false)
    expect(screen.queryByLabelText('Contextual shortcuts')).not.toBeInTheDocument()
  })

  it('shows the drafts contextual row once a draft exists', () => {
    mockDraftCount = 3
    renderSidebar(false)
    expect(screen.getByLabelText('Contextual shortcuts')).toBeInTheDocument()
    expect(screen.getByText('Drafts')).toBeInTheDocument()
  })

  const roles: UserRole[] = ['student', 'alumni', 'faculty', 'driver', 'admin']
  it.each(roles)('renders every fixed row for the %s role, in manifest order', (role) => {
    mockRole = role
    renderSidebar(false)
    const rail = RAILS[role]
    rail.fixed.forEach((row) => {
      expect(screen.getByRole('button', { name: row.label })).toBeInTheDocument()
    })
  })

  it('marks exactly one row active, even when several share a base path', () => {
    mockRole = 'admin'
    renderSidebar(false, vi.fn(), '/admin')
    // Moderation, Members & invites and Insights all live at /admin behind a tab param.
    expect(activeRowNames()).toEqual(['Moderation'])
  })

  it('resolves the active admin row from the tab query param', () => {
    mockRole = 'admin'
    // `users` is AdminPage's own tab value — the rail must speak the page's vocabulary.
    renderSidebar(false, vi.fn(), '/admin?tab=users')
    expect(activeRowNames()).toEqual(['Members & invites'])
  })

  it('driver rail has no more than 4 fixed rows and no student-only routes', () => {
    const rail = RAILS.driver
    expect(rail.fixed.length).toBe(4)
    expect(rail.fixed.some((row) => row.to === '/jobs' || row.to === '/mentorship')).toBe(false)
  })
})
