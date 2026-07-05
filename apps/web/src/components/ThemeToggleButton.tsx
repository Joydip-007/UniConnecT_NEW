import { useState, useEffect, type CSSProperties } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'

interface ThemeToggleButtonProps {
  size?: number
  className?: string
}

/** WCAG 2.5.5 / PRODUCT.md floor for touch targets. */
const MIN_TAP = 44

export function ThemeToggleButton({ size = 36, className }: ThemeToggleButtonProps) {
  const resolved = useThemeStore((s) => s.resolved)
  const toggle = useThemeStore((s) => s.toggle)
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)
  const [coarse, setCoarse] = useState(false)

  // On touch (coarse) pointers, grow the hit area to 44px while the visible
  // chip stays `size`. Fine pointers (mouse) keep the compact footprint, so
  // desktop nav density is unchanged.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(pointer: coarse)')
    const update = () => setCoarse(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const tap = Math.max(size, coarse ? MIN_TAP : 40)
  const scale = pressed ? 0.96 : hovered ? 1.04 : 1

  const hitStyle: CSSProperties = {
    width: tap,
    height: tap,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    flexShrink: 0,
  }

  const circleStyle: CSSProperties = {
    width: size,
    height: size,
    borderRadius: 'var(--r-pill)',
    background: hovered ? 'var(--surface-hover)' : 'var(--surface-raised)',
    color: 'var(--text-primary)',
    border: '0.5px solid var(--border-default)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transform: `scale(${scale})`,
    transition:
      'background 180ms var(--ease-out-strong), transform 120ms var(--ease-out-strong), color 180ms var(--ease-out-strong)',
    flexShrink: 0,
  }

  const Icon = resolved === 'dark' ? Sun : Moon
  const label = resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'

  return (
    <button
      type="button"
      className={className}
      onClick={toggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false) }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      aria-label={label}
      aria-pressed={resolved === 'dark'}
      style={hitStyle}
    >
      <span aria-hidden="true" style={circleStyle}>
        <Icon size={16} strokeWidth={1.75} />
      </span>
    </button>
  )
}
