import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/msw/server'
import { GroupCard } from './GroupCard'
import type { Group } from '../types'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/components/ShareMenu', () => ({ ShareMenu: () => null }))

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: 'g1',
    name: 'UIU robotics club',
    type: 'club',
    description: 'Line-follower builds and competition squads.',
    avatarUrl: null,
    coverUrl: null,
    isPrivate: false,
    memberCount: 284,
    isMember: false,
    userRole: null,
    allowedRole: null,
    isSystem: false,
    department: null,
    createdBy: 'u9',
    ...overrides,
  }
}

function renderCard(group: Group) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <GroupCard group={group} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

let mutePatch: ReturnType<typeof vi.fn>

beforeEach(() => {
  mutePatch = vi.fn()
  server.use(
    http.patch('*/groups/:id/members/me/mute', async ({ request }) => {
      mutePatch(await request.json())
      return HttpResponse.json({ data: { isMuted: true } })
    }),
  )
})

describe('GroupCard', () => {
  // A private group cannot be joined outright, so promising "Join" would fail on click.
  it('asks to request rather than join when the group is private', () => {
    renderCard(makeGroup({ isPrivate: true }))
    expect(screen.getByRole('button', { name: 'Request' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Join' })).not.toBeInTheDocument()
  })

  // System groups track your role automatically — there is nothing to join or leave.
  // The Official badge is what says so; the footer just has no CTA.
  it('offers no membership control on an auto-managed group', () => {
    renderCard(makeGroup({ isSystem: true, isMember: true }))
    expect(screen.getByText('Official')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Joined' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Leave' })).not.toBeInTheDocument()
    // Muting is still the one control that does apply — you cannot leave, so it is
    // the only way to turn the group down.
    expect(screen.getByRole('switch')).toBeInTheDocument()
  })

  // The card holds a share menu, a mute switch and a CTA, so the card itself must not
  // be a button — nesting controls inside one is invalid and swallows their clicks.
  it('exposes the name as the navigation target rather than the whole card', () => {
    renderCard(makeGroup())
    expect(screen.getByRole('link', { name: 'UIU robotics club' })).toHaveAttribute('href', '/groups/g1')
    expect(screen.queryByRole('button', { name: /Open UIU robotics club/ })).not.toBeInTheDocument()
  })

  // The mute toggle is a membership preference, so it has nothing to act on otherwise.
  it('shows the notification toggle only to members', () => {
    const { unmount } = renderCard(makeGroup({ isMember: false }))
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    unmount()

    renderCard(makeGroup({ isMember: true, isMuted: false }))
    expect(screen.getByRole('switch')).toBeChecked()
  })

  it('sends the flipped mute state, not the current one', async () => {
    const user = userEvent.setup()
    renderCard(makeGroup({ isMember: true, isMuted: false }))

    await user.click(screen.getByRole('switch'))
    await waitFor(() => expect(mutePatch).toHaveBeenCalledWith({ muted: true }))
  })

  // "9 people you know" is the reason to click; the members the faces leave out are the
  // fallback when the viewer knows nobody, so a zero must never render as "0 people you know".
  it('prefers known members over the count of the rest, and falls back when there are none', () => {
    const { unmount } = renderCard(makeGroup({ knownMemberCount: 9 }))
    expect(screen.getByText('9 people you know')).toBeInTheDocument()
    unmount()

    renderCard(makeGroup({ knownMemberCount: 0 }))
    expect(screen.queryByText(/people you know/)).not.toBeInTheDocument()
    expect(screen.getAllByText('284 members').length).toBeGreaterThan(0)
  })

  // The faces stand for themselves, so the pill must not count them a second time —
  // and with no faces there is nobody to be "other" than, so it stays a plain count.
  it('excludes the faces it shows from the "+N others" count', () => {
    renderCard(
      makeGroup({
        knownMemberCount: 0,
        memberCount: 1840,
        previewMembers: [
          { id: 'm1', fullName: 'Kabir Uddin', avatarUrl: null },
          { id: 'm2', fullName: 'Sara Rahman', avatarUrl: null },
        ],
      }),
    )
    expect(screen.getByText('+1,838 others')).toBeInTheDocument()
  })

  it('gives the mute switch and the private lock a CSS tooltip', () => {
    const { unmount } = renderCard(makeGroup({ isMember: true, isMuted: false }))
    const toggle = screen.getByRole('switch')
    expect(toggle).toHaveClass('uc-tip')
    expect(toggle).toHaveAttribute('data-tip', 'Notifications on')
    unmount()

    renderCard(makeGroup({ isPrivate: true }))
    const lock = screen.getByLabelText('Private group — request to join')
    expect(lock).toHaveClass('uc-tip')
    expect(lock).toHaveAttribute('data-tip', 'Request to join')
  })

  it('renders a face per preview member', () => {
    renderCard(
      makeGroup({
        previewMembers: [
          { id: 'a', fullName: 'Nusrat Ahmed', avatarUrl: null },
          { id: 'b', fullName: 'Sabina Rahman', avatarUrl: null },
        ],
      }),
    )
    expect(screen.getByTitle('Nusrat Ahmed')).toBeInTheDocument()
    expect(screen.getByTitle('Sabina Rahman')).toBeInTheDocument()
  })
})
