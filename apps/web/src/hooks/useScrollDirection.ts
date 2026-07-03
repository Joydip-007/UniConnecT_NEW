import { useEffect, useRef, useState } from 'react'

/** 'down' once the user scrolls down past `threshold`; 'up' on any upward
    scroll or near the page top. Drives the TopNav hide/reveal. */
export function useScrollDirection(threshold = 64): 'up' | 'down' {
  const [direction, setDirection] = useState<'up' | 'down'>('up')
  const lastY = useRef(0)

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY
      if (y <= threshold) {
        setDirection('up')
      } else if (y > lastY.current) {
        setDirection('down')
      } else if (y < lastY.current) {
        setDirection('up')
      }
      lastY.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])

  return direction
}
