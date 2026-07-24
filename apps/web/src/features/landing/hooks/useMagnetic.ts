import { useEffect, useRef } from 'react'

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Subtle cursor-follow effect for the wrapper element the returned ref is attached to. */
export function useMagnetic<T extends HTMLElement = HTMLDivElement>(strengthX = 0.16, strengthY = 0.28) {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return

    function handleMove(event: PointerEvent) {
      const rect = el!.getBoundingClientRect()
      const dx = (event.clientX - rect.left - rect.width / 2) * strengthX
      const dy = (event.clientY - rect.top - rect.height / 2) * strengthY
      el!.style.transition = 'transform 150ms ease-out'
      el!.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`
    }

    function handleLeave() {
      el!.style.transition = 'transform 350ms cubic-bezier(.22,1,.36,1)'
      el!.style.transform = 'none'
    }

    el.addEventListener('pointermove', handleMove)
    el.addEventListener('pointerleave', handleLeave)
    return () => {
      el.removeEventListener('pointermove', handleMove)
      el.removeEventListener('pointerleave', handleLeave)
    }
  }, [strengthX, strengthY])

  return ref
}
