import { useEffect, useRef } from 'react'

export function useScrollReveal<T extends HTMLElement = HTMLElement>(threshold = 0.08) {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const targets = el.querySelectorAll<HTMLElement>('.reveal')

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return
          const delay = e.target.getAttribute('data-delay') ?? '0'
          ;(e.target as HTMLElement).style.transitionDelay = delay + 'ms'
          e.target.classList.add('revealed')
          obs.unobserve(e.target)
        })
      },
      { threshold },
    )

    targets.forEach((t) => obs.observe(t))
    return () => obs.disconnect()
  }, [threshold])

  return ref
}
