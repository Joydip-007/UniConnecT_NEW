import { useEffect, useRef } from 'react'

const MAX_DEG = 5

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Subtle pointer-driven 3D tilt on the direct children of the returned ref. */
export function useTiltGroup<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    const grid = ref.current
    if (!grid || prefersReducedMotion()) return

    const cards = Array.from(grid.children) as HTMLElement[]
    const cleanups: Array<() => void> = []

    cards.forEach((card) => {
      function handleMove(event: PointerEvent) {
        const rect = card.getBoundingClientRect()
        const rx = ((event.clientY - rect.top) / rect.height - 0.5) * -MAX_DEG
        const ry = ((event.clientX - rect.left) / rect.width - 0.5) * MAX_DEG
        card.style.transition = 'transform 130ms ease-out'
        card.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-2px)`
      }

      function handleLeave() {
        card.style.transition = 'transform 450ms cubic-bezier(.22,1,.36,1)'
        card.style.transform = 'none'
      }

      card.addEventListener('pointermove', handleMove)
      card.addEventListener('pointerleave', handleLeave)
      cleanups.push(() => {
        card.removeEventListener('pointermove', handleMove)
        card.removeEventListener('pointerleave', handleLeave)
      })
    })

    return () => cleanups.forEach((cleanup) => cleanup())
  }, [])

  return ref
}
