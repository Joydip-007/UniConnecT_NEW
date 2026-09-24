import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/tests/msw/server'
import { PATHS } from '@/router/paths'
import { PeopleYouMayKnowWidget } from './PeopleYouMayKnowWidget'

const suggestion = {
  id: 'u-2',
  role: 'student',
  profile: { fullName: 'Ada Rahman', department: 'CSE', batchYear: '2024' },
  connectionStatus: 'none',
  connectionId: null,
}

function renderAt(path: string) {
  let calls = 0
  server.use(
    http.get('*/users/suggestions', () => {
      calls += 1
      return HttpResponse.json({ data: [suggestion] })
    }),
  )
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const utils = render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <PeopleYouMayKnowWidget />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { ...utils, calls: () => calls }
}

describe('PeopleYouMayKnowWidget', () => {
  it('shows suggestions on the feed', async () => {
    renderAt(PATHS.FEED)
    expect(await screen.findByText('Ada Rahman')).toBeInTheDocument()
  })

  // Explore's discovery view already leads with its own "People you may know" carousel.
  it('renders nothing and skips the fetch on Explore', async () => {
    const { container, calls } = renderAt(PATHS.EXPLORE)
    await new Promise((r) => setTimeout(r, 50))
    expect(container).toBeEmptyDOMElement()
    expect(calls()).toBe(0)
  })
})
