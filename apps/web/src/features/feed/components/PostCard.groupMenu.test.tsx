import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { FeedPost } from '@uniconnect/shared'
import { PostCard } from './PostCard'

// PostCard reads `useAuthStore((s) => s.user)` and `@/lib/axios` reads
// `useAuthStore.getState()` imperatively, so the stub carries both — mirrors the
// pattern in `MobileEventsStrip.test.tsx`.
vi.mock('@/stores/authStore', () => {
  const state = () => ({ user: { id: 'viewer-1', role: 'student' }, accessToken: null, clearAuth: () => {} })
  const useAuthStore = Object.assign(
    (selector: (s: ReturnType<typeof state>) => unknown) => selector(state()),
    { getState: state },
  )
  return { useAuthStore }
})

function makePost(overrides: Partial<FeedPost> = {}): FeedPost {
  return {
    id: 'p1',
    type: 'post',
    content: 'hello',
    mediaUrls: [],
    isPinned: false,
    isPublished: true,
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
      id: 'author-1',
      fullName: 'Author Name',
      role: 'student',
      profile: {
        avatarUrl: null,
        headline: null,
        department: null,
        batchYear: null,
      },
    },
    poll: null,
    jobEmbed: null,
    eventEmbed: null,
    lostFoundEmbed: null,
    ...overrides,
  }
}

async function openMenu(
  post: FeedPost,
  props: { groupRole?: 'owner' | 'admin' | 'moderator' | 'member'; groupId?: string } = {},
) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <PostCard post={post} onCommentClick={() => {}} onEditPost={() => {}} {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Post options' }))
}

describe('PostCard group-aware menu', () => {
  it('shows the moderator set (Pin to group / Mute this member / Delete post, no Report) for groupRole=admin', async () => {
    await openMenu(makePost(), { groupRole: 'admin', groupId: 'g1' })

    expect(screen.getByRole('button', { name: 'Pin to group' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mute this member' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete post' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Report to group admins' })).not.toBeInTheDocument()
  })

  it('shows the member set (Report to group admins, no Pin/Mute) for groupRole=member', async () => {
    await openMenu(makePost(), { groupRole: 'member', groupId: 'g1' })

    expect(screen.getByRole('button', { name: 'Report to group admins' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pin to group' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Unpin from group' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mute this member' })).not.toBeInTheDocument()
  })

  it('renders the original menu unchanged when no groupRole is passed', async () => {
    await openMenu(makePost())

    // Viewer (student, not the author, not platform admin) gets the plain Report item.
    expect(screen.getByRole('button', { name: 'Report' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pin to group' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mute this member' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Report to group admins' })).not.toBeInTheDocument()
  })
})
