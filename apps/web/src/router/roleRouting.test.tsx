import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { UserRole } from '@uniconnect/shared'
import ProtectedRoute from './ProtectedRoute'
import { PATHS } from './paths'
import { RAILS } from '@/components/leftSidebar.config'
import { isRouteAllowedForRole } from '@/config/roleShell'

let mockUser: { id: string; role: UserRole; isVerified: boolean } | null = null

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ accessToken: mockUser ? 'token' : null, user: mockUser }),
}))

function renderAt(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path={PATHS.MESSAGES} element={<div>messages page</div>} />
          <Route path={PATHS.NEWS} element={<div>news page</div>} />
          <Route path={PATHS.SHUTTLE} element={<div>shuttle page</div>} />
          <Route path={PATHS.JOBS} element={<div>jobs page</div>} />
          <Route path={PATHS.FEED} element={<div>feed page</div>} />
        </Route>
        <Route path={PATHS.SHUTTLE_DRIVE} element={<div>duty board</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('driver route access', () => {
  it('lets a driver reach every route its own rail offers', () => {
    mockUser = { id: 'd1', role: 'driver', isVerified: true }

    RAILS.driver.fixed.forEach((row) => {
      expect(isRouteAllowedForRole('driver', row.to.split('?')[0])).toBe(true)
    })
    RAILS.driver.tools.forEach((tool) => {
      if (tool.to) expect(isRouteAllowedForRole('driver', tool.to)).toBe(true)
    })
  })

  it('renders the messages page for a driver instead of bouncing to the duty board', () => {
    mockUser = { id: 'd1', role: 'driver', isVerified: true }
    renderAt(PATHS.MESSAGES)
    expect(screen.getByText('messages page')).toBeInTheDocument()
  })

  it('still sends a driver from the member feed to the duty board', () => {
    mockUser = { id: 'd1', role: 'driver', isVerified: true }
    renderAt(PATHS.FEED)
    expect(screen.getByText('duty board')).toBeInTheDocument()
  })

  it('still sends a driver away from jobs, which its rail never offers', () => {
    mockUser = { id: 'd1', role: 'driver', isVerified: true }
    renderAt(PATHS.JOBS)
    expect(screen.getByText('duty board')).toBeInTheDocument()
  })

  it('leaves non-driver roles unrestricted', () => {
    mockUser = { id: 's1', role: 'student', isVerified: true }
    renderAt(PATHS.JOBS)
    expect(screen.getByText('jobs page')).toBeInTheDocument()
  })
})
