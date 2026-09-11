import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/msw/server'
import AdminPage from './AdminPage'
import { useAuthStore } from '@/stores/authStore'

const STATS = {
  users: 4821, posts: 132, jobs: 4, events: 6, groups: 12, news: 3,
  reports: 5, activeUsers: 3200,
  usersByRole: [{ role: 'student', count: 3560 }],
  postsByDay: Array.from({ length: 7 }, (_, i) => ({ date: `2026-09-0${i + 1}`, count: i })),
  escalatedReports: 4, deletionRequests: 3,
  resolvedPct7d: 94, pendingInviteBatches: 3,
  moderationHealth: { reportsOpen: 4, resolvedPct7d: 94, medianResponseHours: 3.2, repeatOffenders: 4 },
}

function renderInsights() {
  useAuthStore.setState({ user: { id: 'admin-1', role: 'admin' } as never })
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/admin?tab=insights']}>
        <AdminPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  server.use(
    http.get('*/admin/stats', () => HttpResponse.json({ data: STATS })),
    http.get('*/admin/university/domains', () => HttpResponse.json({ data: { allowedEmailDomains: [] } })),
    http.get('*/admin/content/summary', () => HttpResponse.json({
      data: { byType: { post: 8, news: 4, event_promo: 2, job_promo: 1 }, total: 15, pinned: 1, removed: 0, reportsOpen: 0 },
    })),
  )
})

describe('AdminPage Insights tab', () => {
  it('shows the resolved-% and pending-invite-batches tiles', async () => {
    renderInsights()
    expect(await screen.findByText('94%')).toBeInTheDocument()

    // The design carries the noun in the 24px value ("3 batches") and keeps the delta line
    // for the state ("expiring soon"). Assert them as one tile rather than as loose text —
    // "3" alone matches several counters on this page.
    const invitesTile = screen.getByText('Pending invites').parentElement
    expect(invitesTile).toHaveTextContent('3 batches')
    expect(invitesTile).toHaveTextContent('expiring soon')
  })

  it('shows a needs-attention row for escalated reports and jumps to Moderation on click', async () => {
    renderInsights()
    const row = await screen.findByRole('button', { name: /escalated reports/i })
    await userEvent.click(row)
    expect(await screen.findByRole('heading', { name: /reported content/i })).toBeInTheDocument()
  })
})
