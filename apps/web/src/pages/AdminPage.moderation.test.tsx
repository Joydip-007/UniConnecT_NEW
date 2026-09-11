import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/msw/server'
import AdminPage from './AdminPage'
import { useAuthStore } from '@/stores/authStore'

const GROUPED_ITEM = {
  targetId: 'post-1', targetType: 'post', title: 'Spam links in an "Internship offer" post',
  location: { label: 'Feed post', path: '/feed/post-1' },
  severity: 'high', reason: 'spam', reportCount: 3, lastReportedAt: new Date().toISOString(), removable: true,
}

let dismissed = false

beforeEach(() => {
  dismissed = false
  useAuthStore.setState({ user: { id: 'admin-1', role: 'admin' } as never })
  server.use(
    http.get('*/admin/stats', () => HttpResponse.json({
      data: {
        users: 4821, posts: 132, jobs: 4, events: 6, groups: 12, news: 3, reports: 5, activeUsers: 3200,
        usersByRole: [], postsByDay: [],
        escalatedReports: 5, verificationRequests: 17, deletionRequests: 3, resolvedPct7d: 94, pendingInviteBatches: 3,
        moderationHealth: { reportsOpen: 4, resolvedPct7d: 94, medianResponseHours: 3.2, repeatOffenders: 4 },
      },
    })),
    http.get('*/admin/reports/grouped', () => HttpResponse.json({
      data: dismissed ? { items: [], total: 0, page: 1, limit: 20 } : { items: [GROUPED_ITEM], total: 1, page: 1, limit: 20 },
    })),
    http.get('*/admin/content/:kind', () => HttpResponse.json({ data: { items: [], total: 0, page: 1, limit: 20 } })),
    http.patch('*/admin/reports/target/:targetType/:targetId', () => {
      dismissed = true
      return HttpResponse.json({ data: { targetId: 'post-1', targetType: 'post', status: 'dismissed' } })
    }),
  )
})

function renderModeration() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/admin?tab=moderation']}>
        <AdminPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AdminPage Moderation tab', () => {
  it('shows the severity badge and report count on a grouped row', async () => {
    renderModeration()
    expect(await screen.findByText('Spam links in an "Internship offer" post')).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.getByText('· 3 reports')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Feed post' })).toHaveAttribute('href', '/feed/post-1')
    expect(screen.getByRole('button', { name: 'Review' })).toBeInTheDocument()
  })

  it('counts open, escalated and deletion requests — never verification, which OTP already gates', async () => {
    renderModeration()
    expect(await screen.findByText('Open reports')).toBeInTheDocument()
    expect(screen.getByText('Escalated reports')).toBeInTheDocument()
    expect(screen.getByText('Deletion requests')).toBeInTheDocument()
    expect(screen.queryByText('Verification requests')).not.toBeInTheDocument()
  })

  it('dismisses a reported target', async () => {
    renderModeration()
    await screen.findByText('Spam links in an "Internship offer" post')
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    await waitFor(() => expect(screen.queryByText('Spam links in an "Internship offer" post')).not.toBeInTheDocument())
  })
})
