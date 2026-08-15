import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserRole } from '@uniconnect/shared'
import { TopNav } from './TopNav'
import { RAILS } from './leftSidebar.config'

const navigate = vi.fn()
let mockRole: UserRole = 'student'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    user: {
      id: 'u1',
      email: 'ada@example.edu',
      role: mockRole,
      profile: { fullName: 'Ada Lovelace', avatarUrl: null },
    },
    clearAuth: vi.fn(),
  }),
}))

vi.mock('@/stores/notificationsStore', () => ({
  useNotificationsStore: () => ({ messageCount: 0, notificationCount: 0 }),
}))

vi.mock('@/stores/themeStore', () => ({
  useThemeStore: (selector: (s: unknown) => unknown) =>
    selector({ mode: 'dark', setMode: vi.fn() }),
}))

vi.mock('@/features/notifications', () => ({ NotificationDropdown: () => null }))
vi.mock('@/features/messages/components/MessagesPopup', () => ({ MessagesPopup: () => null }))
vi.mock('@/features/search', () => ({ SearchPanel: () => null }))
vi.mock('@/components/BrandLogo', () => ({ BrandLogo: () => <span>UniConnecT</span> }))

function renderNav() {
  return render(
    <MemoryRouter initialEntries={['/feed']}>
      <TopNav />
    </MemoryRouter>,
  )
}

describe('TopNav avatar menu', () => {
  beforeEach(() => {
    navigate.mockClear()
    mockRole = 'student'
  })

  const roles: UserRole[] = ['student', 'alumni', 'faculty', 'driver', 'admin']

  it.each(roles)('renders every secondary destination for %s', async (role) => {
    mockRole = role
    const user = userEvent.setup()
    renderNav()

    await user.click(screen.getByRole('button', { name: 'Profile menu' }))

    RAILS[role].secondary.forEach((row) => {
      expect(screen.getByRole('menuitem', { name: row.label })).toBeInTheDocument()
    })
    // The account items the rail gave up must survive alongside them.
    expect(screen.getByRole('menuitem', { name: 'View profile' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument()
  })

  it('navigates to a secondary destination when picked', async () => {
    const user = userEvent.setup()
    renderNav()

    await user.click(screen.getByRole('button', { name: 'Profile menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'Lost & found' }))

    expect(navigate).toHaveBeenCalledWith('/lost-found')
  })

  it('shows the role-aware primary action', async () => {
    mockRole = 'alumni'
    renderNav()
    expect(screen.getByRole('button', { name: 'Post a job' })).toBeInTheDocument()
  })
})
