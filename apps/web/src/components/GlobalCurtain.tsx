import { useThemeStore } from '@/stores/themeStore'

const EASING = 'cubic-bezier(0.76, 0, 0.24, 1)'
const DURATION_MS = 550

export function GlobalCurtain() {
  const phase = useThemeStore((s) => s.phase)
  const targetColor = useThemeStore((s) => s.targetColor)

  const isFalling = phase === 'falling'
  const isAnimating = phase !== 'idle'

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9997,
        pointerEvents: 'none',
        background: targetColor ?? 'transparent',
        transformOrigin: 'top',
        transform: isFalling ? 'scaleY(1)' : 'scaleY(0)',
        transition: isAnimating ? `transform ${DURATION_MS}ms ${EASING}` : 'none',
      }}
    />
  )
}
