import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FeedLayout } from './FeedLayout'

vi.mock('@/components/TopNav', () => ({ TopNav: () => <div data-testid="topnav" /> }))
vi.mock('@/components/MobileBottomNav', () => ({ MobileBottomNav: () => <div data-testid="mobile-nav" /> }))
vi.mock('@/components/RightSidebar', () => ({ RightSidebar: () => <aside data-testid="right-sidebar" /> }))
vi.mock('@/components/ToastHost', () => ({ ToastHost: () => null }))
vi.mock('@/features/notifications', () => ({ useNotificationsSocket: vi.fn() }))
vi.mock('@/features/presence', () => ({ usePresenceHeartbeat: vi.fn() }))
vi.mock('@/features/learning', () => ({ useAchievementSocket: vi.fn() }))
vi.mock('@/stores/authStore', () => ({ useAuthStore: () => 'user-1' }))
vi.mock('@/stores/socketStore', () => ({
  useSocketStore: () => ({ connected: true, hasConnected: true }),
}))

vi.mock('@/components/LeftSidebar', () => ({
  LeftSidebar: ({ collapsed, onToggleCollapsed }: { collapsed: boolean; onToggleCollapsed: () => void }) => (
    <button type="button" onClick={onToggleCollapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
      {collapsed ? 'collapsed' : 'expanded'}
    </button>
  ),
}))

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/feed']}>
      <Routes>
        <Route element={<FeedLayout />}>
          <Route path="/feed" element={<div>Feed body</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('FeedLayout sidebar rail state', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts expanded and marks the grid collapsed after toggle', async () => {
    const { container } = renderLayout()
    const grid = container.querySelector('.feed-layout-grid')

    expect(grid).toHaveAttribute('data-left-sidebar', 'expanded')

    await userEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))

    expect(grid).toHaveAttribute('data-left-sidebar', 'collapsed')
    expect(localStorage.getItem('uc:left-sidebar-collapsed')).toBe('true')
  })
})
