import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/msw/server'
import { GroupLeftRail } from './GroupLeftRail'
import { defaultTabFor } from '../groupTabs'
import type { Group } from '../types'

const navigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

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
    userRole: 'member',
    allowedRole: null,
    isSystem: false,
    department: null,
    createdBy: 'u9',
    ...overrides,
  }
}

function renderRail(group: Group, pendingCount = 0, initialEntries = ['/groups/g1']) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  server.use(
    http.get('*/groups/my', () => HttpResponse.json({ data: { items: [], total: 0, page: 1, hasMore: false } })),
  )
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={initialEntries}>
        <GroupLeftRail group={group} activeTab={defaultTabFor(group)} pendingCount={pendingCount} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('GroupLeftRail', () => {
  beforeEach(() => {
    navigate.mockClear()
  })

  it('lists all rows for an academic admin group, with a pending-count badge', () => {
    const group = makeGroup({ type: 'academic', userRole: 'admin' })
    renderRail(group, 3)

    const tabs = screen.getAllByRole('tab').map((t) => t.textContent?.replace(/\d+$/, '').trim())
    expect(tabs).toEqual([
      'Feed',
      'Resources',
      'Study sessions',
      'Academic LMS',
      'Events',
      'Stats',
      'Join requests',
    ])
    expect(screen.getByRole('tab', { name: /Join requests/ })).toHaveTextContent('3')
  })

  it('hides Stats and Join requests for a non-admin club member', () => {
    const group = makeGroup({ type: 'club', userRole: 'member' })
    renderRail(group)

    const tabs = screen.getAllByRole('tab').map((t) => t.textContent)
    expect(tabs.join(' ')).not.toMatch(/Stats/)
    expect(tabs.join(' ')).not.toMatch(/Join requests/)
  })

  it('navigates with the tab in the URL when a row is clicked', async () => {
    const user = userEvent.setup()
    const group = makeGroup({ type: 'club', userRole: 'member' })
    renderRail(group)

    await user.click(screen.getByRole('tab', { name: /Events/ }))
    expect(navigate).toHaveBeenCalledWith({ search: 'tab=events' })
  })
})
