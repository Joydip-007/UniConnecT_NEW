import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/msw/server'
import { LearningPathFormModal } from './LearningPathFormModal'

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('LearningPathFormModal', () => {
  it('creates a path with at least one unit', async () => {
    let posted: unknown = null
    server.use(
      http.post('*/admin/learning/paths', async ({ request }) => {
        posted = await request.json()
        return HttpResponse.json({ data: { id: 'new-1' } }, { status: 201 })
      }),
    )
    const onClose = vi.fn()
    renderWithClient(<LearningPathFormModal mode="create" path={null} open onClose={onClose} />)

    await userEvent.type(screen.getByLabelText(/^title$/i), 'New path title')
    await userEvent.type(screen.getByLabelText(/first unit title/i), 'Intro unit')
    await userEvent.click(screen.getByRole('button', { name: /create path/i }))

    await screen.findByText(/created/i)
    expect(posted).toMatchObject({ title: 'New path title', units: [{ title: 'Intro unit' }] })
  })

  it('edits metadata for an existing path', async () => {
    let patched: unknown = null
    server.use(
      http.patch('*/admin/learning/paths/p1', async ({ request }) => {
        patched = await request.json()
        return HttpResponse.json({ data: { id: 'p1' } })
      }),
    )
    const onClose = vi.fn()
    renderWithClient(
      <LearningPathFormModal
        mode="edit"
        path={{ id: 'p1', title: 'Old title', description: null, department: null, category: 'career', difficulty: 'beginner', estimatedDays: 5, isPublished: false, source: 'manual', unitCount: 1, enrolledCount: 0, completedCount: 0, completionRate: 0, updatedAt: new Date().toISOString() }}
        open
        onClose={onClose}
      />,
    )

    const titleInput = screen.getByLabelText(/^title$/i)
    await userEvent.clear(titleInput)
    await userEvent.type(titleInput, 'Updated title')
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await screen.findByText(/saved/i)
    expect(patched).toMatchObject({ title: 'Updated title' })
  })
})
