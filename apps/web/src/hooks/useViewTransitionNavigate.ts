import { useCallback } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate } from 'react-router-dom'

/** Navigate wrapped in a View Transition (cross-fade) where supported.
    Falls back to plain navigate. Respects prefers-reduced-motion. */
export function useViewTransitionNavigate(): (to: string) => void {
  const navigate = useNavigate()
  return useCallback(
    (to: string) => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const doc = document as Document & {
        startViewTransition?: (cb: () => void) => void
      }
      if (!doc.startViewTransition || reduced) {
        navigate(to)
        return
      }
      doc.startViewTransition(() => {
        flushSync(() => navigate(to))
      })
    },
    [navigate],
  )
}
