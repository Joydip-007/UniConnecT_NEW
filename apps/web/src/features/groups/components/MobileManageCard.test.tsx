import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/msw/server'
import { MobileManageCard } from './MobileManageCard'
import type { Group } from '../types'

const navigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: 'g1',
    name: 'UIU robotics club',
    type: 'club',
    description: null,
    avatarUrl: null,
    coverUrl: null,
    isPrivate: false,
    memberCount: 284,
    isMember: true,
    userRole: 'admin',
    allowedRole: null,
    isSystem: false,
    department: null,
    createdBy: 'u9',
    ...overrides,
  }
}

function renderCard(group: Group, onToggleSettings = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  server.use(
    http.get('*/groups/g1/review/summary', () =>
      HttpResponse.json({ data: { pendingPosts: 1, pendingEvents: 0, pendingJoinRequests: 2, reportsOpen: 0 } }),
    ),
  )
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/groups/g1']}>
        <MobileManageCard group={group} onToggleSettings={onToggleSettings} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('MobileManageCard', () => {
  beforeEach(() => {
    navigate.mockClear()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders nothing above the 767px breakpoint', () => {
    stubMatchMedia(false)
    renderCard(makeGroup())
    expect(screen.queryByText('Manage this group')).not.toBeInTheDocument()
  })

  it('renders nothing for a non-admin member under 767px', () => {
    stubMatchMedia(true)
    renderCard(makeGroup({ userRole: 'member' }))
    expect(screen.queryByText('Manage this group')).not.toBeInTheDocument()
  })

  it('shows queue counts and action chips for an admin under 767px', async () => {
    stubMatchMedia(true)
    renderCard(makeGroup())

    expect(screen.getByText('Manage this group')).toBeInTheDocument()
    expect(await screen.findByText('2 requests waiting')).toBeInTheDocument()
    expect(screen.getByText('1 waiting')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Invite members/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Group settings/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Analytics/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Moderation log/ })).toBeInTheDocument()
  })

  it('omits the Group settings chip for a system group', async () => {
    stubMatchMedia(true)
    renderCard(makeGroup({ isSystem: true }))
    await screen.findByText('2 requests waiting')
    expect(screen.queryByRole('button', { name: /Group settings/ })).not.toBeInTheDocument()
  })

  it('calls onToggleSettings when the Group settings chip is clicked', async () => {
    stubMatchMedia(true)
    const onToggleSettings = vi.fn()
    const user = userEvent.setup()
    renderCard(makeGroup(), onToggleSettings)
    await screen.findByText('2 requests waiting')

    await user.click(screen.getByRole('button', { name: /Group settings/ }))
    expect(onToggleSettings).toHaveBeenCalledTimes(1)
  })

  it('deep-links Review on join requests to the tab', async () => {
    stubMatchMedia(true)
    const user = userEvent.setup()
    renderCard(makeGroup())

    const reviews = await screen.findAllByRole('button', { name: 'Review' })
    await user.click(reviews[0])
    expect(navigate).toHaveBeenCalledWith({ search: 'tab=join-requests' })
  })
})
