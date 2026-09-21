import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/msw/server'
import GroupsPage, { GROUP_FILTER_TYPES } from './GroupsPage'
import { TYPE_LOOK } from '@/features/groups/groupTypeLook'

vi.mock('@/stores/authStore', () => {
  const state = () => ({
    user: { id: 'viewer-1', role: 'student', university: { name: 'UIU' } },
    accessToken: null,
    clearAuth: () => {},
  })
  const useAuthStore = Object.assign(
    (selector: (s: ReturnType<typeof state>) => unknown) => selector(state()),
    { getState: state },
  )
  return { useAuthStore }
})

class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function renderPage(initialEntries: string[] = ['/groups']) {
  vi.stubGlobal('IntersectionObserver', NoopObserver)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  server.use(
    http.get('*/groups', () => HttpResponse.json({ data: { items: [], total: 0, hasMore: false, page: 1 } })),
  )
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={initialEntries}>
        <GroupsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/**
 * `GroupType` is the contract: the API accepts every one of these on `POST /groups`
 * and `CreateGroupModal` offers every one of them. Parsing the union from source
 * rather than restating it here means adding a type to `types.ts` fails this test
 * until the UI can actually show and filter it.
 */
function groupTypesFromSource(): string[] {
  const source = readFileSync(resolve(__dirname, '../features/groups/types.ts'), 'utf8')
  const match = source.match(/export type GroupType\s*=\s*([^\n]+)/)
  if (!match) throw new Error('Could not find the GroupType union in features/groups/types.ts')
  return [...match[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
}

describe('group type coverage', () => {
  it('offers a filter chip for every group type', () => {
    const declared = groupTypesFromSource()
    expect(declared.length).toBeGreaterThan(0)
    // A creatable type with no chip is only reachable by scrolling the whole
    // directory or guessing the group's name in the search box.
    expect([...GROUP_FILTER_TYPES].sort()).toEqual([...declared].sort())
  })

  it('gives every group type a card glyph and tone', () => {
    const declared = groupTypesFromSource()
    // A missing entry falls back to the generic `other` look, so the card would
    // silently mislabel the group rather than crash.
    expect(Object.keys(TYPE_LOOK).sort()).toEqual([...declared].sort())
  })

  it('labels each type distinctly, so two chips never mean the same thing', () => {
    const labels = Object.values(TYPE_LOOK).map((l) => l.label)
    expect(new Set(labels).size).toBe(labels.length)
  })
})

describe('directory copy', () => {
  it('names the tenant in the subtitle when the auth user carries one', () => {
    renderPage()
    expect(screen.getByText('Departments, clubs and batches at UIU, plus the people in them.')).toBeInTheDocument()
  })

  it('placeholders the groups search box distinctly from the people one', () => {
    renderPage()
    expect(screen.getByPlaceholderText('Search groups')).toBeInTheDocument()
  })

  it('placeholders the people search box with what it actually matches on', async () => {
    server.use(
      http.get('*/users', () => HttpResponse.json({ data: { items: [], total: 0, hasMore: false, page: 1 } })),
    )
    renderPage(['/groups?section=people'])
    expect(await screen.findByPlaceholderText('Search people by name or department')).toBeInTheDocument()
  })
})
