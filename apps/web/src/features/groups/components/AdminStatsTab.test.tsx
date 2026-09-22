import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/msw/server'
import { AdminStatsTab } from './AdminStatsTab'

const stats = {
  newMembersThisWeek: 3,
  postsThisWeek: 12,
  activeContributors: 5,
  pendingJoinRequests: 2,
  upcomingStudySessions: 1,
  members: 1284,
  active30d: 402,
  resources: 37,
  upcomingEvents: 4,
}

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <AdminStatsTab groupId="g1" />
    </QueryClientProvider>,
  )
}

describe('AdminStatsTab', () => {
  it('renders the five design cards with locale-formatted values', async () => {
    server.use(http.get('*/groups/g1/stats', () => HttpResponse.json({ data: stats })))
    renderTab()

    expect(await screen.findByText('Members')).toBeInTheDocument()
    expect(screen.getByText('Posts this week')).toBeInTheDocument()
    expect(screen.getByText('Active, 30 days')).toBeInTheDocument()
    expect(screen.getByText('Resources')).toBeInTheDocument()
    expect(screen.getByText('Upcoming events')).toBeInTheDocument()

    expect(screen.getByText((1284).toLocaleString())).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('402')).toBeInTheDocument()
    expect(screen.getByText('37')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()

    // Old labels are gone
    expect(screen.queryByText('New members this week')).not.toBeInTheDocument()
    expect(screen.queryByText('Pending join requests')).not.toBeInTheDocument()
  })

  it('refetches on Refresh', async () => {
    const user = userEvent.setup()
    let calls = 0
    server.use(
      http.get('*/groups/g1/stats', () => {
        calls += 1
        return HttpResponse.json({ data: { ...stats, members: calls === 1 ? 10 : 11 } })
      }),
    )
    renderTab()

    expect(await screen.findByText('10')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /refresh/i }))
    await waitFor(() => expect(screen.getByText('11')).toBeInTheDocument())
    expect(calls).toBe(2)
  })
})
