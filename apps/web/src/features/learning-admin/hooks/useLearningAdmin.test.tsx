import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/msw/server'
import { useAdminLearningPaths } from './useLearningAdmin'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useAdminLearningPaths', () => {
  it('fetches the admin path list', async () => {
    server.use(
      http.get('*/admin/learning/paths', () =>
        HttpResponse.json({ data: [{ id: 'p1', title: 'Test path', isPublished: true, unitCount: 3, enrolledCount: 10, completionRate: 0.5 }] }),
      ),
    )
    const { result } = renderHook(() => useAdminLearningPaths({ status: 'all' }), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].title).toBe('Test path')
  })
})
