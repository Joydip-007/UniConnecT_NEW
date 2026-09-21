import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ResourcesTab } from './ResourcesTab'

const mockUseGroupResources = vi.fn()
const mockUseCreateResource = vi.fn()
const mockUseDeleteResource = vi.fn()
const mockUseTrackResource = vi.fn()

vi.mock('@/features/groups', async () => {
  const actual = await vi.importActual('@/features/groups')
  return {
    ...actual,
    useGroupResources: (...args: unknown[]) => mockUseGroupResources(...args),
    useCreateResource: (...args: unknown[]) => mockUseCreateResource(...args),
    useDeleteResource: (...args: unknown[]) => mockUseDeleteResource(...args),
    useTrackResource: (...args: unknown[]) => mockUseTrackResource(...args),
  }
})

describe('ResourcesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseGroupResources.mockReturnValue({ data: { items: [], total: 0, page: 1, hasMore: false }, isLoading: false })
    mockUseCreateResource.mockReturnValue({ mutate: vi.fn(), isPending: false })
    mockUseDeleteResource.mockReturnValue({ mutate: vi.fn() })
    mockUseTrackResource.mockReturnValue({ mutate: vi.fn() })
  })

  it('renders the category chip set per the design spec', () => {
    render(<ResourcesTab groupId="g1" />)

    ;['All', 'Researches', 'Projects', 'Assignments', 'Notes', 'Other'].forEach((label) => {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    })
  })

  it('shows category-aware empty copy for the active chip', async () => {
    render(<ResourcesTab groupId="g1" />)
    const user = userEvent.setup()

    expect(screen.getByText('Nothing filed under all yet.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Researches' }))
    expect(screen.getByText('Nothing filed under researches yet.')).toBeInTheDocument()
  })

  it('requests the researches category when that chip is selected', async () => {
    render(<ResourcesTab groupId="g1" />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Projects' }))

    expect(mockUseGroupResources).toHaveBeenLastCalledWith('g1', 'projects')
  })
})
