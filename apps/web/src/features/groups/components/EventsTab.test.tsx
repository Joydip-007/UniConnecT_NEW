import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/msw/server'
import { EventsTab } from './EventsTab'

// The Create event pill needs a faculty/admin platform role on top of the group role.
vi.mock('@/stores/authStore', () => {
  const state = () => ({ user: { id: 'viewer-1', role: 'faculty' }, accessToken: null, clearAuth: () => {} })
  const useAuthStore = Object.assign(
    (selector: (s: ReturnType<typeof state>) => unknown) => selector(state()),
    { getState: state },
  )
  return { useAuthStore }
})

// jsdom has no IntersectionObserver; the events tab's infinite scroll needs a stub.
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}
vi.stubGlobal('IntersectionObserver', NoopObserver)

function makePendingEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt-pending-1',
    title: 'Finals week study jam',
    type: 'general',
    startDate: new Date('2026-10-05T10:00:00Z').toISOString(),
    endDate: null,
    location: 'Library, Room 204',
    description: 'Group study session before finals.',
    coverUrl: null,
    rsvpCounts: { going: 0, maybe: 0 },
    capacity: null,
    myRsvp: null,
    previewAttendees: [],
    totalAttendees: 0,
    organizer: { id: 'u2', fullName: 'Tanvir Hasan' },
    ...overrides,
  }
}

function renderEventsTab(userRole: 'owner' | 'admin' | 'moderator' | 'member' | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <EventsTab groupId="g1" userRole={userRole} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('EventsTab pending event approval queue', () => {
  it('shows the eyebrow and Approve action for an admin when an event is pending', async () => {
    server.use(
      http.get('*/groups/g1/review/events', () =>
        HttpResponse.json({ data: { items: [makePendingEvent()] } }),
      ),
      http.get('*/groups/g1/events', () =>
        HttpResponse.json({ data: { items: [], hasMore: false, page: 1 } }),
      ),
    )

    renderEventsTab('admin')

    expect(await screen.findByText('1 event awaiting approval')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument()
    expect(screen.getByText(/Submitted by Tanvir Hasan/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Create event/ })).toBeInTheDocument()
  })

  it('renders nothing from the review queue and no Create event button for a plain member', async () => {
    server.use(
      http.get('*/groups/g1/events', () =>
        HttpResponse.json({ data: { items: [], hasMore: false, page: 1 } }),
      ),
    )

    renderEventsTab('member')

    await waitFor(() => expect(screen.getByText('No events yet')).toBeInTheDocument())
    expect(screen.queryByText(/awaiting approval/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Create event/ })).not.toBeInTheDocument()
  })
})
