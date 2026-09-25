import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MobileTabStrip } from './MobileTabStrip'
import { defaultTabFor } from '../groupTabs'
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

function renderStrip(group: Group, pendingCount = 0) {
  return render(
    <MemoryRouter initialEntries={['/groups/g1']}>
      <MobileTabStrip group={group} activeTab={defaultTabFor(group)} pendingCount={pendingCount} />
    </MemoryRouter>,
  )
}

describe('MobileTabStrip', () => {
  beforeEach(() => {
    navigate.mockClear()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders nothing above the 767px breakpoint', () => {
    stubMatchMedia(false)
    renderStrip(makeGroup())
    expect(screen.queryAllByRole('tab')).toHaveLength(0)
  })

  it('renders the tab chips under 767px, with a pending-count badge', () => {
    stubMatchMedia(true)
    renderStrip(makeGroup({ type: 'academic' }), 3)

    const tabs = screen.getAllByRole('tab').map((t) => t.textContent?.replace(/\d+$/, '').trim())
    expect(tabs).toEqual(['Feed', 'Resources', 'Study sessions', 'Academic LMS', 'Events', 'Stats', 'Join requests'])
    expect(screen.getByRole('tab', { name: /Join requests/ })).toHaveTextContent('3')
  })

  it('navigates with the tab in the URL when a chip is clicked', async () => {
    stubMatchMedia(true)
    const user = userEvent.setup()
    renderStrip(makeGroup())

    await user.click(screen.getByRole('tab', { name: /Events/ }))
    expect(navigate).toHaveBeenCalledWith({ search: 'tab=events' })
  })
})
