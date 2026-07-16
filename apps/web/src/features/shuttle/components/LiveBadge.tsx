import { isLive } from '../utils'

export function LiveBadge({ updatedAt }: { updatedAt: string | null }) {
  const live = updatedAt ? isLive(updatedAt) : false
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 9px',
        borderRadius: 'var(--r-pill)',
        fontSize: 12,
        fontWeight: 500,
        flexShrink: 0,
        background: live ? 'var(--uc-mint-bg)' : 'var(--surface-raised)',
        border: `0.5px solid ${live ? 'var(--uc-mint-bdr)' : 'var(--border-default)'}`,
        color: live ? 'var(--uc-mint)' : 'var(--text-tertiary)',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: live ? 'var(--uc-mint)' : 'var(--text-tertiary)',
          animation: live ? 'livePulse 1.5s ease-in-out infinite' : 'none',
        }}
      />
      {live ? 'Live' : 'Offline'}
    </span>
  )
}
