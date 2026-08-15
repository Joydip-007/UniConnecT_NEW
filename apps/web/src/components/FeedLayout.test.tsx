import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { FeedLayout } from './FeedLayout'
import { PATHS } from '@/router/paths'

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
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector({ user: { id: 'u1' } }),
}))
vi.mock('@/stores/socketStore', () => ({
  useSocketStore: () => ({ connected: true, hasConnected: true }),
}))

function renderLayout(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route element={<FeedLayout />}>
          <Route path={PATHS.FEED} element={<div>feed content</div>} />
          <Route path={PATHS.ADMIN} element={<div>admin content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('FeedLayout', () => {
  it('wraps the feed in the full three-column shell', () => {
    renderLayout(PATHS.FEED)
    expect(screen.getByText('feed content')).toBeInTheDocument()
    expect(screen.getByText('left rail')).toBeInTheDocument()
    expect(screen.getByText('right rail')).toBeInTheDocument()
    expect(screen.getByText('top nav')).toBeInTheDocument()
  })

  it('renders the admin panel inside the same shell, keeping rail and top nav', () => {
    renderLayout(PATHS.ADMIN)
    expect(screen.getByText('admin content')).toBeInTheDocument()
    expect(screen.getByText('left rail')).toBeInTheDocument()
    expect(screen.getByText('top nav')).toBeInTheDocument()
  })

  it('drops the right rail on admin, which has no right-rail payload of its own', () => {
    const { container } = renderLayout(PATHS.ADMIN)
    expect(screen.queryByText('right rail')).not.toBeInTheDocument()
    expect(container.querySelector('.feed-layout-grid')).toHaveAttribute('data-wide')
  })

  it('keeps the right rail everywhere else', () => {
    const { container } = renderLayout(PATHS.FEED)
    expect(container.querySelector('.feed-layout-grid')).not.toHaveAttribute('data-wide')
  })
})
