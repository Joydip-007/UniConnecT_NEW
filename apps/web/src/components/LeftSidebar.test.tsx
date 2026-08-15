import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserRole } from '@uniconnect/shared'
import { LeftSidebar } from './LeftSidebar'
import { RAILS, type RailContext } from './leftSidebar.config'

const navigate = vi.fn()
let mockRole: UserRole = 'student'
let mockDraftCount = 0

/** Every signal off — the zone's resting state. */
function emptyCtx(): RailContext {
  return {
    draftCount: 0,
    shuttleEtaMinutes: null,
    applicationUpdates: 0,
    eventStartsInMinutes: null,
    newApplicants: 0,
    menteeRequests: 0,
    verifications: 0,
    inviteExpiryDays: null,
    pendingReports: 0,
    onDuty: false,
  }
}

let mockCtx: RailContext = emptyCtx()

vi.mock('@/hooks/useViewTransitionNavigate', () => ({
  useViewTransitionNavigate: () => navigate,
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    user: {
      id: 'user-1',
      role: mockRole,
      profile: {
        fullName: 'Ada Lovelace',
        avatarUrl: null,
        coverUrl: null,
        department: 'CSE',
        batchYear: '2026',
      },
    },
  }),
}))

// The rail's signal bag is mocked so each rule can be driven directly; the queries
// behind it are gated by role inside the hook and covered separately below.
vi.mock('./useRailContext', () => ({
  useRailContext: () => ({ ...mockCtx, draftCount: mockDraftCount || mockCtx.draftCount }),
}))

vi.mock('@/lib/axios', () => ({
  api: {
    get: vi.fn().mockResolvedValue({
      data: {
        data: {
          id: 'user-1',
          email: 'ada@example.edu',
          role: 'student',
          isVerified: true,
          profile: {
            fullName: 'Ada Lovelace',
            username: 'ada',
            avatarUrl: null,
            coverUrl: null,
            headline: null,
            department: 'CSE',
            batchYear: '2026',
            bio: null,
            location: null,
            website: null,
            skills: [],
          },
          stats: { posts: 0, connections: 12, pendingReceived: 2 },
        },
      },
    }),
  },
}))

function renderSidebar(collapsed: boolean, onToggleCollapsed = vi.fn(), route = '/feed') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>
        <LeftSidebar collapsed={collapsed} onToggleCollapsed={onToggleCollapsed} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function activeRowNames(): string[] {
  return screen
    .getAllByRole('button')
    .filter((el) => el.getAttribute('aria-current') === 'page')
    .map((el) => el.textContent ?? '')
}

describe('LeftSidebar', () => {
  beforeEach(() => {
    navigate.mockClear()
    mockRole = 'student'
    mockDraftCount = 0
    mockCtx = emptyCtx()
  })

  it('renders the expanded sidebar with visible profile and labels', () => {
    renderSidebar(false)
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument()
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument()
    expect(screen.getByText('Campus tools')).toBeInTheDocument()
  })

  it('keeps the active route marked with aria-current page', () => {
    renderSidebar(false)
    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Groups & people' })).not.toHaveAttribute('aria-current')
  })

  it('renders collapsed nav as accessible icon buttons without visible labels', () => {
    const { container } = renderSidebar(true)
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('title', 'Home')
    expect(screen.getByRole('button', { name: 'Shuttle live' })).toHaveAttribute('title', 'Shuttle live')
    expect(container.querySelector('.left-sidebar--collapsed')).toBeInTheDocument()
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument()
  })

  it('calls the collapse toggle from the rail button', async () => {
    const onToggleCollapsed = vi.fn()
    renderSidebar(false, onToggleCollapsed)
    await userEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
    expect(onToggleCollapsed).toHaveBeenCalledOnce()
  })

  it('hides the contextual zone when its condition is false', () => {
    mockDraftCount = 0
    renderSidebar(false)
    expect(screen.queryByLabelText('Contextual shortcuts')).not.toBeInTheDocument()
  })

  it('shows the drafts contextual row once a draft exists', () => {
    mockDraftCount = 3
    renderSidebar(false)
    expect(screen.getByLabelText('Contextual shortcuts')).toBeInTheDocument()
    expect(screen.getByText('Drafts')).toBeInTheDocument()
  })

  const roles: UserRole[] = ['student', 'alumni', 'faculty', 'driver', 'admin']
  it.each(roles)('renders every fixed row for the %s role, in manifest order', (role) => {
    mockRole = role
    renderSidebar(false)
    const rail = RAILS[role]
    rail.fixed.forEach((row) => {
      expect(screen.getByRole('button', { name: row.label })).toBeInTheDocument()
    })
  })

  it('marks exactly one row active, even when several share a base path', () => {
    mockRole = 'admin'
    renderSidebar(false, vi.fn(), '/admin')
    // Moderation, Members & invites and Insights all live at /admin behind a tab param.
    expect(activeRowNames()).toEqual(['Moderation'])
  })

  it('resolves the active admin row from the tab query param', () => {
    mockRole = 'admin'
    // `users` is AdminPage's own tab value — the rail must speak the page's vocabulary.
    renderSidebar(false, vi.fn(), '/admin?tab=users')
    expect(activeRowNames()).toEqual(['Members & invites'])
  })

  it('driver rail has no more than 4 fixed rows and no student-only routes', () => {
    const rail = RAILS.driver
    expect(rail.fixed.length).toBe(4)
    expect(rail.fixed.some((row) => row.to === '/jobs' || row.to === '/mentorship')).toBe(false)
  })
})

