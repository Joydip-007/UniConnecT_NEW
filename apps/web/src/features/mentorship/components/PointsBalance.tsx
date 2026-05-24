import { Sparkles } from 'lucide-react'
import { POINTS_PER_SESSION, POINTS_PER_USD } from '../constants'

interface PointsBalanceProps {
  points: number
}

export function PointsBalance({ points }: PointsBalanceProps) {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 'var(--r-pill)',
          background: 'var(--uc-orange-bg)',
          border: '0.5px solid var(--uc-orange-bdr, var(--border-default))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--uc-orange-l)',
          flexShrink: 0,
        }}
      >
        <Sparkles size={20} strokeWidth={1.5} />
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <p
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 500,
            color: 'var(--text-primary)',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.3,
          }}
        >
          {points.toLocaleString()} points
        </p>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 400,
            color: 'var(--text-tertiary)',
            lineHeight: 1.4,
          }}
        >
          {points === 0
            ? `Complete a session to earn your first ${POINTS_PER_SESSION} pts`
            : `Worth ~$${(points / POINTS_PER_USD).toFixed(2)} · earn ${POINTS_PER_SESSION} pts per session`}
        </p>
      </div>
    </div>
  )
}
