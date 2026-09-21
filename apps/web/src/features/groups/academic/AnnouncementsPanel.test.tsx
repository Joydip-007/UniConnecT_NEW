import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/msw/server'
import { AnnouncementsPanel } from './AnnouncementsPanel'

const items = [
  {
    id: 'a1',
    title: 'CT2 moved to Thursday',
    body: 'Same syllabus, same room.',
    kind: 'schedule',
    isPinned: true,
    attachments: [],
    author: { id: 't1', fullName: 'Dr. Rahman' },
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'a2',
    title: 'Bring calculators',
    body: 'Scientific only.',
    kind: 'notice',
    isPinned: false,
    attachments: [],
    author: { id: 't1', fullName: 'Dr. Rahman' },
    createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
  },
]

function renderPanel(isAdmin: boolean) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <AnnouncementsPanel groupId="g1" isAdmin={isAdmin} />
    </QueryClientProvider>,
  )
}

describe('AnnouncementsPanel', () => {
  it('lists announcements with kind pill, pinned tag and author line', async () => {
    server.use(http.get('*/groups/g1/announcements', () => HttpResponse.json({ data: { items } })))
    renderPanel(false)

    expect(await screen.findByText('CT2 moved to Thursday')).toBeInTheDocument()
    expect(screen.getByText('Schedule')).toBeInTheDocument()
    expect(screen.getByText('pinned')).toBeInTheDocument()
    expect(screen.getAllByText(/Dr\. Rahman, course teacher/)).toHaveLength(2)
    // members never see the composer
    expect(screen.queryByText(/Post a notice/)).not.toBeInTheDocument()
  })

  it('admin composer expands, posts and collapses', async () => {
    const user = userEvent.setup()
    let posted: Record<string, unknown> | null = null
    server.use(
      http.get('*/groups/g1/announcements', () => HttpResponse.json({ data: { items: [] } })),
      http.post('*/groups/g1/announcements', async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ data: { ...items[0], id: 'a3' } }, { status: 201 })
      }),
    )
    renderPanel(true)

    await user.click(await screen.findByText(/Post a notice/))
    expect(screen.getByText('New announcement')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Title'), 'Make-up CT')
    await user.type(screen.getByPlaceholderText(/What do members need to know/), 'Saturday 10am')
    await user.click(screen.getByRole('button', { name: 'Urgent' }))
    await user.click(screen.getByRole('switch', { name: /Notify all members/ }))
    await user.click(screen.getByRole('button', { name: 'Post announcement' }))

    await waitFor(() => expect(posted).not.toBeNull())
    expect(posted).toMatchObject({ title: 'Make-up CT', body: 'Saturday 10am', kind: 'urgent', notify_members: true })
    await waitFor(() => expect(screen.queryByText('New announcement')).not.toBeInTheDocument())
  })
})
