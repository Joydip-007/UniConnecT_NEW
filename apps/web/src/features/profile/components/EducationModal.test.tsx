import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ProfileEducation } from '@uniconnect/shared'
import { server } from '@/tests/msw/server'
import { EducationModal } from './EducationModal'

const entry: ProfileEducation = {
  id: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  institution: 'United International University',
  degree: 'BSCSE',
  fieldOfStudy: null,
  startYear: 2021,
  endYear: null,
  grade: null,
  description: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

function renderModal(onClose = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <EducationModal userId={entry.userId} entry={entry} onClose={onClose} />
    </QueryClientProvider>,
  )
  return onClose
}

describe('EducationModal delete', () => {
  it('asks for confirmation and deletes nothing until confirmed', async () => {
    let deleted = 0
    server.use(
      http.delete('*/users/me/education/:id', () => {
        deleted += 1
        return HttpResponse.json({ data: { deleted: true } })
      }),
    )
    const user = userEvent.setup()
    const onClose = renderModal()

    await user.click(screen.getByRole('button', { name: 'Delete education' }))
    expect(screen.getByText('Delete this education entry?')).toBeInTheDocument()
    expect(deleted).toBe(0)

    // "Keep" backs out without deleting and restores the normal footer.
    await user.click(screen.getByRole('button', { name: 'Keep' }))
    expect(screen.queryByText('Delete this education entry?')).not.toBeInTheDocument()
    expect(deleted).toBe(0)

    await user.click(screen.getByRole('button', { name: 'Delete education' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(deleted).toBe(1)
  })

  it('stays open with an error when the delete fails', async () => {
    server.use(http.delete('*/users/me/education/:id', () => new HttpResponse(null, { status: 500 })))
    const user = userEvent.setup()
    const onClose = renderModal()

    await user.click(screen.getByRole('button', { name: 'Delete education' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText("Couldn't delete — try again")).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })
})
