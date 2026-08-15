import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useCountUp } from './useCountUp'

describe('useCountUp', () => {
  it('returns 0 for target 0', () => {
    const { result } = renderHook(() => useCountUp(0))
    expect(result.current).toBe(0)
  })

  it('reaches the target', async () => {
    const { result } = renderHook(() => useCountUp(42, 80))
    // The 80ms animation is driven by requestAnimationFrame, which jsdom backs with a
    // timer. Under a loaded suite those callbacks get starved well past the animation's
    // own duration, so the patience here is about scheduling, not about the assertion —
    // the hook must still land on exactly 42.
    await waitFor(() => expect(result.current).toBe(42), { timeout: 10_000 })
  })
})
