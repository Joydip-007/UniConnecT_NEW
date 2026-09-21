import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/msw/server'
import { JoinRequestsTab } from './JoinRequestsTab'

function makeRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: 'req-1',
    groupId: 'g1',
    userId: 'u1',
    message: 'Excited to join!',
    status: 'pending',
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    requester: {
      id: 'u1',
      fullName: 'Maria Chowdhury',
      avatarUrl: null,
      department: 'CSE',
    },
    ...overrides,
  }
}

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <JoinRequestsTab groupId="g1" />
    </QueryClientProvider>,
  )
}

function mockCounts({ pending = 0, approved = 0, declined = 0 } = {}) {
  server.use(
    http.get('*/groups/g1/join-requests', ({ request }) => {
      const url = new URL(request.url)
      const status = url.searchParams.get('status') ?? 'pending'
      const limit = Number(url.searchParams.get('limit') ?? '20')
      if (limit === 1) {
        const total = status === 'pending' ? pending : status === 'approved' ? approved : declined
        return HttpResponse.json({ data: { items: [], total, page: 1, hasMore: false } })
      }
      return HttpResponse.json({ data: { items: [], total: 0, page: 1, hasMore: false } })
    }),
  )
}

describe('JoinRequestsTab', () => {
  it('shows filter chip counts and switches to declined via ?status=declined', async () => {
    const user = userEvent.setup()
    mockCounts({ pending: 2, approved: 1, declined: 3 })
    server.use(
      http.get('*/groups/g1/join-requests', ({ request }) => {
        const url = new URL(request.url)
        const status = url.searchParams.get('status') ?? 'pending'
        const limit = Number(url.searchParams.get('limit') ?? '20')
        if (limit === 1) {
          const total = status === 'pending' ? 2 : status === 'approved' ? 1 : 3
          return HttpResponse.json({ data: { items: [], total, page: 1, hasMore: false } })
        }
        if (status === 'pending') {
          return HttpResponse.json({ data: { items: [makeRequest()], total: 2, page: 1, hasMore: false } })
        }
        if (status === 'declined') {
          return HttpResponse.json({
            data: {
              items: [makeRequest({ id: 'req-2', status: 'declined' })],
              total: 3,
              page: 1,
              hasMore: false,
            },
          })
        }
        return HttpResponse.json({ data: { items: [], total: 1, page: 1, hasMore: false } })
      }),
    )

    renderTab()

    expect(await screen.findByText('Pending 2')).toBeInTheDocument()
    expect(screen.getByText('Approved 1')).toBeInTheDocument()
    expect(screen.getByText('Declined 3')).toBeInTheDocument()

    let declinedRequest: URL | undefined
    server.use(
      http.get('*/groups/g1/join-requests', ({ request }) => {
        const url = new URL(request.url)
        const status = url.searchParams.get('status') ?? 'pending'
        const limit = Number(url.searchParams.get('limit') ?? '20')
        if (limit === 1) {
          const total = status === 'pending' ? 2 : status === 'approved' ? 1 : 3
          return HttpResponse.json({ data: { items: [], total, page: 1, hasMore: false } })
        }
        if (status === 'declined') declinedRequest = url
        if (status === 'declined') {
          return HttpResponse.json({
            data: { items: [makeRequest({ id: 'req-2', status: 'declined' })], total: 3, page: 1, hasMore: false },
          })
        }
        return HttpResponse.json({ data: { items: [], total: 0, page: 1, hasMore: false } })
      }),
    )

    await user.click(screen.getByText('Declined 3'))

    await waitFor(() => expect(declinedRequest?.searchParams.get('status')).toBe('declined'))
  })

  it('shows an Approve all N ghost button when more than one request is pending', async () => {
    mockCounts({ pending: 2 })
    server.use(
      http.get('*/groups/g1/join-requests', ({ request }) => {
        const url = new URL(request.url)
        const limit = Number(url.searchParams.get('limit') ?? '20')
        if (limit === 1) return HttpResponse.json({ data: { items: [], total: 2, page: 1, hasMore: false } })
        return HttpResponse.json({
          data: {
            items: [makeRequest({ id: 'req-1' }), makeRequest({ id: 'req-2' })],
            total: 2,
            page: 1,
            hasMore: false,
          },
        })
      }),
    )

    renderTab()

    expect(await screen.findByRole('button', { name: 'Approve all 2' })).toBeInTheDocument()
  })

  it('sends action:"undo" when Undo is clicked on a resolved request', async () => {
    const user = userEvent.setup()
    mockCounts({ approved: 1 })

    let patchedBody: unknown
    server.use(
      http.get('*/groups/g1/join-requests', ({ request }) => {
        const url = new URL(request.url)
        const status = url.searchParams.get('status') ?? 'pending'
        const limit = Number(url.searchParams.get('limit') ?? '20')
        if (limit === 1) {
          const total = status === 'approved' ? 1 : 0
          return HttpResponse.json({ data: { items: [], total, page: 1, hasMore: false } })
        }
        if (status === 'approved') {
          return HttpResponse.json({
            data: {
              items: [makeRequest({ id: 'req-3', status: 'approved' })],
              total: 1,
              page: 1,
              hasMore: false,
            },
          })
        }
        return HttpResponse.json({ data: { items: [], total: 0, page: 1, hasMore: false } })
      }),
      http.patch('*/groups/g1/join-requests/req-3', async ({ request }) => {
        patchedBody = await request.json()
        return HttpResponse.json({ data: { ok: true } })
      }),
    )

    renderTab()

    await user.click(await screen.findByText('Approved 1'))

    const undoButton = await screen.findByRole('button', { name: 'Undo' })
    await user.click(undoButton)

    await waitFor(() => expect(patchedBody).toEqual({ action: 'undo' }))
  })

  it('shows the pending empty state copy', async () => {
    mockCounts()

    renderTab()

    expect(
      await screen.findByText('No requests waiting. Approved and declined requests stay listed for 30 days.'),
    ).toBeInTheDocument()
  })

  it('shows the resolved-status empty state copy', async () => {
    const user = userEvent.setup()
    mockCounts()

    renderTab()

    await user.click(await screen.findByText('Approved 0'))

    expect(await screen.findByText('Nothing approved yet.')).toBeInTheDocument()
  })
})
