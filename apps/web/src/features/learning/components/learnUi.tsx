import type { ReactNode } from 'react'
import { ArrowLeft, X } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { TONE_STYLE, type StatusTone } from '../pathFilters'

/** The status pill shared by path cards, the path dialog and quiz rows. */
export function StatusPill({ tone, children, size = 12 }: { tone: StatusTone; children: ReactNode; size?: number }) {
  return (
    <span
      style={{
        fontSize: size,
        fontWeight: 500,
        borderRadius: 'var(--r-pill)',
        padding: '2px 8px',
        flexShrink: 0,
        whiteSpace: 'nowrap',
        ...TONE_STYLE[tone],
      }}
    >
      {children}
    </span>
  )
}

export function RoundIconButton({
  label,
  onClick,
  outlined = false,
  size = 32,
  children,
}: {
  label: string
  onClick: () => void
  outlined?: boolean
  size?: number
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="interactive-surface"
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: outlined ? '0.5px solid var(--border-default)' : 'none',
        borderRadius: '50%',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

/** Filter chip used by the paths grid and the badges view. */
export function FilterChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      style={{
        flexShrink: 0,
        minHeight: 32,
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0 12px',
        borderRadius: 'var(--r-pill)',
        background: on ? 'var(--uc-indigo-bg)' : 'var(--surface-card)',
        border: `0.5px solid ${on ? 'var(--uc-indigo-bdr)' : 'var(--border-default)'}`,
        fontSize: 12,
        fontWeight: 500,
        color: on ? 'var(--uc-indigo-l)' : 'var(--text-secondary)',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

/** A thin progress track. */
export function ProgressBar({ pct, color = 'var(--uc-indigo)' }: { pct: number; color?: string }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{ height: 4, borderRadius: 'var(--r-pill)', background: 'var(--border-default)', overflow: 'hidden' }}
    >
      <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 150ms linear' }} />
    </div>
  )
}

interface LearnDialogProps {
  label: string
  title: string
  sub?: string
  onClose: () => void
  onBack?: () => void
  headerAction?: ReactNode
  /** Rendered between the header and the scroll body (the results stat strip). */
  strip?: ReactNode
  footer?: ReactNode
  children: ReactNode
}

/**
 * The Learn dialogs' shared frame (path detail, quiz, past results, daily answers): header
 * with optional back, a scrolling body and a pinned footer, on a raised 560px panel.
 */
export function LearnDialog({ label, title, sub, onClose, onBack, headerAction, strip, footer, children }: LearnDialogProps) {
  return (
    <Modal isOpen onClose={onClose} title={label} frame="panel" panelSurface="raised" sheet>
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '14px 16px',
          borderBottom: '0.5px solid var(--border-default)',
        }}
      >
        {onBack && (
          <RoundIconButton label="Back" onClick={onBack}>
            <ArrowLeft size={16} />
          </RoundIconButton>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>{title}</h3>
          {sub && <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>{sub}</p>}
        </div>
        {headerAction}
        <RoundIconButton label="Close" onClick={onClose}>
          <X size={16} />
        </RoundIconButton>
      </div>
      {strip}
      <div
        className="rail-scroll"
        style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        {children}
      </div>
      {footer && (
        <div
          style={{
            flexShrink: 0,
            padding: '12px 16px',
            borderTop: '0.5px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          {footer}
        </div>
      )}
    </Modal>
  )
}
