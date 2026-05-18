import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/api/users', () => ({
  updateUserPreferences: vi.fn().mockResolvedValue({ themePreference: 'light' }),
}))

import { updateUserPreferences } from '@/lib/api/users'

/** Minimal matchMedia stub — jsdom doesn't provide one. */
function stubMatchMedia(prefersLight = false) {
  vi.stubGlobal('matchMedia', (query: string) => {
    let matches = false
    if (query === '(prefers-color-scheme: dark)') matches = !prefersLight
    // '(prefers-reduced-motion: reduce)' → always false so animations run
    return {
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList
  })
}

beforeEach(() => {
  stubMatchMedia()
  vi.resetModules()
  localStorage.clear()
  document.documentElement.setAttribute('data-theme', 'dark')
  document.documentElement.setAttribute('data-theme-mode', 'system')
  vi.useFakeTimers()
  ;(updateUserPreferences as ReturnType<typeof vi.fn>).mockClear()
})

async function loadStore() {
  return (await import('./themeStore')).useThemeStore
}

describe('themeStore', () => {
  it('initialises mode and resolved from <html> attributes', async () => {
    document.documentElement.setAttribute('data-theme', 'light')
    document.documentElement.setAttribute('data-theme-mode', 'light')
    const useThemeStore = await loadStore()
    const s = useThemeStore.getState()
    expect(s.mode).toBe('light')
    expect(s.resolved).toBe('light')
  })

  it('setMode flips data-theme, writes localStorage, and debounces the API call', async () => {
    const useThemeStore = await loadStore()
    useThemeStore.getState().setMode('light')

    vi.advanceTimersByTime(550)
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(localStorage.getItem('uc.theme')).toBe('light')

    expect(updateUserPreferences).not.toHaveBeenCalled()
    vi.advanceTimersByTime(300)
    expect(updateUserPreferences).toHaveBeenCalledWith({ themePreference: 'light' })
  })

  it('toggle() flips resolved theme between light and dark', async () => {
    const useThemeStore = await loadStore()
    useThemeStore.getState().toggle()
    vi.advanceTimersByTime(2000)
    expect(useThemeStore.getState().resolved).toBe('light')
    useThemeStore.getState().toggle()
    vi.advanceTimersByTime(2000)
    expect(useThemeStore.getState().resolved).toBe('dark')
  })

  it('hydrateFromProfile does not trigger the API', async () => {
    const useThemeStore = await loadStore()
    useThemeStore.getState().hydrateFromProfile('light')
    vi.advanceTimersByTime(2000)
    expect(updateUserPreferences).not.toHaveBeenCalled()
    expect(useThemeStore.getState().mode).toBe('light')
  })

  it('hydrateFromProfile is a no-op when the value matches current mode', async () => {
    const useThemeStore = await loadStore()
    const before = useThemeStore.getState().mode
    useThemeStore.getState().hydrateFromProfile(before)
    vi.advanceTimersByTime(2000)
    expect(updateUserPreferences).not.toHaveBeenCalled()
  })
})
