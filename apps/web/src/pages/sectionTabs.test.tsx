import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import type { UserRole } from '@uniconnect/shared'
import { server } from '@/tests/msw/server'
import GroupsPage from './GroupsPage'
import ExplorePage from './ExplorePage'

let currentRole: UserRole = 'student'
// The axios request interceptor reads `useAuthStore.getState().accessToken`, so a mock
// that only supplies the hook makes every request throw before it reaches MSW — and the
// failure is silent, since TanStack Query just leaves the list empty. Anything asserting
// on fetched rows needs `getState` here.
vi.mock('@/stores/authStore', () => {
  const state = { user: { id: 'u1', role: 'student' as UserRole }, accessToken: 'test-token' }
  const useAuthStore = (selector: (s: unknown) => unknown) =>
    selector({ ...state, user: { id: 'u1', role: currentRole } })
  useAuthStore.getState = () => ({ ...state, user: { id: 'u1', role: currentRole }, clearAuth: () => {} })
  return { useAuthStore }
})

// The sections view differs from the groups view only in the `type` it asks the API
// for, and GroupCard is stubbed out here — so the request itself is the observable.
const { groupsGet } = vi.hoisted(() => ({ groupsGet: vi.fn() }))
vi.mock('@/lib/axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/axios')>()
  return {
    ...actual,
    api: {
      ...actual.api,
      get: (url: string, config?: unknown) => {
        if (url === '/groups') groupsGet(url, config)
        return actual.api.get(url, config as never)
      },
    },
  }
})

class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return [] }
}
vi.stubGlobal('IntersectionObserver', NoopObserver)

vi.mock('@/features/connections', () => ({
  PeopleDirectory: () => <div>people directory</div>,
}))
vi.mock('@/pages/LostFoundPage', () => ({
  default: () => <div>lost and found panel</div>,
}))
vi.mock('@/features/groups', () => ({
  CreateGroupModal: () => null,
  GroupCard: () => null,
}))
vi.mock('@/features/explore', () => ({ useDiscovery: () => ({ data: null, isLoading: false }) }))

beforeEach(() => {
  currentRole = 'student'
  groupsGet.mockClear()
  server.use(
    http.get('*/groups', () => HttpResponse.json({ data: { items: [], hasMore: false, page: 1 } })),
    http.get('*/explore/discovery', () => HttpResponse.json({ data: null })),
  )
})

/** The `type` param GroupsPage asked for on its first fetch, or null if it sent none. */
function requestedType(): string | null {
  const params = groupsGet.mock.calls[0]?.[1]?.params as Record<string, unknown> | undefined
  return (params?.type as string) ?? null
}

function renderPage(ui: React.ReactElement, route: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('GroupsPage people section', () => {
  it('shows groups by default and folds the people directory in behind a People tab', async () => {
    const user = userEvent.setup()
    renderPage(<GroupsPage />, '/groups')

    expect(screen.queryByText('people directory')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'People' }))
    expect(screen.getByText('people directory')).toBeInTheDocument()
  })

  it('honours a deep link to the people section', () => {
    renderPage(<GroupsPage />, '/groups?section=people')
    expect(screen.getByText('people directory')).toBeInTheDocument()
  })

  // Each view owns its own chip set, so a chip that only exists on one side of the
  // switch must not survive the crossing — it would filter the other list by nothing.
  it('swaps the filter chips with the view and drops the one that was applied', async () => {
    const user = userEvent.setup()
    renderPage(<GroupsPage />, '/groups')

    await user.click(screen.getByRole('button', { name: 'Clubs' }))
    expect(screen.getByRole('button', { name: 'Clubs' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'People' }))
    expect(screen.queryByRole('button', { name: 'Clubs' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Alumni' })).toHaveAttribute('aria-pressed', 'false')
  })

  // "Suggested for you / from your department and batch" is a claim about how the
  // list was built. Once you filter or search, it is simply not true any more.
  it('stops calling results suggestions once the list is narrowed', async () => {
    const user = userEvent.setup()
    server.use(
      http.get('*/groups', () =>
        HttpResponse.json({
          data: {
            items: [{ id: 'g1', name: 'Campus photography', type: 'interest', isMember: false }],
            total: 1,
            hasMore: false,
            page: 1,
          },
        }),
      ),
    )
    renderPage(<GroupsPage />, '/groups')

    expect(await screen.findByRole('heading', { name: 'Suggested for you' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Interest' }))

    expect(await screen.findByRole('heading', { name: 'Other matches' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Suggested for you' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Browse by type' })).not.toBeInTheDocument()
  })

  // "Joined" is a relationship, not a group `type` — sending it as one would 422.
  it('applies the Joined chip client-side rather than as a type filter', async () => {
    const user = userEvent.setup()
    renderPage(<GroupsPage />, '/groups')

    await waitFor(() => expect(groupsGet).toHaveBeenCalled())
    groupsGet.mockClear()

    await user.click(screen.getByRole('button', { name: 'Joined' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Joined' })).toHaveAttribute('aria-pressed', 'true'))

    const params = groupsGet.mock.calls.map((c) => (c[1] as { params?: Record<string, unknown> })?.params)
    expect(params.every((p) => p?.type === undefined)).toBe(true)
  })
})

describe('ExplorePage lost & found section', () => {
  it('absorbs lost & found as a section without losing discovery', async () => {
    const user = userEvent.setup()
    renderPage(<ExplorePage />, '/explore')

    expect(screen.queryByText('lost and found panel')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Lost & found' }))
    expect(screen.getByText('lost and found panel')).toBeInTheDocument()
  })

  it('honours a deep link to the lost & found section', () => {
    renderPage(<ExplorePage />, '/explore?section=lost-found')
    expect(screen.getByText('lost and found panel')).toBeInTheDocument()
  })
})

describe('GroupsPage faculty sections view', () => {
  it('lands faculty on My sections, since sections are their unit of navigation', async () => {
    currentRole = 'faculty'
    renderPage(<GroupsPage />, '/groups')

    expect(await screen.findByRole('button', { name: 'My sections' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('fetches only academic groups in the sections view', async () => {
    currentRole = 'faculty'
    renderPage(<GroupsPage />, '/groups')

    await waitFor(() => expect(groupsGet).toHaveBeenCalled())
    expect(requestedType()).toBe('academic')
  })

  it('hides the group-type chips there, which would contradict the tab', async () => {
    currentRole = 'faculty'
    renderPage(<GroupsPage />, '/groups')

    await screen.findByRole('button', { name: 'My sections' })
    expect(screen.queryByRole('button', { name: 'Clubs' })).not.toBeInTheDocument()
  })

  it('restores the type chips once faculty switches to all groups', async () => {
    const user = userEvent.setup()
    currentRole = 'faculty'
    renderPage(<GroupsPage />, '/groups')

    await user.click(await screen.findByRole('button', { name: /^Groups/ }))
    expect(screen.getByRole('button', { name: 'Clubs' })).toBeInTheDocument()
  })

  it('gives no other role the sections tab, and ignores the param for them', async () => {
    currentRole = 'student'
    renderPage(<GroupsPage />, '/groups?section=sections')

    expect(screen.queryByRole('button', { name: 'My sections' })).not.toBeInTheDocument()
    await waitFor(() => expect(groupsGet).toHaveBeenCalled())
    expect(requestedType()).toBeNull()
  })
})
