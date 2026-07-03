import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useToastStore } from './toastStore'

describe('toastStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useToastStore.setState({ toasts: [] })
  })

  it('show adds a toast and returns its id', () => {
    const id = useToastStore.getState().show({ message: 'Saved' })
    const { toasts } = useToastStore.getState()
    expect(toasts).toHaveLength(1)
    expect(toasts[0]).toMatchObject({ id, message: 'Saved', type: 'success' })
  })

  it('auto-dismisses after the duration', () => {
    useToastStore.getState().show({ message: 'Saved', durationMs: 3000 })
    vi.advanceTimersByTime(2999)
    expect(useToastStore.getState().toasts).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('undo toasts live longer by default and carry the callback', () => {
    const onUndo = vi.fn()
    useToastStore.getState().show({ message: 'Dismissed', onUndo })
    expect(useToastStore.getState().toasts[0].onUndo).toBe(onUndo)
    vi.advanceTimersByTime(3500)
    expect(useToastStore.getState().toasts).toHaveLength(1) // still visible past the 3500ms non-undo TTL — undo toasts get 6000ms
    vi.advanceTimersByTime(2500)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('dismiss removes immediately', () => {
    const id = useToastStore.getState().show({ message: 'Saved' })
    useToastStore.getState().dismiss(id)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })
})
