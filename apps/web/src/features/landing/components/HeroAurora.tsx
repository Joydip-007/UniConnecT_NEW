import { useEffect, useRef, type RefObject } from 'react'

interface HeroAuroraProps {
  hostRef: RefObject<HTMLElement | null>
  active: boolean
}

/** Ambient orbs + a cursor-following spotlight behind the hero content. Renders nothing when motion is disabled. */
export function HeroAurora({ hostRef, active }: HeroAuroraProps) {
  const spotRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    const spot = spotRef.current
    if (!host || !spot || !active) return

    function handleMove(event: PointerEvent) {
      const rect = host!.getBoundingClientRect()
      spot!.style.left = `${event.clientX - rect.left}px`
      spot!.style.top = `${event.clientY - rect.top}px`
      spot!.style.opacity = '0.35'
    }

    function handleLeave() {
      spot!.style.opacity = '0'
    }

    host.addEventListener('pointermove', handleMove)
    host.addEventListener('pointerleave', handleLeave)
    return () => {
      host.removeEventListener('pointermove', handleMove)
      host.removeEventListener('pointerleave', handleLeave)
    }
  }, [hostRef, active])

  if (!active) return null

  return (
    <div className="uc-hero-aurora" aria-hidden="true">
      <div className="uc-hero-aurora-orb uc-hero-aurora-orb-a" />
      <div className="uc-hero-aurora-orb uc-hero-aurora-orb-b" />
      <div ref={spotRef} className="uc-hero-aurora-spotlight" />
    </div>
  )
}
