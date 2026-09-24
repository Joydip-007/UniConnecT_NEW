import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  label: string
  /** Opens this section's in-page "See all" view. */
  onSeeAll?: () => void
  seeAllLabel?: string
  /** Hide the whole section (header included) instead of rendering an empty-state sentence. */
  isEmpty?: boolean
  /** 'scroll' (default) is a horizontal card carousel; 'list' is a dense vertical stack. */
  layout?: 'scroll' | 'list'
  children: ReactNode
}

const FADE = 40

function maskFor(atStart: boolean, atEnd: boolean): string {
  if (atStart && atEnd) return 'none'
  if (atStart) return `linear-gradient(to right, black calc(100% - ${FADE}px), transparent 100%)`
  if (atEnd) return `linear-gradient(to right, transparent 0, black ${FADE}px)`
  return `linear-gradient(to right, transparent 0, black ${FADE}px, black calc(100% - ${FADE}px), transparent 100%)`
}

function arrowStyle(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute',
    [side]: side === 'left' ? -10 : -6,
    top: '50%',
    transform: 'translateY(-50%)',
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: 'var(--surface-raised)',
    border: '0.5px solid var(--border-hover)',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
  }
}

/** Horizontal rail with edge fades that track scroll position and hover arrows. */
function Carousel({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ atStart: true, atEnd: true })

  const measure = useCallback(() => {
    const el = ref.current
    if (!el) return
    const atStart = el.scrollLeft <= 1
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1
    setPos((p) => (p.atStart === atStart && p.atEnd === atEnd ? p : { atStart, atEnd }))
  }, [])

  useEffect(() => {
    measure()
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure, children])

  const page = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * 480, behavior: 'smooth' })
  const mask = maskFor(pos.atStart, pos.atEnd)

  return (
    <div className="car-wrap" style={{ position: 'relative' }}>
      <div
        ref={ref}
        className="hide-bar"
        onScroll={measure}
        aria-label={label}
        role="region"
        style={{
          display: 'flex',
          gap: 10,
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          paddingBottom: 4,
          maskImage: mask,
          WebkitMaskImage: mask,
        }}
      >
        {children}
      </div>
      {!pos.atStart && (
        <button type="button" className="car-arrow" aria-label={`Scroll ${label} left`} onClick={() => page(-1)} style={arrowStyle('left')}>
          <ChevronLeft size={14} aria-hidden="true" />
        </button>
      )}
      {!pos.atEnd && (
        <button type="button" className="car-arrow" aria-label={`Scroll ${label} right`} onClick={() => page(1)} style={arrowStyle('right')}>
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

export function DiscoverySection({ label, onSeeAll, seeAllLabel = 'See all', isEmpty = false, layout = 'scroll', children }: Props) {
  if (isEmpty) return null

  return (
    <section style={{ marginBottom: 28 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <h2
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--text-secondary)',
            margin: 0,
          }}
        >
          {label}
        </h2>
        {onSeeAll && (
          <button
            type="button"
            onClick={onSeeAll}
            style={{
              fontSize: 12,
              color: 'var(--uc-indigo-xl)',
              fontWeight: 500,
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
            }}
          >
            {seeAllLabel}
          </button>
        )}
      </div>
      {layout === 'list' ? (
        <div style={{ display: 'flex', flexDirection: 'column' }}>{children}</div>
      ) : (
        <Carousel label={label}>{children}</Carousel>
      )}
    </section>
  )
}
