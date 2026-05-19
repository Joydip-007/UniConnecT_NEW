import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AuthLoader } from './AuthLoader'

const mocks = vi.hoisted(() => {
  const setAuth = vi.fn()
  const clearAuth = vi.fn()
  const post = vi.fn()
  const get = vi.fn()
  const hydrateFromProfile = vi.fn()
  const useAuthStore = vi.fn((selector: (state: { isLoading: boolean }) => unknown) => selector({ isLoading: false }))

  return { setAuth, clearAuth, post, get, useAuthStore, hydrateFromProfile }
})

vi.mock('@/lib/axios', () => ({
  api: {
    post: mocks.post,
    get: mocks.get,
  },
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: Object.assign(mocks.useAuthStore, {
    getState: () => ({
      setAuth: mocks.setAuth,
      clearAuth: mocks.clearAuth,
    }),
  }),
}))

vi.mock('@/stores/themeStore', () => ({
  useThemeStore: Object.assign(vi.fn(), {
    getState: () => ({
      hydrateFromProfile: mocks.hydrateFromProfile,
    }),
  }),
}))

describe('AuthLoader', () => {
  it('clears auth and skips user rehydration when refresh returns no token', async () => {
    // Seed the session marker so AuthLoader's short-circuit (no-session check)
    // doesn't skip the refresh path under test.
    localStorage.setItem('uc:has_session', '1')
    mocks.post.mockResolvedValueOnce({ data: { accessToken: '' } })

    render(
      <AuthLoader>
        <div>ready</div>
      </AuthLoader>,
    )

    await waitFor(() => expect(screen.getByText('ready')).toBeInTheDocument())
    await waitFor(() => expect(mocks.clearAuth).toHaveBeenCalledOnce())
    expect(mocks.get).not.toHaveBeenCalled()
    expect(mocks.setAuth).not.toHaveBeenCalled()
  })
})