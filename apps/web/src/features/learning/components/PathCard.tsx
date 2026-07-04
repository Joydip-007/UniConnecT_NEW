import { Award } from 'lucide-react'
import type { LearningPath } from '../types'

interface PathCardProps {
  path: LearningPath
  onOpen: (id: string) => void
}

const STATUS_LABEL: Record<'active' | 'completed', string> = {
  active: 'In progress',
  completed: 'Completed',
}

export function PathCard({ path, onOpen }: PathCardProps) {
  const status = path.myEnrollmentStatus === 'active' || path.myEnrollmentStatus === 'completed'
    ? path.myEnrollmentStatus
    : null

  return (
    <button
      type="button"
      onClick={() => onOpen(path.id)}
      className="press-feedback interactive-surface"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 8,
        width: '100%',
        textAlign: 'left',
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: 16,
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{path.title}</span>
        {status && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: status === 'completed' ? 'var(--uc-mint)' : 'var(--uc-indigo-l)',
              background: status === 'completed' ? 'var(--uc-mint-bg)' : 'var(--uc-indigo-bg)',
              border: `0.5px solid ${status === 'completed' ? 'var(--uc-mint-bdr)' : 'var(--uc-indigo-bdr)'}`,
              borderRadius: 'var(--r-pill)',
              padding: '2px 8px',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            {STATUS_LABEL[status]}
          </span>
        )}
      </div>

      {path.description && (
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 400,
            color: 'var(--text-secondary)',
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {path.description}
        </p>
      )}

      <p style={{ margin: 0, fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>
        {path.unitCount} units · ~{path.estimated_days} days · {path.difficulty}
      </p>

      {path.badge_name && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 400, color: 'var(--uc-amber-l)' }}>
          <Award size={13} aria-hidden="true" />
          <span>{path.badge_name}</span>
        </div>
      )}
    </button>
  )
}
