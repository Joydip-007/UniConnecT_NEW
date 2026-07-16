import type { ReactNode } from 'react'

interface StatBoxProps {
  icon: ReactNode
  label: string
  value: string
}

export function StatBox({ icon, label, value }: StatBoxProps) {
  return (
    <div
      style={{
        background: 'var(--surface-raised)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-md)',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {icon}
        <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>{label}</span>
      </div>
      <span
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </span>
    </div>
  )
}
