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
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector({ user: { id: 'u1', role: currentRole } }),
}))

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

vi.mock('@/pages/ConnectionsPage', () => ({
  default: () => <div>connections panel</div>,
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
  it('shows groups by default and folds connections in behind a People tab', async () => {
    const user = userEvent.setup()
    renderPage(<GroupsPage />, '/groups')

    expect(screen.queryByText('connections panel')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'People' }))
    expect(screen.getByText('connections panel')).toBeInTheDocument()
  })

  it('honours a deep link to the people section', () => {
    renderPage(<GroupsPage />, '/groups?section=people')
    expect(screen.getByText('connections panel')).toBeInTheDocument()
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

  it('hides the group-type filter there, which would contradict the tab', async () => {
    currentRole = 'faculty'
    renderPage(<GroupsPage />, '/groups')

    await screen.findByRole('button', { name: 'My sections' })
    expect(screen.getByLabelText('Group types')).not.toBeVisible()
  })

  it('restores the type filter once faculty switches to all groups', async () => {
    const user = userEvent.setup()
    currentRole = 'faculty'
    renderPage(<GroupsPage />, '/groups')

    await user.click(await screen.findByRole('button', { name: 'Groups' }))
    expect(screen.getByLabelText('Group types')).toBeVisible()
  })

  it('gives no other role the sections tab, and ignores the param for them', async () => {
    currentRole = 'student'
    renderPage(<GroupsPage />, '/groups?section=sections')

    expect(screen.queryByRole('button', { name: 'My sections' })).not.toBeInTheDocument()
    await waitFor(() => expect(groupsGet).toHaveBeenCalled())
    expect(requestedType()).toBeNull()
  })
})
