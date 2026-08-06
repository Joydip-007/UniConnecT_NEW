import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ModulesPanel } from './ModulesPanel'

const mockUseModules = vi.fn()
const mockUseTogglePublishModule = vi.fn()
const mockUseReorderModules = vi.fn()
const mockUseCreateModule = vi.fn()
const mockUseModuleUpload = vi.fn()

vi.mock('../hooks/useGroupExtended', () => ({
  useModules: () => mockUseModules(),
  useTogglePublishModule: () => mockUseTogglePublishModule(),
  useReorderModules: () => mockUseReorderModules(),
  useCreateModule: () => mockUseCreateModule(),
  useModuleUpload: () => mockUseModuleUpload(),
}))

function modules() {
  return [{ id: 'm1', groupId: 'g1', title: 'Week 1', isPublished: false, displayOrder: 1 }]
}

describe('ModulesPanel', () => {
  const togglePublishMutate = vi.fn()
  const reorderMutate = vi.fn()
  const createMutateAsync = vi.fn().mockResolvedValue({ id: 'm2' })

  beforeEach(() => {
    vi.clearAllMocks()
    createMutateAsync.mockResolvedValue({ id: 'm2' })
    mockUseModules.mockReturnValue({ data: modules(), isLoading: false })
    mockUseTogglePublishModule.mockReturnValue({ mutate: togglePublishMutate })
    mockUseReorderModules.mockReturnValue({ mutate: reorderMutate })
    mockUseCreateModule.mockReturnValue({ mutateAsync: createMutateAsync })
    mockUseModuleUpload.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
  })

  it('lists modules and toggles publish state', () => {
    render(<ModulesPanel groupId="g1" isAdmin />)
    expect(screen.getByText('Week 1')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /publish/i }))
    expect(togglePublishMutate).toHaveBeenCalledWith('m1')
  })

  it('shows a loading state', () => {
    mockUseModules.mockReturnValue({ data: undefined, isLoading: true })
    render(<ModulesPanel groupId="g1" isAdmin={false} />)
    expect(screen.getByText(/Loading modules/i)).toBeInTheDocument()
  })

  it('hides admin controls for non-admins', () => {
    render(<ModulesPanel groupId="g1" isAdmin={false} />)
    expect(screen.queryByRole('button', { name: /publish/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Module title')).not.toBeInTheDocument()
  })

  it('creates a module from the admin form', async () => {
    render(<ModulesPanel groupId="g1" isAdmin />)
    fireEvent.change(screen.getByLabelText('Module title'), { target: { value: 'Week 2' } })
    fireEvent.click(screen.getByRole('button', { name: /create module/i }))

    await waitFor(() =>
      expect(createMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Week 2', displayOrder: 2 }),
      ),
    )
  })
})
