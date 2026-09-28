import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/msw/server'
import { learningFixtures } from '@/tests/msw/handlers'
import { BadgesPanel } from './BadgesPanel'

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('BadgesPanel', () => {
  it('renders the empty state when there are no badges', async () => {
    server.use(
      http.get('*/learning/users/:userId/badges', () => HttpResponse.json({ data: [] })),
    )
    renderWithClient(<BadgesPanel userId="user-1" isOwnProfile={false} />)
    expect(await screen.findByText('No badges yet')).toBeInTheDocument()
  })

  it('renders fixture badges with their rarity label', async () => {
    renderWithClient(<BadgesPanel userId="user-1" isOwnProfile={false} />)
    expect(await screen.findByText('Git novice')).toBeInTheDocument()
    expect(screen.getByText('Common')).toBeInTheDocument()
  })

  it('shows a Showcase pill on own profile and pins the badge on click', async () => {
    let putBody: unknown = null
    let putUrl = ''
    server.use(
      http.put('*/learning/me/badges/:badgeId/pin', async ({ request }) => {
        putUrl = request.url
        putBody = await request.json()
        return HttpResponse.json({ data: {} })
      }),
    )
    const user = userEvent.setup()
    renderWithClient(<BadgesPanel userId="user-1" isOwnProfile />)

    const showcaseBtn = await screen.findByRole('button', { name: 'Showcase' })
    await user.click(showcaseBtn)

    expect(putUrl).toMatch(/\/learning\/me\/badges\/badge-1\/pin$/)
    expect(putBody).toEqual({ pinned: true })
  })

  it('shows Showcased and unpins only that badge when clicked', async () => {
    let putBody: unknown = null
    server.use(
      http.get('*/learning/users/:userId/badges', () =>
        HttpResponse.json({ data: [{ ...learningFixtures.badges[0], isShowcased: true }] })),
      http.put('*/learning/me/badges/:badgeId/pin', async ({ request }) => {
        putBody = await request.json()
        return HttpResponse.json({ data: {} })
      }),
    )
    const user = userEvent.setup()
    renderWithClient(<BadgesPanel userId="user-1" isOwnProfile />)

    const showcasedBtn = await screen.findByRole('button', { name: 'Showcased ✓' })
    await user.click(showcasedBtn)

    expect(putBody).toEqual({ pinned: false })
  })

  it('does not show Showcase pills on other people profiles', async () => {
    renderWithClient(<BadgesPanel userId="user-1" isOwnProfile={false} />)
    await screen.findByText('Git novice')
    expect(screen.queryByRole('button', { name: 'Showcase' })).not.toBeInTheDocument()
  })
})
