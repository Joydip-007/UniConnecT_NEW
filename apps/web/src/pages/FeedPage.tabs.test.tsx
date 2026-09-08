import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FeedPage from './FeedPage'

/** Records what FeedPage asks usePosts for, so we assert the request, not the label. */
const requestedFilters: string[] = []
const requestedCalls: { filter: string; scope?: string }[] = []

vi.mock('@/features/feed/hooks/usePosts', () => ({
  usePosts: (filter: string, _sort: string, scope?: string) => {
    requestedFilters.push(filter)
    requestedCalls.push({ filter, scope })
    return {
      data: { pages: [{ items: [], total: 0, page: 1, hasMore: false }] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
    }
  },
}))

vi.mock('@/features/feed/hooks/useFeedSocket', () => ({ useFeedSocket: () => {} }))
vi.mock('@/features/feed/hooks/useFeedShortcuts', () => ({ useFeedShortcuts: () => {} }))
vi.mock('@/features/onboarding', () => ({ OnboardingChecklist: () => null }))
vi.mock('@/features/feed/components/CreatePost', () => ({ CreatePost: () => null }))
vi.mock('@/features/feed/components/CommentDrawer', () => ({ CommentDrawer: () => null }))
vi.mock('@/features/feed/components/ShortcutHelp', () => ({ ShortcutHelp: () => null }))
vi.mock('@/features/learning', () => ({ LearnFeedCard: () => null }))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector({ user: { universityId: 'uni-1' } }),
}))

// jsdom has no IntersectionObserver; the feed uses one purely for infinite scroll.
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return [] }
}
vi.stubGlobal('IntersectionObserver', NoopObserver)

function LocationProbe() {
  const { search } = useLocation()
  return <div data-testid="search">{search}</div>
}

function renderFeed(route = '/feed') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route
            path="/feed"
            element={
              <>
                <FeedPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('FeedPage filter tabs', () => {
  beforeEach(() => {
    requestedFilters.length = 0
    requestedCalls.length = 0
  })

  it('defaults to the unfiltered feed', () => {
    renderFeed()
    expect(requestedFilters[0]).toBe('all')
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true')
  })

  it('requests campus news when that tab is picked, and reflects it in the URL', async () => {
    const user = userEvent.setup()
    renderFeed()

    await user.click(screen.getByRole('tab', { name: 'Campus news' }))

    expect(requestedFilters[requestedFilters.length - 1]).toBe('news')
    expect(screen.getByTestId('search').textContent).toContain('tab=news')
  })

  it('honours a deep link straight to a tab', () => {
    renderFeed('/feed?tab=announcement')
    expect(requestedFilters[0]).toBe('announcement')
    expect(screen.getByRole('tab', { name: 'Announcements' })).toHaveAttribute('aria-selected', 'true')
  })

  it('falls back to all when the tab param is not a real filter', () => {
    renderFeed('/feed?tab=nonsense')
    expect(requestedFilters[0]).toBe('all')
  })

  it('asks the server to scope the feed to my groups, not just relabel it', async () => {
    const user = userEvent.setup()
    renderFeed()

    await user.click(screen.getByRole('tab', { name: 'My groups' }))

    const last = requestedCalls[requestedCalls.length - 1]
    expect(last.scope).toBe('my_groups')
    // The scope narrows by membership, so the type filter stays open.
    expect(last.filter).toBe('all')
    expect(screen.getByTestId('search').textContent).toContain('tab=groups')
  })

  /**
   * Jobs and Events were dropped: both are left-rail rows, and the tab showed only the
   * posts promoting one rather than the board or the calendar. Pinned so a future edit
   * has to justify putting a rail destination back in the tab bar.
   */
  it('offers four tabs, and none that duplicates a left-rail destination', () => {
    renderFeed()
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'All',
      'My groups',
      'Campus news',
      'Announcements',
    ])
  })

  it('sends no scope on tabs that filter purely by type', () => {
    renderFeed('/feed?tab=news')
    expect(requestedCalls[0]).toEqual({ filter: 'news', scope: undefined })
  })

  it('keeps the sort selection when switching tabs', async () => {
    const user = userEvent.setup()
    renderFeed('/feed?sort=top')

    await user.click(screen.getByRole('tab', { name: 'Campus news' }))

    const search = screen.getByTestId('search').textContent ?? ''
    expect(search).toContain('sort=top')
    expect(search).toContain('tab=news')
  })
})
