import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserRole } from '@uniconnect/shared'
import { TopNav } from './TopNav'
import { RAILS, TOPNAV_ICON_ROUTES } from './leftSidebar.config'

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
      // Messages and Notifications are excluded on purpose: each already has its own
      // badged icon and peek popover a few pixels away in this same bar, so a menu row
      // would be the weaker of two controls for one feature.
      if (TOPNAV_ICON_ROUTES.includes(row.to)) {
        expect(screen.queryByRole('menuitem', { name: row.label })).not.toBeInTheDocument()
        return
      }
      expect(screen.getByRole('menuitem', { name: row.label })).toBeInTheDocument()
    })
    // The account items the rail gave up must survive alongside them.
    expect(screen.getByRole('menuitem', { name: 'View profile' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument()
  })

  it.each(roles)('still reaches the icon routes from the mobile More sheet for %s', (role) => {
    // The sheet renders `secondary` verbatim and mobile hides both top-bar icons, so the
    // filter above must live in TopNav, never in the manifest.
    const sheet = RAILS[role].secondary.map((row) => row.to)
    TOPNAV_ICON_ROUTES.forEach((path) => {
      const reachable = sheet.includes(path) || RAILS[role].fixed.some((row) => row.to === path)
      expect(reachable, `${role} cannot reach ${path} on a phone`).toBe(true)
    })
  })

  it('navigates to a secondary destination when picked', async () => {
    // The row is taken from the manifest rather than named literally: this test cares
    // that picking a menu row navigates, not that any particular feature is in the menu.
    // Hardcoding one meant the test had to be edited when "Lost & found" was removed for
    // being a second home for a feature that already owns an Explore section tab.
    const row = RAILS.student.secondary.find((r) => !TOPNAV_ICON_ROUTES.includes(r.to))
    if (!row) throw new Error('no non-icon secondary row to exercise the avatar menu with')

    const user = userEvent.setup()
    renderNav()

    await user.click(screen.getByRole('button', { name: 'Profile menu' }))
    await user.click(screen.getByRole('menuitem', { name: row.label }))

    expect(navigate).toHaveBeenCalledWith(row.to)
  })

  it('offers the same search placeholder to every role', () => {
    // Search is global — one endpoint, one result set, no role scoping — so the nav must
    // not imply otherwise. A per-role placeholder promised variance that never existed.
    const seen = new Set<string>()
    ;(['student', 'alumni', 'faculty', 'admin'] as const).forEach((role) => {
      mockRole = role
      const { unmount } = renderNav()
      seen.add(screen.getByRole('combobox', { name: 'Search' }).getAttribute('placeholder') ?? '')
      unmount()
    })
    expect(seen.size).toBe(1)
  })
})

/**
 * The nav slides away on scroll-down, and the feed filter bar sticks underneath it.
 * Without this flag the bar keeps a nav-height offset over empty space and posts scroll
 * through the gap, so the flag is the contract between the two.
 */
describe('TopNav sticky-offset flag', () => {
  function scrollTo(y: number) {
    Object.defineProperty(window, 'scrollY', { value: y, writable: true, configurable: true })
    act(() => {
      window.dispatchEvent(new Event('scroll'))
    })
  }

  beforeEach(() => {
    scrollTo(0)
    delete document.documentElement.dataset.navHidden
  })

  it('flags the root element only while the nav is off-screen', () => {
    renderNav()
    expect(document.documentElement.dataset.navHidden).toBeUndefined()

    scrollTo(400)
    expect(document.documentElement.dataset.navHidden).toBe('true')

    scrollTo(200)
    expect(document.documentElement.dataset.navHidden).toBeUndefined()
  })

  it('clears the flag on unmount rather than stranding it on a page with no nav', () => {
    const { unmount } = renderNav()
    scrollTo(400)
    expect(document.documentElement.dataset.navHidden).toBe('true')

    unmount()
    expect(document.documentElement.dataset.navHidden).toBeUndefined()
  })
})