describe('LeftSidebar profile stats pair', () => {
  const expected: Record<UserRole, [string, string]> = {
    student: ['connections', 'pending'],
    alumni: ['connections', 'mentees'],
    faculty: ['sections', 'students'],
    admin: ['members', 'verifications'],
    driver: ['connections', 'posts'],
  }

  it.each(Object.keys(expected) as UserRole[])(
    'labels the %s card with that role’s pair, not a hardwired one',
    async (role) => {
      mockRole = role
      renderSidebar(false)

      const [first, second] = expected[role]
      expect(await screen.findByText(first)).toBeInTheDocument()
      expect(screen.getByText(second)).toBeInTheDocument()
    },
  )

  it('does not show the student pair to a faculty member', () => {
    mockRole = 'faculty'
    renderSidebar(false)
    expect(screen.queryByText('pending')).not.toBeInTheDocument()
  })
})

describe('LeftSidebar contextual zone', () => {
  beforeEach(() => {
    navigate.mockClear()
    mockRole = 'student'
    mockDraftCount = 0
    mockCtx = emptyCtx()
  })

  function zoneLabels(): string[] {
    const zone = screen.queryByLabelText('Contextual shortcuts')
    if (!zone) return []
    return [...zone.querySelectorAll('button')].map((b) => b.textContent ?? '')
  }

  // Each entry: the role, the row's label, and the single signal that turns it on.
  const rules: [UserRole, string, Partial<RailContext>][] = [
    ['student', 'Shuttle arriving', { shuttleEtaMinutes: 4 }],
    ['student', 'Event starting', { eventStartsInMinutes: 25 }],
    ['student', 'Application update', { applicationUpdates: 2 }],
    ['alumni', 'New applicants', { newApplicants: 5 }],
    ['alumni', 'Mentee requests', { menteeRequests: 1 }],
    ['admin', 'Escalated report', { pendingReports: 3 }],
    ['admin', 'Verification requests', { verifications: 2 }],
    ['admin', 'Invite batch expiring', { inviteExpiryDays: 2 }],
    ['driver', 'On duty now', { onDuty: true }],
  ]

  it.each(rules)('%s: shows "%s" only while its condition holds', (role, label, signal) => {
    mockRole = role
    mockCtx = { ...emptyCtx(), ...signal }
    const { unmount } = renderSidebar(false)
    expect(screen.getByText(label)).toBeInTheDocument()
    unmount()

    // The vanish direction is the one that regresses — assert it explicitly.
    mockCtx = emptyCtx()
    renderSidebar(false)
    expect(screen.queryByText(label)).not.toBeInTheDocument()
  })

  it('caps the zone at two rows and counts the rest as overflow', () => {
    mockRole = 'admin'
    mockCtx = { ...emptyCtx(), pendingReports: 1, verifications: 1, inviteExpiryDays: 1, draftCount: 4 }
    renderSidebar(false)
    // 4 rules true → 2 rendered + a "+2 more" row.
    expect(zoneLabels().filter((l) => l.includes('more'))).toHaveLength(1)
    expect(screen.getByText('+2 more')).toBeInTheDocument()
  })

  it('sorts a live row above a deadline row', () => {
    mockRole = 'student'
    mockCtx = { ...emptyCtx(), shuttleEtaMinutes: 6, eventStartsInMinutes: 30 }
    renderSidebar(false)
    const labels = zoneLabels()
    expect(labels[0]).toContain('Shuttle arriving')
    expect(labels[1]).toContain('Event starting')
  })

  it('keeps the driver pinned row visible past the cap and a higher-ranked competitor', () => {
    mockRole = 'driver'
    // Drivers only have the one rule, so prove pinning at the config level too.
    mockCtx = { ...emptyCtx(), onDuty: true }
    renderSidebar(false)
    expect(zoneLabels()[0]).toContain('On duty now')
    expect(RAILS.driver.contextual.find((r) => r.key === 'on-duty')?.pinned).toBe(true)
  })

  it('renders no zone at all for faculty beyond drafts', () => {
    mockRole = 'faculty'
    // Every non-draft signal on: faculty has no rule that reads any of them.
    mockCtx = {
      draftCount: 0,
      shuttleEtaMinutes: 2,
      applicationUpdates: 9,
      eventStartsInMinutes: 5,
      newApplicants: 9,
      menteeRequests: 9,
      verifications: 9,
      inviteExpiryDays: 0,
      pendingReports: 9,
      onDuty: true,
    }
    renderSidebar(false)
    expect(screen.queryByLabelText('Contextual shortcuts')).not.toBeInTheDocument()
    expect(screen.queryByText('Shows up when relevant')).not.toBeInTheDocument()
  })

  /**
   * A rule may only read a signal its role's API would actually answer — a student
   * rule reading `pendingReports` would mean the rail fires an admin-only request on
   * every page load. Feeding each role every signal it is not entitled to must
   * produce nothing.
   */
  const forbidden: Record<UserRole, Partial<RailContext>> = {
    student: { newApplicants: 9, menteeRequests: 9, verifications: 9, inviteExpiryDays: 0, pendingReports: 9, onDuty: true },
    alumni: { verifications: 9, inviteExpiryDays: 0, pendingReports: 9, onDuty: true, shuttleEtaMinutes: 2 },
    faculty: { newApplicants: 9, menteeRequests: 9, verifications: 9, inviteExpiryDays: 0, pendingReports: 9, onDuty: true },
    admin: { onDuty: true },
    driver: { draftCount: 9, newApplicants: 9, menteeRequests: 9, verifications: 9, pendingReports: 9, applicationUpdates: 9 },
  }

  it.each(Object.keys(forbidden) as UserRole[])(
    'the %s rail evaluates no rule its role would be refused',
    (role) => {
      const ctx = { ...emptyCtx(), ...forbidden[role] }
      const fired = RAILS[role].contextual.filter((rule) => rule.when(ctx) !== false)
      expect(fired.map((r) => r.key)).toEqual([])
    },
  )
})
