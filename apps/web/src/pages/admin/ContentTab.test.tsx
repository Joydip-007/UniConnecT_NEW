import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { FeedPost } from '@uniconnect/shared'
import { server } from '@/tests/msw/server'
import { ContentTab } from './ContentTab'

function makePost(overrides: Partial<FeedPost> & { id: string }): FeedPost {
  return {
    type: 'post',
    content: 'Trimester registration for Fall 2026 opens on 24 August and closes on 4 September. Advising slots are on eLMS.',
    mediaUrls: [],
    isPinned: false,
    isPublished: true,
    publishAt: null,
    archivedAt: null,
    expiresAt: null,
    isSaved: false,
    viewCount: 0,
    myReaction: null,
    reactionCounts: { like: 3, love: 0, care: 0, haha: 0, wow: 0, sad: 0, angry: 0 },
    commentCount: 2,
    shareCount: 0,
    reactionCountsHidden: false,
    commentsDisabled: false,
    sharesDisabled: false,
    originalPost: null,
    myShare: null,
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    author: {
      id: 'u1',
      fullName: 'Dr. Shamsul Alam',
      role: 'faculty',
      profile: { avatarUrl: null, headline: 'Associate professor, CSE', department: 'CSE', batchYear: null },
    },
    poll: null,
    jobEmbed: null,
    eventEmbed: null,
    lostFoundEmbed: null,
    ...overrides,
  }
}

/** In-memory store the handlers read and write, so the tab is exercised end to end. */
let posts: FeedPost[]
let removedIds: Set<string>
const patches: { url: string; body: unknown }[] = []

