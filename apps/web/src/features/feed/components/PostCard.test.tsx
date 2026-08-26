import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { FeedPost } from '@uniconnect/shared'
import { PostCard } from './PostCard'

function makePost(content: string): FeedPost {
  return {
    id: 'p1',
    type: 'post',
    content,
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
      id: 'u1',
      fullName: 'Test User',
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
  }
}

function renderCard(post: FeedPost) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <PostCard post={post} onCommentClick={() => {}} onEditPost={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PostCard markdown sanitization', () => {
  it('strips javascript: links from markdown', () => {
    renderCard(makePost('[click](javascript:alert(1))'))
    const link = screen.queryByRole('link', { name: 'click' })
    // rehype-sanitize either removes the link or strips the dangerous href.
    if (link) {
      expect(link.getAttribute('href') ?? '').not.toMatch(/^javascript:/i)
    }
  })

  it('renders safe https links unchanged', () => {
    renderCard(makePost('[ok](https://example.com)'))
    const link = screen.getByRole('link', { name: 'ok' })
    expect(link.getAttribute('href')).toBe('https://example.com')
  })

  it('renders a role badge beside the author name', () => {
    renderCard(makePost('hello'))
    expect(screen.getByRole('img', { name: 'Student' })).toBeInTheDocument()
    expect(screen.queryByText('Student', { selector: '.role-badge__tip' })).toBeInTheDocument()
  })

  /**
   * `.feed-post-card` carries `content-visibility: auto`, which applies paint
   * containment — an upward tooltip from a badge this close to the card's top edge is
   * clipped whatever its z-index. The flip is the fix, so it is worth asserting.
   */
  it('opens the role badge tooltip below the badge, clear of the card edge', () => {
    renderCard(makePost('hello'))
    expect(screen.getByText('Student', { selector: '.role-badge__tip' })).toHaveClass(
      'role-badge__tip--below',
    )
  })
})

describe('PostCard author meta line', () => {
  function withProfile(profile: Partial<FeedPost['author']['profile']>): FeedPost {
    const post = makePost('hello')
    return { ...post, author: { ...post.author, profile: { ...post.author.profile, ...profile } } }
  }

  it('folds headline, department and timestamp onto one line', () => {
    renderCard(withProfile({ headline: 'Associate professor', department: 'CSE', batchYear: '2021' }))

    const timestamp = screen.getByRole('button', { name: 'View post' })
    const metaLine = timestamp.closest('p')
    expect(metaLine).not.toBeNull()
    expect(metaLine).toHaveTextContent("Associate professor · CSE '21 · less than a minute ago")
  })

  it('omits the separators for the parts an author has not filled in', () => {
    renderCard(withProfile({ headline: null, department: null, batchYear: null }))

    const metaLine = screen.getByRole('button', { name: 'View post' }).closest('p')
    expect(metaLine).toHaveTextContent(/^less than a minute ago$/)
  })

  it('keeps the timestamp a link to the post detail rather than plain text', () => {
    renderCard(withProfile({ headline: 'Associate professor', department: 'CSE', batchYear: null }))
    expect(screen.getByRole('button', { name: 'View post' })).toBeInTheDocument()
  })
})
