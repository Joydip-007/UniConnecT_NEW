import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/msw/server'
import { GroupRightRail } from './GroupRightRail'
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
    description: 'We build robots.',
    avatarUrl: null,
    coverUrl: null,
    isPrivate: false,
    memberCount: 284,
    isMember: true,
    userRole: 'member',
    allowedRole: null,
    isSystem: false,
    department: null,
    createdBy: 'u9',
    rulesMd: 'Be kind.',
    requirePostApproval: false,
    requireEventApproval: false,
    ...overrides,
  }
}

const settingsPatch = vi.fn()

function renderRail(group: Group) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  server.use(
    http.get('*/groups/g1/review/summary', () =>
      HttpResponse.json({ data: { pendingPosts: 1, pendingEvents: 0, pendingJoinRequests: 2, reportsOpen: 0 } }),
    ),
    http.get('*/groups/g1/stats', () =>
      HttpResponse.json({
        data: {
          newMembersThisWeek: 4,
          postsThisWeek: 7,
          activeContributors: 3,
          pendingJoinRequests: 2,
          upcomingStudySessions: 0,
          members: 284,
          active30d: 40,
          resources: 3,
          upcomingEvents: 1,
        },
      }),
    ),
    http.patch('*/groups/g1/settings', async ({ request }) => {
      const body = (await request.json()) as Record<string, boolean>
      settingsPatch(body)
      return HttpResponse.json({ data: { ...group, requirePostApproval: body.require_post_approval ?? group.requirePostApproval } })
    }),
    http.get('*/groups/suggestions', () =>
      HttpResponse.json({
        data: {
          items: [
            makeGroup({ id: 'g2', name: 'Chess society', isMember: false, userRole: null, memberCount: 40 }),
            makeGroup({ id: 'g3', name: 'Photography', isMember: false, userRole: null, isPrivate: true }),
          ],
        },
      }),
    ),
    http.post('*/groups/g2/members', () => HttpResponse.json({ data: { requested: false } })),
    http.get('*/posts/trending', () => HttpResponse.json({ data: { trendingTags: [{ name: 'hackathon', postCount: 9 }] } })),
  )
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/groups/g1']}>
        <GroupRightRail group={group} activeTab="feed" />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('GroupRightRail', () => {
  beforeEach(() => {
    navigate.mockClear()
    settingsPatch.mockClear()
  })

  it('admin view: manage card shows queue counts and Group settings reveals the switches', async () => {
    renderRail(makeGroup({ userRole: 'admin' }))

    expect(screen.getByText('Manage this group')).toBeInTheDocument()
    expect(await screen.findByText('2 requests waiting')).toBeInTheDocument()
    expect(screen.getByText('1 waiting')).toBeInTheDocument()
    expect(screen.getByText('Nothing flagged this week')).toBeInTheDocument()
    expect(await screen.findByText('+4')).toBeInTheDocument()

    expect(screen.queryByRole('switch', { name: 'Require post approval' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Group settings' }))
    const toggle = screen.getByRole('switch', { name: 'Require post approval' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')

    await userEvent.click(toggle)
    await waitFor(() => expect(settingsPatch).toHaveBeenCalledWith({ require_post_approval: true }))

    // Member-only cards are absent for admins
    expect(screen.queryByText('Groups you may like')).not.toBeInTheDocument()
    // About card still present, with rules
    expect(screen.getByText('About this group')).toBeInTheDocument()
    expect(screen.getByText('Be kind.')).toBeInTheDocument()
  })

  it('admin: Review on join requests deep-links to the tab', async () => {
    renderRail(makeGroup({ userRole: 'owner' }))
    const reviews = await screen.findAllByRole('button', { name: 'Review' })
    await userEvent.click(reviews[0])
    expect(navigate).toHaveBeenCalledWith({ search: 'tab=join-requests' })
  })

  it('admin: clearing the About description disables Save and shows a hint', async () => {
    renderRail(makeGroup({ userRole: 'admin' }))
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const textarea = screen.getByRole('textbox', { name: 'Group description' })
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    expect(screen.queryByText("Description can't be empty")).not.toBeInTheDocument()

    await userEvent.clear(textarea)
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByText("Description can't be empty")).toBeInTheDocument()
  })

  it('member view: suggestions and trending, no manage card', async () => {
    renderRail(makeGroup({ userRole: 'member' }))

    expect(screen.queryByText('Manage this group')).not.toBeInTheDocument()
    expect(await screen.findByText('Groups you may like')).toBeInTheDocument()
    expect(screen.getByText('Chess society')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Request' })).toBeInTheDocument()
    expect(await screen.findByText('#hackathon · 9')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Join' }))
    expect(await screen.findByText('Joined')).toBeInTheDocument()
  })
})
