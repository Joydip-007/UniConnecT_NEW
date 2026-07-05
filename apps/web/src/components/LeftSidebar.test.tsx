import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LeftSidebar } from './LeftSidebar'

const navigate = vi.fn()

vi.mock('@/hooks/useViewTransitionNavigate', () => ({
  useViewTransitionNavigate: () => navigate,
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    user: {
      id: 'user-1',
      role: 'student',
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

vi.mock('@/stores/notificationsStore', () => ({
  useNotificationsStore: () => ({ messageCount: 7 }),
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

function renderSidebar(collapsed: boolean, onToggleCollapsed = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/feed']}>
        <LeftSidebar collapsed={collapsed} onToggleCollapsed={onToggleCollapsed} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('LeftSidebar', () => {
  beforeEach(() => {
    navigate.mockClear()
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
    expect(screen.getByRole('button', { name: 'Explore' })).not.toHaveAttribute('aria-current')
  })

  it('renders collapsed nav as accessible icon buttons without visible labels', () => {
    const { container } = renderSidebar(true)
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('title', 'Home')
    expect(screen.getByRole('button', { name: 'Messages' })).toHaveAttribute('title', 'Messages')
    expect(screen.getByRole('button', { name: 'Shuttle live' })).toHaveAttribute('title', 'Shuttle live')
    expect(container.querySelector('.left-sidebar--collapsed')).toBeInTheDocument()
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument()
  })

  it('keeps collapsed badges and group labels in the DOM', () => {
    renderSidebar(true)

    const messages = screen.getByRole('button', { name: 'Messages' })
    expect(messages).toHaveTextContent('7')
    expect(screen.getByText('Main')).toHaveClass('left-sidebar-visually-hidden')
    expect(screen.getByText('Community')).toHaveClass('left-sidebar-visually-hidden')
    expect(screen.getByText('You')).toHaveClass('left-sidebar-visually-hidden')
  })

  it('calls the collapse toggle from the rail button', async () => {
    const onToggleCollapsed = vi.fn()
    renderSidebar(false, onToggleCollapsed)
    await userEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
    expect(onToggleCollapsed).toHaveBeenCalledOnce()
  })
})
