import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserRole } from '@uniconnect/shared'
import JobsPage from './JobsPage'
import { PATHS } from '@/router/paths'

// jsdom has no IntersectionObserver, and this page's infinite scroll needs one.
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('IntersectionObserver', NoopObserver)

let currentRole: UserRole = 'student'

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector({ user: { id: 'u1', role: currentRole } }),
}))

// The two panels are covered by their own suites; what matters here is which one the
// role and the `view` param select, so they are stubbed down to a marker.
vi.mock('@/features/jobs/components/MyPostingsPanel', () => ({
  MyPostingsPanel: () => <div>my postings panel</div>,
}))

const getMock = vi.fn(() =>
  Promise.resolve({ data: { data: { items: [], total: 0, page: 1, hasMore: false } } }),
)
vi.mock('@/lib/axios', () => ({ api: { get: (...args: unknown[]) => getMock(...(args as [])) } }))

function renderPage(role: UserRole, route: string = PATHS.JOBS) {
  currentRole = role
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={PATHS.JOBS} element={<JobsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  currentRole = 'student'
  getMock.mockClear()
})

describe('JobsPage views', () => {
  it('defaults an alumnus to their own postings', async () => {
    renderPage('alumni')
    expect(await screen.findByText('my postings panel')).toBeInTheDocument()
  })

  it('does not fetch the browse feed while an alumnus is on my postings', () => {
    renderPage('alumni')
    expect(getMock).not.toHaveBeenCalled()
  })

  it('defaults a student to browse, with no view switcher at all', async () => {
    renderPage('student')
    expect(screen.queryByText('my postings panel')).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Jobs views' })).not.toBeInTheDocument()
    expect(await screen.findByPlaceholderText('Search jobs, companies, skills…')).toBeInTheDocument()
  })

  it('ignores view=mine for a student, who cannot post', () => {
    renderPage('student', `${PATHS.JOBS}?view=mine`)
    expect(screen.queryByText('my postings panel')).not.toBeInTheDocument()
  })

  it('defaults faculty and admin to browse, since jobs are a secondary surface for them', () => {
    renderPage('faculty')
    expect(screen.queryByText('my postings panel')).not.toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Jobs views' })).toBeInTheDocument()
  })

  it('honours an explicit view param over the role default', async () => {
    renderPage('alumni', `${PATHS.JOBS}?view=browse`)
    expect(screen.queryByText('my postings panel')).not.toBeInTheDocument()
    expect(await screen.findByPlaceholderText('Search jobs, companies, skills…')).toBeInTheDocument()
  })

  it('lets an alumnus switch to browse and back', async () => {
    const user = userEvent.setup()
    renderPage('alumni')
    expect(await screen.findByText('my postings panel')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Browse' }))
    expect(screen.queryByText('my postings panel')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'My postings' }))
    expect(await screen.findByText('my postings panel')).toBeInTheDocument()
  })

  it('marks the active view for assistive tech', async () => {
    renderPage('alumni')
    expect(await screen.findByRole('button', { name: 'My postings' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Browse' })).not.toHaveAttribute('aria-current')
  })
})
