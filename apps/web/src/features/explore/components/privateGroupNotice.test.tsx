import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it } from 'vitest'
import { useToastStore } from '@/stores/toastStore'
import { groupRow, privateGroupNotice } from '../cardHelpers'
import type { GroupSummary } from '../types'
import { ActiveGroups } from './ActiveGroups'
import { SearchResultRows } from './SearchResultRows'

// A private group answers "Group not found" to non-members, so Explore must explain
// the lock instead of navigating to that dead end.

function renderOnExplore(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/explore']}>
        <Routes>
          <Route path="/explore" element={ui} />
          <Route path="/groups/:id" element={<div>group detail page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const searchResult = (over: { isPrivate: boolean; isMember: boolean }) => ({
  id: 'g1', name: 'Quiet Circle', type: 'club', avatarUrl: null, memberCount: 12, ...over,
})

const summary = (over: Partial<GroupSummary>): GroupSummary => ({
  id: 'g2', name: 'Robotics Core', type: 'club', avatarUrl: null, memberCount: 30, recentPostCount: 2,
  isPrivate: true, requestPending: false, knownCount: 0, knownFaces: [], ...over,
})

beforeEach(() => useToastStore.setState({ toasts: [] }))

describe('privateGroupNotice', () => {
  it('is null for public groups and for members', () => {
    expect(privateGroupNotice({ isPrivate: false, isMember: false })).toBeNull()
    expect(privateGroupNotice({ isPrivate: true, isMember: true })).toBeNull()
  })

  it('tells a requester their request is pending', () => {
    expect(privateGroupNotice({ isPrivate: true, isMember: false, requestPending: true })).toMatch(/pending/)
  })
})

describe('Explore private groups', () => {
  it('a search row for a locked group explains why instead of opening it', async () => {
    renderOnExplore(<SearchResultRows rows={[groupRow(searchResult({ isPrivate: true, isMember: false }))]} />)
    expect(screen.getByText(/Private/)).toBeInTheDocument()

    await userEvent.click(screen.getByText('Quiet Circle'))

    expect(screen.queryByText('group detail page')).not.toBeInTheDocument()
    expect(useToastStore.getState().toasts[0]?.message).toMatch(/private group/)
  })

  it('a member still opens their private group', async () => {
    renderOnExplore(<SearchResultRows rows={[groupRow(searchResult({ isPrivate: true, isMember: true }))]} />)
    await userEvent.click(screen.getByText('Quiet Circle'))
    expect(screen.getByText('group detail page')).toBeInTheDocument()
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('a discovery card points the viewer at the Request button', async () => {
    renderOnExplore(<ActiveGroups groups={[summary({})]} />)
    await userEvent.click(screen.getByText('Robotics Core'))
    expect(screen.queryByText('group detail page')).not.toBeInTheDocument()
    expect(useToastStore.getState().toasts[0]?.message).toMatch(/Send a join request/)
  })

  it('a public discovery card still navigates', async () => {
    renderOnExplore(<ActiveGroups groups={[summary({ isPrivate: false })]} />)
    await userEvent.click(screen.getByText('Robotics Core'))
    expect(screen.getByText('group detail page')).toBeInTheDocument()
  })
})
