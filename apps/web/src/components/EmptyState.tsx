import type { LucideIcon } from 'lucide-react'
import { PrimaryBtn } from '@/components/Button'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: '48px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        textAlign: 'center',
      }}
    >
      <Icon
        size={32}
        strokeWidth={1.5}
        style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}
      />
      <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
        {title}
      </p>
      {description && (
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 400,
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            maxWidth: 340,
          }}
        >
          {description}
        </p>
      )}
      {action && (
        <div style={{ marginTop: 6 }}>
          <PrimaryBtn onClick={action.onClick}>{action.label}</PrimaryBtn>
        </div>
      )}
    </div>
  )
}
