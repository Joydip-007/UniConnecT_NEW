import { useEffect, useState, type RefObject } from 'react'

/** True once the referenced element has entered the viewport; stays true after. */
export function useInViewOnce<T extends Element>(ref: RefObject<T | null>, threshold = 0.2) {
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node || inView) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { threshold },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [ref, threshold, inView])

  return inView
}
