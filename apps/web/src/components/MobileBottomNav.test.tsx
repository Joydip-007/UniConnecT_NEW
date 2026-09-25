import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserRole } from '@uniconnect/shared'
import { MobileBottomNav } from './MobileBottomNav'
import { RAILS } from './leftSidebar.config'

let mockRole: UserRole = 'student'

vi.mock('@/hooks/useViewTransitionNavigate', () => ({
  useViewTransitionNavigate: () => vi.fn(),
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ user: { id: 'u1', role: mockRole } }),
}))

vi.mock('@/stores/notificationsStore', () => ({
  useNotificationsStore: () => ({ messageCount: 0, notificationCount: 0 }),
}))

function renderNav(route = '/feed') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <MobileBottomNav />
    </MemoryRouter>,
  )
}

describe('MobileBottomNav', () => {
  beforeEach(() => {
    mockRole = 'student'
  })

  const roles: UserRole[] = ['student', 'alumni', 'faculty', 'driver', 'admin']

  const moreRoles = roles.filter((role) => RAILS[role].mobileBar !== 'all-fixed')

  it.each(moreRoles)('mirrors the first four fixed rail rows for %s, plus More', (role) => {
    mockRole = role
    renderNav()

    const expected = RAILS[role].fixed.slice(0, 4).map((row) => row.label)
    expected.forEach((label) => {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument()
  })

  it('gives the driver all five duty tabs with their short labels and no More', () => {
    mockRole = 'driver'
    renderNav('/shuttle/drive?tab=duty')
    ;['Drive', 'Duty', 'Live', 'News', 'Messages'].forEach((label) => {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: 'More' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Duty' })).toHaveAttribute('aria-current', 'page')
  })

  it('never marks two slots active when rows share a base path', () => {
    mockRole = 'admin'
    renderNav('/admin')

    const active = screen
      .getAllByRole('button')
      .filter((el) => el.getAttribute('aria-current') === 'page')
    expect(active).toHaveLength(1)
  })

  it('offers a driver no route its rail does not carry', () => {
    mockRole = 'driver'
    renderNav('/shuttle/drive')

    expect(screen.queryByRole('button', { name: 'Jobs' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mentorship' })).not.toBeInTheDocument()
  })
})
