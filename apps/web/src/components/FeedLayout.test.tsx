import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserRole } from '@uniconnect/shared'
import { FeedLayout } from './FeedLayout'
import { PATHS } from '@/router/paths'
import { useShellStore } from '@/stores/shellStore'

vi.mock('@/components/TopNav', () => ({ TopNav: () => <div>top nav</div> }))
vi.mock('@/components/LeftSidebar', () => ({
  LeftSidebar: () => <div>left rail</div>,
}))
vi.mock('@/components/RightSidebar', () => ({ RightSidebar: () => <div>right rail</div> }))
vi.mock('@/components/MobileBottomNav', () => ({ MobileBottomNav: () => <div>bottom nav</div> }))
vi.mock('@/components/ToastHost', () => ({ ToastHost: () => null }))
vi.mock('@/features/notifications', () => ({ useNotificationsSocket: () => {} }))
vi.mock('@/features/presence', () => ({ usePresenceHeartbeat: () => {} }))
vi.mock('@/features/learning', () => ({ useAchievementSocket: () => {} }))

let currentRole: UserRole = 'student'

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ user: { id: 'u1', role: currentRole } }),
}))
vi.mock('@/stores/socketStore', () => ({
  useSocketStore: () => ({ connected: true, hasConnected: true }),
}))

function renderLayout(route: string, role: UserRole = 'student') {
  currentRole = role
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route element={<FeedLayout />}>
          <Route path={PATHS.FEED} element={<div>feed content</div>} />
          <Route path={PATHS.ADMIN} element={<div>admin content</div>} />
          <Route path={PATHS.NEWS} element={<div>news content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  currentRole = 'student'
  useShellStore.setState({ bareCount: 0 })
})

describe('FeedLayout', () => {
  it('wraps the feed in the full three-column shell', () => {
    renderLayout(PATHS.FEED)
    expect(screen.getByText('feed content')).toBeInTheDocument()
    expect(screen.getByText('left rail')).toBeInTheDocument()
    expect(screen.getByText('right rail')).toBeInTheDocument()
    expect(screen.getByText('top nav')).toBeInTheDocument()
  })

  it('renders the admin panel inside the same shell, keeping rail and top nav', () => {
    renderLayout(PATHS.ADMIN, 'admin')
    expect(screen.getByText('admin content')).toBeInTheDocument()
    expect(screen.getByText('left rail')).toBeInTheDocument()
    expect(screen.getByText('top nav')).toBeInTheDocument()
  })

  it('keeps the right rail for admin, which has a payload of its own', () => {
    const { container } = renderLayout(PATHS.ADMIN, 'admin')
    expect(screen.getByText('right rail')).toBeInTheDocument()
    expect(container.querySelector('.feed-layout-grid')).not.toHaveAttribute('data-wide')
  })

  it('drops the right rail for a driver, whose manifest lists no widgets', () => {
    const { container } = renderLayout(PATHS.NEWS, 'driver')
    expect(screen.queryByText('right rail')).not.toBeInTheDocument()
    expect(container.querySelector('.feed-layout-grid')).toHaveAttribute('data-wide')
  })

  it('drops the column by role, not by route — the same driver rail is absent on shuttle too', () => {
    renderLayout(PATHS.FEED, 'driver')
    expect(screen.queryByText('right rail')).not.toBeInTheDocument()
  })

  it('drops both rails while an error surface holds the shell bare', () => {
    const { container } = renderLayout(PATHS.FEED)
    act(() => useShellStore.getState().acquireBare())
    expect(screen.queryByText('left rail')).not.toBeInTheDocument()
    expect(screen.queryByText('right rail')).not.toBeInTheDocument()
    expect(screen.getByText('top nav')).toBeInTheDocument()
    expect(container.querySelector('.feed-layout-grid')).toHaveAttribute('data-bare')

    act(() => useShellStore.getState().releaseBare())
    expect(screen.getByText('left rail')).toBeInTheDocument()
    expect(screen.getByText('right rail')).toBeInTheDocument()
  })

  it('shows the offline strip only while the browser is offline', () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    renderLayout(PATHS.FEED)
    expect(screen.getByText(/You're offline/)).toBeInTheDocument()

    onLine.mockReturnValue(true)
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(screen.queryByText(/You're offline/)).not.toBeInTheDocument()
    onLine.mockRestore()
  })
})
