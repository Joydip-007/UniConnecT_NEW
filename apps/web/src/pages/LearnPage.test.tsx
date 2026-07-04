import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { learningFixtures } from '@/tests/msw/handlers'
import LearnPage from './LearnPage'

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <LearnPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('LearnPage', () => {
  it('renders the heading, fixture path titles, and today\'s unit title', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Learn' })).toBeInTheDocument()
    expect(await screen.findByText(learningFixtures.paths[0].title)).toBeInTheDocument()
    expect(await screen.findByText(learningFixtures.today[0].unit.title)).toBeInTheDocument()
  })
})
