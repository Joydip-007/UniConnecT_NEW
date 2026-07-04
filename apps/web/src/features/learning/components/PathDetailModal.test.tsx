import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/msw/server'
import { PathDetailModal } from './PathDetailModal'
import { useToastStore } from '@/stores/toastStore'

function renderModal(overrides: Partial<{ pathId: string | null; open: boolean; onClose: () => void }> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const onClose = overrides.onClose ?? vi.fn()
  const utils = render(
    <QueryClientProvider client={qc}>
      <PathDetailModal pathId={overrides.pathId ?? 'path-1'} open={overrides.open ?? true} onClose={onClose} />
    </QueryClientProvider>,
  )
  return { ...utils, onClose }
}

describe('PathDetailModal', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('renders the unit list and an Enroll button when not enrolled', async () => {
    server.use(
      http.get('*/learning/paths/:pathId', () =>
        HttpResponse.json({
          data: {
            id: 'path-1',
            title: 'Git basics',
            description: 'Learn version control',
            category: 'engineering',
            difficulty: 'beginner',
            estimated_days: 5,
            badge_name: 'Git novice',
            badge_icon: 'git',
            unitCount: 1,
            enrolledCount: 12,
            units: [{ id: 'unit-1', display_order: 1, title: 'Intro', type: 'read', completed: false }],
            enrollment: null,
          },
        })),
    )
    renderModal()

    expect(await screen.findByText('Intro')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enroll' })).toBeInTheDocument()
  })

  it('posts an enroll request and shows a success toast', async () => {
    server.use(
      http.get('*/learning/paths/:pathId', () =>
        HttpResponse.json({
          data: {
            id: 'path-1',
            title: 'Git basics',
            description: 'Learn version control',
            category: 'engineering',
            difficulty: 'beginner',
            estimated_days: 5,
            badge_name: null,
            badge_icon: null,
            unitCount: 1,
            enrolledCount: 12,
            units: [{ id: 'unit-1', display_order: 1, title: 'Intro', type: 'read', completed: false }],
            enrollment: null,
          },
        })),
      http.post('*/learning/paths/:pathId/enroll', () => HttpResponse.json({ data: {} })),
    )
    const user = userEvent.setup()
    renderModal()

    await user.click(await screen.findByRole('button', { name: 'Enroll' }))

    await vi.waitFor(() => {
      const toasts = useToastStore.getState().toasts
      expect(toasts.some((t) => t.message === 'Enrolled — your first unit is ready')).toBe(true)
    })
  })

  it('shows an undo toast when abandoning an active path', async () => {
    server.use(
      http.get('*/learning/paths/:pathId', () =>
        HttpResponse.json({
          data: {
            id: 'path-1',
            title: 'Git basics',
            description: 'Learn version control',
            category: 'engineering',
            difficulty: 'beginner',
            estimated_days: 5,
            badge_name: null,
            badge_icon: null,
            unitCount: 1,
            enrolledCount: 12,
            units: [{ id: 'unit-1', display_order: 1, title: 'Intro', type: 'read', completed: false }],
            enrollment: { status: 'active' },
          },
        })),
      http.post('*/learning/paths/:pathId/abandon', () => HttpResponse.json({ data: {} })),
    )
    const user = userEvent.setup()
    renderModal()

    await user.click(await screen.findByRole('button', { name: 'Abandon path' }))

    await vi.waitFor(() => {
      const toasts = useToastStore.getState().toasts
      const abandonedToast = toasts.find((t) => t.message === 'Path abandoned')
      expect(abandonedToast).toBeDefined()
      expect(typeof abandonedToast?.onUndo).toBe('function')
    })
  })

  it('re-enrolls via POST when the undo callback is invoked after abandoning', async () => {
    const enrollSpy = vi.fn()
    server.use(
      http.get('*/learning/paths/:pathId', () =>
        HttpResponse.json({
          data: {
            id: 'path-1',
            title: 'Git basics',
            description: 'Learn version control',
            category: 'engineering',
            difficulty: 'beginner',
            estimated_days: 5,
            badge_name: null,
            badge_icon: null,
            unitCount: 1,
            enrolledCount: 12,
            units: [{ id: 'unit-1', display_order: 1, title: 'Intro', type: 'read', completed: false }],
            enrollment: { status: 'active' },
          },
        })),
      http.post('*/learning/paths/:pathId/abandon', () => HttpResponse.json({ data: {} })),
      http.post('*/learning/paths/:pathId/enroll', ({ params }) => {
        enrollSpy(params.pathId)
        return HttpResponse.json({ data: {} })
      }),
    )
    const user = userEvent.setup()
    renderModal()

    await user.click(await screen.findByRole('button', { name: 'Abandon path' }))

    let onUndo: (() => void) | undefined
    await vi.waitFor(() => {
      onUndo = useToastStore.getState().toasts.find((t) => t.message === 'Path abandoned')?.onUndo
      expect(typeof onUndo).toBe('function')
    })

    onUndo?.()

    await vi.waitFor(() => {
      expect(enrollSpy).toHaveBeenCalledWith('path-1')
    })
  })

  it('shows a Completed chip and badge line when the path is completed', async () => {
    server.use(
      http.get('*/learning/paths/:pathId', () =>
        HttpResponse.json({
          data: {
            id: 'path-1',
            title: 'Git basics',
            description: 'Learn version control',
            category: 'engineering',
            difficulty: 'beginner',
            estimated_days: 5,
            badge_name: 'Git novice',
            badge_icon: 'git',
            unitCount: 1,
            enrolledCount: 12,
            units: [{ id: 'unit-1', display_order: 1, title: 'Intro', type: 'read', completed: true }],
            enrollment: { status: 'completed' },
          },
        })),
    )
    renderModal()

    expect(await screen.findByText('Completed')).toBeInTheDocument()
    expect(screen.getByText('Badge earned: Git novice')).toBeInTheDocument()
  })
})
