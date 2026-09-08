import { act, renderHook } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { useViewTransitionNavigate } from './useViewTransitionNavigate'

function useProbe() {
  const navigate = useViewTransitionNavigate()
  const location = useLocation()
  return { navigate, pathname: location.pathname }
}

function renderProbe() {
  return renderHook(() => useProbe(), {
    wrapper: ({ children }) => <MemoryRouter initialEntries={['/feed']}>{children}</MemoryRouter>,
  })
}

describe('useViewTransitionNavigate', () => {
  it('navigates immediately', () => {
    const { result } = renderProbe()
    expect(result.current.pathname).toBe('/feed')

    act(() => {
      result.current.navigate('/jobs')
    })

    expect(result.current.pathname).toBe('/jobs')
  })

  /**
   * jsdom has no `startViewTransition`, so the old implementation's fallback path made
   * these tests pass either way. Defining it here proves the page transition is gone
   * rather than merely unsupported in the test environment.
   */
  it('does not start a view transition even where the browser supports one', () => {
    const startViewTransition = vi.fn((cb: () => void) => cb())
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    Object.defineProperty(document, 'startViewTransition', {
      value: startViewTransition,
      configurable: true,
      writable: true,
    })

    const { result } = renderProbe()
    act(() => {
      result.current.navigate('/jobs')
    })

    expect(startViewTransition).not.toHaveBeenCalled()
    expect(result.current.pathname).toBe('/jobs')

    delete (document as unknown as Record<string, unknown>).startViewTransition
    vi.unstubAllGlobals()
  })
})
