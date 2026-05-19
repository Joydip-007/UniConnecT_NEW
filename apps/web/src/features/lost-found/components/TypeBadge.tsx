import type { LostFoundType } from '../types'

export function TypeBadge({ type }: { type: LostFoundType }) {
  const lost = type === 'lost'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 'var(--r-pill)',
        fontSize: 11,
        fontWeight: 500,
        background: lost ? 'var(--uc-orange-bg)' : 'var(--uc-cyan-bg)',
        border: `0.5px solid ${lost ? 'var(--uc-orange-bdr)' : 'var(--uc-cyan-bdr)'}`,
        color: lost ? 'var(--uc-orange-l)' : 'var(--uc-cyan)',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {lost ? 'Lost' : 'Found'}
    </span>
  )
}
