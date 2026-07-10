import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { User } from '@uniconnect/shared/types'
import { CreateGroupModal } from './CreateGroupModal'
import { useAuthStore } from '@/stores/authStore'

function renderModal() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <CreateGroupModal onClose={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CreateGroupModal — academic type', () => {
  it('shows the Academic option for faculty users', () => {
    useAuthStore.setState({ user: { id: 'u1', role: 'faculty' } as unknown as User })
    renderModal()
    expect(screen.getByText('Academic')).toBeInTheDocument()
  })

  it('hides the Academic option for student users', () => {
    useAuthStore.setState({ user: { id: 'u2', role: 'student' } as unknown as User })
    renderModal()
    expect(screen.queryByText('Academic')).not.toBeInTheDocument()
  })
})
