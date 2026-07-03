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
    await waitFor(() => expect(result.current).toBe(42), { timeout: 2000 })
  })
})
