import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { server } from '@/tests/msw/server'
import { ReportedContentPanel, type ReportGroup } from './ReportedContentPanel'

const POST_ID = '11111111-1111-4111-8111-111111111111'
const COMMENT_ID = '22222222-2222-4222-8222-222222222222'

let groups: ReportGroup[]
const patches: { url: string; body: unknown }[] = []
let detailRequests = 0

function installHandlers() {
  server.use(
    http.get('*/admin/reports/grouped', () => HttpResponse.json({ data: { items: groups, total: groups.length, page: 1, hasMore: false } })),
    http.get('*/admin/reports/target/:targetType/:targetId', ({ params }) => {
      detailRequests += 1
      if (params.targetId !== POST_ID) return HttpResponse.json({ error: 'not found', code: 'NOT_FOUND' }, { status: 404 })
      return HttpResponse.json({
        data: {
          targetId: POST_ID,
          targetType: 'post',
          title: 'Internship offer — apply now',
          location: { label: 'Feed post', path: `/feed/${POST_ID}` },
          removable: true,
          reports: [
            {
              id: 'r1',
              reason: 'spam',
              description: 'Links to a phishing site',
              createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
              reporter: { id: 'u1', fullName: 'Tanvir Ahmed', role: 'student', avatarUrl: null },
            },
            {
              id: 'r2',
              reason: 'harassment',
              description: null,
              createdAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
              reporter: { id: 'u2', fullName: 'Mahin Chowdhury', role: 'alumni', avatarUrl: null },
            },
          ],
        },
      })
    }),
    http.patch('*/admin/reports/target/:targetType/:targetId', async ({ request }) => {
      const body = await request.json()
      patches.push({ url: new URL(request.url).pathname, body })
      groups = groups.filter((g) => !request.url.endsWith(`/${g.targetType}/${g.targetId}`))
      return HttpResponse.json({ data: { status: 'dismissed' } })
    }),
  )
}

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ReportedContentPanel />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  patches.length = 0
  detailRequests = 0
  groups = [
    {
      targetId: POST_ID,
      targetType: 'post',
      title: 'Internship offer — apply now',
      location: { label: 'Feed post', path: `/feed/${POST_ID}` },
      severity: 'high',
      reason: 'spam',
      reportCount: 2,
      lastReportedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
      removable: true,
    },
    {
      targetId: COMMENT_ID,
      targetType: 'comment',
      title: 'lol nobody cares',
      location: { label: 'Comment on “Registration opens…”', path: `/feed/${POST_ID}` },
      severity: 'low',
      reason: 'other',
      reportCount: 1,
      lastReportedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      removable: false,
    },
  ]
  installHandlers()
})

describe('ReportedContentPanel', () => {
  it('shows each report with severity, reason, count and where it lives', async () => {
    renderPanel()
    const row = (await screen.findByText('Internship offer — apply now')).closest('div')!.parentElement!
    expect(within(row).getByText('High')).toBeInTheDocument()
    expect(within(row).getByText('Spam')).toBeInTheDocument()
    expect(within(row).getByText('· 2 reports')).toBeInTheDocument()
    expect(within(row).getByRole('link', { name: 'Feed post' })).toHaveAttribute('href', `/feed/${POST_ID}`)

    const comment = screen.getByText('lol nobody cares').closest('div')!.parentElement!
    expect(within(comment).getByRole('link', { name: /Comment on/ })).toHaveAttribute('href', `/feed/${POST_ID}`)
    // A comment cannot be hard-removed from this queue, only dismissed.
    expect(within(comment).queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
  })

  it('Review expands the row with every report: who, why (their words) and a link into context', async () => {
    const user = userEvent.setup()
    renderPanel()
    await screen.findByText('Internship offer — apply now')

    // Nothing is fetched until an admin asks to review a row.
    expect(detailRequests).toBe(0)
    await user.click(screen.getAllByRole('button', { name: 'Review' })[0])

    const review = await screen.findByTestId('report-review')
    expect(detailRequests).toBe(1)
    expect(within(review).getByText('2 reports · Feed post')).toBeInTheDocument()
    expect(within(review).getByRole('link', { name: /Open in context/ })).toHaveAttribute('href', `/feed/${POST_ID}`)

    expect(within(review).getByRole('link', { name: 'Tanvir Ahmed' })).toHaveAttribute('href', '/profile/u1')
    expect(within(review).getByText('Student')).toBeInTheDocument()
    expect(within(review).getByText(/Links to a phishing site/)).toBeInTheDocument()

    expect(within(review).getByRole('link', { name: 'Mahin Chowdhury' })).toBeInTheDocument()
    expect(within(review).getByText('Harassment')).toBeInTheDocument()
    expect(within(review).getByText(/no details given/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByTestId('report-review')).not.toBeInTheDocument()
  })

  it('Dismiss resolves the row through the target endpoint and drops it from the list', async () => {
    const user = userEvent.setup()
    renderPanel()
    await screen.findByText('lol nobody cares')

    const comment = screen.getByText('lol nobody cares').closest('div')!.parentElement!
    await user.click(within(comment).getByRole('button', { name: 'Dismiss' }))

    expect(patches).toEqual([{ url: `/api/v1/admin/reports/target/comment/${COMMENT_ID}`, body: { action: 'dismiss' } }])
    await screen.findByText('Internship offer — apply now')
    expect(screen.queryByText('lol nobody cares')).not.toBeInTheDocument()
  })
})
