import { useEffect, useState } from 'react'

const OFFSET_PX = 140

export function useScrollSpy(sectionIds: readonly string[]) {
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    function determineActive() {
      let active: string | null = null
      for (const id of sectionIds) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= OFFSET_PX) {
          active = id
        }
      }
      setActiveId(active)
    }

    determineActive()
    window.addEventListener('scroll', determineActive, { passive: true })
    return () => window.removeEventListener('scroll', determineActive)
  }, [sectionIds])

  return activeId
}
