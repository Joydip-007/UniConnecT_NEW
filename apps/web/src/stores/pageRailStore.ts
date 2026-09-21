import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { create } from 'zustand'

interface PageRailState {
  /** Replaces the fixed nav + contextual zone + tools; the profile card stays. */
  leftOverride: ReactNode | null
  /** Replaces the manifest widgets entirely. */
  rightOverride: ReactNode | null
  setLeftOverride: (node: ReactNode | null) => void
  setRightOverride: (node: ReactNode | null) => void
}

export const usePageRailStore = create<PageRailState>((set) => ({
  leftOverride: null,
  rightOverride: null,
  setLeftOverride: (node) => set({ leftOverride: node }),
  setRightOverride: (node) => set({ rightOverride: node }),
}))

/** Mount-scoped: sets the override on mount, clears it on unmount. */
export function usePageRails(left: ReactNode | null, right: ReactNode | null) {
  const setLeft = usePageRailStore((s) => s.setLeftOverride)
  const setRight = usePageRailStore((s) => s.setRightOverride)

  useEffect(() => {
    setLeft(left)
    setRight(right)
  }, [left, right, setLeft, setRight])

  useEffect(() => {
    return () => {
      setLeft(null)
      setRight(null)
    }
  }, [setLeft, setRight])
}
