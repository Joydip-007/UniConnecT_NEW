import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { server } from '@/tests/msw/server'
import { learningFixtures } from '@/tests/msw/handlers'
import { useAuthStore } from '@/stores/authStore'
import { usePageRailStore } from '@/stores/pageRailStore'
import LearnPage from './LearnPage'

function Location() {
  const loc = useLocation()
  return <output data-testid="location">{loc.search}</output>
}

function renderPage(entry = '/learn') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[entry]}>
        <LearnPage />
        <Location />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const activePath = {
  ...learningFixtures.paths[0],
  id: 'path-2',
  title: 'Algorithms, properly',
  myEnrollmentStatus: 'active' as const,
  completedUnitCount: 1,
  nextUnitTitle: 'Intro',
}

describe('LearnPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 'me', role: 'student' } as never })
    server.use(
      http.get('*/learning/paths', () => HttpResponse.json({ data: [learningFixtures.paths[0], activePath] })),
      http.get('*/learning/me/today', () =>
        HttpResponse.json({ data: [{ ...learningFixtures.today[0], pathId: 'path-2' }] })),
      http.get('*/quiz/today', () => HttpResponse.json({ data: null })),
      http.get('*/quiz/today/leaderboard', () => HttpResponse.json({ data: [] })),
    )
  })

  it('opens on the skill paths tab with counts, status chips and today’s work on the card', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Learn' })).toBeInTheDocument()
    expect(await screen.findByText('Algorithms, properly')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Skill paths\s*2/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: 'In progress · 1' })).toBeInTheDocument()
    expect(screen.getByText('1 left today')).toBeInTheDocument()
  })

  it('filters by status and keeps the chip in the URL', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Not started · 1' }))
    expect(screen.getByTestId('location')).toHaveTextContent('?status=new')
    expect(screen.queryByText('Algorithms, properly')).not.toBeInTheDocument()
    expect(screen.getByText('Git basics')).toBeInTheDocument()
  })

  it('opens the full list from See all and returns with Back', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: /See all/ }))
    expect(screen.getByRole('heading', { name: 'All skill paths' })).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back to Learn' }))
    expect(screen.getByRole('tablist')).toBeInTheDocument()
  })

  it('lists checkpoint quizzes with why they are locked on the Quizzes tab', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('tab', { name: /Quizzes/ }))
    expect(screen.getByTestId('location')).toHaveTextContent('?tab=quizzes')
    const panel = screen.getByRole('tabpanel', { name: 'Quizzes' })
    expect(await within(panel).findByText('Checkpoint: recovering a repo')).toBeInTheDocument()
    expect(within(panel).getByText('Locked')).toBeInTheDocument()
    expect(within(panel).getByText('Start this path to unlock its units')).toBeInTheDocument()
  })

  it('opens the path dialog from a card', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByText('Git basics'))
    expect(await screen.findByRole('dialog', { name: 'Skill path' })).toBeInTheDocument()
  })

  it('shows the badges view to students and pins an earned badge', async () => {
    let pinned: unknown = null
    server.use(
      http.get('*/learning/me/badges/progress', () =>
        HttpResponse.json({
          data: [{
            id: 'b7', name: 'Week one', description: 'Kept a 7-day learning streak', iconUrl: null, triggerType: 'streak_milestone',
            skillPathId: null, pathTitle: null, current: 9, target: 7, earned: true, awardedAt: null, pinned: false, pinnedAt: null, heldByPct: 34,
          }],
        })),
      http.put('*/learning/me/badges/:badgeId/pin', async ({ request }) => {
        pinned = await request.json()
        return HttpResponse.json({ data: { success: true } })
      }),
    )
    const user = userEvent.setup()
    renderPage('/learn?view=badges')
    expect(await screen.findByRole('heading', { name: 'Your badges' })).toBeInTheDocument()
    expect(await screen.findByText('1 of 1 earned · 0 of 3 pinned to your profile')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Week one/ }))
    expect(pinned).toEqual({ pinned: true })
  })

  it('ignores the badges view for roles the design does not give it to', async () => {
    useAuthStore.setState({ user: { id: 'me', role: 'alumni' } as never })
    renderPage('/learn?view=badges')
    expect(await screen.findByRole('tablist')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Your badges' })).not.toBeInTheDocument()
  })

  it('puts its own right rail in place of the role manifest', async () => {
    renderPage()
    await screen.findByText('Git basics')
    expect(usePageRailStore.getState().rightOverride).not.toBeNull()
  })
})
