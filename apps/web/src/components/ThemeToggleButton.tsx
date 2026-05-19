import { useState, type CSSProperties } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'

interface ThemeToggleButtonProps {
  size?: number
  className?: string
}

export function ThemeToggleButton({ size = 36, className }: ThemeToggleButtonProps) {
  const resolved = useThemeStore((s) => s.resolved)
  const toggle = useThemeStore((s) => s.toggle)
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)

  const scale = pressed ? 0.96 : hovered ? 1.04 : 1

  const style: CSSProperties = {
    width: size,
    height: size,
    borderRadius: 'var(--r-pill)',
    background: hovered ? 'var(--surface-hover)' : 'var(--surface-raised)',
    color: 'var(--text-primary)',
    border: '0.5px solid var(--border-default)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
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
      style={style}
    >
      <Icon size={16} strokeWidth={1.75} />
    </button>
  )
}
