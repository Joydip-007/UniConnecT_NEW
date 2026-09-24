import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { personRow, postRow } from '../cardHelpers'
import type { TrendingPost, UserSuggestion } from '../types'
import { FeaturedAlumni } from './FeaturedAlumni'
import { PersonSuggestionCard } from './PersonSuggestionCard'
import { SearchResultRows } from './SearchResultRows'
import { TrendingPosts } from './TrendingPosts'

// The role badge is part of every user's identity: wherever Explore names a person,
// the badge sits before the name, as it does on the feed and profile.

function renderUi(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

const person = (over: Partial<UserSuggestion>): UserSuggestion => ({
  id: 'u1', role: 'faculty', fullName: 'Shamsul Alam', headline: null, department: 'CSE', batchYear: null,
  avatarUrl: null, followerCount: 0, mutualCount: 0, connectionStatus: 'none', connectionId: null, ...over,
})

describe('Explore role badges', () => {
  it('search rows badge people and post authors', () => {
    renderUi(
      <SearchResultRows
        rows={[
          personRow({ id: 'u1', fullName: 'Sadia Rahman', headline: null, department: 'CSE', batchYear: '2020', avatarUrl: null, role: 'alumni', connectionStatus: 'none', connectionId: null }),
          postRow({ id: 'p1', content: 'Lab notes', createdAt: new Date().toISOString(), reactionCount: 0, commentCount: 0, author: { id: 'u2', fullName: 'Imran Hossain', avatarUrl: null, role: 'student' } }),
        ]}
      />,
    )
    expect(within(screen.getByText('Sadia Rahman').closest('a')!).getByRole('img', { name: 'Alumni' })).toBeInTheDocument()
    expect(within(screen.getByText('Lab notes').closest('a')!).getByRole('img', { name: 'Student' })).toBeInTheDocument()
  })

  it('people suggestions and featured alumni show the badge', () => {
    renderUi(
      <>
        <PersonSuggestionCard person={person({})} />
        <FeaturedAlumni alumni={[person({ id: 'u3', role: 'alumni', fullName: 'Farhana Akter' })]} />
      </>,
    )
    expect(screen.getByRole('img', { name: 'Faculty' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Alumni' })).toBeInTheDocument()
  })

  it('trending posts badge the author', () => {
    const post: TrendingPost = {
      id: 'p2', content: 'Registration opens Sunday', createdAt: new Date().toISOString(), authorId: 'u4',
      authorName: 'Nusrat Jahan', authorAvatarUrl: null, authorRole: 'admin', reactionCount: 1, commentCount: 0,
    }
    renderUi(<TrendingPosts posts={[post]} />)
    expect(screen.getByRole('img', { name: 'Admin' })).toBeInTheDocument()
  })
})
