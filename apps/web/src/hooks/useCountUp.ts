import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

/** Animates 0 → target once (ease-out) the first time target becomes > 0.
    Returns target directly under reduced motion. */
export function useCountUp(target: number, durationMs = 300): number {
  const reduced = useReducedMotion()
  const [value, setValue] = useState(0)
  const played = useRef(false)

  useEffect(() => {
    if (target <= 0) {
      setValue(target < 0 ? target : 0)
      return
    }
    if (reduced || played.current) {
      setValue(target)
      return
    }
    played.current = true
    const start = performance.now()
    let raf = 0
    function tick(now: number) {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(eased * target))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs, reduced])

  return value
}
