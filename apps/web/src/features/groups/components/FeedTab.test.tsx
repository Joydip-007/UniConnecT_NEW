import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/msw/server'
import type { FeedPost } from '@uniconnect/shared'
import { FeedTab } from './FeedTab'

vi.mock('@/features/feed/components/CreatePost', () => ({ CreatePost: () => null }))
vi.mock('@/features/feed/components/CommentDrawer', () => ({ CommentDrawer: () => null }))

// jsdom has no IntersectionObserver; the feed tab's infinite scroll needs a stub.
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}
vi.stubGlobal('IntersectionObserver', NoopObserver)

function makePendingPost(overrides: Partial<FeedPost> = {}): FeedPost {
  return {
    id: 'pending-1',
    type: 'post',
    content: 'Can we get more study rooms booked for finals week?',
    mediaUrls: [],
    isPinned: false,
    isPublished: false,
    publishAt: null,
    archivedAt: null,
    expiresAt: null,
    isSaved: false,
    viewCount: 0,
    myReaction: null,
    reactionCounts: { like: 0, love: 0, care: 0, haha: 0, wow: 0, sad: 0, angry: 0 },
    commentCount: 0,
    shareCount: 0,
    reactionCountsHidden: false,
    commentsDisabled: false,
    sharesDisabled: false,
    originalPost: null,
    myShare: null,
    createdAt: new Date().toISOString(),
    author: {
      id: 'u2',
      fullName: 'Tanvir Hasan',
      role: 'student',
      profile: { avatarUrl: null, headline: null, department: null, batchYear: null },
    },
    poll: null,
    jobEmbed: null,
    eventEmbed: null,
    lostFoundEmbed: null,
    ...overrides,
  }
}

function renderFeedTab(userRole: 'owner' | 'admin' | 'moderator' | 'member' | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <FeedTab groupId="g1" userRole={userRole} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('FeedTab pending post approval queue', () => {
  it('shows the eyebrow and Approve action for an admin when a post is pending', async () => {
    server.use(
      http.get('*/groups/g1/review/posts', () =>
        HttpResponse.json({ data: { items: [makePendingPost()] } }),
      ),
      http.get('*/groups/g1/posts', () =>
        HttpResponse.json({ data: { items: [], hasMore: false, page: 1 } }),
      ),
    )

    renderFeedTab('admin')

    expect(await screen.findByText('1 post awaiting approval')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument()
  })

  it('renders nothing from the review queue for a plain member', async () => {
    server.use(
      http.get('*/groups/g1/posts', () =>
        HttpResponse.json({ data: { items: [], hasMore: false, page: 1 } }),
      ),
    )

    renderFeedTab('member')

    await waitFor(() => expect(screen.getByText('No posts yet')).toBeInTheDocument())
    expect(screen.queryByText(/awaiting approval/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
  })
})
