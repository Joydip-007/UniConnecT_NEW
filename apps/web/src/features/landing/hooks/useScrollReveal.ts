import { useEffect, useRef } from 'react'

function supportsViewTimeline() {
  return typeof CSS !== 'undefined' && CSS.supports('animation-timeline: view()')
}

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useScrollReveal<T extends HTMLElement = HTMLElement>(threshold = 0.08) {
  const ref = useRef<T>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return

    const targets = Array.from(root.querySelectorAll<HTMLElement>('.reveal'))
    if (targets.length === 0) return

    root.dataset.revealReady = 'true'

    if (prefersReducedMotion()) {
      root.dataset.revealMode = 'reduced'
      targets.forEach((target) => target.classList.add('is-revealed'))
      return
    }

    if (supportsViewTimeline()) {
      root.dataset.revealMode = 'timeline'
      return
    }

    root.dataset.revealMode = 'observer'

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const target = entry.target as HTMLElement
          const delay = target.dataset.delay ?? '0'
          target.style.transitionDelay = `${delay}ms`
          target.classList.add('is-revealed')
          observer.unobserve(target)
        })
      },
      { threshold },
    )

    targets.forEach((target) => observer.observe(target))

    return () => observer.disconnect()
  }, [threshold])

  return ref
}
