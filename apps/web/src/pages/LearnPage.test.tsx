import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/tests/msw/server'
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
    // Path title now appears in both the TodayCard's path-context line and the
    // Paths section card, so assert there is at least one match rather than
    // requiring a single unambiguous element.
    const pathTitleMatches = await screen.findAllByText(learningFixtures.paths[0].title)
    expect(pathTitleMatches.length).toBeGreaterThanOrEqual(1)
    expect(await screen.findByText(learningFixtures.today[0].unit.title)).toBeInTheDocument()
  })

  it('gives the filled accent to the first unfinished unit in Today and nothing else', async () => {
    renderPage()

    const complete = await screen.findByRole('button', { name: 'Mark complete' })
    expect(complete.getAttribute('style')).toContain('var(--uc-orange)')
    expect(complete.getAttribute('style')).toContain('var(--on-accent)')
  })

  it('leaves the Mark complete button quiet once the unit is done for today', async () => {
    server.use(
      http.get('*/learning/me/today', () =>
        HttpResponse.json({
          data: [{ ...learningFixtures.today[0], completedToday: true }],
        })),
    )
    renderPage()

    expect(await screen.findByText('Done for today. Come back tomorrow')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mark complete' })).not.toBeInTheDocument()
  })

  it('filters the paths grid by the selected chip', async () => {
    const user = userEvent.setup()
    renderPage()

    // The fixture path is beginner/engineering, so an "Advanced" chip never renders and
    // "Engineering · 1" keeps it visible while a non-matching facet would empty the grid.
    const engineering = await screen.findByRole('button', { name: 'Engineering · 1' })
    expect(screen.queryByRole('button', { name: /Advanced/ })).not.toBeInTheDocument()

    await user.click(engineering)
    expect(engineering).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByText(learningFixtures.paths[0].title).length).toBeGreaterThanOrEqual(1)
  })

  it('opens on All when nothing is enrolled, so "My paths" is not offered', async () => {
    renderPage()

    const all = await screen.findByRole('button', { name: 'All · 1' })
    expect(all).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: /My paths/ })).not.toBeInTheDocument()
  })
})
