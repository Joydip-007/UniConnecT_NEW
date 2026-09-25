import { create } from 'zustand'

export interface RedirectNotice {
  id: number
  message: string
}

interface RedirectNoticeState {
  notice: RedirectNotice | null
  show: (message: string) => void
  dismiss: () => void
}

const NOTICE_TTL_MS = 6000
let timer: ReturnType<typeof setTimeout> | null = null
let nextId = 1

/**
 * One notice at a time: a route guard can fire twice for the same redirect (StrictMode
 * effects, a guard nested in a guard), and a stack of identical pills reads as a bug.
 */
export const useRedirectNoticeStore = create<RedirectNoticeState>((set, get) => ({
  notice: null,
  show: (message) => {
    if (timer) clearTimeout(timer)
    const current = get().notice
    if (current?.message !== message) set({ notice: { id: nextId++, message } })
    timer = setTimeout(() => get().dismiss(), NOTICE_TTL_MS)
  },
  dismiss: () => {
    if (timer) clearTimeout(timer)
    timer = null
    set({ notice: null })
  },
}))
