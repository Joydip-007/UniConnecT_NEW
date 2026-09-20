import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/msw/server'
import { useAuthStore } from '@/stores/authStore'
import GroupDetailPage from './GroupDetailPage'
import type { Group } from '@/features/groups'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// The tab bodies each own a query; only the ones a test lands on need a handler,
// and the rest are stubbed so an unrelated fetch cannot fail the route assertion.
vi.mock('@/features/groups/components/FeedTab', () => ({ FeedTab: () => <div>feed-body</div> }))
vi.mock('@/features/groups/components/MembersTab', () => ({ MembersTab: () => <div>members-body</div> }))
vi.mock('@/features/groups/components/AdminStatsTab', () => ({ AdminStatsTab: () => <div>stats-body</div> }))
vi.mock('@/features/groups/components/AboutTab', () => ({ AboutTab: () => <div>about-body</div> }))

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: 'g1',
    name: 'UIU robotics club',
    type: 'club',
    description: null,
    avatarUrl: null,
    coverUrl: null,
    isPrivate: false,
    memberCount: 12,
    isMember: true,
    userRole: 'member',
    allowedRole: null,
    isSystem: false,
    department: null,
    createdBy: 'u9',
    ...overrides,
  }
}

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="location">{loc.pathname + loc.search}</div>
}

function renderAt(url: string, group: Group) {
  server.use(
    http.get('*/groups/g1', () => HttpResponse.json({ data: group })),
    http.get('*/groups/g1/join-requests', () => HttpResponse.json({ data: { items: [], total: 0, page: 1, hasMore: false } })),
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/groups/:id" element={<><GroupDetailPage /><LocationProbe /></>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} })
  useAuthStore.setState({
    user: { id: 'u1', role: 'student' } as never,
    accessToken: 'token',
  } as never)
})

describe('GroupDetailPage routes', () => {
  it('lands on the section named in the URL', async () => {
    renderAt('/groups/g1?tab=members', makeGroup())
    expect(await screen.findByText('members-body')).toBeInTheDocument()
  })

  it('falls back to the feed for a tab the role does not earn', async () => {
    // A member following an admin's Stats link must not get an empty panel.
    renderAt('/groups/g1?tab=stats', makeGroup())
    expect(await screen.findByText('feed-body')).toBeInTheDocument()
    expect(screen.queryByText('stats-body')).not.toBeInTheDocument()
  })

  it('writes the tab to the URL and keeps the default out of it', async () => {
    renderAt('/groups/g1', makeGroup())
    await screen.findByText('feed-body')
    await userEvent.click(screen.getByRole('tab', { name: 'About' }))
    expect(await screen.findByText('about-body')).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/groups/g1?tab=about')
    await userEvent.click(screen.getByRole('tab', { name: 'Feed' }))
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/groups\/g1$/)
  })

  it('opens the share dialog from ?modal=share and clears it on close', async () => {
    renderAt('/groups/g1?modal=share', makeGroup())
    const dialog = await screen.findByRole('dialog', { name: 'Share this group' })
    expect(dialog).toHaveTextContent('/groups/g1')
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/groups\/g1$/)
  })

  it('routes the share button through the URL', async () => {
    renderAt('/groups/g1', makeGroup())
    await screen.findByText('feed-body')
    await userEvent.click(await screen.findByRole('button', { name: 'Share group' }))
    expect(await screen.findByRole('dialog', { name: 'Share this group' })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/groups/g1?modal=share')
  })

  it('ignores ?modal=invite for a viewer who cannot invite', async () => {
    renderAt('/groups/g1?modal=invite', makeGroup({ userRole: 'member' }))
    await screen.findByText('feed-body')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Invite' })).not.toBeInTheDocument()
  })

  it('opens the invite dialog for an admin from ?modal=invite', async () => {
    renderAt('/groups/g1?modal=invite', makeGroup({ userRole: 'admin' }))
    expect(await screen.findByRole('dialog', { name: /invite/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Invite' })).toBeInTheDocument()
  })

  it('sends the member count to the members section', async () => {
    renderAt('/groups/g1', makeGroup())
    await screen.findByText('feed-body')
    await userEvent.click(await screen.findByRole('button', { name: /12 members/ }))
    expect(await screen.findByText('members-body')).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/groups/g1?tab=members')
  })
})
