import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/msw/server'
import { MembersPanel } from './MembersPanel'
import { InvitePanel } from './InvitePanel'
import type { Group } from '../types'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn() }
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
    memberCount: 3,
    isMember: true,
    userRole: 'owner',
    allowedRole: null,
    isSystem: false,
    department: null,
    createdBy: 'u9',
    ...overrides,
  }
}

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

const members = [
  { id: 'u1', fullName: 'Ayesha Rahman', avatarUrl: null, role: 'owner', headline: 'Robotics lead', department: 'CSE' },
  { id: 'u2', fullName: 'Tanvir Hasan', avatarUrl: null, role: 'member', headline: null, department: 'EEE' },
]

describe('MembersPanel', () => {
  it('lists members, hides the menu on the owner, and promotes via PATCH', async () => {
    const patched: unknown[] = []
    server.use(
      http.get('*/groups/g1/members', () =>
        HttpResponse.json({ data: { items: members, total: 3, page: 1, hasMore: false } }),
      ),
      http.patch('*/groups/g1/members/:userId', async ({ request, params }) => {
        patched.push({ userId: params.userId, body: await request.json() })
        return HttpResponse.json({ data: {} })
      }),
    )
    wrap(<MembersPanel group={makeGroup()} onClose={() => {}} onInvite={() => {}} />)

    expect(await screen.findByText('Ayesha Rahman')).toBeInTheDocument()
    expect(screen.getByText('Creator')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'More actions for Ayesha Rahman' })).not.toBeInTheDocument()
    expect(screen.getByText('3 members')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'More actions for Tanvir Hasan' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Make moderator' }))
    await waitFor(() => expect(patched).toEqual([{ userId: 'u2', body: { role: 'moderator' } }]))
  })
})

describe('InvitePanel', () => {
  it('footer reads "2 people selected" and sends 2 invites with the chosen role', async () => {
    const posted: unknown[] = []
    server.use(
      http.get('*/users/suggestions', () =>
        HttpResponse.json({
          data: [
            { id: 'p1', role: 'student', profile: { fullName: 'Nadia Islam', department: 'CSE', batchYear: '2027' } },
            { id: 'p2', role: 'student', profile: { fullName: 'Rafi Ahmed', department: 'CSE', batchYear: '2026' } },
          ],
        }),
      ),
      http.post('*/groups/g1/invitations', async ({ request }) => {
        posted.push(await request.json())
        return HttpResponse.json({ data: { invited: true } }, { status: 201 })
      }),
    )
    wrap(<InvitePanel group={makeGroup()} onClose={() => {}} />)

    expect(screen.getByText('0 people selected')).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: /Nadia Islam/ }))
    await userEvent.click(screen.getByRole('button', { name: /Rafi Ahmed/ }))
    expect(screen.getByText('2 people selected')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Moderator' }))
    await userEvent.click(screen.getByRole('button', { name: 'Send 2 invites' }))

    await waitFor(() => expect(posted).toHaveLength(2))
    expect(posted).toEqual(
      expect.arrayContaining([{ userId: 'p1', role: 'moderator' }, { userId: 'p2', role: 'moderator' }]),
    )
    expect(await screen.findByRole('status')).toHaveTextContent('2 invites sent')
  })

  it('hides the Admin chip for academic groups', () => {
    server.use(http.get('*/users/suggestions', () => HttpResponse.json({ data: [] })))
    wrap(<InvitePanel group={makeGroup({ type: 'academic' })} onClose={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Admin' })).not.toBeInTheDocument()
  })
})
