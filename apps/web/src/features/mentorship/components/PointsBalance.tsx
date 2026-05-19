import { Sparkles } from 'lucide-react'
import { POINTS_PER_SESSION, POINTS_PER_USD } from '../constants'

interface PointsBalanceProps {
  points: number
}

export function PointsBalance({ points }: PointsBalanceProps) {
  const equivalentUsd = points / POINTS_PER_USD

  return (
    <div
      style={{
        background:
          'linear-gradient(135deg, var(--uc-orange-bg) 0%, var(--uc-indigo-bg) 100%)',
        border: '0.5px solid var(--uc-orange-bdr)',
        borderRadius: 'var(--r-lg)',
        padding: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 'var(--r-md)',
          background: 'var(--surface-card)',
          border: '0.5px solid var(--uc-orange-bdr)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--uc-orange-l)',
          flexShrink: 0,
        }}
      >
        <Sparkles size={22} strokeWidth={1.5} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--text-secondary)',
            textTransform: 'none',
            letterSpacing: 0,
          }}
        >
          Available points
        </p>
        <p
          style={{
            margin: '4px 0 2px',
            fontSize: 28,
            fontWeight: 500,
            color: 'var(--text-primary)',
            lineHeight: 1.1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {points.toLocaleString()}
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
          Worth roughly ${equivalentUsd.toFixed(2)} · earn {POINTS_PER_SESSION} per completed session
        </p>
      </div>
    </div>
  )
}
