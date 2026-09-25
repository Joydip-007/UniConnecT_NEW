import type { ReactNode } from 'react'

interface StatBoxProps {
  icon: ReactNode
  label: string
  value: string
}

export function StatBox({ icon, label, value }: StatBoxProps) {
  return (
    <div className="shuttle-stat">
      <span className="shuttle-stat-label">
        <span className="shuttle-stat-icon">{icon}</span>
        {label}
      </span>
      <span className="shuttle-stat-value">{value}</span>
    </div>
  )
}
