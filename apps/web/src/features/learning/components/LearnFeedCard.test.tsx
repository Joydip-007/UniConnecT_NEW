import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { LearnFeedCard } from './LearnFeedCard'
import { api } from '@/lib/axios'
import type { TodayEntry } from '../types'

vi.mock('@/lib/axios', () => ({
  api: { get: vi.fn() },
}))

const notCompletedEntry: TodayEntry = {
  pathId: 'path-1',
  unit: {
    id: 'unit-1',
    display_order: 1,
    title: 'Intro to campus life',
    type: 'read',
    completed: false,
  },
  completedToday: false,
}

function renderCard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LearnFeedCard />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('LearnFeedCard', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders the unit title and a continue learning link when an entry is not completed today', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [notCompletedEntry] } })
    renderCard()

    expect(await screen.findByText('Intro to campus life')).toBeInTheDocument()
    expect(screen.getByText("Today's unit")).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /continue learning/i })
    expect(link).toHaveAttribute('href', '/learn')
  })

  it('renders nothing when all entries are completed today', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { data: [{ ...notCompletedEntry, completedToday: true }] },
    })
    const { container } = renderCard()

    await waitFor(() => expect(api.get).toHaveBeenCalled())
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })

  it('renders nothing when there are no entries', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
    const { container } = renderCard()

    await waitFor(() => expect(api.get).toHaveBeenCalled())
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })

  it('hides and persists dismissal via sessionStorage on dismiss click', async () => {
    const user = userEvent.setup()
    vi.mocked(api.get).mockResolvedValue({ data: { data: [notCompletedEntry] } })
    renderCard()

    await screen.findByText('Intro to campus life')
    const dismissButton = screen.getByRole('button', { name: /dismiss/i })
    await user.click(dismissButton)

    expect(screen.queryByText('Intro to campus life')).not.toBeInTheDocument()
    expect(sessionStorage.getItem('uc:learn-card-dismissed')).toBe('1')
  })

  it('does not render if already dismissed this session', async () => {
    sessionStorage.setItem('uc:learn-card-dismissed', '1')
    vi.mocked(api.get).mockResolvedValue({ data: { data: [notCompletedEntry] } })
    const { container } = renderCard()

    await waitFor(() => expect(api.get).toHaveBeenCalled())
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })
})
