import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { server } from '@/tests/msw/server'
import { AnnouncementsTab } from './AnnouncementsTab'

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <AnnouncementsTab />
    </QueryClientProvider>,
  )
}

describe('AnnouncementsTab composer', () => {
  it('sends is_published: false when saving as a draft', async () => {
    const user = userEvent.setup()
    let captured: Record<string, unknown> | null = null
    server.use(
      http.get('*/admin/content/posts', () => HttpResponse.json({ data: { items: [], total: 0, page: 1, limit: 20 } })),
      http.get('*/admin/stats', () => HttpResponse.json({ data: { activeUsers: 4821 } })),
      http.post('*/posts', async ({ request }) => {
        captured = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ data: { id: 'p1' } }, { status: 201 })
      }),
    )

    renderTab()
    await user.type(await screen.findByPlaceholderText(/write an announcement/i), 'Draft body')
    await user.click(screen.getByRole('button', { name: /save as draft/i }))

    await waitFor(() => expect(captured).not.toBeNull())
    expect(captured).toMatchObject({ type: 'announcement', content: 'Draft body', is_published: false })
    expect(captured!.publish_at).toBeUndefined()
  })

  it('sends publish_at when scheduling for later', async () => {
    const user = userEvent.setup()
    let captured: Record<string, unknown> | null = null
    server.use(
      http.get('*/admin/content/posts', () => HttpResponse.json({ data: { items: [], total: 0, page: 1, limit: 20 } })),
      http.get('*/admin/stats', () => HttpResponse.json({ data: { activeUsers: 4821 } })),
      http.post('*/posts', async ({ request }) => {
        captured = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ data: { id: 'p2' } }, { status: 201 })
      }),
    )

    renderTab()
    await user.type(await screen.findByPlaceholderText(/write an announcement/i), 'Scheduled body')
    await user.click(screen.getByRole('button', { name: /schedule for/i }))
    const dtInput = screen.getByLabelText(/schedule date and time/i)
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const local = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}T${String(future.getHours()).padStart(2, '0')}:${String(future.getMinutes()).padStart(2, '0')}`
    await user.type(dtInput, local)
    await user.click(screen.getByRole('button', { name: /^schedule$/i }))

    await waitFor(() => expect(captured).not.toBeNull())
    expect(captured).toMatchObject({ type: 'announcement', content: 'Scheduled body' })
    expect(typeof captured!.publish_at).toBe('string')
  })

  it('publishes immediately with no extra fields on the default action', async () => {
    const user = userEvent.setup()
    let captured: Record<string, unknown> | null = null
    server.use(
      http.get('*/admin/content/posts', () => HttpResponse.json({ data: { items: [], total: 0, page: 1, limit: 20 } })),
      http.get('*/admin/stats', () => HttpResponse.json({ data: { activeUsers: 4821 } })),
      http.post('*/posts', async ({ request }) => {
        captured = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ data: { id: 'p3' } }, { status: 201 })
      }),
    )

    renderTab()
    await user.type(await screen.findByPlaceholderText(/write an announcement/i), 'Live now body')
    await user.click(screen.getByRole('button', { name: /^publish now$/i }))

    await waitFor(() => expect(captured).not.toBeNull())
    expect(captured).toMatchObject({ type: 'announcement', content: 'Live now body' })
    expect(captured!.is_published).toBeUndefined()
    expect(captured!.publish_at).toBeUndefined()
  })
})
