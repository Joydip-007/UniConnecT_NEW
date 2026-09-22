import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/msw/server'
import { GroupHeader } from './GroupHeader'
import type { Group } from '../types'

const navigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: 'g1',
    name: 'UIU robotics club',
    type: 'club',
    description: null,
    avatarUrl: null,
    coverUrl: null,
    isPrivate: false,
    memberCount: 1840,
    isMember: true,
    userRole: 'admin',
    allowedRole: null,
    isSystem: false,
    department: null,
    createdBy: 'u9',
    ...overrides,
  }
}

function LocationProbe() {
  const { search } = useLocation()
  return <span data-testid="search">{search}</span>
}

const members = Array.from({ length: 5 }, (_, i) => ({
  id: `m${i}`,
  fullName: `Member ${i}`,
  avatarUrl: null,
  role: i === 0 ? 'owner' : 'member',
  headline: null,
  department: 'CSE',
}))

function renderHeader(group: Group, initialEntry = '/groups/g1') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  server.use(
    http.get('*/groups/g1/members', () =>
      HttpResponse.json({ data: { items: members, total: 1840, page: 1, hasMore: true } }),
    ),
  )
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <GroupHeader group={group} />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('GroupHeader', () => {
  beforeEach(() => navigate.mockClear())

  it('renders "+1,835 others" for 1840 members and opens the Members panel', async () => {
    renderHeader(makeGroup())
    const btn = await screen.findByRole('button', { name: '+1,835 others' })
    await userEvent.click(btn)
    expect(await screen.findByRole('dialog', { name: 'Members' })).toBeInTheDocument()
    expect(await screen.findByText('Member 1')).toBeInTheDocument()
    expect(screen.getByText('1,840 members')).toBeInTheDocument()
  })

  it('shows my-role tag and the chat button only for academic members', () => {
    renderHeader(makeGroup({ type: 'academic', userRole: 'moderator' }))
    expect(screen.getByText('Mod')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open group chat' })).toBeInTheDocument()
  })

  it('opens the group chat and navigates to the conversation', async () => {
    server.use(http.post('*/groups/g1/chat', () => HttpResponse.json({ data: { conversationId: 'c42' } })))
    renderHeader(makeGroup({ type: 'academic' }))
    await userEvent.click(screen.getByRole('button', { name: 'Open group chat' }))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/messages/c42'))
  })

  it('hides Invite for plain members and system groups', () => {
    renderHeader(makeGroup({ userRole: 'member' }))
    expect(screen.queryByRole('button', { name: /Invite/ })).not.toBeInTheDocument()
  })

  it('share modal copies the group URL', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    renderHeader(makeGroup())
    await userEvent.click(screen.getByRole('button', { name: 'Share group' }))
    expect(await screen.findByRole('dialog', { name: 'Share this group' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/groups/g1`)
    expect(await screen.findByText('Link copied')).toBeInTheDocument()
  })

  describe('?modal= in the URL', () => {
    it('writes the open overlay to the URL and clears it on close', async () => {
      renderHeader(makeGroup())
      await userEvent.click(screen.getByRole('button', { name: 'Share group' }))
      expect(await screen.findByRole('dialog', { name: 'Share this group' })).toBeInTheDocument()
      expect(screen.getByTestId('search')).toHaveTextContent('?modal=share')
      await userEvent.keyboard('{Escape}')
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(screen.getByTestId('search')).toHaveTextContent('')
    })

    it('opens the dialog a shared link names, keeping the tab', async () => {
      renderHeader(makeGroup(), '/groups/g1?tab=events&modal=members')
      expect(await screen.findByRole('dialog', { name: 'Members' })).toBeInTheDocument()
      expect(screen.getByTestId('search')).toHaveTextContent('?tab=events&modal=members')
    })

    it('ignores ?modal=invite for a viewer who cannot invite', () => {
      // An admin's invite link must not hand a member a panel that 403s on send.
      renderHeader(makeGroup({ userRole: 'member' }), '/groups/g1?modal=invite')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('swaps Members for Invite in place', async () => {
      renderHeader(makeGroup(), '/groups/g1?modal=members')
      const panel = await screen.findByRole('dialog', { name: 'Members' })
      await userEvent.click(within(panel).getByRole('button', { name: /Invite/ }))
      expect(screen.getByTestId('search')).toHaveTextContent('?modal=invite')
    })
  })
})
