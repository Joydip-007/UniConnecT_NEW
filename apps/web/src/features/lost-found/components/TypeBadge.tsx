import { TYPE_TONES } from '../constants'
import type { LostFoundType } from '../types'

export function TypeBadge({ type }: { type: LostFoundType }) {
  const tone = TYPE_TONES[type]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 10px',
        borderRadius: 'var(--r-pill)',
        fontSize: 12,
        fontWeight: 500,
        background: tone.bg,
        border: `0.5px solid ${tone.bdr}`,
        color: tone.fg,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {tone.label}
    </span>
  )
}
