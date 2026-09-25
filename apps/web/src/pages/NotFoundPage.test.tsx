import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserRole } from '@uniconnect/shared'
import NotFoundPage from './NotFoundPage'
import { PATHS } from '@/router/paths'

let mockUser: { id: string; role: UserRole } | null = null

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ accessToken: mockUser ? 'token' : null, user: mockUser }),
}))

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={PATHS.FEED} element={<div>feed page</div>} />
        <Route path={PATHS.ADMIN} element={<div>admin dashboard</div>} />
        <Route path={PATHS.SHUTTLE_DRIVE} element={<div>duty board</div>} />
        <Route path={PATHS.LOGIN} element={<div>login page</div>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockUser = null
})

describe('NotFoundPage', () => {
  it('shows the address that failed so a typo is obvious', () => {
    mockUser = { id: 's1', role: 'student' }
    renderAt('/evnets/tech-fest-2026')
    expect(screen.getByText(/\/evnets\/tech-fest-2026/)).toBeInTheDocument()
  })

  it.each<[UserRole, string, string]>([
    ['student', 'Back to feed', 'feed page'],
    ['admin', 'Back to dashboard', 'admin dashboard'],
    ['driver', 'Back to duty board', 'duty board'],
  ])('sends a %s straight to their own home', async (role, label, landing) => {
    mockUser = { id: 'u1', role }
    renderAt('/nope')
    expect(screen.getByRole('button', { name: /Go back/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: new RegExp(label) }))
    expect(screen.getByText(landing)).toBeInTheDocument()
  })

  it('offers a signed-out visitor Sign in and the landing page', async () => {
    renderAt('/nope')
    expect(screen.getByRole('button', { name: /Go to home/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Sign in/ }))
    expect(screen.getByText('login page')).toBeInTheDocument()
  })
})
