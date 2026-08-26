import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SavedPage from './SavedPage'
import { PATHS } from '@/router/paths'

// jsdom has no IntersectionObserver, and this page's infinite scroll needs one.
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('IntersectionObserver', NoopObserver)

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ user: { id: 'u1', role: 'student', universityId: 'uni-1' } }),
}))

// Both cards have their own suites; here only the routing between them matters.
vi.mock('@/features/feed/components/PostCard', () => ({
  PostCard: ({ post }: { post: { id: string } }) => <div>saved post {post.id}</div>,
}))
vi.mock('@/features/jobs/components/JobCard', () => ({
  JobCard: ({ job }: { job: { id: string } }) => <div>saved job {job.id}</div>,
}))

const page = (items: { id: string }[]) => ({
  data: { data: { items, total: items.length, page: 1, hasMore: false } },
})

const getMock = vi.fn((url: string) =>
  Promise.resolve(url === '/posts/saved' ? page([{ id: 'p1' }]) : page([{ id: 'j1' }, { id: 'j2' }])),
)
vi.mock('@/lib/axios', () => ({ api: { get: (...args: unknown[]) => getMock(...(args as [string])) } }))

function renderPage(route: string = PATHS.SAVED) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={PATHS.SAVED} element={<SavedPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  getMock.mockClear()
})

describe('SavedPage', () => {
  it('defaults to saved posts', async () => {
    renderPage()
    expect(await screen.findByText('saved post p1')).toBeInTheDocument()
    expect(screen.queryByText('saved job j1')).not.toBeInTheDocument()
  })

  it('reads both saved lists so each tab can carry its own count', async () => {
    renderPage()
    expect(await screen.findByRole('tab', { name: 'Posts 1' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Jobs 2' })).toBeInTheDocument()
  })

  it('opens on jobs when the tab param says so', async () => {
    renderPage(`${PATHS.SAVED}?tab=jobs`)
    expect(await screen.findByText('saved job j1')).toBeInTheDocument()
    expect(screen.queryByText('saved post p1')).not.toBeInTheDocument()
  })

  it('falls back to posts for an unknown tab param rather than rendering nothing', async () => {
    renderPage(`${PATHS.SAVED}?tab=nonsense`)
    expect(await screen.findByText('saved post p1')).toBeInTheDocument()
  })

  it('switches between the two tabs', async () => {
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText('saved post p1')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Jobs 2' }))
    expect(await screen.findByText('saved job j1')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Posts 1' }))
    expect(await screen.findByText('saved post p1')).toBeInTheDocument()
  })

  it('marks the active tab for assistive tech', async () => {
    renderPage()
    expect(await screen.findByRole('tab', { name: 'Posts 1' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Jobs 2' })).toHaveAttribute('aria-selected', 'false')
  })

  it('shows an empty state per tab when nothing is saved', async () => {
    getMock.mockImplementation(() => Promise.resolve(page([])))
    renderPage()
    expect(await screen.findByText('Nothing saved yet')).toBeInTheDocument()
    expect(screen.getByText('Tap the bookmark icon on a post to keep it here.')).toBeInTheDocument()
  })
})
