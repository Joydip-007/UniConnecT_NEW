import { Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { controlButton } from './StudyToolsStyles'

export function PanelHeader({ title, icon, actionLabel, onAction, meta }: {
  title: string
  icon: ReactNode
  actionLabel: string
  onAction: () => void
  meta?: ReactNode
}) {
  return (
    <div style={{ minHeight: 58, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <div style={{ minWidth: 0, display: 'grid', gap: 3 }}>
        <h3 style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', textWrap: 'balance' }}>{icon}{title}</h3>
        {meta}
      </div>
      <button type="button" onClick={onAction} style={controlButton}><Plus size={14} />{actionLabel}</button>
    </div>
  )
}

export function EmptyState({ title, actionLabel, onAction }: { title: string; actionLabel: string; onAction: () => void }) {
  return (
    <div style={{ minHeight: 150, padding: 16, borderTop: '0.5px solid var(--border-default)', display: 'grid', placeItems: 'center', gap: 10, textAlign: 'center' }}>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', textWrap: 'balance' }}>{title}</p>
      <button type="button" onClick={onAction} style={controlButton}><Plus size={14} />{actionLabel}</button>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ minHeight: 130, padding: 16, borderTop: '0.5px solid var(--border-default)', display: 'grid', placeItems: 'center', gap: 10, textAlign: 'center' }}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', textWrap: 'pretty' }}>{message}</p>
      <button type="button" onClick={onRetry} style={controlButton}>Retry</button>
    </div>
  )
}

export function AcademicOnlyNotice({ message, subtitle, icon }: { message: string; subtitle?: string; icon: string }) {
  return (
    <div style={{ minHeight: 130, padding: 16, display: 'grid', placeItems: 'center', gap: 6, textAlign: 'center' }}>
      <span style={{ fontSize: 32 }}>{icon}</span>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)', textWrap: 'pretty' }}>{message}</p>
      {subtitle && (
        <p style={{ margin: 0, fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)', textWrap: 'pretty' }}>{subtitle}</p>
      )}
    </div>
  )
}

export function ListSkeleton({ rows }: { rows: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} style={{ height: 68, padding: 12, borderTop: index === 0 ? '0.5px solid var(--border-default)' : '0.5px solid var(--border-default)' }}>
          <div style={{ height: 14, width: '54%', marginBottom: 8, borderRadius: 'var(--r-sm)', background: 'var(--surface-raised)' }} />
          <div style={{ height: 12, width: '34%', borderRadius: 'var(--r-sm)', background: 'var(--surface-raised)' }} />
        </div>
      ))}
    </>
  )
}
