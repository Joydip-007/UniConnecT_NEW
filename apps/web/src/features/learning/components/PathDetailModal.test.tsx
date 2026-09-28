import { describe, expect, it, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { useState } from 'react'
import { server } from '@/tests/msw/server'
import { PathDetailModal } from './PathDetailModal'
import { useToastStore } from '@/stores/toastStore'
import type { PathDetail, TodayEntry } from '../types'

const UNITS: PathDetail['units'] = [
  { id: 'u1', display_order: 1, title: 'Branches without fear', type: 'read', completed: true, summary: 'One branch per feature.', minutes: 7, content: { body: 'A branch is a cheap pointer.' } },
  { id: 'u2', display_order: 2, title: 'Rebase vs merge', type: 'video', completed: false, summary: 'When a clean history helps.', minutes: 9, hasVideo: true, content: { body: 'Merge keeps history.', video_url: 'https://cdn.example/rebase.mp4' } },
  { id: 'u3', display_order: 3, title: 'Checkpoint: recovering a repo', type: 'quiz', completed: false, summary: 'Two questions on reflog.', questionCount: 2, content: null, completion_rule: { passScore: 70 } },
]

function detail(over: Partial<PathDetail> = {}): PathDetail {
  return {
    id: 'path-1', title: 'Git for group projects', description: 'Branches, rebases and recovery.', category: 'technical',
    difficulty: 'beginner', estimated_days: 9, badge_name: 'Merge master', badge_icon: null, unitCount: 3, enrolledCount: 4,
    units: UNITS, enrollment: { status: 'active' }, ...over,
  }
}

function usePathResponse(data: PathDetail) {
  server.use(http.get('*/learning/paths/:pathId', () => HttpResponse.json({ data })))
}

function Harness({ today, onStartQuiz = vi.fn() }: { today?: TodayEntry; onStartQuiz?: (id: string) => void }) {
  const [unitId, setUnitId] = useState<string | null>(null)
  return (
    <PathDetailModal
      pathId="path-1"
      unitId={unitId}
      onSelectUnit={setUnitId}
      onClose={vi.fn()}
      onStartQuiz={onStartQuiz}
      onShowResults={vi.fn()}
      today={today}
    />
  )
}

function renderModal(props: Parameters<typeof Harness>[0] = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <Harness {...props} />
    </QueryClientProvider>,
  )
}

