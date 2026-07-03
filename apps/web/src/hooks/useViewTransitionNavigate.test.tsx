import { act, renderHook } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { useViewTransitionNavigate } from './useViewTransitionNavigate'

// jsdom has no `document.startViewTransition`, so calling the returned
// navigate function always exercises the plain-navigate fallback path.
function useProbe() {
  const navigate = useViewTransitionNavigate()
  const location = useLocation()
  return { navigate, pathname: location.pathname }
}

describe('useViewTransitionNavigate', () => {
  it('navigates via the fallback path when startViewTransition is unavailable', () => {
    const { result } = renderHook(() => useProbe(), {
      wrapper: ({ children }) => <MemoryRouter initialEntries={['/feed']}>{children}</MemoryRouter>,
    })

    expect(result.current.pathname).toBe('/feed')

    act(() => {
      result.current.navigate('/jobs')
    })

    expect(result.current.pathname).toBe('/jobs')
  })
})
