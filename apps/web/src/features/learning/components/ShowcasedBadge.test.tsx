import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/msw/server'
import { learningFixtures } from '@/tests/msw/handlers'
import { ShowcasedBadge } from './ShowcasedBadge'

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('ShowcasedBadge', () => {
  it('renders nothing when the user has no showcased badge', async () => {
    renderWithClient(<ShowcasedBadge userId="user-1" />)
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByTitle('Git novice')).not.toBeInTheDocument()
  })

  it('renders the showcased badge with a title tooltip', async () => {
    server.use(
      http.get('*/learning/users/:userId/badges', () =>
        HttpResponse.json({ data: [{ ...learningFixtures.badges[0], isShowcased: true }] })),
    )
    renderWithClient(<ShowcasedBadge userId="user-1" />)
    expect(await screen.findByTitle('Git novice')).toBeInTheDocument()
  })
})
