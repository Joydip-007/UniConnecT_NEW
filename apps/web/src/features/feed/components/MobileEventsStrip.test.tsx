import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserRole } from '@uniconnect/shared'
import { server } from '@/tests/msw/server'
import { MobileEventsStrip } from './MobileEventsStrip'

let currentRole: UserRole = 'student'

// `@/lib/axios` reads the store imperatively (`useAuthStore.getState()`), so the stub
// has to carry `getState` too — a bare selector function would make every request throw
// and the strip would look empty for the wrong reason.
vi.mock('@/stores/authStore', () => {
  const state = () => ({ user: { id: 'u1', role: currentRole }, accessToken: null, clearAuth: () => {} })
  const useAuthStore = Object.assign(
    (selector: (s: ReturnType<typeof state>) => unknown) => selector(state()),
    { getState: state },
  )
  return { useAuthStore }
})

function respondWith(items: Array<{ id: string; title: string; location: string | null; startsAt: string }>) {
  // Leading `*` per the repo convention: the axios baseURL under vitest depends on env,
  // so a handler pinned to an absolute origin silently never matches.
  server.use(http.get('*/events', () => HttpResponse.json({ data: { items } })))
}

function renderStrip() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <MobileEventsStrip />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const EVENT = {
  id: 'e1',
  title: 'Robotics workshop',
  location: 'Lab 401',
  startsAt: '2030-04-12T09:00:00.000Z',
}

beforeEach(() => {
  currentRole = 'student'
})

describe('MobileEventsStrip', () => {
  it('lists the upcoming events the rail would have shown', async () => {
    respondWith([EVENT])
    renderStrip()
    expect(await screen.findByText('Robotics workshop')).toBeInTheDocument()
  })

  it('renders nothing when nothing is scheduled, rather than an empty strip', async () => {
    respondWith([])
    const { container } = renderStrip()
    await new Promise((r) => setTimeout(r, 0))
    expect(container).toBeEmptyDOMElement()
  })

  /**
   * The strip stands in for a rail widget, so it follows the same manifest the rail
   * does. A driver's `rightRail` is empty — giving the phone a widget the desktop rail
   * would never show it would fork the shell.
   */
  it('stays off for a role whose manifest lists no upcoming-events widget', async () => {
    currentRole = 'driver'
    respondWith([EVENT])
    const { container } = renderStrip()
    await new Promise((r) => setTimeout(r, 0))
    expect(container).toBeEmptyDOMElement()
  })
})
