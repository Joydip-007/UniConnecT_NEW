import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { server } from '@/tests/msw/server'
import { AdminQueueWidget } from './AdminQueueWidget'
import { AdminStatsWidget } from './AdminStatsWidget'

/**
 * The rail is route-aware, so the rule under test is "this URL → this endpoint → these
 * cards". Handlers are per-route so a widget that reached for the wrong endpoint would
 * hang in its hidden state and the assertion would fail, not a mock.
 */

const STATS = {
  users: 5000,
  activeUsers: 4821,
  postsByDay: [{ date: new Date().toISOString().slice(0, 10), count: 132 }],
  verificationsByRole: [{ role: 'student', count: 11 }, { role: 'alumni', count: 4 }],
  escalatedReports: 5,
  verificationRequests: 15,
  deletionRequests: 3,
  resolvedPct7d: 94,
  pendingInviteBatches: 3,
  moderationHealth: { reportsOpen: 25, resolvedPct7d: 94, medianResponseHours: 3.2, repeatOffenders: 4 },
}

const PENDING = { news: [{ id: 'n1' }], events: [] }

function renderAt(url: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>
        <AdminQueueWidget />
        <AdminStatsWidget />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

let hits: string[] = []

beforeEach(() => {
  hits = []
  server.use(
    http.get('*/admin/stats', () => { hits.push('stats'); return HttpResponse.json({ data: STATS }) }),
    http.get('*/admin/content-sync/pending', () => { hits.push('pending'); return HttpResponse.json({ data: PENDING }) }),
    http.get('*/admin/shuttle/stats', () => {
      hits.push('shuttle')
      return HttpResponse.json({ data: { busesLive: 2, activeRoutes: 3, onDutyDrivers: 2, onTimeRatePct: 92, routes: [{ routeId: 'r1', isLive: true }] } })
    }),
    http.get('*/shuttle/routes', () => HttpResponse.json({ data: [{ id: 'r1', name: 'Route A' }, { id: 'r2', name: 'Route B' }] })),
  )
})

afterEach(() => server.resetHandlers())

describe('admin right rail', () => {
  it('leads with campus insights on the Insights tab and lists the cross-tab backlog', async () => {
    renderAt('/admin?tab=insights')

    expect(await screen.findByText('Campus insights')).toBeInTheDocument()
    expect(screen.getByText('4,821')).toBeInTheDocument()
    expect(screen.getByText('Needs attention')).toBeInTheDocument()
    expect(screen.getByText('Escalated reports')).toBeInTheDocument()
    expect(screen.getByText('Imported drafts')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open moderation' })).toBeInTheDocument()

    // Numbers lead on Insights: the manifest lists queue first, so the swap is flex order.
    expect(screen.getByRole('region', { name: 'Campus insights' })).toHaveStyle({ order: 1 })
    expect(screen.getByRole('region', { name: 'Needs attention' })).toHaveStyle({ order: 2 })
  })

  it('swaps to moderation health on the Moderation tab without a CTA to itself', async () => {
    renderAt('/admin?tab=moderation')

    expect(await screen.findByText('Moderation health')).toBeInTheDocument()
    expect(screen.getByText('3.2h')).toBeInTheDocument()
    expect(screen.getByText('25 open')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open moderation' })).not.toBeInTheDocument()
    // Only the endpoint this tab already reads — no cross-tab fetch.
    await waitFor(() => expect(hits).toContain('stats'))
    expect(hits).not.toContain('pending')
    expect(hits).not.toContain('shuttle')
  })

  it('reads fleet numbers on Shuttle ops and flags idle routes', async () => {
    renderAt('/admin?tab=shuttle')

    expect(await screen.findByText('Fleet')).toBeInTheDocument()
    expect(screen.getByText('Route alerts')).toBeInTheDocument()
    expect(screen.getByText('1 idle')).toBeInTheDocument()
    expect(screen.getByText('Route B')).toBeInTheDocument()
    expect(screen.queryByText('Route A')).not.toBeInTheDocument()
    expect(hits).not.toContain('stats')
  })

  it('falls back to Insights on any non-admin page', async () => {
    renderAt('/settings')
    expect(await screen.findByText('Campus insights')).toBeInTheDocument()
  })
})
