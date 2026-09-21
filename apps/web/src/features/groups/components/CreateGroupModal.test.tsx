import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '@uniconnect/shared/types'
import { CreateGroupModal } from './CreateGroupModal'
import { useAuthStore } from '@/stores/authStore'

const mockUseSearchPeople = vi.fn()

vi.mock('@/features/search/hooks/useSearchPeople', () => ({
  useSearchPeople: (...args: unknown[]) => mockUseSearchPeople(...args),
}))

function person(id: string, fullName: string) {
  return {
    id,
    fullName,
    headline: null,
    department: 'CSE',
    batchYear: '2024',
    avatarUrl: null,
    role: 'student',
    connectionStatus: 'none' as const,
    connectionId: null,
  }
}

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

describe('CreateGroupModal — member picker (Task 19)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ user: { id: 'u1', role: 'student' } as unknown as User })
    mockUseSearchPeople.mockReturnValue({
      data: { pages: [{ items: [person('p1', 'Alex Rahman'), person('p2', 'Bina Chowdhury')] }] },
      isLoading: false,
    })
  })

  it('shows the Academic and Other kind chips', () => {
    useAuthStore.setState({ user: { id: 'u1', role: 'faculty' } as unknown as User })
    renderModal()
    expect(screen.getByRole('button', { name: /academic/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /other/i })).toBeInTheDocument()
  })

  it('shows "No one selected" before any pick, then updates the count and footer label as people are picked', () => {
    renderModal()
    expect(screen.getByText('No one selected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create group' })).toBeInTheDocument()

    fireEvent.click(screen.getByText('Alex Rahman'))
    fireEvent.click(screen.getByText('Bina Chowdhury'))

    expect(screen.getByText('2 people selected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create with 2' })).toBeInTheDocument()
  })

  it('advances to the naming step and hides Academic for a student user', () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Create group' }))
    expect(screen.getByText('Name the group')).toBeInTheDocument()
    expect(screen.queryByText('Academic')).not.toBeInTheDocument()
  })
})

describe('CreateGroupModal — academic type (legacy)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSearchPeople.mockReturnValue({ data: { pages: [] }, isLoading: false })
  })

  it('shows the Academic option for faculty users', () => {
    useAuthStore.setState({ user: { id: 'u1', role: 'faculty' } as unknown as User })
    renderModal()
    expect(screen.getByRole('button', { name: /academic/i })).toBeInTheDocument()
  })

  it('hides the Academic option for student users', () => {
    useAuthStore.setState({ user: { id: 'u2', role: 'student' } as unknown as User })
    renderModal()
    expect(screen.queryByText('Academic')).not.toBeInTheDocument()
  })
})