function installHandlers() {
  server.use(
    http.get('*/admin/content/summary', () =>
      HttpResponse.json({
        data: {
          total: posts.filter((p) => !removedIds.has(p.id)).length,
          pinned: posts.filter((p) => p.isPinned && !removedIds.has(p.id)).length,
          removed: removedIds.size,
          reportsOpen: 4,
        },
      }),
    ),
    http.get('*/admin/content/feed', ({ request }) => {
      const url = new URL(request.url)
      const removed = url.searchParams.get('removed') === 'true'
      const type = url.searchParams.get('type')
      const items = posts.filter((p) => (removed ? removedIds.has(p.id) : !removedIds.has(p.id) && (!type || p.type === type)))
      return HttpResponse.json({ data: { items, total: items.length, page: 1, hasMore: false } })
    }),
    http.patch('*/admin/content/posts/:id/:action', async ({ request, params }) => {
      const body = (await request.json()) as Record<string, boolean>
      patches.push({ url: request.url, body })
      const id = params.id as string
      const post = posts.find((p) => p.id === id)!
      if (params.action === 'pin') post.isPinned = body.is_pinned
      if (params.action === 'publish') post.isPublished = body.is_published
      if (params.action === 'comments') post.commentsDisabled = body.comments_disabled
      if (params.action === 'removed') {
        if (body.is_removed) removedIds.add(id)
        else removedIds.delete(id)
      }
      return HttpResponse.json({ data: { id } })
    }),
  )
}

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ContentTab />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ContentTab (admin content moderation)', () => {
  beforeEach(() => {
    posts = [
      makePost({ id: 'p1', isPinned: true }),
      makePost({ id: 'p2', content: 'Line-following bots from the workshop.', author: { id: 'u2', fullName: 'Ishrat Binte Kabir', role: 'student', profile: { avatarUrl: null, headline: null, department: 'EEE', batchYear: '2027' } } }),
      makePost({ id: 'j1', type: 'job_promo', content: 'Two junior backend roles for the December intake.', author: { id: 'u3', fullName: 'Rafiul Karim', role: 'alumni', profile: { avatarUrl: null, headline: 'Backend engineer', department: 'CSE', batchYear: '2019' } } }),
    ]
    removedIds = new Set()
    patches.length = 0
    installHandlers()
  })

  it('renders the stat strip, type tabs and collapsed rows for the Posts tab only', async () => {
    renderTab()
    expect(await screen.findByText('Total items')).toBeInTheDocument()
    expect(screen.getByText('Reports open')).toBeInTheDocument()
    expect(await screen.findByText('4')).toBeInTheDocument()

    expect(await screen.findByText('Dr. Shamsul Alam')).toBeInTheDocument()
    expect(screen.getByText('Ishrat Binte Kabir')).toBeInTheDocument()
    // The job promo lives under the Jobs tab.
    expect(screen.queryByText('Rafiul Karim')).not.toBeInTheDocument()

    // Collapsed: snippet only, no full body, no member action row.
    expect(screen.queryByRole('button', { name: /^like$/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Collapse')).not.toBeInTheDocument()
  })

  it('switches type tabs', async () => {
    const user = userEvent.setup()
    renderTab()
    await screen.findByText('Dr. Shamsul Alam')
    await user.click(screen.getByRole('button', { name: 'Jobs' }))
    expect(await screen.findByText('Rafiul Karim')).toBeInTheDocument()
    expect(screen.queryByText('Dr. Shamsul Alam')).not.toBeInTheDocument()
  })

  it('expands a row into the review-only PostCard with the Manage menu, and collapses it again', async () => {
    const user = userEvent.setup()
    renderTab()
    const row = await screen.findByRole('button', { name: /Ishrat Binte Kabir/ })
    await user.click(row)

    expect(await screen.findByText('Collapse')).toBeInTheDocument()
    // Full body and role badge from the shipped PostCard…
    expect(screen.getByText('Line-following bots from the workshop.')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Student' })).toBeInTheDocument()
    // …but no member participation, and no way into the feed: the timestamp and the
    // comment count are plain text rather than links to the post detail.
    expect(screen.queryByRole('button', { name: /^like$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^save$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'View post' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Manage post' }))
    const menu = await screen.findByRole('menu')
    expect(within(menu).getByText('Manage post')).toBeInTheDocument()
    expect(within(menu).getByText('Pin to feed')).toBeInTheDocument()
    expect(within(menu).getByText('Unpublish')).toBeInTheDocument()
    expect(within(menu).getByText('Close to replies')).toBeInTheDocument()
    expect(within(menu).getByText('Open author profile')).toBeInTheDocument()
    expect(within(menu).getByText('Delete')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Close menu' }))
    await user.click(screen.getByText('Collapse'))
    expect(screen.queryByText('Collapse')).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Student' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ishrat Binte Kabir/ })).toBeInTheDocument()
  })

  it('pinned rows show the pin in the collapsed row and the Pinned pill + Unpin when expanded', async () => {
    const user = userEvent.setup()
    renderTab()
    await user.click(await screen.findByRole('button', { name: /Dr\. Shamsul Alam/ }))
    // The stat strip also says "Pinned"; the pill is the span inside the card header.
    expect(await screen.findByText('Pinned', { selector: 'span' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Manage announcement' }))
    expect(await screen.findByText('Unpin')).toBeInTheDocument()
  })

  it('Unpublish and Close to replies flip the pills and call the endpoints', async () => {
    const user = userEvent.setup()
    renderTab()
    await user.click(await screen.findByRole('button', { name: /Ishrat Binte Kabir/ }))
    await user.click(await screen.findByRole('button', { name: 'Manage post' }))
    await user.click(await screen.findByText('Unpublish'))
    expect(await screen.findByText('Unpublished')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Manage post' }))
    await user.click(await screen.findByText('Close to replies'))
    expect(await screen.findByText('Closed')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Manage post' }))
    const menu = await screen.findByRole('menu')
    expect(within(menu).getByText('Publish')).toBeInTheDocument()
    expect(within(menu).getByText('hidden')).toBeInTheDocument()
    expect(within(menu).getByText('Reopen')).toBeInTheDocument()
    expect(within(menu).getByText('closed')).toBeInTheDocument()

    expect(patches.map((p) => [p.url.split('/admin/content/')[1], p.body])).toEqual([
      ['posts/p2/publish', { is_published: false }],
      ['posts/p2/comments', { comments_disabled: true }],
    ])
  })

  it('Delete needs a second click, then moves the post to Recently removed, where Restore brings it back', async () => {
    const user = userEvent.setup()
    renderTab()
    expect(screen.queryByText(/Recently removed/)).not.toBeInTheDocument()

    await user.click(await screen.findByRole('button', { name: /Ishrat Binte Kabir/ }))
    await user.click(await screen.findByRole('button', { name: 'Manage post' }))
    await user.click(await screen.findByText('Delete'))
    // First click only arms; nothing has been sent.
    expect(await screen.findByText('Click again to confirm')).toBeInTheDocument()
    expect(patches).toHaveLength(0)
    await user.click(screen.getByText('Click again to confirm'))

    expect(await screen.findByText('Recently removed (1)')).toBeInTheDocument()
    expect(screen.queryByText('Ishrat Binte Kabir')).not.toBeInTheDocument()
    expect(patches).toEqual([{ url: expect.stringContaining('/admin/content/posts/p2/removed'), body: { is_removed: true } }])

    await user.click(screen.getByText('Recently removed (1)'))
    expect(await screen.findByText(/Ishrat Binte Kabir · Line-following bots/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Restore' }))

    // Back in the list (still expanded, as it was when removed).
    expect(await screen.findByText('Ishrat Binte Kabir')).toBeInTheDocument()
    expect(screen.queryByText(/Recently removed/)).not.toBeInTheDocument()
    expect(patches[1]).toEqual({ url: expect.stringContaining('/admin/content/posts/p2/removed'), body: { is_removed: false } })
  })

  it('the comment count opens the thread read-only: comments visible, no composer, no reply or like', async () => {
    server.use(
      http.get('*/posts/:id/comments', () =>
        HttpResponse.json({ data: { items: [
          { id: 'c1', postId: 'p2', authorId: 'u9', parentId: null, content: 'Which lab was this in?', mediaUrls: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            author: { id: 'u9', fullName: 'Ayesha Siddika', avatarUrl: null, headline: null, role: 'student' },
            reactionCounts: { like: 1, love: 0, care: 0, haha: 0, wow: 0, sad: 0, angry: 0 }, myReaction: null, replies: [] },
        ], total: 1, page: 1, hasMore: false } }),
      ),
    )
    const user = userEvent.setup()
    renderTab()
    await user.click(await screen.findByRole('button', { name: /Ishrat Binte Kabir/ }))
    await user.click(await screen.findByRole('button', { name: '2 comments' }))
    expect(await screen.findByText('Which lab was this in?')).toBeInTheDocument()
    expect(screen.getByText(/Read-only — admins review comments/)).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /reply/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^like$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /send/i })).not.toBeInTheDocument()
  })

  it('a poll shows percentages only, with no clickable options', async () => {
    posts.push(makePost({ id: 'p3', content: 'Pick a slot.', author: { id: 'u4', fullName: 'Tanvir Ahmed', role: 'student', profile: { avatarUrl: null, headline: null, department: 'CSE', batchYear: '2026' } },
      poll: { id: 'poll1', question: 'Which slot works?', expiresAt: null, myVote: null, totalVotes: 4, options: [
        { id: 'o1', text: 'Thursday, 4 pm', displayOrder: 0, voteCount: 3 },
        { id: 'o2', text: 'Friday, 11 am', displayOrder: 1, voteCount: 1 },
      ] } }))
    const user = userEvent.setup()
    renderTab()
    await user.click(await screen.findByRole('button', { name: /Tanvir Ahmed/ }))
    expect(await screen.findByText('Which slot works?')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getByText('25%')).toBeInTheDocument()
    const option = screen.getByRole('button', { name: /Thursday, 4 pm/ })
    expect(option).toBeDisabled()
    await user.click(option)
    expect(patches).toHaveLength(0)
    expect(screen.getByText('4 votes')).toBeInTheDocument()
  })

  it('shows the per-type empty state', async () => {
    const user = userEvent.setup()
    renderTab()
    await screen.findByText('Dr. Shamsul Alam')
    await user.click(screen.getByRole('button', { name: 'Events' }))
    expect(await screen.findByText('Nothing here yet')).toBeInTheDocument()
    expect(screen.getByText('No events posted to the feed yet.')).toBeInTheDocument()
  })
})
