import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ProblemReport } from '@uniconnect/shared'
import { server } from '@/tests/msw/server'
import { useAuthStore } from '@/stores/authStore'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ProblemReportsPanel } from './components/ProblemReportsPanel'

function setSignedIn(on: boolean) {
  useAuthStore.setState(
    on
      ? ({ accessToken: 'token', user: { id: 'u1', role: 'student' } } as Partial<ReturnType<typeof useAuthStore.getState>>)
      : { accessToken: null, user: null },
  )
}

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/events/abc']}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

function Boom(): never {
  throw new Error('kaboom')
}

beforeEach(() => {
  setSignedIn(true)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

describe('Report a problem', () => {
  it('sends the caught error, its id and the note to the admins', async () => {
    let body: Record<string, unknown> | null = null
    server.use(
      http.post('*/users/me/problem-reports', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ data: { id: 'r1' } }, { status: 201 })
      }),
    )
    wrap(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Report a problem' }))
    await userEvent.type(screen.getByRole('textbox'), 'Opened it from a link')
    await userEvent.click(screen.getByRole('button', { name: 'Send report' }))

    await waitFor(() => expect(body).not.toBeNull())
    expect(body).toMatchObject({ errorMessage: 'Error: kaboom', description: 'Opened it from a link' })
    expect(String(body!.errorId)).toMatch(/^uc-[0-9a-f]{6}$/)
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Send report' })).not.toBeInTheDocument())
  })

  it('falls back to the clipboard for a signed-out visitor, with no request', async () => {
    setSignedIn(false)
    const posted = vi.fn()
    server.use(http.post('*/users/me/problem-reports', () => { posted(); return HttpResponse.json({}) }))
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

    wrap(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Report a problem' }))
    await waitFor(() => expect(writeText).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: 'Send report' })).not.toBeInTheDocument()
    expect(posted).not.toHaveBeenCalled()
  })
})

describe('ProblemReportsPanel', () => {
  it('lists reports and resolves one', async () => {
    const reports: ProblemReport[] = [
      {
        id: 'r1',
        errorId: 'uc-7f3a91',
        errorMessage: "TypeError: Cannot read properties of undefined (reading 'map')",
        description: 'Opened from a link',
        pageUrl: 'https://uniconnect.app/events/abc',
        userAgent: null,
        status: 'open',
        createdAt: new Date().toISOString(),
        resolvedAt: null,
        reporterId: '11111111-1111-4111-8111-111111111111',
        reporterName: 'Tanvir Ahmed',
        reporterEmail: 'tanvir@uiu.ac.bd',
      },
    ]
    let patched: unknown = null
    server.use(
      http.get('*/admin/problem-reports', () =>
        HttpResponse.json({ data: { items: reports, total: reports.length, page: 1, hasMore: false } }),
      ),
      http.patch('*/admin/problem-reports/:id', async ({ request, params }) => {
        patched = { id: params.id, body: await request.json() }
        reports[0] = { ...reports[0], status: 'resolved' }
        return HttpResponse.json({ data: {} })
      }),
    )

    wrap(<ProblemReportsPanel />)
    expect(await screen.findByText('Tanvir Ahmed')).toBeInTheDocument()
    expect(screen.getByText('uc-7f3a91')).toBeInTheDocument()
    expect(screen.getByText(/\/events\/abc/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Mark resolved' }))
    await waitFor(() => expect(patched).toEqual({ id: 'r1', body: { status: 'resolved' } }))
    expect(await screen.findByRole('button', { name: 'Reopen' })).toBeInTheDocument()
  })
})
