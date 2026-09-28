import { Award, CalendarCheck } from 'lucide-react'
import type { LearningPath } from '../types'
import { PATH_STATUS_META, pathStatus } from '../pathFilters'
import { ProgressBar, StatusPill } from './learnUi'
import { pathMeta } from '../learnFormat'

interface PathCardProps {
  path: LearningPath
  onOpen: (id: string) => void
  /** Units on today's plan for this path that are still to do. */
  todayLeft?: number
  /** Phone layout: no description or badge line, tighter type. */
  compact?: boolean
}

export function PathCard({ path, onOpen, todayLeft = 0, compact = false }: PathCardProps) {
  const status = pathStatus(path.myEnrollmentStatus)
  const meta = PATH_STATUS_META[status]
  const showProgress = status === 'active' && path.unitCount > 0

  return (
    <button
      type="button"
      onClick={() => onOpen(path.id)}
      className="press-feedback interactive-surface"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: compact ? 6 : 8,
        width: '100%',
        textAlign: 'left',
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: compact ? 14 : 16,
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 8 }}>
        <span style={{ fontSize: compact ? 13 : 14, fontWeight: 500, color: 'var(--text-primary)' }}>{path.title}</span>
        <StatusPill tone={meta.tone} size={compact ? 11 : 12}>
          {meta.label}
        </StatusPill>
      </div>

      {!compact && path.description && (
        <p
          style={{
            margin: 0,
            fontSize: 13,
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

      <p style={{ margin: 0, fontSize: 12, color: compact ? 'var(--text-secondary)' : 'var(--text-tertiary)', lineHeight: 1.4 }}>
        {pathMeta(path)}
      </p>

      {showProgress && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: compact ? 5 : 6 }}>
          <ProgressBar pct={Math.round((100 * path.completedUnitCount) / path.unitCount)} />
          <span style={{ fontSize: compact ? 11 : 12, color: 'var(--text-tertiary)' }}>
            {path.completedUnitCount} of {path.unitCount} units
            {path.nextUnitTitle ? ` · next: ${path.nextUnitTitle}` : ''}
          </span>
          {todayLeft > 0 && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: compact ? 11 : 12,
                fontWeight: 500,
                color: 'var(--uc-orange-l)',
              }}
            >
              <CalendarCheck size={13} aria-hidden="true" />
              {todayLeft} left today
            </span>
          )}
        </div>
      )}

      {!compact && path.badge_name && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--uc-amber-l)' }}>
          <Award size={13} aria-hidden="true" />
          <span>{path.badge_name}</span>
        </div>
      )}
    </button>
  )
}
