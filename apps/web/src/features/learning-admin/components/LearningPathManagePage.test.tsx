import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/msw/server'
import { LearningPathManagePage } from './LearningPathManagePage'

function renderAt(pathId: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/admin/learning/paths/${pathId}`]}>
        <Routes>
          <Route path="/admin/learning/paths/:pathId" element={<LearningPathManagePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('LearningPathManagePage', () => {
  it('lists units and adds a new one', async () => {
    let posted: unknown = null
    server.use(
      http.get('*/admin/learning/paths/p1', () =>
        HttpResponse.json({
          data: {
            id: 'p1', title: 'Algorithms, properly', isPublished: true, unitCount: 1, enrolledCount: 0, completionRate: 0, updatedAt: new Date().toISOString(),
            units: [{ id: 'u1', displayOrder: 1, title: 'Big-O notation', type: 'read', content: { body: 'x' }, completionRule: null }],
          },
        }),
      ),
      http.post('*/admin/learning/paths/p1/units', async ({ request }) => {
        posted = await request.json()
        return HttpResponse.json({ data: { success: true } }, { status: 201 })
      }),
    )
    renderAt('p1')

    expect(await screen.findByText('Big-O notation')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText(/new unit title/i), 'Recursion basics')
    await userEvent.click(screen.getByRole('button', { name: /add unit/i }))

    expect(posted).toMatchObject({ title: 'Recursion basics', type: 'read' })
  })
})
