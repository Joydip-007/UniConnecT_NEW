import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/msw/server'
import { LearningPathLibrary } from './LearningPathLibrary'

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('LearningPathLibrary', () => {
  it('shows stat tiles and path cards, and calls onManagePath', async () => {
    server.use(
      http.get('*/admin/learning/paths', () =>
        HttpResponse.json({
          data: [
            { id: 'p1', title: 'Algorithms, properly', department: 'CSE', category: 'technical', difficulty: 'intermediate', isPublished: true, unitCount: 11, enrolledCount: 214, completionRate: 0.46, updatedAt: new Date().toISOString() },
          ],
        }),
      ),
      http.get('*/admin/learning/pending-paths', () => HttpResponse.json({ data: [] })),
    )
    const onManagePath = vi.fn()
    const onEditPath = vi.fn()
    renderWithClient(<LearningPathLibrary onCreatePath={() => {}} onEditPath={onEditPath} onManagePath={onManagePath} />)

    expect(await screen.findByText('Algorithms, properly')).toBeInTheDocument()
    expect(screen.getByText(/214 enrolled/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /manage/i }))
    expect(onManagePath).toHaveBeenCalledWith('p1')

    await userEvent.click(screen.getByRole('button', { name: /^edit$/i }))
    expect(onEditPath).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }))
  })

  it('filters to drafts when the Drafts chip is clicked', async () => {
    server.use(
      http.get('*/admin/learning/paths', ({ request }) => {
        const url = new URL(request.url)
        const status = url.searchParams.get('status')
        const rows =
          status === 'draft'
            ? [{ id: 'p2', title: 'Draft path', isPublished: false, unitCount: 2, enrolledCount: 0, completionRate: 0, updatedAt: new Date().toISOString() }]
            : [
                { id: 'p1', title: 'Published path', isPublished: true, unitCount: 3, enrolledCount: 5, completionRate: 0.2, updatedAt: new Date().toISOString() },
                { id: 'p2', title: 'Draft path', isPublished: false, unitCount: 2, enrolledCount: 0, completionRate: 0, updatedAt: new Date().toISOString() },
              ]
        return HttpResponse.json({ data: rows })
      }),
      http.get('*/admin/learning/pending-paths', () => HttpResponse.json({ data: [] })),
    )
    renderWithClient(<LearningPathLibrary onCreatePath={() => {}} onEditPath={() => {}} onManagePath={() => {}} />)
    expect(await screen.findByText('Published path')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^drafts/i }))
    expect(await screen.findByText('Draft path')).toBeInTheDocument()
    expect(screen.queryByText('Published path')).not.toBeInTheDocument()
  })
})
