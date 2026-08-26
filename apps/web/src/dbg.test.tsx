import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/tests/msw/server'
import { useUpcomingEvents } from '@/components/rightRail/useUpcomingEvents'

describe('dbg', () => {
  it('fetches', async () => {
    server.use(http.get('*/events', () => HttpResponse.json({ data: { items: [{ id: 'e1', title: 'X', location: null, startsAt: '2030-01-01T00:00:00Z' }] } })))
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => useUpcomingEvents(), {
      wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>,
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    console.log('STATUS', result.current.status, JSON.stringify(result.current.error), JSON.stringify(result.current.data))
  })
})
