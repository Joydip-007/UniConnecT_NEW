import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAchievementSocket } from './useAchievementSocket'
import { useToastStore } from '@/stores/toastStore'

const handlers: Record<string, (payload: unknown) => void> = {}

vi.mock('@/lib/socket', () => ({
  socket: {
    on: vi.fn((event: string, cb: (payload: unknown) => void) => {
      handlers[event] = cb
    }),
    off: vi.fn((event: string) => {
      delete handlers[event]
    }),
  },
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient()
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('useAchievementSocket', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
    Object.keys(handlers).forEach((k) => delete handlers[k])
  })

  it('shows a toast and invalidates badges query when badge:earned fires', () => {
    const queryClient = new QueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    renderHook(() => useAchievementSocket(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    })

    expect(handlers['badge:earned']).toBeTypeOf('function')

    handlers['badge:earned']({
      badge: { id: 'b1', name: 'First steps', description: 'desc', icon_url: 'icon.png', points: 10 },
    })

    expect(useToastStore.getState().toasts).toHaveLength(1)
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      message: 'Badge earned: First steps',
      type: 'success',
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['learning', 'badges'] })
  })

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useAchievementSocket(), { wrapper })
    expect(handlers['badge:earned']).toBeTypeOf('function')
    unmount()
    expect(handlers['badge:earned']).toBeUndefined()
  })
})
