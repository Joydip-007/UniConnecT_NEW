import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserRole } from '@uniconnect/shared'
import { RightSidebar } from './RightSidebar'
import { ROLE_SHELL, type WidgetKey } from '@/config/roleShell'

/**
 * Each widget owns a query, so this suite stubs the registry rather than the network:
 * the rule under test is "the rail renders exactly what the manifest lists for this
 * role", which is dispatch, not data. Widget-level empty/loading behaviour is the
 * widgets' own concern.
 */
vi.mock('@/components/rightRail', () => ({
  RIGHT_RAIL_WIDGETS: {
    'profile-progress': () => <div>widget:profile-progress</div>,
    'people-you-may-know': () => <div>widget:people-you-may-know</div>,
    'upcoming-events': () => <div>widget:upcoming-events</div>,
    'trending-tags': () => <div>widget:trending-tags</div>,
    'admin-queue': () => <div>widget:admin-queue</div>,
    'admin-stats': () => <div>widget:admin-stats</div>,
  },
}))

let currentRole: UserRole = 'student'

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector({ user: { id: 'u1', role: currentRole } }),
}))

const ALL_KEYS: WidgetKey[] = [
  'profile-progress',
  'people-you-may-know',
  'upcoming-events',
  'trending-tags',
  'admin-queue',
  'admin-stats',
]

function renderFor(role: UserRole) {
  currentRole = role
  return render(
    <MemoryRouter>
      <RightSidebar />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  currentRole = 'student'
})

describe('RightSidebar', () => {
  const roles: UserRole[] = ['student', 'alumni', 'faculty', 'admin', 'driver']

  it.each(roles)('renders exactly the manifest widgets for %s, and nothing else', (role) => {
    renderFor(role)
    const expected = ROLE_SHELL[role].rightRail

    for (const key of ALL_KEYS) {
      const found = screen.queryByText(`widget:${key}`)
      if (expected.includes(key)) {
        expect(found, `${role} should render ${key}`).toBeInTheDocument()
      } else {
        expect(found, `${role} should not render ${key}`).not.toBeInTheDocument()
      }
    }
  })

  it.each(roles)('renders %s widgets in manifest order', (role) => {
    const { container } = renderFor(role)
    const rendered = Array.from(container.querySelectorAll('div'))
      .map((el) => el.textContent ?? '')
      .filter((text) => text.startsWith('widget:'))
      .map((text) => text.replace('widget:', ''))

    expect(rendered).toEqual(ROLE_SHELL[role].rightRail)
  })

  it('renders no rail at all for a driver rather than an empty column', () => {
    const { container } = renderFor('driver')
    expect(container).toBeEmptyDOMElement()
  })

  it('carries only widgets addressing something the left rail cannot reach', () => {
    // Every surviving member widget opens a *specific* event, person or tag. The two
    // that were dropped (mentee-requests, platform-today) had no destination that was
    // not already a rail row, so they were the left rail rendered a second time on the
    // right. The admin pair is different in kind: it is re-keyed by the tab you are on,
    // so it shows *this screen's* backlog and numbers, which no rail row can.
    const itemLevel = new Set<WidgetKey>([
      'people-you-may-know',
      'upcoming-events',
      'trending-tags',
      'profile-progress',
      'admin-queue',
      'admin-stats',
    ])
    roles.forEach((role) => {
      ROLE_SHELL[role].rightRail.forEach((key) => {
        expect(itemLevel.has(key), `${role} lists ${key}, which leads nowhere new`).toBe(true)
      })
    })
  })
})
