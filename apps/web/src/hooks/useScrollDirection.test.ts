import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useScrollDirection } from './useScrollDirection'

function scrollTo(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true })
  window.dispatchEvent(new Event('scroll'))
}

describe('useScrollDirection', () => {
  it('starts as up and stays up near the top', () => {
    const { result } = renderHook(() => useScrollDirection())
    act(() => scrollTo(30))
    expect(result.current).toBe('up')
  })

  it('reports down after scrolling down past threshold, up after scrolling up', () => {
    const { result } = renderHook(() => useScrollDirection())
    act(() => scrollTo(200))
    expect(result.current).toBe('down')
    act(() => scrollTo(120))
    expect(result.current).toBe('up')
  })
})
