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
    isSaved: false,
    viewCount: 0,
    myReaction: null,
    reactionCounts: { like: 0, love: 0, insightful: 0, celebrate: 0 },
    commentCount: 0,
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
})
