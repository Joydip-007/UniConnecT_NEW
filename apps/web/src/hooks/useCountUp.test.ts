import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCountUp } from './useCountUp'

describe('useCountUp', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns 0 for target 0', () => {
    const { result } = renderHook(() => useCountUp(0))
    expect(result.current).toBe(0)
  })

  it('reaches the target', async () => {
    // jsdom backs requestAnimationFrame with a timer that a loaded suite starves well past
    // the test timeout. Hand each frame a timestamp beyond the animation's end instead, so
    // the assertion is about where the hook lands, not about the scheduler.
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
      window.setTimeout(() => cb(performance.now() + 1_000), 0),
    )
    vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id))

    const { result } = renderHook(() => useCountUp(42, 80))
    await waitFor(() => expect(result.current).toBe(42))
  })
})
