import { create } from 'zustand'
import type { ThemePreference } from '@uniconnect/shared/types'
import { updateUserPreferences } from '@/lib/api/users'

export type ThemeMode = ThemePreference
export type ResolvedTheme = 'light' | 'dark'
export type CurtainPhase = 'idle' | 'falling' | 'rising'

const STORAGE_KEY = 'uc.theme'
const CURTAIN_MS = 550
const API_DEBOUNCE_MS = 300

/** Destination --surface-page values, kept in sync with tokens.css. */
const PAGE_COLOR: Record<ResolvedTheme, string> = {
  light: '#FAF7F2',
  dark:  '#060D1A',
}

function readBootstrap(): { mode: ThemeMode; resolved: ResolvedTheme } {
  if (typeof document === 'undefined') return { mode: 'system', resolved: 'dark' }
  const modeAttr = document.documentElement.getAttribute('data-theme-mode')
  const themeAttr = document.documentElement.getAttribute('data-theme')
  const mode: ThemeMode =
    modeAttr === 'light' || modeAttr === 'dark' || modeAttr === 'system' ? modeAttr : 'system'
  const resolved: ResolvedTheme = themeAttr === 'light' ? 'light' : 'dark'
  return { mode, resolved }
}

function systemResolved(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolveMode(mode: ThemeMode): ResolvedTheme {
  return mode === 'system' ? systemResolved() : mode
}

function applyDom(mode: ThemeMode, resolved: ResolvedTheme) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', resolved)
  document.documentElement.setAttribute('data-theme-mode', mode)
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

interface ThemeState {
  mode: ThemeMode
  resolved: ResolvedTheme
  phase: CurtainPhase
  targetColor: string | null

  setMode: (mode: ThemeMode) => void
  toggle: () => void
  hydrateFromProfile: (mode: ThemeMode) => void
  _onSystemChange: () => void
}

let apiDebounce: ReturnType<typeof setTimeout> | null = null
let skipApiOnce = false
let mediaQuery: MediaQueryList | null = null

function scheduleApi(mode: ThemeMode) {
  if (skipApiOnce) {
    skipApiOnce = false
    return
  }
  if (apiDebounce) clearTimeout(apiDebounce)
  apiDebounce = setTimeout(() => {
    updateUserPreferences({ themePreference: mode }).catch(() => {
      // eslint-disable-next-line no-console
      console.warn('[themeStore] failed to persist theme preference')
    })
  }, API_DEBOUNCE_MS)
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const initial = readBootstrap()

  function internalSetMode(mode: ThemeMode, opts: { animate: boolean; persist: boolean }) {
    const nextResolved = resolveMode(mode)
    const current = get().resolved
    const shouldAnimate = opts.animate && nextResolved !== current && !prefersReducedMotion()

    if (!shouldAnimate) {
      applyDom(mode, nextResolved)
      set({ mode, resolved: nextResolved, phase: 'idle', targetColor: null })
      if (opts.persist) {
        try { localStorage.setItem(STORAGE_KEY, mode) } catch {}
        scheduleApi(mode)
      }
      bindSystemListener(mode)
      return
    }

    // Animated path: fall → swap → rise → idle.
    set({ phase: 'falling', targetColor: PAGE_COLOR[nextResolved] })
    setTimeout(() => {
      applyDom(mode, nextResolved)
      set({ mode, resolved: nextResolved, phase: 'rising' })
      if (opts.persist) {
        try { localStorage.setItem(STORAGE_KEY, mode) } catch {}
        scheduleApi(mode)
      }
      bindSystemListener(mode)
      setTimeout(() => set({ phase: 'idle', targetColor: null }), CURTAIN_MS + 40)
    }, CURTAIN_MS)
  }

  function bindSystemListener(mode: ThemeMode) {
    if (typeof window === 'undefined') return
    if (mode === 'system') {
      if (!mediaQuery) {
        mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        mediaQuery.addEventListener('change', () => get()._onSystemChange())
      }
    }
  }

  bindSystemListener(initial.mode)

  return {
    mode: initial.mode,
    resolved: initial.resolved,
    phase: 'idle',
    targetColor: null,

    setMode: (mode) => internalSetMode(mode, { animate: true, persist: true }),

    toggle: () => {
      const next: ResolvedTheme = get().resolved === 'dark' ? 'light' : 'dark'
      internalSetMode(next, { animate: true, persist: true })
    },

    hydrateFromProfile: (mode) => {
      if (mode === get().mode) return
      skipApiOnce = true
      internalSetMode(mode, { animate: true, persist: true })
    },

    _onSystemChange: () => {
      const state = get()
      if (state.mode !== 'system') return
      const nextResolved = systemResolved()
      if (nextResolved === state.resolved) return
      internalSetMode('system', { animate: true, persist: false })
    },
  }
})
