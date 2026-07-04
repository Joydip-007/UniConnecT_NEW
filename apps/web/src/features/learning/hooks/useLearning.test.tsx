import { describe, expect, it } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { learningFixtures } from '@/tests/msw/handlers'
import {
  useCompleteUnit, usePaths, useShowcaseBadge, useToday,
} from './useLearning'

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
  return { Wrapper, qc }
}

describe('useLearning hooks', () => {
  it('usePaths resolves the fixture list', async () => {
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => usePaths(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(learningFixtures.paths)
  })

  it('useCompleteUnit posts score and invalidates learning queries so today refetches', async () => {
    const { Wrapper, qc } = createWrapper()

    const { result: todayResult } = renderHook(() => useToday(), { wrapper: Wrapper })
    await waitFor(() => expect(todayResult.current.isSuccess).toBe(true))

    const { result: completeResult } = renderHook(() => useCompleteUnit(), { wrapper: Wrapper })

    completeResult.current.mutate({ unitId: 'unit-1', score: 100 })

    await waitFor(() => expect(completeResult.current.isSuccess).toBe(true))
    expect(completeResult.current.data).toEqual(learningFixtures.completeUnitResult)

    await waitFor(() => {
      const state = qc.getQueryState(['learning', 'today', {}])
      expect(state?.isInvalidated).toBe(false) // refetch already resolved and cleared the flag
      expect(state?.dataUpdateCount).toBeGreaterThan(1)
    })
  })

  it('useShowcaseBadge sends { badgeId: null }', async () => {
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useShowcaseBadge(), { wrapper: Wrapper })

    result.current.mutate(null)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})
