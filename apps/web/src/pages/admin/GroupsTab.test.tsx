import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { GroupsTab } from './GroupsTab'
import { api } from '@/lib/axios'

vi.mock('@/lib/axios', () => ({
  api: { get: vi.fn() },
}))

function renderWithProviders() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <GroupsTab />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('GroupsTab — Group activity panel', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        data: {
          items: [],
          total: 0,
          page: 1,
          hasMore: false,
          summary: {
            totalGroups: 42,
            privateGroups: 9,
            totalMembers: 1830,
            pendingRequests: 12,
            createdThisWeek: 3,
          },
        },
      },
    })
  })

  it('renders the summary metrics once loaded', async () => {
    renderWithProviders()
    expect(await screen.findByText('42')).toBeInTheDocument()
    expect(screen.getByText('9 private')).toBeInTheDocument()
    expect(screen.getByText('1,830')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})
