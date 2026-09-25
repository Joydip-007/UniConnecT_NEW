import { useEffect } from 'react'
import { create } from 'zustand'

interface ShellState {
  /** Mounted error/not-found surfaces asking the shell to drop both rails. */
  bareCount: number
  acquireBare: () => void
  releaseBare: () => void
}

export const useShellStore = create<ShellState>((set) => ({
  bareCount: 0,
  acquireBare: () => set((s) => ({ bareCount: s.bareCount + 1 })),
  releaseBare: () => set((s) => ({ bareCount: Math.max(0, s.bareCount - 1) })),
}))

/**
 * While mounted (and `active`), FeedLayout renders only the top nav and a single
 * 560px centre column — the error-state layout. A counter rather than a flag, so two
 * surfaces mounting and unmounting out of order never leave the rails hidden.
 */
export function useBareShell(active = true) {
  const acquire = useShellStore((s) => s.acquireBare)
  const release = useShellStore((s) => s.releaseBare)

  useEffect(() => {
    if (!active) return
    acquire()
    return release
  }, [active, acquire, release])
}