describe('PathDetailModal', () => {
  beforeEach(() => useToastStore.setState({ toasts: [] }))

  it('lists every unit with its summary and kind, and offers Start path when not enrolled', async () => {
    usePathResponse(detail({ enrollment: null, units: UNITS.map((u) => ({ ...u, completed: false })) }))
    renderModal()
    expect(await screen.findByText('Not started')).toBeInTheDocument()
    expect(screen.getByText('When a clean history helps.')).toBeInTheDocument()
    expect(screen.getByText('Video · 9 min')).toBeInTheDocument()
    expect(screen.getByText('Quiz · 2 questions')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Start path/ })).toBeInTheDocument()
  })

  it('starts the path and opens its first unit', async () => {
    let enrolled = false
    server.use(
      http.get('*/learning/paths/:pathId', () =>
        HttpResponse.json({ data: enrolled ? detail({ units: UNITS.map((u) => ({ ...u, completed: false })) }) : detail({ enrollment: null }) })),
      http.post('*/learning/paths/:pathId/enroll', () => {
        enrolled = true
        return HttpResponse.json({ data: {} })
      }),
    )
    renderModal()
    await userEvent.setup().click(await screen.findByRole('button', { name: /Start path/ }))
    expect(await screen.findByText('Git for group projects · unit 1 of 3')).toBeInTheDocument()
  })

  it('shows today’s unit, progress and Continue for an active path', async () => {
    usePathResponse(detail())
    renderModal({ today: { pathId: 'path-1', unit: UNITS[1], completedToday: false } })
    expect(await screen.findByText('Left for today · 1')).toBeInTheDocument()
    expect(screen.getByText('Today')).toBeInTheDocument()
    expect(screen.getByText('1 of 3 units complete')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue: Rebase vs merge' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abandon path' })).toBeInTheDocument()
  })

  it('says today is done when the path’s unit for today is finished', async () => {
    usePathResponse(detail())
    renderModal({ today: { pathId: 'path-1', unit: UNITS[1], completedToday: true } })
    expect(await screen.findByText(/Today's plan for this path is done/)).toBeInTheDocument()
  })

  it('keeps Mark complete disabled until the video is played through to the end', async () => {
    usePathResponse(detail())
    const user = userEvent.setup()
    renderModal()
    await user.click(await screen.findByRole('button', { name: 'Continue: Rebase vs merge' }))

    const mark = screen.getByRole('button', { name: /Mark complete/ })
    expect(mark).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText('Watch the whole video to mark this unit complete.')).toBeInTheDocument()

    const video = screen.getByLabelText('Lesson video') as HTMLVideoElement
    Object.defineProperty(video, 'duration', { configurable: true, value: 4 })
    fireEvent.loadedMetadata(video)
    // Scrubbing straight to the end does not count.
    Object.defineProperty(video, 'currentTime', { configurable: true, writable: true, value: 4 })
    fireEvent.timeUpdate(video)
    expect(mark).toHaveAttribute('aria-disabled', 'true')
    // Playing through does.
    for (const t of [1, 2, 3, 4]) {
      video.currentTime = t
      fireEvent.timeUpdate(video)
    }
    await waitFor(() => expect(mark).toHaveAttribute('aria-disabled', 'false'))
    expect(screen.getByText('Video watched. You can mark this unit complete.')).toBeInTheDocument()
  })

  it('completes a reading unit and toasts the streak', async () => {
    usePathResponse(detail({ units: [{ ...UNITS[0], completed: false }, UNITS[1], UNITS[2]] }))
    const user = userEvent.setup()
    renderModal()
    await user.click(await screen.findByRole('button', { name: 'Continue: Branches without fear' }))
    expect(screen.getByText('A branch is a cheap pointer.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Mark complete/ }))
    await waitFor(() =>
      expect(useToastStore.getState().toasts.map((t) => t.message)).toContain('Unit complete — streak: 4 days'))
  })

  it('explains why a later unit is locked', async () => {
    usePathResponse(detail())
    const user = userEvent.setup()
    renderModal()
    await user.click(await screen.findByText('Checkpoint: recovering a repo'))
    expect(screen.getByText('Finish "Rebase vs merge" first')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Start quiz/ })).not.toBeInTheDocument()
  })

  it('offers the quiz on an unlocked checkpoint unit', async () => {
    usePathResponse(detail({
      units: [UNITS[0], { ...UNITS[1], completed: true }, { ...UNITS[2], content: { questions: [{ q: 'Q?', options: ['a', 'b'], answer: 0 }] } }],
    }))
    const onStartQuiz = vi.fn()
    const user = userEvent.setup()
    renderModal({ onStartQuiz })
    await user.click(await screen.findByRole('button', { name: 'Continue: Checkpoint: recovering a repo' }))
    expect(await screen.findByText('Not attempted yet')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Start quiz' }))
    expect(onStartQuiz).toHaveBeenCalledWith('u3')
  })

  it('abandons with an undo toast', async () => {
    usePathResponse(detail())
    let abandoned = false
    server.use(http.post('*/learning/paths/:pathId/abandon', () => {
      abandoned = true
      return HttpResponse.json({ data: {} })
    }))
    const user = userEvent.setup()
    renderModal()
    await user.click(await screen.findByRole('button', { name: 'Abandon path' }))
    await waitFor(() => expect(abandoned).toBe(true))
    await waitFor(() => expect(useToastStore.getState().toasts[0]?.onUndo).toBeTypeOf('function'))
  })
})
